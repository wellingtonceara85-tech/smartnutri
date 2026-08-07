import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  AppointmentModality,
  AppointmentStatus,
  Gender,
  PatientStatus,
  PrismaClient,
  Role,
} from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DEMO_PASSWORD = 'Demo@123456';
const BCRYPT_ROUNDS = 12;

/** Gera um CPF fictício válido (dígitos verificadores corretos) a partir de 9 dígitos base. */
function buildFakeCpf(base9: string): string {
  const calcDigit = (digits: string, weightStart: number): number => {
    let sum = 0;
    for (let i = 0; i < digits.length; i++)
      sum += Number(digits[i]) * (weightStart - i);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const d1 = calcDigit(base9, 10);
  const d2 = calcDigit(base9 + String(d1), 11);
  return `${base9}${d1}${d2}`;
}

async function upsertPlan(
  tenantId: string,
  data: {
    name: string;
    description: string;
    durationMonths: number;
    suggestedAppointments: number;
    suggestedIntervalDays: number;
    defaultPrice: number;
    defaultInstallments: number;
  },
) {
  const existing = await prisma.plan.findFirst({
    where: { tenantId, name: data.name, deletedAt: null },
  });
  if (existing) {
    return prisma.plan.update({ where: { id: existing.id }, data });
  }
  return prisma.plan.create({ data: { ...data, tenantId } });
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'clinica-demo' },
    update: {},
    create: {
      name: 'Ambiente demo SmartNutri',
      slug: 'clinica-demo',
      email: 'contato@clinicademo.com.br',
      phone: '(11) 4000-0000',
      addressLine: 'Rua das Flores, 123',
      city: 'São Paulo',
      state: 'SP',
      cancellationPolicyText:
        'Cancelamentos devem ser avisados com pelo menos 24h de antecedência.',
      cancellationMinHoursNotice: 24,
      receiptNumberPrefix: 'REC',
    },
  });

  // Identidade do profissional — nome fictício de demonstração, nunca um
  // nome de clínica fixo; o tenant acima é só infraestrutura multi-empresa.
  await prisma.professionalProfile.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      displayName: 'Nutri Nutricionista',
      professionalName: 'Nutri Nutricionista',
      professionalTitle: 'Nutricionista Clínica',
      crnNumber: '12345',
      crnState: 'SP',
      specialty: 'Nutrição clínica e comportamental',
      shortBio:
        'Atendimento nutricional individualizado, com acompanhamento de evolução corporal.',
      primaryPhone: '(11) 4000-0000',
      whatsappPhone: '(11) 98888-0000',
      email: 'nutricionista@clinicademo.com.br',
    },
  });

  const demoUsers: { name: string; email: string; role: Role }[] = [
    {
      name: 'Ana Administradora',
      email: 'admin@clinicademo.com.br',
      role: Role.ADMIN,
    },
    {
      name: 'Nutri Nutricionista',
      email: 'nutricionista@clinicademo.com.br',
      role: Role.NUTRITIONIST,
    },
    {
      name: 'Rita Recepção',
      email: 'recepcao@clinicademo.com.br',
      role: Role.RECEPTION,
    },
  ];

  const userIdByEmail = new Map<string, string>();

  for (const demoUser of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: demoUser.email },
      update: {},
      create: { name: demoUser.name, email: demoUser.email, passwordHash },
    });
    userIdByEmail.set(demoUser.email, user.id);

    await prisma.userClinic.upsert({
      where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
      update: {},
      create: { userId: user.id, tenantId: tenant.id, role: demoUser.role },
    });
  }

  const nutritionistUserId = userIdByEmail.get(
    'nutricionista@clinicademo.com.br',
  )!;

  const paymentMethods = [
    'PIX',
    'Dinheiro',
    'Cartão de Crédito',
    'Cartão de Débito',
    'Transferência',
    'Boleto',
    'Outro',
  ];
  for (const name of paymentMethods) {
    await prisma.paymentMethod.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name } },
      update: {},
      create: { tenantId: tenant.id, name },
    });
  }

  const appointmentTypes: { name: string; defaultDurationMinutes: number }[] = [
    { name: 'Primeira consulta', defaultDurationMinutes: 60 },
    { name: 'Retorno', defaultDurationMinutes: 40 },
    { name: 'Avaliação', defaultDurationMinutes: 60 },
    { name: 'Acompanhamento', defaultDurationMinutes: 30 },
    { name: 'Encaixe', defaultDurationMinutes: 20 },
    { name: 'Outro', defaultDurationMinutes: 30 },
  ];
  for (const type of appointmentTypes) {
    await prisma.appointmentType.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: type.name } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: type.name,
        defaultDurationMinutes: type.defaultDurationMinutes,
      },
    });
  }

  await upsertPlan(tenant.id, {
    name: 'Plano Trimestral',
    description: 'Acompanhamento nutricional por 3 meses',
    durationMonths: 3,
    suggestedAppointments: 3,
    suggestedIntervalDays: 30,
    defaultPrice: 900,
    defaultInstallments: 3,
  });

  await upsertPlan(tenant.id, {
    name: 'Plano Semestral',
    description: 'Acompanhamento nutricional por 6 meses',
    durationMonths: 6,
    suggestedAppointments: 6,
    suggestedIntervalDays: 30,
    defaultPrice: 1600,
    defaultInstallments: 6,
  });

  // Pacientes fictícios cobrindo os cenários exigidos para testes manuais:
  // ativo/inativo/pausado, com/sem nutricionista responsável, com/sem CPF.
  const patients: Array<{
    fullName: string;
    status: PatientStatus;
    cpf?: string;
    gender?: Gender;
    responsibleNutritionistId?: string;
    primaryPhone?: string;
    whatsappPhone?: string;
    email?: string;
    source?: string;
  }> = [
    {
      fullName: 'Beatriz Almeida Santos',
      status: PatientStatus.ACTIVE,
      cpf: buildFakeCpf('111444777'),
      gender: Gender.FEMALE,
      responsibleNutritionistId: nutritionistUserId,
      primaryPhone: '11988881111',
      whatsappPhone: '11988881111',
      email: 'beatriz.santos@example.com',
      source: 'Instagram',
    },
    {
      fullName: 'Carlos Eduardo Souza',
      status: PatientStatus.ACTIVE,
      gender: Gender.MALE,
      primaryPhone: '11988882222',
      email: 'carlos.souza@example.com',
      source: 'Indicação',
    },
    {
      fullName: 'Daniela Ferreira Lima',
      status: PatientStatus.INACTIVE,
      cpf: buildFakeCpf('222555888'),
      gender: Gender.FEMALE,
      responsibleNutritionistId: nutritionistUserId,
      primaryPhone: '11988883333',
      source: 'Google',
    },
    {
      fullName: 'Eduardo Costa Pereira',
      status: PatientStatus.PAUSED,
      gender: Gender.MALE,
      primaryPhone: '11988884444',
      whatsappPhone: '11988884444',
      source: 'Indicação',
    },
    {
      fullName: 'Fernanda Oliveira Rocha',
      status: PatientStatus.ACTIVE,
      responsibleNutritionistId: nutritionistUserId,
      gender: Gender.FEMALE,
      email: 'fernanda.rocha@example.com',
      source: 'Instagram',
    },
    {
      fullName: 'Gabriel Martins Rocha',
      status: PatientStatus.DISCHARGED,
      cpf: buildFakeCpf('333666999'),
      gender: Gender.MALE,
      primaryPhone: '11988886666',
      source: 'Google',
    },
  ];

  const patientIdByName = new Map<string, string>();
  for (const patient of patients) {
    const existing = await prisma.patient.findFirst({
      where: { tenantId: tenant.id, fullName: patient.fullName },
    });
    const record =
      existing ??
      (await prisma.patient.create({
        data: { ...patient, tenantId: tenant.id },
      }));
    patientIdByName.set(patient.fullName, record.id);
  }

  // Evolução corporal de exemplo — três avaliações independentes de Beatriz,
  // mostrando queda de peso/gordura ao longo do tempo (histórico + comparação + gráficos).
  const beatrizId = patientIdByName.get('Beatriz Almeida Santos')!;
  await prisma.patient.update({
    where: { id: beatrizId },
    data: { bodySilhouettePreference: 'FEMALE' },
  });

  const evolutionSeeds = [
    {
      daysAgo: 90,
      weightKg: 78,
      waistCm: 88,
      hipCm: 108,
      bodyFatPercent: 34,
      muscleMassKg: 24,
    },
    {
      daysAgo: 45,
      weightKg: 75,
      waistCm: 84,
      hipCm: 105,
      bodyFatPercent: 31,
      muscleMassKg: 24.5,
    },
    {
      daysAgo: 5,
      weightKg: 72,
      waistCm: 80,
      hipCm: 102,
      bodyFatPercent: 27,
      muscleMassKg: 25.5,
    },
  ];

  for (const seedData of evolutionSeeds) {
    const assessmentDate = new Date(
      Date.now() - seedData.daysAgo * 24 * 60 * 60 * 1000,
    );
    const heightCm = 165;
    const bmi =
      Math.round((seedData.weightKg / (heightCm / 100) ** 2) * 100) / 100;

    const existingEvolution = await prisma.patientEvolution.findFirst({
      where: { tenantId: tenant.id, patientId: beatrizId, assessmentDate },
    });
    if (existingEvolution) continue;

    await prisma.patientEvolution.create({
      data: {
        tenantId: tenant.id,
        patientId: beatrizId,
        nutritionistUserId,
        createdByUserId: nutritionistUserId,
        assessmentDate,
        title: seedData.daysAgo === 90 ? 'Avaliação inicial' : undefined,
        objective: 'Redução de gordura corporal com manutenção de massa magra',
        anthropometry: {
          create: {
            tenantId: tenant.id,
            weightKg: seedData.weightKg,
            heightCm,
            bmi,
            bmiClassification:
              bmi < 25
                ? 'Peso adequado'
                : bmi < 30
                  ? 'Sobrepeso'
                  : 'Obesidade grau I',
            waistCm: seedData.waistCm,
            hipCm: seedData.hipCm,
          },
        },
        bioimpedance: {
          create: {
            tenantId: tenant.id,
            bodyFatPercent: seedData.bodyFatPercent,
            muscleMassKg: seedData.muscleMassKg,
            bodyWaterPercent: 52,
            // Campos abaixo só na avaliação mais recente — mostra o preenchimento completo sem repetir em todas.
            ...(seedData.daysAgo === 5
              ? {
                  proteinKg: 10.8,
                  mineralMassKg: 3.1,
                  boneMassKg: 2.6,
                  visceralFatLevel: 6,
                  obesityDegreePercent: 108,
                  bodyCompositionScore: 84,
                  bodyCompositionScoreMaximum: 100,
                  bodyCompositionScoreLabel: 'Pontuação da composição corporal',
                  bodyCompositionScoreSource: 'Bioimpedância de demonstração',
                  referenceWeightKg: 68,
                  recommendedWeightChangeKg: -4,
                  recommendedFatChangeKg: -6,
                  recommendedMuscleChangeKg: 2,
                  segmentalImpedanceMeasurements: {
                    create: [
                      {
                        tenantId: tenant.id,
                        frequencyValue: 20,
                        rightArmOhms: 205,
                        leftArmOhms: 208,
                        trunkOhms: 19,
                        rightLegOhms: 178,
                        leftLegOhms: 181,
                      },
                      {
                        tenantId: tenant.id,
                        frequencyValue: 100,
                        rightArmOhms: 180,
                        leftArmOhms: 183,
                        trunkOhms: 16,
                        rightLegOhms: 156,
                        leftLegOhms: 159,
                      },
                    ],
                  },
                }
              : {}),
          },
        },
        segmentalMeasurements: {
          create: [
            {
              tenantId: tenant.id,
              segment: 'TRUNK',
              metricType: 'FAT_MASS_KG',
              valueKg: seedData.weightKg * 0.18,
              isEstimated: true,
            },
            {
              tenantId: tenant.id,
              segment: 'TRUNK',
              metricType: 'LEAN_MASS_KG',
              valueKg: seedData.muscleMassKg * 0.4,
            },
          ],
        },
        referenceRanges:
          seedData.daysAgo === 5
            ? {
                create: [
                  {
                    tenantId: tenant.id,
                    fieldKey: 'bodyWaterLiters',
                    minValue: 30,
                    maxValue: 37,
                    unit: 'L',
                    source: 'Bioimpedância de demonstração',
                  },
                ],
              }
            : undefined,
      },
    });
  }

  // ------------------------------------------------------------------------
  // Consultas fictícias (Missão 0004) — cobrem os principais status/cenários
  // exigidos: passadas/hoje/futuras, confirmada/aguardando/realizada/
  // cancelada/falta/reagendada, online/presencial, e um vínculo consulta→
  // evolução. Idempotente por contagem: só roda na primeira execução do seed.
  const existingAppointmentsCount = await prisma.appointment.count({
    where: { tenantId: tenant.id },
  });

  if (existingAppointmentsCount === 0) {
    const typeIdByName = new Map<string, string>();
    for (const type of appointmentTypes) {
      const record = await prisma.appointmentType.findFirstOrThrow({
        where: { tenantId: tenant.id, name: type.name },
      });
      typeIdByName.set(type.name, record.id);
    }

    const carlosId = patientIdByName.get('Carlos Eduardo Souza')!;
    const danielaId = patientIdByName.get('Daniela Ferreira Lima')!;
    const eduardoId = patientIdByName.get('Eduardo Costa Pereira')!;
    const fernandaId = patientIdByName.get('Fernanda Oliveira Rocha')!;

    const atHour = (daysOffset: number, hour: number, minute = 0): Date => {
      const date = new Date();
      date.setDate(date.getDate() + daysOffset);
      date.setHours(hour, minute, 0, 0);
      return date;
    };

    interface AppointmentFixture {
      patientId: string;
      typeName: string;
      scheduledAt: Date;
      durationMinutes: number;
      modality: AppointmentModality;
      status: AppointmentStatus;
      location?: string;
      onlineMeetingUrl?: string;
      confirmedAt?: Date;
      completedAt?: Date;
      cancelledAt?: Date;
      cancellationReason?: string;
      noShowAt?: Date;
      clinicalNotes?: string;
      linkToLatestBeatrizEvolution?: boolean;
    }

    const fixtures: AppointmentFixture[] = [
      // Hoje
      {
        patientId: beatrizId,
        typeName: 'Retorno',
        scheduledAt: atHour(0, 14, 0),
        durationMinutes: 40,
        modality: AppointmentModality.IN_PERSON,
        location: 'Consultório 1',
        status: AppointmentStatus.CONFIRMED,
        confirmedAt: new Date(),
      },
      {
        patientId: carlosId,
        typeName: 'Primeira consulta',
        scheduledAt: atHour(0, 16, 0),
        durationMinutes: 60,
        modality: AppointmentModality.IN_PERSON,
        location: 'Consultório 1',
        status: AppointmentStatus.AWAITING_CONFIRMATION,
      },
      // Futuras
      {
        patientId: danielaId,
        typeName: 'Acompanhamento',
        scheduledAt: atHour(2, 10, 0),
        durationMinutes: 30,
        modality: AppointmentModality.ONLINE,
        onlineMeetingUrl: 'https://meet.exemplo.com/daniela-acompanhamento',
        status: AppointmentStatus.AWAITING_CONFIRMATION,
      },
      {
        patientId: eduardoId,
        typeName: 'Avaliação',
        scheduledAt: atHour(5, 11, 0),
        durationMinutes: 60,
        modality: AppointmentModality.IN_PERSON,
        location: 'Consultório 1',
        status: AppointmentStatus.CONFIRMED,
        confirmedAt: new Date(),
      },
      {
        patientId: fernandaId,
        typeName: 'Encaixe',
        scheduledAt: atHour(7, 9, 0),
        durationMinutes: 20,
        modality: AppointmentModality.IN_PERSON,
        location: 'Consultório 1',
        status: AppointmentStatus.AWAITING_CONFIRMATION,
      },
      // Passadas
      {
        patientId: beatrizId,
        typeName: 'Retorno',
        scheduledAt: atHour(-5, 9, 0),
        durationMinutes: 40,
        modality: AppointmentModality.IN_PERSON,
        location: 'Consultório 1',
        status: AppointmentStatus.DONE,
        completedAt: atHour(-5, 9, 45),
        clinicalNotes:
          'Boa adesão ao plano alimentar. Redução consistente de peso e gordura corporal.',
        linkToLatestBeatrizEvolution: true,
      },
      {
        patientId: carlosId,
        typeName: 'Acompanhamento',
        scheduledAt: atHour(-10, 15, 0),
        durationMinutes: 30,
        modality: AppointmentModality.IN_PERSON,
        location: 'Consultório 1',
        status: AppointmentStatus.DONE,
        completedAt: atHour(-10, 15, 30),
        clinicalNotes: 'Paciente relatou dificuldade com refeições fora de casa.',
      },
      {
        patientId: danielaId,
        typeName: 'Retorno',
        scheduledAt: atHour(-15, 10, 0),
        durationMinutes: 40,
        modality: AppointmentModality.IN_PERSON,
        location: 'Consultório 1',
        status: AppointmentStatus.CANCELLED_BY_PATIENT,
        cancelledAt: atHour(-16, 8, 0),
        cancellationReason: 'Paciente remarcou por motivo pessoal',
      },
      {
        patientId: eduardoId,
        typeName: 'Avaliação',
        scheduledAt: atHour(-8, 14, 0),
        durationMinutes: 60,
        modality: AppointmentModality.IN_PERSON,
        location: 'Consultório 1',
        status: AppointmentStatus.NO_SHOW,
        noShowAt: atHour(-8, 14, 20),
      },
    ];

    const typeDurationByName = new Map(
      appointmentTypes.map((t) => [t.name, t.defaultDurationMinutes]),
    );

    for (const fixture of fixtures) {
      const appointment = await prisma.appointment.create({
        data: {
          tenantId: tenant.id,
          patientId: fixture.patientId,
          nutritionistUserId,
          appointmentTypeId: typeIdByName.get(fixture.typeName)!,
          scheduledAt: fixture.scheduledAt,
          durationMinutes: fixture.durationMinutes,
          modality: fixture.modality,
          location: fixture.location,
          onlineMeetingUrl: fixture.onlineMeetingUrl,
          status: fixture.status,
          confirmedAt: fixture.confirmedAt,
          completedAt: fixture.completedAt,
          cancelledAt: fixture.cancelledAt,
          cancellationReason: fixture.cancellationReason,
          noShowAt: fixture.noShowAt,
          clinicalNotes: fixture.clinicalNotes,
          createdByUserId: nutritionistUserId,
        },
      });

      await prisma.appointmentStatusHistory.create({
        data: {
          tenantId: tenant.id,
          appointmentId: appointment.id,
          fromStatus: null,
          toStatus: fixture.status,
          changedByUserId: nutritionistUserId,
          reason: 'Consulta de demonstração (seed)',
        },
      });

      if (fixture.linkToLatestBeatrizEvolution) {
        const latestEvolution = await prisma.patientEvolution.findFirst({
          where: { tenantId: tenant.id, patientId: beatrizId },
          orderBy: { assessmentDate: 'desc' },
        });
        if (latestEvolution) {
          await prisma.patientEvolution.update({
            where: { id: latestEvolution.id },
            data: { appointmentId: appointment.id },
          });
        }
      }
    }

    // Reagendamento: consulta original de Fernanda (20 dias atrás) foi
    // reagendada para 12 dias atrás — preserva a original como RESCHEDULED
    // e cria a nova ligada por rescheduledFromAppointmentId.
    const fernandaOriginal = await prisma.appointment.create({
      data: {
        tenantId: tenant.id,
        patientId: fernandaId,
        nutritionistUserId,
        appointmentTypeId: typeIdByName.get('Retorno')!,
        scheduledAt: atHour(-20, 10, 0),
        durationMinutes: typeDurationByName.get('Retorno')!,
        modality: AppointmentModality.IN_PERSON,
        location: 'Consultório 1',
        status: AppointmentStatus.RESCHEDULED,
        createdByUserId: nutritionistUserId,
      },
    });
    await prisma.appointmentStatusHistory.createMany({
      data: [
        {
          tenantId: tenant.id,
          appointmentId: fernandaOriginal.id,
          fromStatus: null,
          toStatus: AppointmentStatus.SCHEDULED,
          changedByUserId: nutritionistUserId,
          reason: 'Consulta de demonstração (seed)',
        },
        {
          tenantId: tenant.id,
          appointmentId: fernandaOriginal.id,
          fromStatus: AppointmentStatus.SCHEDULED,
          toStatus: AppointmentStatus.RESCHEDULED,
          changedByUserId: nutritionistUserId,
          reason: 'Paciente pediu para adiar (seed)',
        },
      ],
    });

    const fernandaRescheduled = await prisma.appointment.create({
      data: {
        tenantId: tenant.id,
        patientId: fernandaId,
        nutritionistUserId,
        appointmentTypeId: typeIdByName.get('Retorno')!,
        scheduledAt: atHour(-12, 10, 0),
        durationMinutes: typeDurationByName.get('Retorno')!,
        modality: AppointmentModality.IN_PERSON,
        location: 'Consultório 1',
        status: AppointmentStatus.DONE,
        completedAt: atHour(-12, 10, 40),
        rescheduledFromAppointmentId: fernandaOriginal.id,
        createdByUserId: nutritionistUserId,
      },
    });
    await prisma.appointmentStatusHistory.createMany({
      data: [
        {
          tenantId: tenant.id,
          appointmentId: fernandaRescheduled.id,
          fromStatus: null,
          toStatus: AppointmentStatus.SCHEDULED,
          changedByUserId: nutritionistUserId,
          reason: 'Reagendada (seed)',
        },
        {
          tenantId: tenant.id,
          appointmentId: fernandaRescheduled.id,
          fromStatus: AppointmentStatus.SCHEDULED,
          toStatus: AppointmentStatus.DONE,
          changedByUserId: nutritionistUserId,
          reason: 'Consulta de demonstração (seed)',
        },
      ],
    });
  }

  console.log('Seed concluído.');
  console.log(`Clínica demo: ${tenant.name} (${tenant.slug})`);
  console.log(
    'Usuários de demonstração (senha para todos: ' + DEMO_PASSWORD + '):',
  );
  for (const demoUser of demoUsers) {
    console.log(`  - ${demoUser.role}: ${demoUser.email}`);
  }
  console.log(`Pacientes fictícios criados: ${patients.length}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
