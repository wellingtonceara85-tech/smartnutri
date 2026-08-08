import 'dotenv/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { MealPlansService } from '../meal-plans/meal-plans.service';
import { FoodDiaryStatus, Role } from '../../generated/prisma/client';
import { FoodDiaryService } from './food-diary.service';

jest.setTimeout(15000);

describe('FoodDiaryService (integração)', () => {
  let service: FoodDiaryService;
  let mealPlansService: MealPlansService;
  let prisma: PrismaService;

  let tenantA: { id: string };
  let tenantB: { id: string };
  let nutritionistA: { id: string };
  let patientA: { id: string };
  let patientB: { id: string };

  const runId = Date.now();

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [FoodDiaryService, MealPlansService, AuditService, PrismaService, StorageService],
    }).compile();

    service = moduleRef.get(FoodDiaryService);
    mealPlansService = moduleRef.get(MealPlansService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    tenantA = await prisma.tenant.create({
      data: { name: 'Tenant Diary A', slug: `diary-a-${runId}`, email: 'a@teste.com', phone: '11111111' },
    });
    tenantB = await prisma.tenant.create({
      data: { name: 'Tenant Diary B', slug: `diary-b-${runId}`, email: 'b@teste.com', phone: '22222222' },
    });

    nutritionistA = await prisma.user.create({
      data: { name: 'Nutri Diary A', email: `nutri-diary-a-${runId}@teste.com`, passwordHash: 'x' },
    });
    await prisma.userClinic.create({
      data: { userId: nutritionistA.id, tenantId: tenantA.id, role: Role.NUTRITIONIST },
    });

    patientA = await prisma.patient.create({ data: { tenantId: tenantA.id, fullName: 'Paciente Diary A' } });
    patientB = await prisma.patient.create({ data: { tenantId: tenantB.id, fullName: 'Paciente Diary B' } });
  }, 20000);

  afterAll(async () => {
    await prisma.foodDiaryEntry.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.mealPlan.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.patient.deleteMany({ where: { id: { in: [patientA.id, patientB.id] } } });
    await prisma.userClinic.deleteMany({ where: { userId: nutritionistA.id } });
    await prisma.user.deleteMany({ where: { id: nutritionistA.id } });
    await prisma.tenant.delete({ where: { id: tenantA.id } });
    await prisma.tenant.delete({ where: { id: tenantB.id } });
    await prisma.$disconnect();
  });

  it('registra uma refeição consumida sem exigir vínculo com o plano prescrito', async () => {
    const created = await service.create(tenantA.id, nutritionistA.id, patientA.id, {
      entryDate: '2026-08-08',
      mealName: 'Lanche da tarde',
      comment: 'Comeu fora do horário combinado',
    });

    expect(created.mealName).toBe('Lanche da tarde');
    expect(created.mealPlanId).toBeNull();
    expect(created.source).toBe('PROFESSIONAL');
    expect(created.status).toBe(FoodDiaryStatus.PENDING_REVIEW);
  });

  it('vincula a um plano/refeição prescritos quando informado e válido', async () => {
    const plan = await mealPlansService.create(tenantA.id, nutritionistA.id, Role.NUTRITIONIST, patientA.id, {
      title: 'Plano vinculável',
      effectiveFrom: '2026-08-01',
      meals: [{ name: 'Almoço', items: [{ description: 'Arroz e feijão' }] }],
    });
    const mealId = plan.meals[0].id;

    const entry = await service.create(tenantA.id, nutritionistA.id, patientA.id, {
      entryDate: '2026-08-08',
      mealName: 'Almoço',
      mealPlanId: plan.id,
      mealId,
    });

    expect(entry.mealPlan?.id).toBe(plan.id);
    expect(entry.meal?.id).toBe(mealId);
  });

  it('rejeita vínculo com refeição que não pertence ao plano informado', async () => {
    const planA = await mealPlansService.create(tenantA.id, nutritionistA.id, Role.NUTRITIONIST, patientA.id, {
      title: 'Plano A',
      effectiveFrom: '2026-08-01',
      meals: [{ name: 'Café', items: [] }],
    });
    const planB = await mealPlansService.create(tenantA.id, nutritionistA.id, Role.NUTRITIONIST, patientA.id, {
      title: 'Plano B',
      effectiveFrom: '2026-08-01',
      meals: [{ name: 'Jantar', items: [] }],
    });

    await expect(
      service.create(tenantA.id, nutritionistA.id, patientA.id, {
        entryDate: '2026-08-08',
        mealName: 'Café',
        mealPlanId: planA.id,
        mealId: planB.meals[0].id,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('isola registros por tenant — paciente de outro tenant não é encontrado', async () => {
    await expect(
      service.create(tenantA.id, nutritionistA.id, patientB.id, {
        entryDate: '2026-08-08',
        mealName: 'Tentativa cross-tenant',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('isola registros por tenant — plano de outro tenant não é aceito mesmo com UUID válido', async () => {
    const nutritionistB = await prisma.user.create({
      data: { name: 'Nutri Diary B', email: `nutri-diary-b-${runId}@teste.com`, passwordHash: 'x' },
    });
    await prisma.userClinic.create({
      data: { userId: nutritionistB.id, tenantId: tenantB.id, role: Role.NUTRITIONIST },
    });

    const planOfTenantB = await mealPlansService.create(tenantB.id, nutritionistB.id, Role.NUTRITIONIST, patientB.id, {
      title: 'Plano do outro tenant',
      effectiveFrom: '2026-08-01',
    });

    await expect(
      service.create(tenantA.id, nutritionistA.id, patientA.id, {
        entryDate: '2026-08-08',
        mealName: 'Tentativa com plano de outro tenant',
        mealPlanId: planOfTenantB.id,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    await prisma.mealPlan.delete({ where: { id: planOfTenantB.id } });
    await prisma.userClinic.deleteMany({ where: { userId: nutritionistB.id } });
    await prisma.user.delete({ where: { id: nutritionistB.id } });
  });

  it('review registra feedback profissional e nunca julga automaticamente', async () => {
    const created = await service.create(tenantA.id, nutritionistA.id, patientA.id, {
      entryDate: '2026-08-08',
      mealName: 'Jantar',
    });

    const reviewed = await service.review(tenantA.id, nutritionistA.id, created.id, {
      status: FoodDiaryStatus.REVIEWED,
      nutritionistFeedback: 'Boa escolha, continue assim.',
    });

    expect(reviewed.status).toBe(FoodDiaryStatus.REVIEWED);
    expect(reviewed.nutritionistFeedback).toBe('Boa escolha, continue assim.');
    expect(reviewed.reviewedByUser?.id).toBe(nutritionistA.id);
    expect(reviewed.reviewedAt).not.toBeNull();
  });

  it('rejeita marcar um registro como PENDING_REVIEW via review()', async () => {
    const created = await service.create(tenantA.id, nutritionistA.id, patientA.id, {
      entryDate: '2026-08-08',
      mealName: 'Refeição qualquer',
    });

    await expect(
      service.review(tenantA.id, nutritionistA.id, created.id, {
        status: FoodDiaryStatus.PENDING_REVIEW,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('archive é soft delete — some da listagem mas o registro permanece', async () => {
    const created = await service.create(tenantA.id, nutritionistA.id, patientA.id, {
      entryDate: '2026-08-08',
      mealName: 'Registro a arquivar',
    });

    await service.archive(tenantA.id, nutritionistA.id, created.id);

    const list = await service.list(tenantA.id, patientA.id);
    expect(list.some((e) => e.id === created.id)).toBe(false);
    await expect(service.getById(tenantA.id, created.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('filtra por status na listagem', async () => {
    const created = await service.create(tenantA.id, nutritionistA.id, patientA.id, {
      entryDate: '2026-08-09',
      mealName: 'Para filtrar',
    });
    await service.review(tenantA.id, nutritionistA.id, created.id, {
      status: FoodDiaryStatus.NO_REVIEW_NEEDED,
    });

    const reviewed = await service.list(tenantA.id, patientA.id, { status: FoodDiaryStatus.NO_REVIEW_NEEDED });
    expect(reviewed.some((e) => e.id === created.id)).toBe(true);

    const pending = await service.list(tenantA.id, patientA.id, { status: FoodDiaryStatus.PENDING_REVIEW });
    expect(pending.some((e) => e.id === created.id)).toBe(false);
  });
});
