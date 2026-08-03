import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DEMO_PASSWORD = 'Demo@123456';
const BCRYPT_ROUNDS = 12;

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

  for (const demoUser of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: demoUser.email },
      update: {},
      create: { name: demoUser.name, email: demoUser.email, passwordHash },
    });

    await prisma.userClinic.upsert({
      where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
      update: {},
      create: { userId: user.id, tenantId: tenant.id, role: demoUser.role },
    });
  }

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

  await prisma.plan.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Trimestral' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Trimestral',
      description: 'Acompanhamento nutricional por 3 meses',
      durationMonths: 3,
      suggestedAppointmentCount: 3,
      suggestedIntervalDays: 30,
      defaultPrice: 900,
      defaultInstallmentCount: 3,
    },
  });

  await prisma.plan.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Semestral' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Semestral',
      description: 'Acompanhamento nutricional por 6 meses',
      durationMonths: 6,
      suggestedAppointmentCount: 6,
      suggestedIntervalDays: 30,
      defaultPrice: 1600,
      defaultInstallmentCount: 6,
    },
  });

  console.log('Seed concluído.');
  console.log(`Clínica demo: ${tenant.name} (${tenant.slug})`);
  console.log('Usuários de demonstração (senha para todos: ' + DEMO_PASSWORD + '):');
  for (const demoUser of demoUsers) {
    console.log(`  - ${demoUser.role}: ${demoUser.email}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
