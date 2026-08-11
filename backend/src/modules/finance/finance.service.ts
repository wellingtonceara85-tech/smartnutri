import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  computeFinalValue,
  splitIntoInstallments,
} from '../../common/utils/money.util';
import {
  AuditAction,
  ChargeStatus,
  Prisma,
} from '../../generated/prisma/client';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { ChargeStatusFilter, QueryChargesDto } from './dto/query-charges.dto';
import { QueryFinanceSummaryDto } from './dto/query-finance-summary.dto';

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

const CHARGE_INCLUDE = {
  patient: { select: { id: true, fullName: true } },
  treatmentCycle: {
    select: { id: true, plan: { select: { id: true, name: true } } },
  },
  appointment: {
    select: {
      id: true,
      scheduledAt: true,
      appointmentType: { select: { id: true, name: true } },
      standalonePaymentMethod: { select: { id: true, name: true } },
    },
  },
  allocations: {
    where: { payment: { deletedAt: null } },
    include: {
      payment: {
        select: {
          id: true,
          paidAt: true,
          paymentMethod: { select: { id: true, name: true } },
        },
      },
    },
  },
} satisfies Prisma.ChargeInclude;

type ChargeWithIncludes = Prisma.ChargeGetPayload<{
  include: typeof CHARGE_INCLUDE;
}>;

const OPEN_CHARGE_STATUSES: ChargeStatus[] = [
  ChargeStatus.PENDING,
  ChargeStatus.PARTIALLY_PAID,
];

/**
 * Minimal shape needed to gerar cobranças a partir de um TreatmentCycle já
 * criado — evita acoplar o finance module ao payload exato do módulo de
 * contratação (Missão 0006).
 */
interface CycleForCharges {
  id: string;
  tenantId: string;
  patientId: string;
  startDate: Date;
  finalValue: Prisma.Decimal | number | string;
  downPayment: Prisma.Decimal | number | string;
  installmentCount: number;
  plan: { name: string };
}

interface AppointmentForCharge {
  id: string;
  tenantId: string;
  patientId: string;
  scheduledAt: Date;
  standaloneValue: Prisma.Decimal | number | string | null;
  standaloneDiscountValue: Prisma.Decimal | number | string | null;
  standaloneFinalValue: Prisma.Decimal | number | string | null;
}

/**
 * Financeiro (Missão 0006) — nunca é fonte de verdade do contrato: valor/
 * desconto/forma de pagamento continuam vivendo em TreatmentCycle (parcelas)
 * e Appointment (avulsa). O Charge é só o calendário/ledger de cobrança
 * derivado desses dados — regenerado quando a contratação é corrigida,
 * nunca editado diretamente pelo cliente da API.
 *
 * "Vencido" nunca é um status gravado — é sempre calculado (PENDING/
 * PARTIALLY_PAID com dueDate no passado). Evita precisar de um job agendado
 * só para virar status, e mantém ChargeStatus com o mesmo conjunto de
 * valores que já existe no schema desde a migration inicial.
 */
