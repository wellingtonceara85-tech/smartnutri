import 'dotenv/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CycleStatus } from '../../generated/prisma/client';
import { TreatmentCyclesService } from './treatment-cycles.service';

describe('TreatmentCyclesService (integração)', () => {
  let service: TreatmentCyclesService;
  let prisma: PrismaService;

  let tenantA: { id: string };
  let tenantB: { id: string };
  let patientA: { id: string };
  let patientB: { id: string };
  let planTrimestral: { id: string; defaultPrice: unknown };
  let planNoDiscount: { id: string };
  let actorUserId: string;

  const runId = Date.now();

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [TreatmentCyclesService, AuditService, PrismaService],
    }).compile();

    service = moduleRef.get(TreatmentCyclesService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    tenantA = await prisma.tenant.create({
      data: {
        name: 'Tenant Ciclos A',
        slug: `ciclos-a-${runId}`,
        email: 'a@teste.com',
        phone: '11111111',
      },
    });
    tenantB = await prisma.tenant.create({
      data: {
        name: 'Tenant Ciclos B',
        slug: `ciclos-b-${runId}`,
        email: 'b@teste.com',
        phone: '22222222',
      },
    });

    const admin = await prisma.user.create({
      data: {
        name: 'Admin Teste Ciclos',
        email: `admin-ciclos-${runId}@teste.com`,
        passwordHash: 'x',
      },
    });
    actorUserId = admin.id;

    patientA = await prisma.patient.create({
      data: { tenantId: tenantA.id, fullName: 'Paciente Ciclos A' },
    });
    patientB = await prisma.patient.create({
      data: { tenantId: tenantB.id, fullName: 'Paciente Ciclos B' },
    });

    planTrimestral = await prisma.plan.create({
      data: {
        tenantId: tenantA.id,
        name: 'Trimestral Teste Ciclos',
        durationMonths: 3,
        suggestedAppointments: 3,
        suggestedIntervalDays: 30,
        defaultPrice: 900,
        defaultInstallments: 3,
        allowsDiscount: true,
      },
    });
    planNoDiscount = await prisma.plan.create({
      data: {
        tenantId: tenantA.id,
        name: 'Sem Desconto Teste Ciclos',
        durationMonths: 1,
        suggestedAppointments: 1,
        suggestedIntervalDays: 30,
        defaultPrice: 300,
        defaultInstallments: 1,
        allowsDiscount: false,
      },
    });
  });

  afterAll(async () => {
    await prisma.treatmentCycle.deleteMany({ where: { tenantId: tenantA.id } });
    await prisma.plan.deleteMany({ where: { tenantId: tenantA.id } });
    await prisma.patient.deleteMany({
      where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
    await prisma.tenant.delete({ where: { id: tenantA.id } });
    await prisma.tenant.delete({ where: { id: tenantB.id } });
    await prisma.user.delete({ where: { id: actorUserId } });
    await prisma.$disconnect();
  });

  it('calcula o valor final com desconto percentual sem alterar o preço-base (exemplo do prompt: R$900 -10% = R$810)', async () => {
    const cycle = await service.create(tenantA.id, actorUserId, patientA.id, {
      planId: planTrimestral.id,
      startDate: '2026-01-01',
      discountType: 'PERCENTAGE',
      discountValue: 10,
    });
    expect(cycle.contractedValue.toString()).toBe('900');
    expect(cycle.discount.toString()).toBe('90');
    expect(cycle.finalValue.toString()).toBe('810');
  });

  it('calcula o valor final com desconto fixo em R$', async () => {
    const cycle = await service.create(tenantA.id, actorUserId, patientA.id, {
      planId: planTrimestral.id,
      startDate: '2026-01-01',
      discountType: 'FIXED',
      discountValue: 50,
    });
    expect(cycle.contractedValue.toString()).toBe('900');
    expect(cycle.discount.toString()).toBe('50');
    expect(cycle.finalValue.toString()).toBe('850');
  });

  it('sem desconto informado, valor final é igual ao preço-base', async () => {
    const cycle = await service.create(tenantA.id, actorUserId, patientA.id, {
      planId: planTrimestral.id,
      startDate: '2026-01-01',
    });
    expect(cycle.discount.toString()).toBe('0');
    expect(cycle.finalValue.toString()).toBe(cycle.contractedValue.toString());
  });

  it('nunca deixa o valor final negativo mesmo com desconto maior que o preço', async () => {
    const cycle = await service.create(tenantA.id, actorUserId, patientA.id, {
      planId: planTrimestral.id,
      startDate: '2026-01-01',
      discountType: 'FIXED',
      discountValue: 5000,
    });
    expect(cycle.finalValue.toString()).toBe('0');
  });

  it('rejeita desconto percentual acima de 100%', async () => {
    await expect(
      service.create(tenantA.id, actorUserId, patientA.id, {
        planId: planTrimestral.id,
        startDate: '2026-01-01',
        discountType: 'PERCENTAGE',
        discountValue: 150,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita desconto quando o plano não permite (Plan.allowsDiscount=false)', async () => {
    await expect(
      service.create(tenantA.id, actorUserId, patientA.id, {
        planId: planNoDiscount.id,
        startDate: '2026-01-01',
        discountType: 'FIXED',
        discountValue: 10,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('permite contratar um plano sem desconto que não permite desconto', async () => {
    const cycle = await service.create(tenantA.id, actorUserId, patientA.id, {
      planId: planNoDiscount.id,
      startDate: '2026-01-01',
    });
    expect(cycle.finalValue.toString()).toBe('300');
  });

  it('incrementa cycleNumber por paciente, começando em 1', async () => {
    const freshPatient = await prisma.patient.create({
      data: { tenantId: tenantA.id, fullName: 'Paciente Sequência Ciclos' },
    });
    const first = await service.create(
      tenantA.id,
      actorUserId,
      freshPatient.id,
      {
        planId: planTrimestral.id,
        startDate: '2026-01-01',
      },
    );
    const second = await service.create(
      tenantA.id,
      actorUserId,
      freshPatient.id,
      {
        planId: planTrimestral.id,
        startDate: '2026-06-01',
      },
    );
    expect(first.cycleNumber).toBe(1);
    expect(second.cycleNumber).toBe(2);
  });

  it('isola ciclos por tenant — paciente de outro tenant não pode contratar plano deste tenant', async () => {
    await expect(
      service.create(tenantA.id, actorUserId, patientB.id, {
        planId: planTrimestral.id,
        startDate: '2026-01-01',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lista o histórico de contratações de um paciente, mais recente primeiro', async () => {
    const freshPatient = await prisma.patient.create({
      data: { tenantId: tenantA.id, fullName: 'Paciente Histórico Ciclos' },
    });
    await service.create(tenantA.id, actorUserId, freshPatient.id, {
      planId: planTrimestral.id,
      startDate: '2026-01-01',
    });
    await service.create(tenantA.id, actorUserId, freshPatient.id, {
      planId: planTrimestral.id,
      startDate: '2026-06-01',
    });
    const history = await service.listForPatient(tenantA.id, freshPatient.id);
    expect(history).toHaveLength(2);
    expect(history[0].cycleNumber).toBe(2);
    expect(history[1].cycleNumber).toBe(1);
  });

  it('transições de status válidas e inválidas', async () => {
    const cycle = await service.create(tenantA.id, actorUserId, patientA.id, {
      planId: planTrimestral.id,
      startDate: '2026-01-01',
    });
    const paused = await service.updateStatus(
      tenantA.id,
      actorUserId,
      cycle.id,
      {
        status: CycleStatus.PAUSED,
      },
    );
    expect(paused.status).toBe(CycleStatus.PAUSED);

    await expect(
      service.updateStatus(tenantA.id, actorUserId, cycle.id, {
        status: CycleStatus.COMPLETED,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const cancelled = await service.updateStatus(
      tenantA.id,
      actorUserId,
      cycle.id,
      {
        status: CycleStatus.CANCELLED,
        closureReason: 'Paciente desistiu',
      },
    );
    expect(cancelled.status).toBe(CycleStatus.CANCELLED);
    expect(cancelled.actualEndDate).not.toBeNull();

    await expect(
      service.updateStatus(tenantA.id, actorUserId, cycle.id, {
        status: CycleStatus.ACTIVE,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update() não altera campos financeiros (não existem no DTO)', async () => {
    const cycle = await service.create(tenantA.id, actorUserId, patientA.id, {
      planId: planTrimestral.id,
      startDate: '2026-01-01',
      discountType: 'PERCENTAGE',
      discountValue: 10,
    });
    const updated = await service.update(tenantA.id, actorUserId, cycle.id, {
      notes: 'Observação atualizada',
    });
    expect(updated.finalValue.toString()).toBe('810');
    expect(updated.notes).toBe('Observação atualizada');
  });

  // ---------------------------------------------------------------------
  // Missão 0005.8, ajuste final: correção de valores já contratados
  // ---------------------------------------------------------------------

  it('updateFinancials() corrige o desconto e recalcula o valor final, sem exigir cancelar/recriar', async () => {
    const cycle = await service.create(tenantA.id, actorUserId, patientA.id, {
      planId: planTrimestral.id,
      startDate: '2026-01-01',
      discountType: 'PERCENTAGE',
      discountValue: 10,
    });
    expect(cycle.finalValue.toString()).toBe('810');

    const corrected = await service.updateFinancials(
      tenantA.id,
      actorUserId,
      cycle.id,
      {
        discountType: 'FIXED',
        discountValue: 100,
        reason: 'Desconto errado na contratação original',
      },
    );
    expect(corrected.discount.toString()).toBe('100');
    expect(corrected.finalValue.toString()).toBe('800');
    // Campo não enviado permanece intacto.
    expect(corrected.contractedValue.toString()).toBe('900');
  });

  it('updateFinancials() corrige valor contratado, forma de pagamento, entrada e parcelas', async () => {
    const method = await prisma.paymentMethod.create({
      data: { tenantId: tenantA.id, name: `Método Correção ${runId}` },
    });
    const cycle = await service.create(tenantA.id, actorUserId, patientA.id, {
      planId: planTrimestral.id,
      startDate: '2026-01-01',
    });

    const corrected = await service.updateFinancials(
      tenantA.id,
      actorUserId,
      cycle.id,
      {
        contractedValue: 950,
        paymentMethodId: method.id,
        downPayment: 100,
        installmentCount: 5,
        reason: 'Valor renegociado com o paciente',
      },
    );
    expect(corrected.contractedValue.toString()).toBe('950');
    expect(corrected.finalValue.toString()).toBe('950');
    expect(corrected.paymentMethod?.id).toBe(method.id);
    expect(corrected.downPayment.toString()).toBe('100');
    expect(corrected.installmentCount).toBe(5);
  });

  it('updateFinancials() grava antes/depois/quem/quando/motivo no AuditLog, sem sobrescrever silenciosamente', async () => {
    const cycle = await service.create(tenantA.id, actorUserId, patientA.id, {
      planId: planTrimestral.id,
      startDate: '2026-01-01',
    });
    await service.updateFinancials(tenantA.id, actorUserId, cycle.id, {
      contractedValue: 850,
      reason: 'Correção de teste — motivo obrigatório',
    });

    const entry = await prisma.auditLog.findFirst({
      where: {
        tenantId: tenantA.id,
        entityType: 'TreatmentCycle',
        entityId: cycle.id,
        action: 'UPDATE',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(entry).not.toBeNull();
    expect(entry?.actorUserId).toBe(actorUserId);
    expect((entry?.metadata as { reason?: string } | null)?.reason).toBe(
      'Correção de teste — motivo obrigatório',
    );
    const before = entry?.beforeJson as { contractedValue?: string } | null;
    const after = entry?.afterJson as { contractedValue?: string } | null;
    expect(before?.contractedValue).toBe('900');
    expect(after?.contractedValue).toBe('850');
  });

  it('updateFinancials() rejeita desconto percentual acima de 100% e desconto em plano que não permite', async () => {
    const cycle = await service.create(tenantA.id, actorUserId, patientA.id, {
      planId: planTrimestral.id,
      startDate: '2026-01-01',
    });
    await expect(
      service.updateFinancials(tenantA.id, actorUserId, cycle.id, {
        discountType: 'PERCENTAGE',
        discountValue: 150,
        reason: 'Teste',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const cycleNoDiscount = await service.create(
      tenantA.id,
      actorUserId,
      patientA.id,
      {
        planId: planNoDiscount.id,
        startDate: '2026-01-01',
      },
    );
    await expect(
      service.updateFinancials(tenantA.id, actorUserId, cycleNoDiscount.id, {
        discountType: 'FIXED',
        discountValue: 10,
        reason: 'Teste',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updateFinancials() rejeita correção em ciclo já encerrado (COMPLETED/CANCELLED)', async () => {
    const cycle = await service.create(tenantA.id, actorUserId, patientA.id, {
      planId: planTrimestral.id,
      startDate: '2026-01-01',
    });
    await service.updateStatus(tenantA.id, actorUserId, cycle.id, {
      status: CycleStatus.CANCELLED,
    });

    await expect(
      service.updateFinancials(tenantA.id, actorUserId, cycle.id, {
        contractedValue: 500,
        reason: 'Tentativa após cancelamento',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
