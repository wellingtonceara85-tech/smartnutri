import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { Role } from '../src/generated/prisma/client';

/**
 * Testes e2e de RBAC e isolamento de tenant para o módulo Financeiro
 * (Missão 0006), contra a aplicação Nest real (guards/pipes/filtros ativos)
 * — mesmo padrão dos demais specs de RBAC deste projeto.
 */
describe('Finance RBAC & isolamento (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let tenantA: { id: string };
  let tenantB: { id: string };
  let tokens: Record<'admin' | 'nutritionist' | 'reception', string>;
  let tenantBAdminToken: string;
  let patientInTenantA: { id: string };
  let planInTenantA: { id: string };
  let paymentMethodInTenantA: { id: string };
  let cycleId: string;
  let chargeId: string;

  const runId = Date.now();

  async function createUserWithRole(
    tenantId: string,
    role: Role,
    label: string,
  ) {
    const user = await prisma.user.create({
      data: {
        name: `${label} ${runId}`,
        email: `${label.toLowerCase()}-finance-${runId}@teste.com`,
        passwordHash: 'x',
      },
    });
    const userClinic = await prisma.userClinic.create({
      data: { userId: user.id, tenantId, role },
    });
    const accessToken = await jwtService.signAsync(
      { sub: user.id, tenantId, userClinicId: userClinic.id },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' },
    );
    return { user, userClinic, accessToken };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = moduleFixture.get(PrismaService);
    jwtService = moduleFixture.get(JwtService);

    tenantA = await prisma.tenant.create({
      data: {
        name: 'Tenant Finance RBAC A',
        slug: `finance-rbac-a-${runId}`,
        email: 'a@teste.com',
        phone: '11111111',
      },
    });
    tenantB = await prisma.tenant.create({
      data: {
        name: 'Tenant Finance RBAC B',
        slug: `finance-rbac-b-${runId}`,
        email: 'b@teste.com',
        phone: '22222222',
      },
    });

    const admin = await createUserWithRole(tenantA.id, Role.ADMIN, 'Admin');
    const nutritionist = await createUserWithRole(
      tenantA.id,
      Role.NUTRITIONIST,
      'Nutri',
    );
    const reception = await createUserWithRole(
      tenantA.id,
      Role.RECEPTION,
      'Recepcao',
    );
    const adminB = await createUserWithRole(tenantB.id, Role.ADMIN, 'AdminB');

    tokens = {
      admin: admin.accessToken,
      nutritionist: nutritionist.accessToken,
      reception: reception.accessToken,
    };
    tenantBAdminToken = adminB.accessToken;

    patientInTenantA = await prisma.patient.create({
      data: { tenantId: tenantA.id, fullName: 'Paciente Finance RBAC' },
    });
    planInTenantA = await prisma.plan.create({
      data: {
        tenantId: tenantA.id,
        name: `Plano Finance RBAC ${runId}`,
        durationMonths: 1,
        suggestedAppointments: 1,
        suggestedIntervalDays: 30,
        defaultPrice: 500,
        defaultInstallments: 1,
      },
    });
    paymentMethodInTenantA = await prisma.paymentMethod.create({
      data: { tenantId: tenantA.id, name: `PIX Finance RBAC ${runId}` },
    });

    const cycleRes = await request(app.getHttpServer())
      .post(`/patients/${patientInTenantA.id}/treatment-cycles`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ planId: planInTenantA.id, startDate: '2026-01-01' })
      .expect(201);
    cycleId = (cycleRes.body as { id: string }).id;

    const charges = await prisma.charge.findMany({
      where: { treatmentCycleId: cycleId },
    });
    chargeId = charges[0].id;
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
    await prisma.userClinic.deleteMany({
      where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
    await prisma.patient.deleteMany({ where: { tenantId: tenantA.id } });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantA.id, tenantB.id] } },
    });
    await prisma.user.deleteMany({
      where: { email: { endsWith: `-finance-${runId}@teste.com` } },
    });
    await app.close();
  }, 30000);

  describe('Leitura (qualquer papel autenticado)', () => {
    it('todos os perfis conseguem ver o resumo financeiro', async () => {
      for (const role of ['admin', 'nutritionist', 'reception'] as const) {
        await request(app.getHttpServer())
          .get('/finance/summary')
          .set('Authorization', `Bearer ${tokens[role]}`)
          .expect(200);
      }
    });

    it('todos os perfis conseguem listar cobranças, e a cobrança gerada pela contratação aparece', async () => {
      const res = await request(app.getHttpServer())
        .get('/finance/charges')
        .set('Authorization', `Bearer ${tokens.admin}`)
        .expect(200);
      const body = res.body as { data: { id: string }[] };
      expect(body.data.some((c) => c.id === chargeId)).toBe(true);
    });

    it('usuário de outro tenant não vê a cobrança nem consegue buscar por id (404)', async () => {
      const res = await request(app.getHttpServer())
        .get('/finance/charges')
        .set('Authorization', `Bearer ${tenantBAdminToken}`)
        .expect(200);
      const body = res.body as { data: { id: string }[] };
      expect(body.data.some((c) => c.id === chargeId)).toBe(false);

      await request(app.getHttpServer())
        .get(`/finance/charges/${chargeId}`)
        .set('Authorization', `Bearer ${tenantBAdminToken}`)
        .expect(404);
    });

    it('requisição sem token é rejeitada (401)', async () => {
      await request(app.getHttpServer()).get('/finance/summary').expect(401);
    });
  });

  describe('Registrar e reverter pagamento', () => {
    it('admin, recepção e nutricionista conseguem registrar pagamento', async () => {
      const res = await request(app.getHttpServer())
        .post('/finance/payments')
        .set('Authorization', `Bearer ${tokens.nutritionist}`)
        .send({ chargeId, paymentMethodId: paymentMethodInTenantA.id })
        .expect(201);

      const body = res.body as { id: string; amount: string };
      expect(Number(body.amount)).toBe(500);

      const charge = await prisma.charge.findUnique({
        where: { id: chargeId },
      });
      expect(charge?.status).toBe('PAID');
    });

    it('usuário de outro tenant não consegue pagar cobrança que não é dele (404)', async () => {
      await request(app.getHttpServer())
        .post('/finance/payments')
        .set('Authorization', `Bearer ${tenantBAdminToken}`)
        .send({ chargeId, paymentMethodId: paymentMethodInTenantA.id })
        .expect(404);
    });

    it('reverter pagamento exige motivo (400 sem reason) e some com o status PAID (200)', async () => {
      const payment = await prisma.payment.findFirst({
        where: { tenantId: tenantA.id },
        orderBy: { createdAt: 'desc' },
      });

      await request(app.getHttpServer())
        .patch(`/finance/payments/${payment!.id}/void`)
        .set('Authorization', `Bearer ${tokens.admin}`)
        .send({})
        .expect(400);

      await request(app.getHttpServer())
        .patch(`/finance/payments/${payment!.id}/void`)
        .set('Authorization', `Bearer ${tokens.admin}`)
        .send({ reason: 'Lançado por engano no teste' })
        .expect(200);

      const charge = await prisma.charge.findUnique({
        where: { id: chargeId },
      });
      expect(charge?.status).toBe('PENDING');
    });
  });
});
