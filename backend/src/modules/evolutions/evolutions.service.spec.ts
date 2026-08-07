import 'dotenv/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { Role } from '../../generated/prisma/client';
import { EvolutionsService } from './evolutions.service';

// Cada avaliação grava 3-4 tabelas relacionadas em sequência — dá mais
// margem que o padrão de 5s do Jest, sobretudo no primeiro teste do arquivo.
jest.setTimeout(15000);

describe('EvolutionsService (integração)', () => {
  let service: EvolutionsService;
  let prisma: PrismaService;

  let tenantA: { id: string };
  let tenantB: { id: string };
  let nutritionistA: { id: string };
  let patientA: { id: string };
  let patientB: { id: string };
  let receptionA: { id: string };

  const runId = Date.now();

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        EvolutionsService,
        AuditService,
        PrismaService,
        StorageService,
      ],
    }).compile();

    service = moduleRef.get(EvolutionsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    tenantA = await prisma.tenant.create({
      data: {
        name: 'Tenant Evolution A',
        slug: `evo-a-${runId}`,
        email: 'a@teste.com',
        phone: '11111111',
      },
    });
    tenantB = await prisma.tenant.create({
      data: {
        name: 'Tenant Evolution B',
        slug: `evo-b-${runId}`,
        email: 'b@teste.com',
        phone: '22222222',
      },
    });

    nutritionistA = await prisma.user.create({
      data: {
        name: 'Nutri Evo A',
        email: `nutri-evo-a-${runId}@teste.com`,
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
        name: 'Recepção Evo A',
        email: `reception-evo-a-${runId}@teste.com`,
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
      data: { tenantId: tenantA.id, fullName: 'Paciente Evolução A' },
    });
    patientB = await prisma.patient.create({
      data: { tenantId: tenantB.id, fullName: 'Paciente Evolução B' },
    });
  }, 20000);

  afterAll(async () => {
    await prisma.patientEvolution.deleteMany({
      where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
    await prisma.appointment.deleteMany({
      where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
    await prisma.appointmentType.deleteMany({
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

  it('persiste a data da avaliação exatamente como informada, sem deslocamento de fuso', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      patientA.id,
      {
        assessmentDate: '2026-08-06',
      },
    );
    expect(created.assessmentDate.toISOString().slice(0, 10)).toBe(
      '2026-08-06',
    );

    const fetched = await service.getById(tenantA.id, created.id);
    expect(fetched.assessmentDate.toISOString().slice(0, 10)).toBe(
      '2026-08-06',
    );

    const [inHistory] = await service.list(tenantA.id, patientA.id);
    expect(inHistory.assessmentDate.toISOString().slice(0, 10)).not.toBeNull();
  });

  it('cria uma avaliação com antropometria e calcula o IMC no servidor', async () => {
    const evolution = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      patientA.id,
      {
        assessmentDate: '2026-01-10',
        anthropometry: { weightKg: 80, heightCm: 160 },
      },
    );

    expect(evolution.anthropometry?.bmi).not.toBeNull();
    expect(Number(evolution.anthropometry?.bmi)).toBeCloseTo(31.25, 1);
  });

  it('nunca sobrescreve uma avaliação anterior — cada registro é independente', async () => {
    await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      patientA.id,
      {
        assessmentDate: '2026-02-10',
        anthropometry: { weightKg: 78 },
      },
    );

    const history = await service.list(tenantA.id, patientA.id);
    expect(history.length).toBeGreaterThanOrEqual(2);
    const weights = history
      .map((e) => e.anthropometry?.weightKg)
      .filter(Boolean);
    expect(new Set(weights).size).toBeGreaterThan(1);
  });

  it('não exige nutritionistUserId quando o próprio ator é nutricionista', async () => {
    const evolution = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      patientA.id,
      {
        assessmentDate: '2026-03-01',
      },
    );
    expect(evolution.nutritionistUser.id).toBe(nutritionistA.id);
  });

  it('exige nutritionistUserId explícito quando o ator não é nutricionista', async () => {
    await expect(
      service.create(tenantA.id, receptionA.id, Role.RECEPTION, patientA.id, {
        assessmentDate: '2026-03-05',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('isola avaliações por tenant', async () => {
    await expect(
      service.create(
        tenantA.id,
        nutritionistA.id,
        Role.NUTRITIONIST,
        patientB.id,
        { assessmentDate: '2026-03-10' },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('não calcula IMC sem peso ou altura, e não assume zero', async () => {
    const evolution = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      patientA.id,
      {
        assessmentDate: '2026-04-01',
        anthropometry: { waistCm: 90 },
      },
    );
    expect(evolution.anthropometry?.bmi).toBeNull();
    expect(evolution.anthropometry?.waistCm).not.toBeNull();
  });

  it('arquiva uma avaliação (soft delete) sem apagar o registro', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      patientA.id,
      {
        assessmentDate: '2026-05-01',
      },
    );
    const archived = await service.archive(
      tenantA.id,
      nutritionistA.id,
      created.id,
    );
    expect(archived.status).toBe('ARCHIVED');

    const listAfterArchive = await service.list(tenantA.id, patientA.id);
    expect(listAfterArchive.some((e) => e.id === created.id)).toBe(false);
  });

  it('compartilhamento não expõe clinicalNotes/internalNotes — só isSharedWithPatient e patientVisibleNotes', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      patientA.id,
      {
        assessmentDate: '2026-06-01',
        clinicalNotes: 'Nota interna sensível',
      },
    );

    const shared = await service.share(
      tenantA.id,
      nutritionistA.id,
      created.id,
      {
        isSharedWithPatient: true,
        patientVisibleNotes: 'Continue assim!',
      },
    );

    expect(shared.isSharedWithPatient).toBe(true);
    expect(shared.patientVisibleNotes).toBe('Continue assim!');
    expect(shared.clinicalNotes).toBe('Nota interna sensível');
    expect(shared.sharedByUserId).toBe(nutritionistA.id);
  });

  it('segmentar aceita múltiplos segmentos e métricas por avaliação', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      patientA.id,
      {
        assessmentDate: '2026-07-01',
        segmentalMeasurements: [
          { segment: 'TRUNK', metricType: 'FAT_MASS_KG', valueKg: 10 },
          { segment: 'TRUNK', metricType: 'LEAN_MASS_KG', valueKg: 20 },
          { segment: 'RIGHT_ARM', metricType: 'FAT_MASS_KG', valueKg: 1.2 },
        ],
      },
    );
    expect(created.segmentalMeasurements).toHaveLength(3);
  });

  it('salva proteína e minerais separadamente — nunca sinônimos entre si nem de massa óssea', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      patientA.id,
      {
        assessmentDate: '2026-07-05',
        bioimpedance: { proteinKg: 11.9, mineralMassKg: 3.6, boneMassKg: 2.9 },
      },
    );

    expect(Number(created.bioimpedance?.proteinKg)).toBeCloseTo(11.9, 1);
    expect(Number(created.bioimpedance?.mineralMassKg)).toBeCloseTo(3.6, 1);
    expect(Number(created.bioimpedance?.boneMassKg)).toBeCloseTo(2.9, 1);
  });

  it('salva a pontuação corporal fornecida pelo equipamento sem calculá-la', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      patientA.id,
      {
        assessmentDate: '2026-07-10',
        bioimpedance: {
          bodyCompositionScore: 81,
          bodyCompositionScoreMaximum: 100,
          bodyCompositionScoreLabel: 'Pontuação da composição corporal',
          bodyCompositionScoreSource: 'Equipamento fictício',
        },
      },
    );

    expect(created.bioimpedance?.bodyCompositionScore).toBe(81);
    expect(created.bioimpedance?.bodyCompositionScoreMaximum).toBe(100);
    expect(created.bioimpedance?.bodyCompositionScoreLabel).toBe(
      'Pontuação da composição corporal',
    );
  });

  it('salva peso de referência e ajustes positivos, negativos e zero, sem interpretar o sinal', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      patientA.id,
      {
        assessmentDate: '2026-07-15',
        bioimpedance: {
          referenceWeightKg: 70.4,
          recommendedWeightChangeKg: -9,
          recommendedFatChangeKg: -9,
          recommendedMuscleChangeKg: 0,
        },
      },
    );

    expect(Number(created.bioimpedance?.referenceWeightKg)).toBeCloseTo(
      70.4,
      1,
    );
    expect(Number(created.bioimpedance?.recommendedWeightChangeKg)).toBe(-9);
    expect(Number(created.bioimpedance?.recommendedFatChangeKg)).toBe(-9);
    expect(Number(created.bioimpedance?.recommendedMuscleChangeKg)).toBe(0);
  });

  it('salva gordura visceral como nível e grau de obesidade separado do percentual de gordura', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      patientA.id,
      {
        assessmentDate: '2026-07-20',
        bioimpedance: {
          visceralFatLevel: 8,
          obesityDegreePercent: 137,
          bodyFatPercent: 24.7,
        },
      },
    );

    expect(Number(created.bioimpedance?.visceralFatLevel)).toBe(8);
    expect(Number(created.bioimpedance?.obesityDegreePercent)).toBeCloseTo(
      137,
      0,
    );
    expect(Number(created.bioimpedance?.bodyFatPercent)).toBeCloseTo(24.7, 1);
    expect(created.bioimpedance?.obesityDegreePercent).not.toBe(
      created.bioimpedance?.bodyFatPercent,
    );
  });

  it('salva massa magra e gordura para os cinco segmentos com indicador de estimativa', async () => {
    const segments = [
      'RIGHT_ARM',
      'LEFT_ARM',
      'TRUNK',
      'RIGHT_LEG',
      'LEFT_LEG',
    ] as const;
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      patientA.id,
      {
        assessmentDate: '2026-07-25',
        segmentalMeasurements: segments.flatMap((segment) => [
          { segment, metricType: 'LEAN_MASS_KG' as const, valueKg: 5 },
          {
            segment,
            metricType: 'FAT_MASS_KG' as const,
            valueKg: 1,
            isEstimated: true,
          },
        ]),
      },
    );

    expect(created.segmentalMeasurements).toHaveLength(10);
    expect(
      created.segmentalMeasurements.every(
        (m) => m.metricType !== 'FAT_MASS_KG' || m.isEstimated,
      ),
    ).toBe(true);
  });

  it('salva múltiplas frequências de impedância segmentar', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      patientA.id,
      {
        assessmentDate: '2026-07-30',
        bioimpedance: { bodyFatPercent: 20 },
        segmentalImpedanceMeasurements: [
          { frequencyValue: 20, rightArmOhms: 200, leftArmOhms: 205 },
          { frequencyValue: 100, rightArmOhms: 180, leftArmOhms: 182 },
        ],
      },
    );

    expect(created.bioimpedance?.segmentalImpedanceMeasurements).toHaveLength(
      2,
    );
    const frequencies =
      created.bioimpedance?.segmentalImpedanceMeasurements.map((m) =>
        Number(m.frequencyValue),
      );
    expect(frequencies).toEqual(expect.arrayContaining([20, 100]));
  });

  it('não exige impedância para salvar uma avaliação', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      patientA.id,
      {
        assessmentDate: '2026-08-01',
        anthropometry: { weightKg: 75 },
      },
    );
    expect(created.bioimpedance).toBeNull();
  });

  it('salva faixas de referência genéricas por campo, sem diagnosticar automaticamente', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      patientA.id,
      {
        assessmentDate: '2026-08-05',
        referenceRanges: [
          {
            fieldKey: 'bodyWaterLiters',
            minValue: 32.5,
            maxValue: 39.7,
            unit: 'L',
            source: 'Equipamento fictício',
          },
        ],
      },
    );

    expect(created.referenceRanges).toHaveLength(1);
    expect(created.referenceRanges[0].fieldKey).toBe('bodyWaterLiters');
    expect(Number(created.referenceRanges[0].minValue)).toBeCloseTo(32.5, 1);
  });

  describe('vínculo com consulta (Appointment)', () => {
    it('vincula a evolução à consulta informada quando pertence ao mesmo paciente', async () => {
      const appointmentType = await prisma.appointmentType.create({
        data: {
          tenantId: tenantA.id,
          name: `Retorno-${runId}`,
          defaultDurationMinutes: 40,
        },
      });
      const appointment = await prisma.appointment.create({
        data: {
          tenantId: tenantA.id,
          patientId: patientA.id,
          nutritionistUserId: nutritionistA.id,
          appointmentTypeId: appointmentType.id,
          scheduledAt: new Date('2026-08-10T14:00:00.000Z'),
          durationMinutes: 40,
          createdByUserId: nutritionistA.id,
        },
      });

      const created = await service.create(
        tenantA.id,
        nutritionistA.id,
        Role.NUTRITIONIST,
        patientA.id,
        {
          assessmentDate: '2026-08-10',
          appointmentId: appointment.id,
        },
      );

      expect(created.appointment?.id).toBe(appointment.id);
    });

    it('bloqueia vínculo com consulta de outro paciente', async () => {
      const appointmentType = await prisma.appointmentType.create({
        data: {
          tenantId: tenantA.id,
          name: `Retorno-outro-paciente-${runId}`,
          defaultDurationMinutes: 40,
        },
      });
      const appointmentOfPatientB = await prisma.appointment.create({
        data: {
          tenantId: tenantA.id,
          patientId: patientB.id,
          nutritionistUserId: nutritionistA.id,
          appointmentTypeId: appointmentType.id,
          scheduledAt: new Date('2026-08-11T14:00:00.000Z'),
          durationMinutes: 40,
          createdByUserId: nutritionistA.id,
        },
      });

      await expect(
        service.create(
          tenantA.id,
          nutritionistA.id,
          Role.NUTRITIONIST,
          patientA.id,
          {
            assessmentDate: '2026-08-11',
            appointmentId: appointmentOfPatientB.id,
          },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('bloqueia vínculo com consulta de outro tenant', async () => {
      const otherTenant = await prisma.tenant.create({
        data: {
          name: 'Tenant Evolution C',
          slug: `evo-c-${runId}`,
          email: 'c@teste.com',
          phone: '33333333',
        },
      });
      const otherType = await prisma.appointmentType.create({
        data: {
          tenantId: otherTenant.id,
          name: 'Retorno',
          defaultDurationMinutes: 40,
        },
      });
      const otherNutri = await prisma.user.create({
        data: {
          name: 'Nutri C',
          email: `nutri-evo-c-${runId}@teste.com`,
          passwordHash: 'x',
        },
      });
      const otherPatient = await prisma.patient.create({
        data: { tenantId: otherTenant.id, fullName: 'Paciente Evolução C' },
      });
      const appointmentOfOtherTenant = await prisma.appointment.create({
        data: {
          tenantId: otherTenant.id,
          patientId: otherPatient.id,
          nutritionistUserId: otherNutri.id,
          appointmentTypeId: otherType.id,
          scheduledAt: new Date('2026-08-12T14:00:00.000Z'),
          durationMinutes: 40,
          createdByUserId: otherNutri.id,
        },
      });

      await expect(
        service.create(
          tenantA.id,
          nutritionistA.id,
          Role.NUTRITIONIST,
          patientA.id,
          {
            assessmentDate: '2026-08-12',
            appointmentId: appointmentOfOtherTenant.id,
          },
        ),
      ).rejects.toThrow(NotFoundException);

      await prisma.appointment.deleteMany({
        where: { tenantId: otherTenant.id },
      });
      await prisma.appointmentType.deleteMany({
        where: { tenantId: otherTenant.id },
      });
      await prisma.patient.deleteMany({ where: { tenantId: otherTenant.id } });
      await prisma.user.delete({ where: { id: otherNutri.id } });
      await prisma.tenant.delete({ where: { id: otherTenant.id } });
    });
  });
});
