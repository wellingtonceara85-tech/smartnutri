import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { Gender, PatientStatus, PrismaClient, Role } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DEMO_PASSWORD = 'Demo@123456';
const BCRYPT_ROUNDS = 12;

/** Gera um CPF fictício válido (dígitos verificadores corretos) a partir de 9 dígitos base. */
function buildFakeCpf(base9: string): string {
  const calcDigit = (digits: string, weightStart: number): number => {
    let sum = 0;
    for (let i = 0; i < digits.length; i++) sum += Number(digits[i]) * (weightStart - i);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const d1 = calcDigit(base9, 10);
  const d2 = calcDigit(base9 + String(d1), 11);
  return `${base9}${d1}${d2}`;
}

async function upsertPlan(tenantId: string, data: {
  name: string;
  description: string;
  durationMonths: number;
  suggestedAppointments: number;
  suggestedIntervalDays: number;
  defaultPrice: number;
  defaultInstallments: number;
}) {
  const existing = await prisma.plan.findFirst({ where: { tenantId, name: data.name, deletedAt: null } });
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
      name: 'Clínica Bem Nutrir (Demo)',
      slug: 'clinica-demo',
      email: 'contato@clinicademo.com.br',
      phone: '(11) 4000-0000',
      addressLine: 'Rua das Flores, 123',
      city: 'São Paulo',
      state: 'SP',
      cancellationPolicyText: 'Cancelamentos devem ser avisados com pelo menos 24h de antecedência.',
      cancellationMinHoursNotice: 24,
      receiptNumberPrefix: 'REC',
    },
  });

  const demoUsers: { name: string; email: string; role: Role }[] = [
    { name: 'Ana Administradora', email: 'admin@clinicademo.com.br', role: Role.ADMIN },
    { name: 'Nutri Nutricionista', email: 'nutricionista@clinicademo.com.br', role: Role.NUTRITIONIST },
    { name: 'Rita Recepção', email: 'recepcao@clinicademo.com.br', role: Role.RECEPTION },
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

  const nutritionistUserId = userIdByEmail.get('nutricionista@clinicademo.com.br')!;

  const paymentMethods = ['PIX', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'Transferência', 'Boleto', 'Outro'];
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
      create: { tenantId: tenant.id, name: type.name, defaultDurationMinutes: type.defaultDurationMinutes },
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

  for (const patient of patients) {
    const existing = await prisma.patient.findFirst({ where: { tenantId: tenant.id, fullName: patient.fullName } });
    if (!existing) {
      await prisma.patient.create({ data: { ...patient, tenantId: tenant.id } });
    }
  }

  console.log('Seed concluído.');
  console.log(`Clínica demo: ${tenant.name} (${tenant.slug})`);
  console.log('Usuários de demonstração (senha para todos: ' + DEMO_PASSWORD + '):');
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
