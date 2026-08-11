import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  computeDiscountAmount,
  computeFinalValue,
} from '../../common/utils/money.util';
import { FinanceService } from '../finance/finance.service';
import {
  AuditAction,
  CycleStatus,
  Prisma,
} from '../../generated/prisma/client';
import { CreateTreatmentCycleDto } from './dto/create-treatment-cycle.dto';
import { UpdateTreatmentCycleFinancialsDto } from './dto/update-treatment-cycle-financials.dto';
import { UpdateTreatmentCycleStatusDto } from './dto/update-treatment-cycle-status.dto';
import { UpdateTreatmentCycleDto } from './dto/update-treatment-cycle.dto';

/** Financeiro não é editável depois que o ciclo já foi encerrado — evita reescrever
 * retroativamente um contrato que já foi concluído/cancelado. */
const FINANCIALLY_EDITABLE_STATUSES: CycleStatus[] = [
  CycleStatus.DRAFT,
  CycleStatus.ACTIVE,
  CycleStatus.PAUSED,
];

const CYCLE_INCLUDE = {
  plan: {
    select: { id: true, name: true, defaultPrice: true, allowsDiscount: true },
  },
  paymentMethod: { select: { id: true, name: true } },
  createdByUser: { select: { id: true, name: true } },
  _count: { select: { appointments: { where: { deletedAt: null } } } },
} satisfies Prisma.TreatmentCycleInclude;

/** DRAFT nunca é usado pela criação (sempre nasce ACTIVE — seção 2 da Missão 0005.8), mas
 * permanece como alvo de transição válido para uso futuro (ex.: reservas). */
