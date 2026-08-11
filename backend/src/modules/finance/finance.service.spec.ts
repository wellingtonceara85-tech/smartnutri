import 'dotenv/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ChargeStatus } from '../../generated/prisma/client';
import { TreatmentCyclesService } from '../treatment-cycles/treatment-cycles.service';
import { FinanceService } from './finance.service';

describe('FinanceService (integração)', () => {
  let finance: FinanceService;
  let cycles: TreatmentCyclesService;
  let prisma: PrismaService;

  let tenantA: { id: string };
  let tenantB: { id: string };
  let patientA: { id: string };
  let patientB: { id: string };
  let plan: { id: string };
  let paymentMethod: { id: string };
  let actorUserId: string;

  const runId = Date.now();

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceService,
        TreatmentCyclesService,
        AuditService,
        PrismaService,
      ],
    }).compile();

    finance = moduleRef.get(FinanceService);
    cycles = moduleRef.get(TreatmentCyclesService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    tenantA = await prisma.tenant.create({
      data: {
        name: 'Tenant Finance A',
        slug: `finance-a-${runId}`,
        email: 'a@teste.com',
        phone: '11111111',
      },
    });
    tenantB = await prisma.tenant.create({
      data: {
        name: 'Tenant Finance B',
        slug: `finance-b-${runId}`,
        email: 'b@teste.com',
        phone: '22222222',
      },
    });

    const admin = await prisma.user.create({
      data: {
        name: 'Admin Teste Finance',
        email: `admin-finance-${runId}@teste.com`,
        passwordHash: 'x',
      },
    });
    actorUserId = admin.id;

    patientA = await prisma.patient.create({
      data: { tenantId: tenantA.id, fullName: 'Paciente Finance A' },
    });
    patientB = await prisma.patient.create({
      data: { tenantId: tenantB.id, fullName: 'Paciente Finance B' },
    });

    plan = await prisma.plan.create({
      data: {
        tenantId: tenantA.id,
        name: `Plano Finance ${runId}`,
        durationMonths: 3,
        suggestedAppointments: 3,
        suggestedIntervalDays: 30,
        defaultPrice: 1000,
        defaultInstallments: 3,
      },
    });
    paymentMethod = await prisma.paymentMethod.create({
      data: { tenantId: tenantA.id, name: `PIX Finance ${runId}` },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.paymentAllocation.deleteMany({
      where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
    await prisma.payment.deleteMany({
      where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
    await prisma.charge.deleteMany({
      where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
    await prisma.treatmentCycle.deleteMany({ where: { tenantId: tenantA.id } });
    await prisma.plan.deleteMany({ where: { tenantId: tenantA.id } });
    await prisma.paymentMethod.deleteMany({ where: { tenantId: tenantA.id } });
    await prisma.patient.deleteMany({
      where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
    await prisma.tenant.delete({ where: { id: tenantA.id } });
    await prisma.tenant.delete({ where: { id: tenantB.id } });
    await prisma.user.delete({ where: { id: actorUserId } });
    await prisma.$disconnect();
  }, 30000);

  describe('geração de cobranças a partir da contratação', () => {
    it('cria uma Charge por parcela, valor total batendo com finalValue (sem sobra nem falta de centavos)', async () => {
      const cycle = await cycles.create(tenantA.id, actorUserId, patientA.id, {
        planId: plan.id,
        startDate: '2026-01-01',
      });
      const charges = await prisma.charge.findMany({
        where: { treatmentCycleId: cycle.id },
        orderBy: { installmentNumber: 'asc' },
      });
      expect(charges).toHaveLength(3);
      const sum = charges.reduce((acc, c) => acc + Number(c.amount), 0);
      expect(sum).toBeCloseTo(1000, 2);
      expect(charges[0].installmentNumber).toBe(1);
      expect(charges[2].installmentTotal).toBe(3);
      expect(charges.every((c) => c.status === ChargeStatus.PENDING)).toBe(
        true,
      );
    });

    it('com entrada (downPayment), a 1ª parcela é a entrada e o resto é dividido entre as demais', async () => {
      const cycle = await cycles.create(tenantA.id, actorUserId, patientA.id, {
        planId: plan.id,
        startDate: '2026-01-01',
        downPayment: 400,
        installmentCount: 3,
      });
      const charges = await prisma.charge.findMany({
        where: { treatmentCycleId: cycle.id },
        orderBy: { installmentNumber: 'asc' },
      });
      expect(Number(charges[0].amount)).toBe(400);
      const restSum = Number(charges[1].amount) + Number(charges[2].amount);
      expect(restSum).toBeCloseTo(600, 2);
    });

    it('vencimentos das parcelas são espaçados por mês a partir da data de início', async () => {
      const cycle = await cycles.create(tenantA.id, actorUserId, patientA.id, {
        planId: plan.id,
        startDate: '2026-02-01',
      });
      const charges = await prisma.charge.findMany({
        where: { treatmentCycleId: cycle.id },
        orderBy: { installmentNumber: 'asc' },
      });
      expect(charges[0].dueDate.toISOString().slice(0, 10)).toBe('2026-02-01');
      expect(charges[1].dueDate.toISOString().slice(0, 10)).toBe('2026-03-01');
      expect(charges[2].dueDate.toISOString().slice(0, 10)).toBe('2026-04-01');
    });

    it('isola cobranças por tenant — paciente do tenant A não vê cobrança do tenant B', async () => {
      const otherPlan = await prisma.plan.create({
        data: {
          tenantId: tenantB.id,
          name: `Plano B ${runId}`,
          durationMonths: 1,
          suggestedAppointments: 1,
          suggestedIntervalDays: 30,
          defaultPrice: 500,
          defaultInstallments: 1,
        },
      });
      await cycles.create(tenantB.id, actorUserId, patientB.id, {
        planId: otherPlan.id,
        startDate: '2026-01-01',
      });
      const listA = await finance.listCharges(tenantA.id, {});
      expect(listA.data.every((c) => c.patient.id !== patientB.id)).toBe(true);
    });
  });

  describe('geração de cobrança para consulta avulsa', () => {
    it('cria uma única Charge com o valor final avulso já descontado', async () => {
      const appointmentType = await prisma.appointmentType.create({
        data: { tenantId: tenantA.id, name: `Avulsa Teste ${runId}` },
      });
      const appointment = await prisma.appointment.create({
        data: {
          tenantId: tenantA.id,
          patientId: patientA.id,
          nutritionistUserId: actorUserId,
          appointmentTypeId: appointmentType.id,
          scheduledAt: new Date('2026-05-10T13:00:00Z'),
          durationMinutes: 60,
          createdByUserId: actorUserId,
          standaloneValue: 200,
          standaloneDiscountType: 'FIXED',
          standaloneDiscountValue: 20,
          standaloneFinalValue: 180,
        },
      });

      await prisma.$transaction((tx) =>
        finance.generateChargeForStandaloneAppointment(tx, {
          id: appointment.id,
          tenantId: tenantA.id,
          patientId: patientA.id,
          scheduledAt: appointment.scheduledAt,
          standaloneValue: appointment.standaloneValue,
          standaloneDiscountValue: appointment.standaloneDiscountValue,
          standaloneFinalValue: appointment.standaloneFinalValue,
        }),
      );

      const charge = await prisma.charge.findFirst({
        where: { appointmentId: appointment.id },
      });
      expect(charge).not.toBeNull();
      expect(Number(charge?.amount)).toBe(200);
      expect(Number(charge?.discount)).toBe(20);
      expect(charge?.treatmentCycleId).toBeNull();
      expect(charge?.installmentTotal).toBe(1);
    });
  });

  describe('reagendamento (transferChargeOnReschedule)', () => {
    it('move a cobrança em aberto para a nova consulta e atualiza o vencimento', async () => {
      const appointmentType = await prisma.appointmentType.create({
        data: { tenantId: tenantA.id, name: `Reagendamento Teste ${runId}` },
      });
      const original = await prisma.appointment.create({
        data: {
          tenantId: tenantA.id,
          patientId: patientA.id,
          nutritionistUserId: actorUserId,
          appointmentTypeId: appointmentType.id,
          scheduledAt: new Date('2026-06-01T13:00:00Z'),
          durationMinutes: 60,
          createdByUserId: actorUserId,
          status: 'RESCHEDULED',
          standaloneValue: 150,
          standaloneFinalValue: 150,
        },
      });
      await prisma.$transaction((tx) =>
        finance.generateChargeForStandaloneAppointment(tx, {
          id: original.id,
          tenantId: tenantA.id,
          patientId: patientA.id,
          scheduledAt: original.scheduledAt,
          standaloneValue: original.standaloneValue,
          standaloneDiscountValue: null,
          standaloneFinalValue: original.standaloneFinalValue,
        }),
      );
      const rescheduled = await prisma.appointment.create({
        data: {
          tenantId: tenantA.id,
          patientId: patientA.id,
          nutritionistUserId: actorUserId,
          appointmentTypeId: appointmentType.id,
          scheduledAt: new Date('2026-06-08T13:00:00Z'),
          durationMinutes: 60,
          createdByUserId: actorUserId,
          rescheduledFromAppointmentId: original.id,
        },
      });

      await prisma.$transaction((tx) =>
        finance.transferChargeOnReschedule(
          tx,
          tenantA.id,
          original.id,
          rescheduled.id,
          rescheduled.scheduledAt,
        ),
      );

      const oldCharge = await prisma.charge.findFirst({
        where: { appointmentId: original.id },
      });
      const newCharge = await prisma.charge.findFirst({
        where: { appointmentId: rescheduled.id },
      });
      expect(oldCharge).toBeNull();
      expect(newCharge).not.toBeNull();
      expect(newCharge?.dueDate.toISOString().slice(0, 10)).toBe('2026-06-08');
      expect(Number(newCharge?.amount)).toBe(150);
    });

    it('cobrança já paga acompanha a nova consulta, mas o vencimento (já liquidado) não muda', async () => {
      const appointmentType = await prisma.appointmentType.create({
        data: {
          tenantId: tenantA.id,
          name: `Reagendamento Paga Teste ${runId}`,
        },
      });
      const original = await prisma.appointment.create({
        data: {
          tenantId: tenantA.id,
          patientId: patientA.id,
          nutritionistUserId: actorUserId,
          appointmentTypeId: appointmentType.id,
          scheduledAt: new Date('2026-07-01T13:00:00Z'),
          durationMinutes: 60,
          createdByUserId: actorUserId,
          status: 'RESCHEDULED',
          standaloneValue: 220,
          standaloneFinalValue: 220,
        },
      });
      await prisma.$transaction((tx) =>
        finance.generateChargeForStandaloneAppointment(tx, {
          id: original.id,
          tenantId: tenantA.id,
          patientId: patientA.id,
          scheduledAt: original.scheduledAt,
          standaloneValue: original.standaloneValue,
          standaloneDiscountValue: null,
          standaloneFinalValue: original.standaloneFinalValue,
        }),
      );
      const chargeBefore = await prisma.charge.findFirstOrThrow({
        where: { appointmentId: original.id },
      });
      await finance.registerPayment(tenantA.id, actorUserId, {
        chargeId: chargeBefore.id,
        paymentMethodId: paymentMethod.id,
      });

      const rescheduled = await prisma.appointment.create({
        data: {
          tenantId: tenantA.id,
          patientId: patientA.id,
          nutritionistUserId: actorUserId,
          appointmentTypeId: appointmentType.id,
          scheduledAt: new Date('2026-07-08T13:00:00Z'),
          durationMinutes: 60,
          createdByUserId: actorUserId,
          rescheduledFromAppointmentId: original.id,
        },
      });
      await prisma.$transaction((tx) =>
        finance.transferChargeOnReschedule(
          tx,
          tenantA.id,
          original.id,
          rescheduled.id,
          rescheduled.scheduledAt,
        ),
      );

      const movedCharge = await prisma.charge.findFirst({
        where: { appointmentId: rescheduled.id },
      });
      expect(movedCharge).not.toBeNull();
      expect(movedCharge?.status).toBe(ChargeStatus.PAID);
      expect(movedCharge?.dueDate.toISOString().slice(0, 10)).toBe(
        '2026-07-01',
      );
    });
  });

  describe('correção de valores (regenerateFuturePendingCharges)', () => {
    it('sem nenhum pagamento ainda, regenera as parcelas do zero com os novos valores', async () => {
      const cycle = await cycles.create(tenantA.id, actorUserId, patientA.id, {
        planId: plan.id,
        startDate: '2026-01-01',
      });
      await cycles.updateFinancials(tenantA.id, actorUserId, cycle.id, {
        contractedValue: 600,
        installmentCount: 2,
        reason: 'Correção de teste',
      });
      const charges = await prisma.charge.findMany({
        where: {
          treatmentCycleId: cycle.id,
          status: { not: ChargeStatus.CANCELLED },
        },
      });
      expect(charges).toHaveLength(2);
      const sum = charges.reduce((acc, c) => acc + Number(c.amount), 0);
      expect(sum).toBeCloseTo(600, 2);
    });

    it('com uma parcela já paga, ela não é alterada — só o saldo pendente é redistribuído', async () => {
      const cycle = await cycles.create(tenantA.id, actorUserId, patientA.id, {
        planId: plan.id,
        startDate: '2026-01-01',
      });
      const [first] = await prisma.charge.findMany({
        where: { treatmentCycleId: cycle.id },
        orderBy: { installmentNumber: 'asc' },
      });
      await finance.registerPayment(tenantA.id, actorUserId, {
        chargeId: first.id,
        paymentMethodId: paymentMethod.id,
      });

      await cycles.updateFinancials(tenantA.id, actorUserId, cycle.id, {
        contractedValue: 1200,
        reason: 'Renegociação depois de já ter pago a 1ª parcela',
      });

      const paidCharge = await prisma.charge.findUnique({
        where: { id: first.id },
      });
      expect(Number(paidCharge?.amount)).toBeCloseTo(1000 / 3, 2);
      expect(paidCharge?.status).toBe(ChargeStatus.PAID);

      const untouched = await prisma.charge.findMany({
        where: {
          treatmentCycleId: cycle.id,
          id: { not: first.id },
          status: { not: ChargeStatus.CANCELLED },
        },
      });
      const untouchedSum = untouched.reduce(
        (acc, c) => acc + Number(c.amount),
        0,
      );
      expect(untouchedSum).toBeCloseTo(1200 - Number(paidCharge?.amount), 2);
    });
  });

  describe('cancelamento', () => {
    it('cancelar o ciclo cancela as parcelas pendentes, mas nunca as já pagas', async () => {
      const cycle = await cycles.create(tenantA.id, actorUserId, patientA.id, {
        planId: plan.id,
        startDate: '2026-01-01',
      });
      const [first] = await prisma.charge.findMany({
        where: { treatmentCycleId: cycle.id },
        orderBy: { installmentNumber: 'asc' },
      });
      await finance.registerPayment(tenantA.id, actorUserId, {
        chargeId: first.id,
        paymentMethodId: paymentMethod.id,
      });

      await cycles.updateStatus(tenantA.id, actorUserId, cycle.id, {
        status: 'CANCELLED',
      });

      const charges = await prisma.charge.findMany({
        where: { treatmentCycleId: cycle.id },
        orderBy: { installmentNumber: 'asc' },
      });
      expect(charges[0].status).toBe(ChargeStatus.PAID);
      expect(charges[1].status).toBe(ChargeStatus.CANCELLED);
      expect(charges[2].status).toBe(ChargeStatus.CANCELLED);
    });
  });

  describe('registerPayment / voidPayment', () => {
    it('pagamento total marca a cobrança como PAID', async () => {
      const cycle = await cycles.create(tenantA.id, actorUserId, patientA.id, {
        planId: plan.id,
        startDate: '2026-01-01',
        installmentCount: 1,
      });
      const [charge] = await prisma.charge.findMany({
        where: { treatmentCycleId: cycle.id },
      });

      const payment = await finance.registerPayment(tenantA.id, actorUserId, {
        chargeId: charge.id,
        paymentMethodId: paymentMethod.id,
      });
      expect(Number(payment.amount)).toBe(1000);

      const updated = await prisma.charge.findUnique({
        where: { id: charge.id },
      });
      expect(updated?.status).toBe(ChargeStatus.PAID);
    });

    it('pagamento parcial marca PARTIALLY_PAID; completar o saldo marca PAID', async () => {
      const cycle = await cycles.create(tenantA.id, actorUserId, patientA.id, {
        planId: plan.id,
        startDate: '2026-01-01',
        installmentCount: 1,
      });
      const [charge] = await prisma.charge.findMany({
        where: { treatmentCycleId: cycle.id },
      });

      await finance.registerPayment(tenantA.id, actorUserId, {
        chargeId: charge.id,
        paymentMethodId: paymentMethod.id,
        amount: 400,
      });
      const partial = await prisma.charge.findUnique({
        where: { id: charge.id },
      });
      expect(partial?.status).toBe(ChargeStatus.PARTIALLY_PAID);

      await finance.registerPayment(tenantA.id, actorUserId, {
        chargeId: charge.id,
        paymentMethodId: paymentMethod.id,
        amount: 600,
      });
      const complete = await prisma.charge.findUnique({
        where: { id: charge.id },
      });
      expect(complete?.status).toBe(ChargeStatus.PAID);
    });

    it('rejeita pagamento acima do saldo restante', async () => {
      const cycle = await cycles.create(tenantA.id, actorUserId, patientA.id, {
        planId: plan.id,
        startDate: '2026-01-01',
        installmentCount: 1,
      });
      const [charge] = await prisma.charge.findMany({
        where: { treatmentCycleId: cycle.id },
      });

      await expect(
        finance.registerPayment(tenantA.id, actorUserId, {
          chargeId: charge.id,
          paymentMethodId: paymentMethod.id,
          amount: 5000,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejeita pagamento de cobrança já paga ou cancelada', async () => {
      const cycle = await cycles.create(tenantA.id, actorUserId, patientA.id, {
        planId: plan.id,
        startDate: '2026-01-01',
        installmentCount: 1,
      });
      const [charge] = await prisma.charge.findMany({
        where: { treatmentCycleId: cycle.id },
      });
      await finance.registerPayment(tenantA.id, actorUserId, {
        chargeId: charge.id,
        paymentMethodId: paymentMethod.id,
      });
      await expect(
        finance.registerPayment(tenantA.id, actorUserId, {
          chargeId: charge.id,
          paymentMethodId: paymentMethod.id,
          amount: 1,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('voidPayment reverte a cobrança para PENDING e preserva o histórico do pagamento (soft delete)', async () => {
      const cycle = await cycles.create(tenantA.id, actorUserId, patientA.id, {
        planId: plan.id,
        startDate: '2026-01-01',
        installmentCount: 1,
      });
      const [charge] = await prisma.charge.findMany({
        where: { treatmentCycleId: cycle.id },
      });
      const payment = await finance.registerPayment(tenantA.id, actorUserId, {
        chargeId: charge.id,
        paymentMethodId: paymentMethod.id,
      });

      await finance.voidPayment(
        tenantA.id,
        actorUserId,
        payment.id,
        'Lançado por engano',
      );

      const reverted = await prisma.charge.findUnique({
        where: { id: charge.id },
      });
      expect(reverted?.status).toBe(ChargeStatus.PENDING);

      const voidedPayment = await prisma.payment.findUnique({
        where: { id: payment.id },
      });
      expect(voidedPayment?.deletedAt).not.toBeNull();

      const auditEntry = await prisma.auditLog.findFirst({
        where: {
          entityType: 'Payment',
          entityId: payment.id,
          action: 'REFUND',
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditEntry).not.toBeNull();
      expect((auditEntry?.metadata as { reason?: string } | null)?.reason).toBe(
        'Lançado por engano',
      );
    });

    it('não encontra pagamento de outro tenant (isolamento)', async () => {
      const cycle = await cycles.create(tenantA.id, actorUserId, patientA.id, {
        planId: plan.id,
        startDate: '2026-01-01',
        installmentCount: 1,
      });
      const [charge] = await prisma.charge.findMany({
        where: { treatmentCycleId: cycle.id },
      });
      const payment = await finance.registerPayment(tenantA.id, actorUserId, {
        chargeId: charge.id,
        paymentMethodId: paymentMethod.id,
      });

      await expect(
        finance.voidPayment(
          tenantB.id,
          actorUserId,
          payment.id,
          'Tentativa de outro tenant',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getSummary', () => {
    it('agrega recebido no período, a receber e vencido corretamente', async () => {
      const cycle = await cycles.create(tenantA.id, actorUserId, patientA.id, {
        planId: plan.id,
        startDate: '2020-01-01',
        installmentCount: 1,
      });
      const [charge] = await prisma.charge.findMany({
        where: { treatmentCycleId: cycle.id },
      });
      // Vencimento no passado — deve contar como vencido.
      await prisma.charge.update({
        where: { id: charge.id },
        data: { dueDate: new Date('2020-01-01') },
      });

      const before = await finance.getSummary(tenantA.id, {});
      expect(Number(before.vencido)).toBeGreaterThanOrEqual(1000);

      await finance.registerPayment(tenantA.id, actorUserId, {
        chargeId: charge.id,
        paymentMethodId: paymentMethod.id,
        paidAt: new Date().toISOString(),
      });

      const after = await finance.getSummary(tenantA.id, {});
      expect(Number(after.recebidoNoPeriodo)).toBeGreaterThanOrEqual(1000);
    });
  });
});
