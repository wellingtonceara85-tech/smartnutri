import 'dotenv/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  MealPlanOrganizationType,
  MealPlanStatus,
  Role,
} from '../../generated/prisma/client';
import { MealPlansService } from './meal-plans.service';

jest.setTimeout(15000);

describe('MealPlansService (integração)', () => {
  let service: MealPlansService;
  let prisma: PrismaService;

  let tenantA: { id: string };
  let tenantB: { id: string };
  let nutritionistA: { id: string };
  let receptionA: { id: string };
  let patientA: { id: string };
  let patientB: { id: string };

  const runId = Date.now();

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [MealPlansService, AuditService, PrismaService],
    }).compile();

    service = moduleRef.get(MealPlansService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    tenantA = await prisma.tenant.create({
      data: {
        name: 'Tenant MealPlan A',
        slug: `mp-a-${runId}`,
        email: 'a@teste.com',
        phone: '11111111',
      },
    });
    tenantB = await prisma.tenant.create({
      data: {
        name: 'Tenant MealPlan B',
        slug: `mp-b-${runId}`,
        email: 'b@teste.com',
        phone: '22222222',
      },
    });

    nutritionistA = await prisma.user.create({
      data: {
        name: 'Nutri MealPlan A',
        email: `nutri-mp-a-${runId}@teste.com`,
        passwordHash: 'x',
      },
    });
    await prisma.userClinic.create({
      data: {
        userId: nutritionistA.id,
        tenantId: tenantA.id,
        role: Role.NUTRITIONIST,
      },
    });

    receptionA = await prisma.user.create({
      data: {
        name: 'Recepção MealPlan A',
        email: `reception-mp-a-${runId}@teste.com`,
        passwordHash: 'x',
      },
    });
    await prisma.userClinic.create({
      data: {
        userId: receptionA.id,
        tenantId: tenantA.id,
        role: Role.RECEPTION,
      },
    });

    patientA = await prisma.patient.create({
      data: { tenantId: tenantA.id, fullName: 'Paciente MealPlan A' },
    });
    patientB = await prisma.patient.create({
      data: { tenantId: tenantB.id, fullName: 'Paciente MealPlan B' },
    });
  }, 20000);

  afterAll(async () => {
    await prisma.mealPlan.deleteMany({
      where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
    await prisma.patient.deleteMany({
      where: { id: { in: [patientA.id, patientB.id] } },
    });
    await prisma.userClinic.deleteMany({
      where: { userId: { in: [nutritionistA.id, receptionA.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [nutritionistA.id, receptionA.id] } },
    });
    await prisma.tenant.delete({ where: { id: tenantA.id } });
    await prisma.tenant.delete({ where: { id: tenantB.id } });
    await prisma.$disconnect();
  });

  it('cria um plano com dia, refeições, itens e substituições aninhados', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      patientA.id,
      {
        title: 'Plano inicial',
        effectiveFrom: '2026-08-01',
        organizationType: MealPlanOrganizationType.DAILY,
        days: [
          {
            name: 'Rotina diária',
            meals: [
              {
                name: 'Café da manhã',
                scheduledTime: '08:00',
                items: [
                  {
                    description: 'Pão integral',
                    quantity: 2,
                    unit: 'fatias',
                    substitutions: [
                      { description: 'Tapioca', quantity: 1, unit: 'unidade' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    );

    expect(created.status).toBe(MealPlanStatus.DRAFT);
    expect(created.version).toBe(1);
    expect(created.days).toHaveLength(1);
    expect(created.days[0].meals).toHaveLength(1);
    expect(created.days[0].meals[0].items).toHaveLength(1);
    expect(created.days[0].meals[0].items[0].substitutions).toHaveLength(1);
    expect(created.days[0].meals[0].items[0].substitutions[0].description).toBe(
      'Tapioca',
    );
  });

  it('sem organizationType e sem days, assume DAILY com um dia "Rotina diária" implícito', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      patientA.id,
      {
        title: 'Plano sem organização explícita',
        effectiveFrom: '2026-08-01',
      },
    );

    expect(created.organizationType).toBe(MealPlanOrganizationType.DAILY);
    expect(created.days).toHaveLength(1);
    expect(created.days[0].name).toBe('Rotina diária');
    expect(created.days[0].meals).toHaveLength(0);
  });

  it('cria um plano WEEKLY com dias distintos por dia da semana', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      patientA.id,
      {
        title: 'Plano semanal',
        effectiveFrom: '2026-08-01',
        organizationType: MealPlanOrganizationType.WEEKLY,
        days: [
          {
            name: 'Segunda-feira',
            weekDay: 'MONDAY',
            dayNumber: 1,
            meals: [{ name: 'Almoço' }],
          },
          {
            name: 'Terça-feira',
            weekDay: 'TUESDAY',
            dayNumber: 2,
            meals: [],
          },
        ],
      },
    );

    expect(created.organizationType).toBe(MealPlanOrganizationType.WEEKLY);
    expect(created.days).toHaveLength(2);
    expect(
      created.days.find((d) => d.name === 'Segunda-feira')?.meals,
    ).toHaveLength(1);
    expect(
      created.days.find((d) => d.name === 'Terça-feira')?.meals,
    ).toHaveLength(0);
  });

  it('cria um plano CUSTOM_CYCLE com dias livres e cycleLength', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      patientA.id,
      {
        title: 'Ciclo personalizado',
        effectiveFrom: '2026-08-01',
        organizationType: MealPlanOrganizationType.CUSTOM_CYCLE,
        cycleLength: 3,
        days: [
          {
            name: 'Dia de treino',
            dayNumber: 1,
            meals: [{ name: 'Pós-treino' }],
          },
          { name: 'Dia sem treino', dayNumber: 2, meals: [] },
        ],
      },
    );

    expect(created.organizationType).toBe(
      MealPlanOrganizationType.CUSTOM_CYCLE,
    );
    expect(created.cycleLength).toBe(3);
    expect(created.days.map((d) => d.name)).toEqual([
      'Dia de treino',
      'Dia sem treino',
    ]);
  });

  it('não exige nutritionistUserId quando o próprio ator é nutricionista', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      patientA.id,
      {
        title: 'Plano auto-atribuído',
        effectiveFrom: '2026-08-01',
      },
    );
    expect(created.nutritionistUser.id).toBe(nutritionistA.id);
  });

  it('exige nutritionistUserId explícito quando o ator não é nutricionista', async () => {
    await expect(
      service.create(tenantA.id, receptionA.id, Role.RECEPTION, patientA.id, {
        title: 'Tentativa recepção',
        effectiveFrom: '2026-08-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('isola planos por tenant — paciente de outro tenant não é encontrado', async () => {
    await expect(
      service.create(
        tenantA.id,
        nutritionistA.id,
        Role.NUTRITIONIST,
        patientB.id,
        {
          title: 'Tentativa cross-tenant',
          effectiveFrom: '2026-08-01',
        },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update com days substitui a árvore inteira (nunca mescla)', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      patientA.id,
      {
        title: 'Plano a editar',
        effectiveFrom: '2026-08-01',
        days: [
          {
            name: 'Rotina diária',
            meals: [{ name: 'Almoço', items: [{ description: 'Arroz' }] }],
          },
        ],
      },
    );

    const updated = await service.update(
      tenantA.id,
      nutritionistA.id,
      created.id,
      {
        days: [
          {
            name: 'Rotina diária',
            meals: [{ name: 'Jantar', items: [{ description: 'Sopa' }] }],
          },
        ],
      },
    );

    expect(updated.days).toHaveLength(1);
    expect(updated.days[0].meals).toHaveLength(1);
    expect(updated.days[0].meals[0].name).toBe('Jantar');
    expect(
      updated.days[0].meals.find((m) => m.name === 'Almoço'),
    ).toBeUndefined();
  });

  it('update permite reorganizar em vários dias (ex.: virar semanal) preservando os IDs de dia antigos como novos', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      patientA.id,
      {
        title: 'Plano que vira semanal',
        effectiveFrom: '2026-08-01',
        days: [{ name: 'Rotina diária', meals: [{ name: 'Almoço' }] }],
      },
    );
    const originalDayId = created.days[0].id;

    const updated = await service.update(
      tenantA.id,
      nutritionistA.id,
      created.id,
      {
        organizationType: MealPlanOrganizationType.WEEKLY,
        days: [
          {
            name: 'Segunda-feira',
            weekDay: 'MONDAY',
            dayNumber: 1,
            meals: [{ name: 'Almoço' }],
          },
          {
            name: 'Terça-feira',
            weekDay: 'TUESDAY',
            dayNumber: 2,
            meals: [],
          },
        ],
      },
    );

    expect(updated.organizationType).toBe(MealPlanOrganizationType.WEEKLY);
    expect(updated.days).toHaveLength(2);
    expect(updated.days.every((d) => d.id !== originalDayId)).toBe(true);
  });

  it('activate marca o plano anterior ACTIVE como REPLACED, nunca apaga', async () => {
    const first = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      patientA.id,
      {
        title: 'Plano v1 ativo',
        effectiveFrom: '2026-08-01',
      },
    );
    await service.activate(tenantA.id, nutritionistA.id, first.id);

    const second = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      patientA.id,
      {
        title: 'Plano v2 substituto',
        effectiveFrom: '2026-08-15',
      },
    );
    const activatedSecond = await service.activate(
      tenantA.id,
      nutritionistA.id,
      second.id,
    );

    expect(activatedSecond.status).toBe(MealPlanStatus.ACTIVE);
    const previous = await service.getById(tenantA.id, first.id);
    expect(previous.status).toBe(MealPlanStatus.REPLACED);
  });

  it('só permite ativar um plano em DRAFT', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      patientA.id,
      {
        title: 'Plano para ativar duas vezes',
        effectiveFrom: '2026-08-01',
      },
    );
    await service.activate(tenantA.id, nutritionistA.id, created.id);

    await expect(
      service.activate(tenantA.id, nutritionistA.id, created.id),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('duplicate cria uma cópia totalmente independente (sem parentMealPlanId), com dias e refeições em IDs novos', async () => {
    const original = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      patientA.id,
      {
        title: 'Plano original para duplicar',
        effectiveFrom: '2026-08-01',
        days: [
          {
            name: 'Rotina diária',
            meals: [{ name: 'Lanche', items: [{ description: 'Iogurte' }] }],
          },
        ],
      },
    );

    const copy = await service.duplicate(
      tenantA.id,
      nutritionistA.id,
      original.id,
    );

    expect(copy.id).not.toBe(original.id);
    expect(copy.parentMealPlanId).toBeNull();
    expect(copy.version).toBe(1);
    expect(copy.status).toBe(MealPlanStatus.DRAFT);
    expect(copy.days[0].id).not.toBe(original.days[0].id);
    expect(copy.days[0].meals[0].id).not.toBe(original.days[0].meals[0].id);
    expect(copy.days[0].meals[0].items[0].id).not.toBe(
      original.days[0].meals[0].items[0].id,
    );
    expect(copy.days[0].meals[0].name).toBe('Lanche');

    // Editar a cópia não deve afetar o original — árvores independentes.
    await service.update(tenantA.id, nutritionistA.id, copy.id, {
      days: [{ name: 'Rotina diária', meals: [{ name: 'Lanche editado' }] }],
    });
    const originalAfter = await service.getById(tenantA.id, original.id);
    expect(originalAfter.days[0].meals[0].name).toBe('Lanche');
  });

  it('new-version cria uma versão encadeada e mantém o plano original intocado, com dias em IDs novos', async () => {
    const original = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      patientA.id,
      {
        title: 'Plano original para versionar',
        effectiveFrom: '2026-08-01',
        days: [
          {
            name: 'Rotina diária',
            meals: [{ name: 'Ceia', items: [{ description: 'Chá' }] }],
          },
        ],
      },
    );
    await service.activate(tenantA.id, nutritionistA.id, original.id);

    const nextVersion = await service.createNewVersion(
      tenantA.id,
      nutritionistA.id,
      original.id,
    );

    expect(nextVersion.parentMealPlanId).toBe(original.id);
    expect(nextVersion.version).toBe(original.version + 1);
    expect(nextVersion.status).toBe(MealPlanStatus.DRAFT);
    expect(nextVersion.days[0].id).not.toBe(original.days[0].id);

    const originalAfter = await service.getById(tenantA.id, original.id);
    expect(originalAfter.status).toBe(MealPlanStatus.ACTIVE);
  });

  it('archive é soft delete — some da listagem mas o registro permanece', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      patientA.id,
      {
        title: 'Plano para arquivar',
        effectiveFrom: '2026-08-01',
      },
    );
    const archived = await service.archive(
      tenantA.id,
      nutritionistA.id,
      created.id,
    );
    expect(archived.status).toBe(MealPlanStatus.ARCHIVED);

    const list = await service.list(tenantA.id, patientA.id);
    expect(list.some((p) => p.id === created.id)).toBe(false);
  });

  it('share não expõe internalNotes — só isSharedWithPatient e patientVisibleNotes mudam', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      patientA.id,
      {
        title: 'Plano para compartilhar',
        effectiveFrom: '2026-08-01',
        internalNotes: 'Nota interna sensível — nunca para o paciente',
      },
    );

    const shared = await service.share(
      tenantA.id,
      nutritionistA.id,
      created.id,
      {
        isSharedWithPatient: true,
        patientVisibleNotes: 'Siga o plano com atenção!',
      },
    );

    expect(shared.isSharedWithPatient).toBe(true);
    expect(shared.patientVisibleNotes).toBe('Siga o plano com atenção!');
    expect(shared.internalNotes).toBe(
      'Nota interna sensível — nunca para o paciente',
    );
    expect(shared.sharedByUserId).toBe(nutritionistA.id);
  });

  it('MealPlanDay respeita isolamento de tenant — dia de um tenant não vaza para outro na listagem', async () => {
    const createdA = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      patientA.id,
      {
        title: 'Plano tenant A',
        effectiveFrom: '2026-08-01',
        days: [{ name: 'Rotina diária', meals: [{ name: 'Almoço' }] }],
      },
    );

    const dayCountOtherTenant = await prisma.mealPlanDay.count({
      where: { id: createdA.days[0].id, tenantId: tenantB.id },
    });
    expect(dayCountOtherTenant).toBe(0);

    const dayCountOwnTenant = await prisma.mealPlanDay.count({
      where: { id: createdA.days[0].id, tenantId: tenantA.id },
    });
    expect(dayCountOwnTenant).toBe(1);
  });
});