const ALLOWED_CYCLE_TRANSITIONS: Record<CycleStatus, CycleStatus[]> = {
  DRAFT: [CycleStatus.ACTIVE, CycleStatus.CANCELLED],
  ACTIVE: [CycleStatus.PAUSED, CycleStatus.COMPLETED, CycleStatus.CANCELLED],
  PAUSED: [CycleStatus.ACTIVE, CycleStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
  RENEWED: [],
};

@Injectable()
export class TreatmentCyclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly finance: FinanceService,
  ) {}

  async listForPatient(tenantId: string, patientId: string) {
    await this.assertPatientInTenant(tenantId, patientId);
    return this.prisma.treatmentCycle.findMany({
      where: { tenantId, patientId, deletedAt: null },
      include: CYCLE_INCLUDE,
      orderBy: { cycleNumber: 'desc' },
    });
  }

  async getById(tenantId: string, id: string) {
    return this.findOrThrow(tenantId, id);
  }

  async create(
    tenantId: string,
    actorUserId: string,
    patientId: string,
    dto: CreateTreatmentCycleDto,
  ) {
    await this.assertPatientInTenant(tenantId, patientId);

    const plan = await this.prisma.plan.findFirst({
      where: { id: dto.planId, tenantId, deletedAt: null },
    });
    if (!plan) {
      throw new NotFoundException('Plano não encontrado');
    }
    if (!plan.isActive) {
      throw new BadRequestException(
        'Este plano está inativo e não pode ser contratado',
      );
    }

    const discountType = dto.discountType ?? 'FIXED';
    const discountValue = dto.discountValue ?? 0;
    if (discountValue > 0 && !plan.allowsDiscount) {
      throw new BadRequestException('Este plano não permite desconto');
    }
    if (discountType === 'PERCENTAGE' && discountValue > 100) {
      throw new BadRequestException(
        'Desconto percentual não pode passar de 100%',
      );
    }
    if (dto.paymentMethodId) {
      await this.assertPaymentMethodInTenant(tenantId, dto.paymentMethodId);
    }

    const contractedValue = plan.defaultPrice;
    const discount = computeDiscountAmount(
      contractedValue,
      discountType,
      discountValue,
    );
    const finalValue = computeFinalValue(contractedValue, discount, 0);

    const startDate = new Date(dto.startDate);
    const expectedEndDate = this.addMonths(startDate, plan.durationMonths);
    const cycleNumber = await this.nextCycleNumber(tenantId, patientId);

    const downPayment = dto.downPayment ?? 0;
    const installmentCount = dto.installmentCount ?? plan.defaultInstallments;

    const created = await this.prisma.$transaction(async (tx) => {
      const created = await tx.treatmentCycle.create({
        data: {
          tenantId,
          patientId,
          planId: plan.id,
          cycleNumber,
          status: CycleStatus.ACTIVE,
          startDate,
          expectedEndDate,
          appointmentCountPlanned: plan.suggestedAppointments,
          intervalDaysPlanned: plan.suggestedIntervalDays,
          contractedValue,
          discountType,
          discountValue,
          discount,
          finalValue,
          downPayment,
          installmentCount,
          paymentMethodId: dto.paymentMethodId,
          notes: dto.notes,
          createdByUserId: actorUserId,
        },
        include: CYCLE_INCLUDE,
      });

      // Financeiro (Missão 0006): gera o calendário de parcelas a partir do
      // valor já contratado aqui — nunca pede o mesmo dado de novo.
      await this.finance.generateChargesForCycle(tx, {
        id: created.id,
        tenantId,
        patientId,
        startDate,
        finalValue,
        downPayment,
        installmentCount,
        plan: { name: plan.name },
      });

      return created;
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'TreatmentCycle',
      entityId: created.id,
      action: AuditAction.CREATE,
      after: this.toAuditJson(created),
    });

    return created;
  }

  async update(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: UpdateTreatmentCycleDto,
  ) {
    const before = await this.findOrThrow(tenantId, id);

    const updated = await this.prisma.treatmentCycle.update({
      where: { id },
      data: {
        expectedEndDate: dto.expectedEndDate
          ? new Date(dto.expectedEndDate)
          : undefined,
        notes: dto.notes,
      },
      include: CYCLE_INCLUDE,
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'TreatmentCycle',
      entityId: id,
      action: AuditAction.UPDATE,
      before: this.toAuditJson(before),
      after: this.toAuditJson(updated),
    });

    return updated;
  }

  /**
   * Correção de valores já contratados (Missão 0005.8, ajuste final, seção
   * 4) — nunca sobrescreve silenciosamente: grava antes/depois completos +
   * quem + quando + motivo no AuditLog (reaproveitado, sem tabela nova).
   * discount/finalValue são sempre recalculados a partir dos novos valores.
   */
  async updateFinancials(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: UpdateTreatmentCycleFinancialsDto,
  ) {
    const before = await this.findOrThrow(tenantId, id);
    if (!FINANCIALLY_EDITABLE_STATUSES.includes(before.status)) {
      throw new BadRequestException(
        `Não é possível corrigir valores de um ciclo com status "${before.status}"`,
      );
    }

    const contractedValue =
      dto.contractedValue ?? Number(before.contractedValue);
    const discountType = dto.discountType ?? before.discountType;
    const discountValue = dto.discountValue ?? Number(before.discountValue);

    if (discountValue > 0 && !before.plan.allowsDiscount) {
      throw new BadRequestException('Este plano não permite desconto');
    }
    if (discountType === 'PERCENTAGE' && discountValue > 100) {
      throw new BadRequestException(
        'Desconto percentual não pode passar de 100%',
      );
    }
    if (dto.paymentMethodId) {
      await this.assertPaymentMethodInTenant(tenantId, dto.paymentMethodId);
    }

    const discount = computeDiscountAmount(
      contractedValue,
      discountType,
      discountValue,
    );
    const finalValue = computeFinalValue(contractedValue, discount, 0);
    const downPayment = dto.downPayment ?? Number(before.downPayment);
    const installmentCount = dto.installmentCount ?? before.installmentCount;

    const updated = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.treatmentCycle.update({
        where: { id },
        data: {
          contractedValue,
          discountType,
          discountValue,
          discount,
          finalValue,
          paymentMethodId:
            dto.paymentMethodId === undefined ? undefined : dto.paymentMethodId,
          downPayment: dto.downPayment,
          installmentCount: dto.installmentCount,
        },
        include: CYCLE_INCLUDE,
      });

      // Financeiro (Missão 0006): parcelas já pagas nunca são tocadas — só
      // o saldo ainda pendente é redistribuído com o valor corrigido.
      await this.finance.regenerateFuturePendingCharges(tx, {
        id: updated.id,
        tenantId,
        patientId: updated.patientId,
        startDate: updated.startDate,
        finalValue,
        downPayment,
        installmentCount,
        plan: { name: updated.plan.name },
      });

      return updated;
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'TreatmentCycle',
      entityId: id,
      action: AuditAction.UPDATE,
      before: this.toAuditJson(before),
      after: this.toAuditJson(updated),
      metadata: { correction: true, reason: dto.reason },
    });

    return updated;
  }

  async updateStatus(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: UpdateTreatmentCycleStatusDto,
  ) {
    const before = await this.findOrThrow(tenantId, id);
    const allowed = ALLOWED_CYCLE_TRANSITIONS[before.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Não é possível mudar o ciclo de "${before.status}" para "${dto.status}"`,
      );
    }

    const isClosing =
      dto.status === CycleStatus.COMPLETED ||
      dto.status === CycleStatus.CANCELLED;

    const updated = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.treatmentCycle.update({
        where: { id },
        data: {
          status: dto.status,
          closureReason: dto.closureReason,
          actualEndDate: isClosing ? new Date() : undefined,
        },
        include: CYCLE_INCLUDE,
      });

      if (dto.status === CycleStatus.CANCELLED) {
        await this.finance.cancelChargesForCycle(tx, tenantId, actorUserId, id);
      }

      return updated;
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'TreatmentCycle',
      entityId: id,
      action: AuditAction.STATUS_CHANGE,
      before: { status: before.status },
      after: { status: updated.status, closureReason: dto.closureReason },
    });

    return updated;
  }

  // --------------------------------------------------------------------

  private async findOrThrow(tenantId: string, id: string) {
    const cycle = await this.prisma.treatmentCycle.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: CYCLE_INCLUDE,
    });
    if (!cycle) {
      throw new NotFoundException('Ciclo de tratamento não encontrado');
    }
    return cycle;
  }

  private async assertPatientInTenant(tenantId: string, patientId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId },
    });
    if (!patient) {
      throw new NotFoundException('Paciente não encontrado');
    }
    return patient;
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

  private async nextCycleNumber(
    tenantId: string,
    patientId: string,
  ): Promise<number> {
    const last = await this.prisma.treatmentCycle.findFirst({
      where: { tenantId, patientId },
      orderBy: { cycleNumber: 'desc' },
      select: { cycleNumber: true },
    });
    return (last?.cycleNumber ?? 0) + 1;
  }

  private addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  private toAuditJson(cycle: Record<string, unknown>): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(cycle)) as Prisma.InputJsonValue;
  }
}
