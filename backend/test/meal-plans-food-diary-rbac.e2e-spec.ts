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
 * Testes e2e de autorização por perfil e isolamento de tenant para Plano
 * Alimentar e Diário Alimentar, usando a aplicação Nest real (guards, pipes
 * e filtros ativos). RECEPTION precisa estar totalmente bloqueada em ambos
 * os módulos — não só escondida na UI, mas barrada no backend (403).
 */
describe('Meal Plans & Food Diary RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let tenantA: { id: string };
  let tenantB: { id: string };
  let tokens: Record<'admin' | 'nutritionist' | 'reception', string>;
  let tenantBAdminToken: string;
  let patientInTenantA: { id: string };

  const runId = Date.now();

  async function createUserWithRole(tenantId: string, role: Role, label: string) {
    const user = await prisma.user.create({
      data: {
        name: `${label} ${runId}`,
        email: `${label.toLowerCase()}-mpfd-${runId}@teste.com`,
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
      data: { name: 'Tenant MPFD RBAC A', slug: `mpfd-rbac-a-${runId}`, email: 'a@teste.com', phone: '11111111' },
    });
    tenantB = await prisma.tenant.create({
      data: { name: 'Tenant MPFD RBAC B', slug: `mpfd-rbac-b-${runId}`, email: 'b@teste.com', phone: '22222222' },
    });

    const admin = await createUserWithRole(tenantA.id, Role.ADMIN, 'Admin');
    const nutritionist = await createUserWithRole(tenantA.id, Role.NUTRITIONIST, 'Nutri');
    const reception = await createUserWithRole(tenantA.id, Role.RECEPTION, 'Recepcao');
    const adminB = await createUserWithRole(tenantB.id, Role.ADMIN, 'AdminB');

    tokens = {
      admin: admin.accessToken,
      nutritionist: nutritionist.accessToken,
      reception: reception.accessToken,
    };
    tenantBAdminToken = adminB.accessToken;

    patientInTenantA = await prisma.patient.create({
      data: { tenantId: tenantA.id, fullName: 'Paciente MPFD RBAC Teste' },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.foodDiaryEntry.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.mealPlan.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.patient.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
    await prisma.tenant.delete({ where: { id: tenantA.id } });
    await prisma.tenant.delete({ where: { id: tenantB.id } });
    await prisma.user.deleteMany({ where: { email: { endsWith: `-mpfd-${runId}@teste.com` } } });
    await app.close();
  }, 30000);

  describe('Plano Alimentar', () => {
    it('RECEPTION recebe 403 ao listar e ao criar plano — blackout completo', async () => {
      await request(app.getHttpServer())
        .get(`/patients/${patientInTenantA.id}/meal-plans`)
        .set('Authorization', `Bearer ${tokens.reception}`)
        .expect(403);

      await request(app.getHttpServer())
        .post(`/patients/${patientInTenantA.id}/meal-plans`)
        .set('Authorization', `Bearer ${tokens.reception}`)
        .send({ title: 'Tentativa recepção', effectiveFrom: '2026-08-01' })
        .expect(403);
    });

    it('ADMIN e NUTRITIONIST conseguem criar e listar planos', async () => {
      for (const role of ['admin', 'nutritionist'] as const) {
        const createRes = await request(app.getHttpServer())
          .post(`/patients/${patientInTenantA.id}/meal-plans`)
          .set('Authorization', `Bearer ${tokens[role]}`)
          .send({
            title: `Plano criado por ${role} ${runId}`,
            effectiveFrom: '2026-08-01',
            nutritionistUserId:
              role === 'admin'
                ? (await prisma.userClinic.findFirst({ where: { tenantId: tenantA.id, role: Role.NUTRITIONIST } }))!
                    .userId
                : undefined,
          })
          .expect(201);
        expect(createRes.body.id).toBeDefined();

        await request(app.getHttpServer())
          .get(`/patients/${patientInTenantA.id}/meal-plans`)
          .set('Authorization', `Bearer ${tokens[role]}`)
          .expect(200);
      }
    });

    it('usuário de outro tenant não acessa plano por UUID (404)', async () => {
      const nutritionistUserId = (
        await prisma.userClinic.findFirst({ where: { tenantId: tenantA.id, role: Role.NUTRITIONIST } })
      )!.userId;
      const created = await prisma.mealPlan.create({
        data: {
          tenantId: tenantA.id,
          patientId: patientInTenantA.id,
          nutritionistUserId,
          createdByUserId: nutritionistUserId,
          title: 'Plano isolamento',
          effectiveFrom: new Date('2026-08-01'),
        },
      });

      await request(app.getHttpServer())
        .get(`/meal-plans/${created.id}`)
        .set('Authorization', `Bearer ${tenantBAdminToken}`)
        .expect(404);
    });

    it('requisição sem token é rejeitada (401)', async () => {
      await request(app.getHttpServer()).get(`/patients/${patientInTenantA.id}/meal-plans`).expect(401);
    });
  });

  describe('Diário Alimentar', () => {
    it('RECEPTION recebe 403 ao listar e ao registrar refeição — nunca vê fotos, comentários ou feedback', async () => {
      await request(app.getHttpServer())
        .get(`/patients/${patientInTenantA.id}/food-diary`)
        .set('Authorization', `Bearer ${tokens.reception}`)
        .expect(403);

      await request(app.getHttpServer())
        .post(`/patients/${patientInTenantA.id}/food-diary`)
        .set('Authorization', `Bearer ${tokens.reception}`)
        .send({ entryDate: '2026-08-08', mealName: 'Tentativa recepção' })
        .expect(403);
    });

    it('ADMIN e NUTRITIONIST conseguem registrar e listar entradas do diário', async () => {
      for (const role of ['admin', 'nutritionist'] as const) {
        const createRes = await request(app.getHttpServer())
          .post(`/patients/${patientInTenantA.id}/food-diary`)
          .set('Authorization', `Bearer ${tokens[role]}`)
          .send({ entryDate: '2026-08-08', mealName: `Registro de ${role} ${runId}` })
          .expect(201);
        expect(createRes.body.id).toBeDefined();

        await request(app.getHttpServer())
          .get(`/patients/${patientInTenantA.id}/food-diary`)
          .set('Authorization', `Bearer ${tokens[role]}`)
          .expect(200);
      }
    });

    it('RECEPTION recebe 403 ao tentar avaliar um registro (review)', async () => {
      const entry = await prisma.foodDiaryEntry.create({
        data: { tenantId: tenantA.id, patientId: patientInTenantA.id, entryDate: new Date('2026-08-08'), mealName: 'Para avaliar' },
      });

      await request(app.getHttpServer())
        .post(`/food-diary/${entry.id}/review`)
        .set('Authorization', `Bearer ${tokens.reception}`)
        .send({ status: 'REVIEWED', nutritionistFeedback: 'Tentativa indevida' })
        .expect(403);
    });

    it('usuário de outro tenant não acessa registro por UUID (404)', async () => {
      const entry = await prisma.foodDiaryEntry.create({
        data: { tenantId: tenantA.id, patientId: patientInTenantA.id, entryDate: new Date('2026-08-08'), mealName: 'Isolamento' },
      });

      await request(app.getHttpServer())
        .get(`/food-diary/${entry.id}`)
        .set('Authorization', `Bearer ${tenantBAdminToken}`)
        .expect(404);
    });

    it('requisição sem token é rejeitada (401)', async () => {
      await request(app.getHttpServer()).get(`/patients/${patientInTenantA.id}/food-diary`).expect(401);
    });
  });
});
