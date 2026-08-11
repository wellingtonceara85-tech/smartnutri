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
 * Testes e2e de autorização e isolamento de tenant para Contratação
 * (TreatmentCycle) e Formas de pagamento (Missão 0005.8), contra a
 * aplicação Nest real (guards/pipes/filtros ativos).
 */
describe('Treatment Cycles & Payment Methods RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let tenantA: { id: string };
  let tenantB: { id: string };
  let tokens: Record<'admin' | 'nutritionist' | 'reception', string>;
  let tenantBAdminToken: string;
  let patientInTenantA: { id: string };
  let planInTenantA: { id: string };
  let cycleInTenantA: { id: string };

  const runId = Date.now();

  async function createUserWithRole(
    tenantId: string,
    role: Role,
    label: string,
  ) {
    const user = await prisma.user.create({
      data: {
        name: `${label} ${runId}`,
        email: `${label.toLowerCase()}-cycles-${runId}@teste.com`,
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
        name: 'Tenant Ciclos RBAC A',
        slug: `cycles-rbac-a-${runId}`,
        email: 'a@teste.com',
        phone: '11111111',
      },
    });
    tenantB = await prisma.tenant.create({
      data: {
        name: 'Tenant Ciclos RBAC B',
        slug: `cycles-rbac-b-${runId}`,
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
      data: { tenantId: tenantA.id, fullName: 'Paciente Ciclos RBAC' },
    });
    planInTenantA = await prisma.plan.create({
      data: {
        tenantId: tenantA.id,
        name: `Plano Ciclos RBAC ${runId}`,
        durationMonths: 3,
        suggestedAppointments: 3,
        suggestedIntervalDays: 30,
        defaultPrice: 900,
        defaultInstallments: 3,
      },
    });
    cycleInTenantA = await prisma.treatmentCycle.create({
      data: {
        tenantId: tenantA.id,
        patientId: patientInTenantA.id,
        planId: planInTenantA.id,
        cycleNumber: 1,
        status: 'ACTIVE',
        startDate: new Date('2026-01-01'),
        appointmentCountPlanned: 3,
        intervalDaysPlanned: 30,
        contractedValue: 900,
        finalValue: 900,
        installmentCount: 3,
        createdByUserId: admin.user.id,
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantA.id } });
    await prisma.tenant.delete({ where: { id: tenantB.id } });
    await prisma.user.deleteMany({
      where: { email: { endsWith: `-cycles-${runId}@teste.com` } },
    });
    await app.close();
  }, 30000);

  describe('Formas de pagamento', () => {
    it('todos os perfis conseguem listar formas de pagamento', async () => {
      for (const role of ['admin', 'nutritionist', 'reception'] as const) {
        await request(app.getHttpServer())
          .get('/payment-methods')
          .set('Authorization', `Bearer ${tokens[role]}`)
          .expect(200);
      }
    });
  });

  describe('Contratação (TreatmentCycle)', () => {
    it('todos os perfis conseguem listar o histórico de contratações do paciente', async () => {
      for (const role of ['admin', 'nutritionist', 'reception'] as const) {
        const res = await request(app.getHttpServer())
          .get(`/patients/${patientInTenantA.id}/treatment-cycles`)
          .set('Authorization', `Bearer ${tokens[role]}`)
          .expect(200);
        const cycles = res.body as { id: string }[];
        expect(cycles.some((c) => c.id === cycleInTenantA.id)).toBe(true);
      }
    });

    it('admin, recepção e nutricionista podem contratar um plano para o paciente (Missão 0005.8, ajuste final)', async () => {
      await request(app.getHttpServer())
        .post(`/patients/${patientInTenantA.id}/treatment-cycles`)
        .set('Authorization', `Bearer ${tokens.reception}`)
        .send({
          planId: planInTenantA.id,
          startDate: '2026-02-01',
          discountType: 'PERCENTAGE',
          discountValue: 10,
        })
        .expect(201)
        .expect((res) => {
          const body = res.body as { finalValue: string };
          if (body.finalValue !== '810') {
            throw new Error(
              `esperado finalValue 810, recebido ${body.finalValue}`,
            );
          }
        });

      await request(app.getHttpServer())
        .post(`/patients/${patientInTenantA.id}/treatment-cycles`)
        .set('Authorization', `Bearer ${tokens.admin}`)
        .send({ planId: planInTenantA.id, startDate: '2026-03-01' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/patients/${patientInTenantA.id}/treatment-cycles`)
        .set('Authorization', `Bearer ${tokens.nutritionist}`)
        .send({ planId: planInTenantA.id, startDate: '2026-04-01' })
        .expect(201);
    });

    it('nutricionista não pode editar o ciclo (403), recepção pode', async () => {
      await request(app.getHttpServer())
        .patch(`/treatment-cycles/${cycleInTenantA.id}`)
        .set('Authorization', `Bearer ${tokens.nutritionist}`)
        .send({ notes: 'Tentativa nutricionista' })
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/treatment-cycles/${cycleInTenantA.id}`)
        .set('Authorization', `Bearer ${tokens.reception}`)
        .send({ notes: 'Atualizado pela recepção' })
        .expect(200);
    });

    it('nutricionista não pode alterar status do ciclo (403), admin pode', async () => {
      await request(app.getHttpServer())
        .patch(`/treatment-cycles/${cycleInTenantA.id}/status`)
        .set('Authorization', `Bearer ${tokens.nutritionist}`)
        .send({ status: 'PAUSED' })
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/treatment-cycles/${cycleInTenantA.id}/status`)
        .set('Authorization', `Bearer ${tokens.admin}`)
        .send({ status: 'PAUSED' })
        .expect(200);
    });

    it('admin, recepção e nutricionista podem corrigir valores financeiros do ciclo, sempre com motivo (Missão 0005.8, ajuste final)', async () => {
      await request(app.getHttpServer())
        .patch(`/treatment-cycles/${cycleInTenantA.id}/financials`)
        .set('Authorization', `Bearer ${tokens.nutritionist}`)
        .send({
          discountType: 'FIXED',
          discountValue: 50,
          reason: 'Correção nutricionista',
        })
        .expect(200)
        .expect((res) => {
          const body = res.body as { discount: string; finalValue: string };
          if (body.discount !== '50' || body.finalValue !== '850') {
            throw new Error(
              `esperado discount 50 / finalValue 850, recebido ${JSON.stringify(body)}`,
            );
          }
        });

      // Motivo é obrigatório — sem ele, 400 antes mesmo de chegar no service.
      await request(app.getHttpServer())
        .patch(`/treatment-cycles/${cycleInTenantA.id}/financials`)
        .set('Authorization', `Bearer ${tokens.admin}`)
        .send({ contractedValue: 800 })
        .expect(400);
    });

    it('usuário de outro tenant não acessa ciclo por UUID (404)', async () => {
      await request(app.getHttpServer())
        .get(`/treatment-cycles/${cycleInTenantA.id}`)
        .set('Authorization', `Bearer ${tenantBAdminToken}`)
        .expect(404);
    });

    it('usuário de outro tenant não consegue contratar plano de outro tenant para paciente inexistente ali (404)', async () => {
      await request(app.getHttpServer())
        .post(`/patients/${patientInTenantA.id}/treatment-cycles`)
        .set('Authorization', `Bearer ${tenantBAdminToken}`)
        .send({ planId: planInTenantA.id, startDate: '2026-02-01' })
        .expect(404);
    });

    it('requisição sem token é rejeitada (401)', async () => {
      await request(app.getHttpServer())
        .get(`/patients/${patientInTenantA.id}/treatment-cycles`)
        .expect(401);
    });
  });
});
