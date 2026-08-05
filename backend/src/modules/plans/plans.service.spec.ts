import 'dotenv/config';
import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role } from '../../generated/prisma/client';
import { PlansService } from './plans.service';

describe('PlansService (integração)', () => {
  let service: PlansService;
  let prisma: PrismaService;

  let tenantA: { id: string };
  let tenantB: { id: string };
  let actorUserId: string;

  const runId = Date.now();

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [PlansService, AuditService, PrismaService],
    }).compile();

    service = moduleRef.get(PlansService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    tenantA = await prisma.tenant.create({
      data: {
        name: 'Tenant Planos A',
        slug: `planos-a-${runId}`,
        email: 'a@teste.com',
        phone: '11111111',
      },
    });
    tenantB = await prisma.tenant.create({
      data: {
        name: 'Tenant Planos B',
        slug: `planos-b-${runId}`,
        email: 'b@teste.com',
        phone: '22222222',
      },
    });

    const admin = await prisma.user.create({
      data: {
        name: 'Admin Teste Planos',
        email: `admin-planos-${runId}@teste.com`,
        passwordHash: 'x',
      },
    });
    actorUserId = admin.id;
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantA.id } });
    await prisma.tenant.delete({ where: { id: tenantB.id } });
    await prisma.user.delete({ where: { id: actorUserId } });
    await prisma.$disconnect();
  });

  const basePlan = {
    name: 'Plano Trimestral Teste',
    durationMonths: 3,
    suggestedAppointments: 3,
    suggestedIntervalDays: 30,
    defaultPrice: 199.9,
    defaultInstallments: 3,
  };

  it('cria um plano válido', async () => {
    const plan = await service.create(tenantA.id, actorUserId, basePlan);
    expect(plan.id).toBeDefined();
    expect(plan.isActive).toBe(true);
  });

  it('persiste o valor monetário como Decimal, sem erro de ponto flutuante', async () => {
    const plan = await service.create(tenantA.id, actorUserId, {
      ...basePlan,
      name: 'Plano Decimal',
      defaultPrice: 199.9,
    });
    expect(plan.defaultPrice.toString()).toBe('199.9');
  });

  it('rejeita nome de plano duplicado no mesmo tenant', async () => {
    await service.create(tenantA.id, actorUserId, {
      ...basePlan,
      name: 'Plano Duplicado',
    });
    await expect(
      service.create(tenantA.id, actorUserId, {
        ...basePlan,
        name: 'Plano Duplicado',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('permite o mesmo nome de plano em tenants diferentes', async () => {
    await service.create(tenantA.id, actorUserId, {
      ...basePlan,
      name: 'Plano Mesmo Nome',
    });
    const planB = await service.create(tenantB.id, actorUserId, {
      ...basePlan,
      name: 'Plano Mesmo Nome',
    });
    expect(planB.tenantId).toBe(tenantB.id);
  });

  it('isola planos por tenant', async () => {
    const listA = await service.list(tenantA.id, {}, Role.ADMIN);
    const listB = await service.list(tenantB.id, {}, Role.ADMIN);
    const idsA = listA.data.map((p) => p.id);
    const idsB = listB.data.map((p) => p.id);
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });

  it('ativa e inativa um plano', async () => {
    const plan = await service.create(tenantA.id, actorUserId, {
      ...basePlan,
      name: 'Plano Ativação',
    });
    const inactivated = await service.updateStatus(
      tenantA.id,
      actorUserId,
      plan.id,
      { isActive: false },
    );
    expect(inactivated.isActive).toBe(false);

    const reactivated = await service.updateStatus(
      tenantA.id,
      actorUserId,
      plan.id,
      { isActive: true },
    );
    expect(reactivated.isActive).toBe(true);
  });

  it('recepção só enxerga planos ativos na listagem', async () => {
    const plan = await service.create(tenantA.id, actorUserId, {
      ...basePlan,
      name: 'Plano Inativo Recepção',
    });
    await service.updateStatus(tenantA.id, actorUserId, plan.id, {
      isActive: false,
    });

    const listForReception = await service.list(tenantA.id, {}, Role.RECEPTION);
    expect(listForReception.data.some((p) => p.id === plan.id)).toBe(false);

    const listForAdmin = await service.list(
      tenantA.id,
      { isActive: false },
      Role.ADMIN,
    );
    expect(listForAdmin.data.some((p) => p.id === plan.id)).toBe(true);
  });

  it('permite reaproveitar o nome de um plano excluído (índice único parcial)', async () => {
    const plan = await service.create(tenantA.id, actorUserId, {
      ...basePlan,
      name: 'Plano Reaproveitável',
    });
    await service.archive(tenantA.id, actorUserId, plan.id);

    const recreated = await service.create(tenantA.id, actorUserId, {
      ...basePlan,
      name: 'Plano Reaproveitável',
    });
    expect(recreated.id).not.toBe(plan.id);
  });
});
