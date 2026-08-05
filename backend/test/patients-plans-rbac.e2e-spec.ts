import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { Role } from '../src/generated/prisma/client';

/**
 * Testes e2e de autorização por perfil e isolamento de tenant para os
 * módulos de Pacientes e Planos, usando a aplicação Nest real (guards,
 * pipes e filtros ativos) contra o Postgres de desenvolvimento.
 */
describe('Patients & Plans RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let tenantA: { id: string };
  let tenantB: { id: string };
  let tokens: Record<'admin' | 'nutritionist' | 'reception', string>;
  let tenantBAdminToken: string;
  let patientInTenantA: { id: string };
  let planInTenantA: { id: string };

  const runId = Date.now();

  async function createUserWithRole(
    tenantId: string,
    role: Role,
    label: string,
  ) {
    const user = await prisma.user.create({
      data: {
        name: `${label} ${runId}`,
        email: `${label.toLowerCase()}-${runId}@teste.com`,
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
    await app.init();

    prisma = moduleFixture.get(PrismaService);
    jwtService = moduleFixture.get(JwtService);

    tenantA = await prisma.tenant.create({
      data: {
        name: 'Tenant RBAC A',
        slug: `rbac-a-${runId}`,
        email: 'a@teste.com',
        phone: '11111111',
      },
    });
    tenantB = await prisma.tenant.create({
      data: {
        name: 'Tenant RBAC B',
        slug: `rbac-b-${runId}`,
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
      data: { tenantId: tenantA.id, fullName: 'Paciente RBAC Teste' },
    });
    planInTenantA = await prisma.plan.create({
      data: {
        tenantId: tenantA.id,
        name: `Plano RBAC ${runId}`,
        durationMonths: 3,
        suggestedAppointments: 3,
        suggestedIntervalDays: 30,
        defaultPrice: 100,
        defaultInstallments: 3,
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantA.id } });
    await prisma.tenant.delete({ where: { id: tenantB.id } });
    await prisma.user.deleteMany({
      where: { email: { endsWith: `-${runId}@teste.com` } },
    });
    await app.close();
  }, 30000);

  describe('Pacientes', () => {
    it('todos os perfis conseguem listar pacientes', async () => {
      for (const role of ['admin', 'nutritionist', 'reception'] as const) {
        await request(app.getHttpServer())
          .get('/patients')
          .set('Authorization', `Bearer ${tokens[role]}`)
          .expect(200);
      }
    });

    it('todos os perfis conseguem criar pacientes', async () => {
      for (const role of ['admin', 'nutritionist', 'reception'] as const) {
        await request(app.getHttpServer())
          .post('/patients')
          .set('Authorization', `Bearer ${tokens[role]}`)
          .send({ fullName: `Paciente criado por ${role} ${runId}` })
          .expect(201);
      }
    });

    it('nutricionista não pode alterar status do paciente (403)', async () => {
      await request(app.getHttpServer())
        .patch(`/patients/${patientInTenantA.id}/status`)
        .set('Authorization', `Bearer ${tokens.nutritionist}`)
        .send({ status: 'INACTIVE' })
        .expect(403);
    });

    it('recepção pode alterar status do paciente', async () => {
      await request(app.getHttpServer())
        .patch(`/patients/${patientInTenantA.id}/status`)
        .set('Authorization', `Bearer ${tokens.reception}`)
        .send({ status: 'INACTIVE' })
        .expect(200);
    });

    it('apenas admin pode arquivar (DELETE) paciente', async () => {
      await request(app.getHttpServer())
        .delete(`/patients/${patientInTenantA.id}`)
        .set('Authorization', `Bearer ${tokens.nutritionist}`)
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/patients/${patientInTenantA.id}`)
        .set('Authorization', `Bearer ${tokens.reception}`)
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/patients/${patientInTenantA.id}`)
        .set('Authorization', `Bearer ${tokens.admin}`)
        .expect(200);
    });

    it('usuário de outro tenant não acessa paciente por UUID (404)', async () => {
      await request(app.getHttpServer())
        .get(`/patients/${patientInTenantA.id}`)
        .set('Authorization', `Bearer ${tenantBAdminToken}`)
        .expect(404);
    });

    it('requisição sem token é rejeitada (401)', async () => {
      await request(app.getHttpServer()).get('/patients').expect(401);
    });
  });

  describe('Planos', () => {
    it('todos os perfis conseguem listar planos', async () => {
      for (const role of ['admin', 'nutritionist', 'reception'] as const) {
        await request(app.getHttpServer())
          .get('/plans')
          .set('Authorization', `Bearer ${tokens[role]}`)
          .expect(200);
      }
    });

    it('apenas admin pode criar plano', async () => {
      await request(app.getHttpServer())
        .post('/plans')
        .set('Authorization', `Bearer ${tokens.nutritionist}`)
        .send({
          name: `Tentativa Nutri ${runId}`,
          durationMonths: 3,
          suggestedAppointments: 3,
          suggestedIntervalDays: 30,
          defaultPrice: 100,
          defaultInstallments: 3,
        })
        .expect(403);

      await request(app.getHttpServer())
        .post('/plans')
        .set('Authorization', `Bearer ${tokens.reception}`)
        .send({
          name: `Tentativa Recepção ${runId}`,
          durationMonths: 3,
          suggestedAppointments: 3,
          suggestedIntervalDays: 30,
          defaultPrice: 100,
          defaultInstallments: 3,
        })
        .expect(403);

      await request(app.getHttpServer())
        .post('/plans')
        .set('Authorization', `Bearer ${tokens.admin}`)
        .send({
          name: `Plano Criado Admin ${runId}`,
          durationMonths: 3,
          suggestedAppointments: 3,
          suggestedIntervalDays: 30,
          defaultPrice: 100,
          defaultInstallments: 3,
        })
        .expect(201);
    });

    it('apenas admin pode ativar/inativar plano', async () => {
      await request(app.getHttpServer())
        .patch(`/plans/${planInTenantA.id}/status`)
        .set('Authorization', `Bearer ${tokens.reception}`)
        .send({ isActive: false })
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/plans/${planInTenantA.id}/status`)
        .set('Authorization', `Bearer ${tokens.admin}`)
        .send({ isActive: false })
        .expect(200);
    });

    it('usuário de outro tenant não acessa plano por UUID (404)', async () => {
      await request(app.getHttpServer())
        .get(`/plans/${planInTenantA.id}`)
        .set('Authorization', `Bearer ${tenantBAdminToken}`)
        .expect(404);
    });
  });
});