@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // -- Geração a partir da contratação / agenda --------------------------

  /** Chamado dentro da transação de TreatmentCyclesService.create(). */
  async generateChargesForCycle(
    tx: Prisma.TransactionClient,
    cycle: CycleForCharges,
  ): Promise<void> {
    const amounts = this.buildCycleInstallmentAmounts(
      new Decimal(cycle.finalValue),
      new Decimal(cycle.downPayment),
      cycle.installmentCount,
    );

    await tx.charge.createMany({
      data: amounts.map((amount, index) => ({
        tenantId: cycle.tenantId,
        treatmentCycleId: cycle.id,
        patientId: cycle.patientId,
        installmentNumber: index + 1,
        installmentTotal: cycle.installmentCount,
        description: `${cycle.plan.name} — Parcela ${index + 1}/${cycle.installmentCount}`,
        amount,
        dueDate: this.addMonths(cycle.startDate, index),
        status: ChargeStatus.PENDING,
      })),
    });
  }

  /**
   * Correção de valores do ciclo (updateFinancials): parcelas que já têm
   * algum pagamento nunca são tocadas — o saldo recalculado é redistribuído
   * só entre as parcelas ainda 100% pendentes. Se nenhuma parcela tem
   * pagamento, regenera do zero com a nova contagem de parcelas.
   */
  async regenerateFuturePendingCharges(
    tx: Prisma.TransactionClient,
    cycle: CycleForCharges,
  ): Promise<void> {
    const existing = await tx.charge.findMany({
      where: {
        tenantId: cycle.tenantId,
        treatmentCycleId: cycle.id,
        deletedAt: null,
        status: { not: ChargeStatus.CANCELLED },
      },
      include: {
        allocations: { where: { payment: { deletedAt: null } } },
      },
      orderBy: { installmentNumber: 'asc' },
    });

    const touched = existing.filter((c) => c.allocations.length > 0);
    const untouched = existing.filter((c) => c.allocations.length === 0);

    if (touched.length === 0) {
      // Nada foi pago ainda — regenera do zero com os valores novos.
      await tx.charge.deleteMany({
        where: { id: { in: existing.map((c) => c.id) } },
      });
      await this.generateChargesForCycle(tx, cycle);
      return;
    }

    const alreadyCommitted = touched.reduce(
      (sum, c) => sum.plus(new Decimal(c.amount)),
      new Decimal(0),
    );
    const remaining = Decimal.max(
      new Decimal(cycle.finalValue).minus(alreadyCommitted),
      0,
    );

    if (untouched.length === 0) {
      // Todas as parcelas já têm pagamento — não há mais nada a redistribuir
      // sem mexer no que já foi cobrado. A correção fica só nos campos do
      // ciclo em si (contractedValue/discount/finalValue já atualizados).
      return;
    }

    const newAmounts = splitIntoInstallments(remaining, untouched.length);
    await Promise.all(
      untouched.map((charge, index) =>
        tx.charge.update({
          where: { id: charge.id },
          data: { amount: newAmounts[index] },
        }),
      ),
    );
  }

  /** Chamado dentro da transação de AppointmentsService.create() — só quando standaloneValue foi informado. */
  async generateChargeForStandaloneAppointment(
    tx: Prisma.TransactionClient,
    appointment: AppointmentForCharge,
  ): Promise<void> {
    if (appointment.standaloneValue == null) return;

    const finalValue =
      appointment.standaloneFinalValue != null
        ? new Decimal(appointment.standaloneFinalValue)
        : new Decimal(appointment.standaloneValue);
    const discount =
      appointment.standaloneDiscountValue != null
        ? new Decimal(appointment.standaloneValue).minus(finalValue)
        : new Decimal(0);

    await tx.charge.create({
      data: {
        tenantId: appointment.tenantId,
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        installmentNumber: 1,
        installmentTotal: 1,
        description: 'Consulta avulsa',
        amount: new Decimal(appointment.standaloneValue),
        discount: Decimal.max(discount, 0),
        dueDate: appointment.scheduledAt,
        status: ChargeStatus.PENDING,
      },
    });
  }

  /**
   * Reagendamento (Missão 0006): a obrigação de pagamento é da consulta, não
   * do horário — em vez de cancelar e recriar a cobrança, ela só "acompanha"
   * a consulta para o novo horário. Vencimento só muda se ainda estiver em
   * aberto; uma já paga fica como está (já foi liquidada).
   */
  async transferChargeOnReschedule(
    tx: Prisma.TransactionClient,
    tenantId: string,
    fromAppointmentId: string,
    toAppointmentId: string,
    newScheduledAt: Date,
  ): Promise<void> {
    const charge = await tx.charge.findFirst({
      where: { tenantId, appointmentId: fromAppointmentId, deletedAt: null },
    });
    if (!charge) return;

    await tx.charge.update({
      where: { id: charge.id },
      data: {
        appointmentId: toAppointmentId,
        dueDate: OPEN_CHARGE_STATUSES.includes(charge.status)
          ? newScheduledAt
          : undefined,
      },
    });
  }

  // -- Cancelamento --------------------------------------------------------

  /** Chamado quando o ciclo muda para CANCELLED — nunca mexe em parcelas já pagas. */
  async cancelChargesForCycle(
    tx: Prisma.TransactionClient,
    tenantId: string,
    actorUserId: string,
    treatmentCycleId: string,
  ): Promise<void> {
    const result = await tx.charge.updateMany({
      where: {
        tenantId,
        treatmentCycleId,
        status: { in: OPEN_CHARGE_STATUSES },
        deletedAt: null,
      },
      data: {
        status: ChargeStatus.CANCELLED,
        cancelledReason: 'Contratação cancelada',
      },
    });
    if (result.count > 0) {
      await this.audit.log({
        tenantId,
        actorUserId,
        entityType: 'Charge',
        entityId: treatmentCycleId,
        action: AuditAction.CANCEL,
        metadata: { treatmentCycleId, cancelledCount: result.count },
      });
    }
  }

  /** Chamado quando uma consulta avulsa é cancelada. */
  async cancelChargeForAppointment(
    tenantId: string,
    actorUserId: string,
    appointmentId: string,
  ): Promise<void> {
    const charge = await this.prisma.charge.findFirst({
      where: {
        tenantId,
        appointmentId,
        status: { in: OPEN_CHARGE_STATUSES },
        deletedAt: null,
      },
    });
    if (!charge) return;

    await this.prisma.charge.update({
      where: { id: charge.id },
      data: {
        status: ChargeStatus.CANCELLED,
        cancelledReason: 'Consulta cancelada',
      },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'Charge',
      entityId: charge.id,
      action: AuditAction.CANCEL,
      before: { status: charge.status },
      after: { status: ChargeStatus.CANCELLED },
    });
  }

  // -- Pagamento -------------------------------------------------------

  async registerPayment(
    tenantId: string,
    actorUserId: string,
    dto: RegisterPaymentDto,
  ) {
    const charge = await this.prisma.charge.findFirst({
      where: { id: dto.chargeId, tenantId, deletedAt: null },
      include: { allocations: { where: { payment: { deletedAt: null } } } },
    });
    if (!charge) {
      throw new NotFoundException('Cobrança não encontrada');
    }
    if (charge.status === ChargeStatus.CANCELLED) {
      throw new BadRequestException(
        'Esta cobrança foi cancelada e não pode receber pagamento',
      );
    }
    if (charge.status === ChargeStatus.PAID) {
      throw new BadRequestException('Esta cobrança já está totalmente paga');
    }
    await this.assertPaymentMethodInTenant(tenantId, dto.paymentMethodId);

    const finalValue = computeFinalValue(
      charge.amount,
      charge.discount,
      charge.surcharge,
    );
    const alreadyAllocated = charge.allocations.reduce(
      (sum, a) => sum.plus(new Decimal(a.allocatedAmount)),
      new Decimal(0),
    );
    const remaining = finalValue.minus(alreadyAllocated);
    const amount = dto.amount != null ? new Decimal(dto.amount) : remaining;

    if (amount.lte(0)) {
      throw new BadRequestException(
        'Valor do pagamento deve ser maior que zero',
      );
    }
    if (amount.gt(remaining)) {
      throw new BadRequestException(
        `Valor informado (${amount.toFixed(2)}) é maior que o saldo restante da cobrança (${remaining.toFixed(2)})`,
      );
    }

    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    const newAllocated = alreadyAllocated.plus(amount);
    const newStatus = newAllocated.gte(finalValue)
      ? ChargeStatus.PAID
      : ChargeStatus.PARTIALLY_PAID;

    const { payment, updatedCharge } = await this.prisma.$transaction(
      async (tx) => {
        const payment = await tx.payment.create({
          data: {
            tenantId,
            patientId: charge.patientId,
            paymentMethodId: dto.paymentMethodId,
            amount,
            paidAt,
            referenceNote: dto.referenceNote,
            createdByUserId: actorUserId,
          },
        });
        await tx.paymentAllocation.create({
          data: {
            tenantId,
            paymentId: payment.id,
            chargeId: charge.id,
            allocatedAmount: amount,
          },
        });
        const updatedCharge = await tx.charge.update({
          where: { id: charge.id },
          data: { status: newStatus },
        });
        return { payment, updatedCharge };
      },
    );

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'Charge',
      entityId: charge.id,
      action: AuditAction.PAYMENT,
      before: { status: charge.status },
      after: {
        status: updatedCharge.status,
        paymentId: payment.id,
        amount: amount.toFixed(2),
      },
    });

    return payment;
  }

  /** Reverte um pagamento lançado por engano — nunca apaga o registro, só marca como excluído
   * (histórico preservado) e recalcula o status das cobranças afetadas. */
  async voidPayment(
    tenantId: string,
    actorUserId: string,
    paymentId: string,
    reason: string,
  ): Promise<void> {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, tenantId, deletedAt: null },
      include: { allocations: true },
    });
    if (!payment) {
      throw new NotFoundException('Pagamento não encontrado');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { deletedAt: new Date() },
      });

      for (const allocation of payment.allocations) {
        const charge = await tx.charge.findUnique({
          where: { id: allocation.chargeId },
        });
        if (!charge || charge.status === ChargeStatus.CANCELLED) continue;

        const remaining = await tx.paymentAllocation.findMany({
          where: {
            chargeId: charge.id,
            paymentId: { not: payment.id },
            payment: { deletedAt: null },
          },
        });
        const stillAllocated = remaining.reduce(
          (sum, a) => sum.plus(new Decimal(a.allocatedAmount)),
          new Decimal(0),
        );
        const finalValue = computeFinalValue(
          charge.amount,
          charge.discount,
          charge.surcharge,
        );
        const newStatus = stillAllocated.gte(finalValue)
          ? ChargeStatus.PAID
          : stillAllocated.gt(0)
            ? ChargeStatus.PARTIALLY_PAID
            : ChargeStatus.PENDING;

        await tx.charge.update({
          where: { id: charge.id },
          data: { status: newStatus },
        });
      }
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'Payment',
      entityId: payment.id,
      action: AuditAction.REFUND,
      before: { voided: false },
      after: { voided: true },
      metadata: { reason },
    });
  }

  // -- Leitura -----------------------------------------------------------

  async listCharges(tenantId: string, query: QueryChargesDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.ChargeWhereInput = {
      tenantId,
      deletedAt: null,
      patientId: query.patientId,
    };
    const dueDateFilter: Prisma.DateTimeFilter<'Charge'> = {};
    if (query.from) dueDateFilter.gte = new Date(query.from);
    if (query.to) dueDateFilter.lte = new Date(query.to);

    if (query.status === 'OVERDUE') {
      where.status = { in: OPEN_CHARGE_STATUSES };
      dueDateFilter.lt = this.startOfDay(new Date());
    } else if (query.status) {
      where.status = query.status;
    }
    if (Object.keys(dueDateFilter).length > 0) {
      where.dueDate = dueDateFilter;
    }

    const [charges, total] = await this.prisma.$transaction([
      this.prisma.charge.findMany({
        where,
        include: CHARGE_INCLUDE,
        orderBy: { dueDate: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.charge.count({ where }),
    ]);

    return {
      data: charges.map((c) => this.toChargeDto(c)),
      total,
      page,
      pageSize,
    };
  }

  async getChargeById(tenantId: string, id: string) {
    const charge = await this.prisma.charge.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: CHARGE_INCLUDE,
    });
    if (!charge) {
      throw new NotFoundException('Cobrança não encontrada');
    }
    return this.toChargeDto(charge);
  }

  async getSummary(tenantId: string, query: QueryFinanceSummaryDto) {
    const now = new Date();
    const from = query.from ? new Date(query.from) : this.startOfMonth(now);
    const to = query.to
      ? this.endOfDay(new Date(query.to))
      : this.endOfMonth(now);
    const today = this.startOfDay(now);

    const [receivedAgg, openCharges, recentPayments] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { tenantId, deletedAt: null, paidAt: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      this.prisma.charge.findMany({
        where: {
          tenantId,
          deletedAt: null,
          status: { in: OPEN_CHARGE_STATUSES },
        },
        include: {
          patient: { select: { id: true, fullName: true } },
          allocations: { where: { payment: { deletedAt: null } } },
        },
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.payment.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { paidAt: 'desc' },
        take: 8,
        include: {
          patient: { select: { id: true, fullName: true } },
          paymentMethod: { select: { id: true, name: true } },
        },
      }),
    ]);

    let aReceber = new Decimal(0);
    let vencido = new Decimal(0);
    const upcoming: {
      chargeId: string;
      patientName: string;
      dueDate: Date;
      remaining: string;
    }[] = [];

    for (const charge of openCharges) {
      const finalValue = computeFinalValue(
        charge.amount,
        charge.discount,
        charge.surcharge,
      );
      const allocated = charge.allocations.reduce(
        (sum, a) => sum.plus(new Decimal(a.allocatedAmount)),
        new Decimal(0),
      );
      const remaining = finalValue.minus(allocated);
      if (remaining.lte(0)) continue;

      aReceber = aReceber.plus(remaining);
      const isOverdue = charge.dueDate < today;
      if (isOverdue) {
        vencido = vencido.plus(remaining);
      } else {
        upcoming.push({
          chargeId: charge.id,
          patientName: charge.patient.fullName,
          dueDate: charge.dueDate,
          remaining: remaining.toFixed(2),
        });
      }
    }
    upcoming.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    return {
      recebidoNoPeriodo: (receivedAgg._sum.amount ?? new Decimal(0)).toFixed(2),
      aReceber: aReceber.toFixed(2),
      vencido: vencido.toFixed(2),
      proximosRecebimentos: upcoming.slice(0, 5),
      movimentacoesRecentes: recentPayments.map((p) => ({
        id: p.id,
        patientName: p.patient.fullName,
        amount: new Decimal(p.amount).toFixed(2),
        paymentMethodName: p.paymentMethod.name,
        paidAt: p.paidAt,
      })),
    };
  }

  // --------------------------------------------------------------------

  private buildCycleInstallmentAmounts(
    finalValue: Decimal,
    downPayment: Decimal,
    installmentCount: number,
  ): Decimal[] {
    if (downPayment.gt(0) && installmentCount > 1) {
      const remaining = Decimal.max(finalValue.minus(downPayment), 0);
      const rest = splitIntoInstallments(remaining, installmentCount - 1);
      return [downPayment, ...rest];
    }
    return splitIntoInstallments(finalValue, installmentCount);
  }

  private toChargeDto(charge: ChargeWithIncludes) {
    const finalValue = computeFinalValue(
      charge.amount,
      charge.discount,
      charge.surcharge,
    );
    const allocated = charge.allocations.reduce(
      (sum, a) => sum.plus(new Decimal(a.allocatedAmount)),
      new Decimal(0),
    );
    const lastPayment = charge.allocations
      .map((a) => a.payment)
      .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime())[0];
    const isOverdue =
      OPEN_CHARGE_STATUSES.includes(charge.status) &&
      charge.dueDate < this.startOfDay(new Date());

    return {
      id: charge.id,
      patient: charge.patient,
      origin: charge.treatmentCycle
        ? {
            type: 'CYCLE' as const,
            treatmentCycleId: charge.treatmentCycle.id,
            planName: charge.treatmentCycle.plan.name,
          }
        : charge.appointment
          ? {
              type: 'APPOINTMENT' as const,
              appointmentId: charge.appointment.id,
              appointmentTypeName: charge.appointment.appointmentType.name,
            }
          : null,
      installmentNumber: charge.installmentNumber,
      installmentTotal: charge.installmentTotal,
      description: charge.description,
      amount: new Decimal(charge.amount).toFixed(2),
      discount: new Decimal(charge.discount).toFixed(2),
      finalValue: finalValue.toFixed(2),
      remaining: finalValue.minus(allocated).toFixed(2),
      dueDate: charge.dueDate,
      status: charge.status,
      isOverdue,
      paymentId: lastPayment?.id ?? null,
      paymentMethodName:
        lastPayment?.paymentMethod.name ??
        charge.appointment?.standalonePaymentMethod?.name ??
        null,
      paidAt: lastPayment?.paidAt ?? null,
    };
  }

  private async assertPaymentMethodInTenant(
    tenantId: string,
    paymentMethodId: string,
  ) {
    const method = await this.prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, tenantId },
    });
    if (!method) {
      throw new NotFoundException('Forma de pagamento não encontrada');
    }
    return method;
  }

  /** Sempre em UTC: `startDate`/`dueDate` são datas puras (`@db.Date`) — manipular com
   * getMonth/setMonth (hora local) pode "voltar" um dia inteiro se o fuso local estiver
   * atrás de UTC (ex.: 2026-02-01T00:00Z vira 31/jan às 21h em UTC-3). */
  private addMonths(date: Date, months: number): Date {
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth() + months,
        date.getUTCDate(),
      ),
    );
  }

  private startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private endOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private endOfMonth(date: Date): Date {
    return this.endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
  }
}

export type { ChargeStatusFilter };
