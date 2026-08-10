import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { Role, TenantType } from '../src/generated/prisma/client';

interface TeamMemberBody {
  id: string;
  userId: string;
  tenantId: string;
  role: string;
  isActive: boolean;
  temporaryPassword?: string;
}

interface ErrorResponseBody {
  message?: string;
}

interface UsageResponseBody {
  planCode: string;
  planDisplayName: string;
  maxUsers: number;
  usedUsers: number;
}

interface TenantDetailBody {
  plan: { code: string; displayName: string; maxUsers: number };
  usage: { users: number; maxUsers: number };
}

/**
 * Testes e2e da Missão 0005.7 — catálogo de planos/entitlements, limite de
 * usuários por plano, gestão de equipe pelo ADMIN do próprio tenant, troca
 * de plano pelo Platform Admin com bloqueio de downgrade incompatível, e
 * autoproteção do último ADMIN ativo.
 */
describe('Plans & Licensing (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let platformAdminToken: string;

  const runId = Date.now();
  const DEFAULT_PASSWORD = 'Senha@Original123';

  async function createTenant(
    type: TenantType,
    planCode: string,
    label: string,
  ) {
    return prisma.tenant.create({
      data: {
        name: `${label} ${runId}`,
        slug: `plans-${label.toLowerCase()}-${runId}`,
        email: `${label.toLowerCase()}@teste.com`,
        phone: '11999990000',
        type,
        planCode,
      },
    });
  }

  async function createMember(tenantId: string, role: Role, label: string) {
    const user = await prisma.user.create({
      data: {
        name: `${label} ${runId}`,
        email: `${label.toLowerCase()}-plans-${runId}@teste.com`,
        passwordHash: await bcrypt.hash(DEFAULT_PASSWORD, 10),
      },
    });
    const userClinic = await prisma.userClinic.create({
      data: { userId: user.id, tenantId, role },
    });
    const accessToken = await jwtService.signAsync(
      { sub: user.id, scope: 'tenant', tenantId, userClinicId: userClinic.id },
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

    const platformAdmin = await prisma.user.create({
      data: {
        name: `Platform Admin Plans ${runId}`,
        email: `platform-admin-plans-${runId}@teste.com`,
        passwordHash: 'x',
        isPlatformAdmin: true,
      },
    });
    platformAdminToken = await jwtService.signAsync(
      { sub: platformAdmin.id, scope: 'platform' },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' },
    );
  }, 30000);

  afterAll(async () => {
    await prisma.tenant.deleteMany({
      where: { slug: { contains: `-${runId}` } },
    });
    await prisma.user.deleteMany({
      where: { email: { endsWith: `-plans-${runId}@teste.com` } },
    });
    await app.close();
  }, 30000);

  describe('Limites por plano (criação via ADMIN do próprio tenant)', () => {
    it('SOLO permite 1 usuário e bloqueia o 2º', async () => {
      const tenant = await createTenant(TenantType.SOLO, 'SOLO', 'SoloLimit');
      const owner = await createMember(tenant.id, Role.ADMIN, 'SoloOwnerA');

      const res = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          name: 'Segundo Solo',
          email: `segundo-solo-plans-${runId}@teste.com`,
          role: 'ADMIN',
        })
        .expect(409);

      expect((res.body as ErrorResponseBody).message).toMatch(
        /permite até 1 usuário/i,
      );
    });

    it('CLINIC_ESSENTIAL permite 3 usuários e bloqueia o 4º', async () => {
      const tenant = await createTenant(
        TenantType.CLINIC,
        'CLINIC_ESSENTIAL',
        'EssentialLimit',
      );
      const admin = await createMember(tenant.id, Role.ADMIN, 'EssAdmin');
      await createMember(tenant.id, Role.NUTRITIONIST, 'EssNutri1');
      await createMember(tenant.id, Role.NUTRITIONIST, 'EssNutri2');

      const res = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({
          name: 'Quarto Essential',
          email: `quarto-essential-plans-${runId}@teste.com`,
          role: 'RECEPTION',
        })
        .expect(409);

      expect((res.body as ErrorResponseBody).message).toMatch(
        /permite até 3 usuários/i,
      );
    });

    it('CLINIC_PRO permite 8 usuários e bloqueia o 9º', async () => {
      const tenant = await createTenant(
        TenantType.CLINIC,
        'CLINIC_PRO',
        'ProLimit',
      );
      const admin = await createMember(tenant.id, Role.ADMIN, 'ProAdmin');
      for (let i = 0; i < 6; i++) {
        await createMember(tenant.id, Role.NUTRITIONIST, `ProNutri${i}`);
      }
      // 7 já existem (1 admin + 6 nutris); tentar o 8º deve funcionar, o 9º não.
      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({
          name: 'Oitavo Pro',
          email: `oitavo-pro-plans-${runId}@teste.com`,
          role: 'RECEPTION',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({
          name: 'Nono Pro',
          email: `nono-pro-plans-${runId}@teste.com`,
          role: 'RECEPTION',
        })
        .expect(409);

      expect((res.body as ErrorResponseBody).message).toMatch(
        /permite até 8 usuários/i,
      );
    });

    it('CLINIC_PLUS permite 15 usuários e bloqueia o 16º', async () => {
      const tenant = await createTenant(
        TenantType.CLINIC,
        'CLINIC_PLUS',
        'PlusLimit',
      );
      const admin = await createMember(tenant.id, Role.ADMIN, 'PlusAdmin');
      for (let i = 0; i < 13; i++) {
        await createMember(tenant.id, Role.NUTRITIONIST, `PlusNutri${i}`);
      }
      // 14 já existem; o 15º deve funcionar, o 16º não.
      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({
          name: 'Décimo Quinto Plus',
          email: `decimoquinto-plus-plans-${runId}@teste.com`,
          role: 'RECEPTION',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({
          name: 'Décimo Sexto Plus',
          email: `decimosexto-plus-plans-${runId}@teste.com`,
          role: 'RECEPTION',
        })
        .expect(409);

      expect((res.body as ErrorResponseBody).message).toMatch(
        /permite até 15 usuários/i,
      );
    });
  });

  describe('RBAC de gestão de equipe', () => {
    it('NUTRITIONIST não pode criar usuário (403)', async () => {
      const tenant = await createTenant(
        TenantType.CLINIC,
        'CLINIC_ESSENTIAL',
        'RbacNutri',
      );
      const nutri = await createMember(tenant.id, Role.NUTRITIONIST, 'RbacN');

      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${nutri.accessToken}`)
        .send({
          name: 'Tentativa',
          email: `tentativa-nutri-plans-${runId}@teste.com`,
          role: 'RECEPTION',
        })
        .expect(403);
    });

    it('RECEPTION não pode criar usuário (403)', async () => {
      const tenant = await createTenant(
        TenantType.CLINIC,
        'CLINIC_ESSENTIAL',
        'RbacRecep',
      );
      const reception = await createMember(tenant.id, Role.RECEPTION, 'RbacR');

      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${reception.accessToken}`)
        .send({
          name: 'Tentativa',
          email: `tentativa-recep-plans-${runId}@teste.com`,
          role: 'RECEPTION',
        })
        .expect(403);
    });

    it('ADMIN cria membro com sucesso e recebe senha provisória — nunca passwordHash', async () => {
      const tenant = await createTenant(
        TenantType.CLINIC,
        'CLINIC_ESSENTIAL',
        'RbacAdmin',
      );
      const admin = await createMember(tenant.id, Role.ADMIN, 'RbacA');

      const res = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({
          name: 'Novo Membro',
          email: `novo-membro-plans-${runId}@teste.com`,
          role: 'NUTRITIONIST',
        })
        .expect(201);

      const body = res.body as TeamMemberBody;
      expect(typeof body.temporaryPassword).toBe('string');
      expect(body.temporaryPassword!.length).toBeGreaterThan(0);
      expect(JSON.stringify(body)).not.toMatch(/passwordHash/i);
    });
  });

  describe('Primeiro ADMIN consome licença', () => {
    it('tenant recém-criado pelo Platform Admin mostra 1 usuário usado imediatamente', async () => {
      const res = await request(app.getHttpServer())
        .post('/platform/tenants')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          type: 'CLINIC',
          planCode: 'CLINIC_PRO',
          name: `Primeiro Admin ${runId}`,
          responsibleName: 'Dono',
          email: `primeiro-admin-plans-${runId}@teste.com`,
          phone: '11988887777',
        })
        .expect(201);

      const tenantId = (res.body as { tenant: { id: string } }).tenant.id;

      const detailRes = await request(app.getHttpServer())
        .get(`/platform/tenants/${tenantId}`)
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .expect(200);

      const detail = detailRes.body as TenantDetailBody;
      expect(detail.plan.code).toBe('CLINIC_PRO');
      expect(detail.plan.maxUsers).toBe(8);
      expect(detail.usage.users).toBe(1);
      expect(detail.usage.maxUsers).toBe(8);
    });
  });

  describe('Troca de plano', () => {
    it('Platform Admin altera plano quando a equipe cabe no novo limite', async () => {
      const tenant = await createTenant(
        TenantType.CLINIC,
        'CLINIC_ESSENTIAL',
        'UpgradeOk',
      );
      await createMember(tenant.id, Role.ADMIN, 'UpgradeAdmin');

      const res = await request(app.getHttpServer())
        .patch(`/platform/tenants/${tenant.id}/plan`)
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({ planCode: 'CLINIC_PRO' })
        .expect(200);

      expect((res.body as TenantDetailBody).plan.code).toBe('CLINIC_PRO');
    });

    it('bloqueia downgrade incompatível com o uso atual', async () => {
      const tenant = await createTenant(
        TenantType.CLINIC,
        'CLINIC_PRO',
        'DowngradeBlock',
      );
      const admin = await createMember(tenant.id, Role.ADMIN, 'DowngradeAdmin');
      for (let i = 0; i < 5; i++) {
        await createMember(tenant.id, Role.NUTRITIONIST, `DowngradeN${i}`);
      }
      // 6 usuários ativos (1 admin + 5 nutris) — não cabem num CLINIC_ESSENTIAL (3).
      void admin;

      const res = await request(app.getHttpServer())
        .patch(`/platform/tenants/${tenant.id}/plan`)
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({ planCode: 'CLINIC_ESSENTIAL' })
        .expect(409);

      expect((res.body as ErrorResponseBody).message).toMatch(
        /6 usuários ativos.*permite até 3/i,
      );

      // Nada foi alterado — plano continua o mesmo.
      const detailRes = await request(app.getHttpServer())
        .get(`/platform/tenants/${tenant.id}`)
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .expect(200);
      expect((detailRes.body as TenantDetailBody).plan.code).toBe('CLINIC_PRO');
    });
  });

  describe('Autoproteção do último ADMIN ativo', () => {
    it('impede o único ADMIN ativo de suspender a si mesmo', async () => {
      const tenant = await createTenant(
        TenantType.CLINIC,
        'CLINIC_ESSENTIAL',
        'LastAdminSuspend',
      );
      const admin = await createMember(tenant.id, Role.ADMIN, 'LastAdminSusp');

      const res = await request(app.getHttpServer())
        .delete(`/users/${admin.user.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(409);

      expect((res.body as ErrorResponseBody).message).toMatch(
        /único administrador ativo/i,
      );
    });

    it('impede rebaixar o único ADMIN ativo', async () => {
      const tenant = await createTenant(
        TenantType.CLINIC,
        'CLINIC_ESSENTIAL',
        'LastAdminRole',
      );
      const admin = await createMember(tenant.id, Role.ADMIN, 'LastAdminR');

      const res = await request(app.getHttpServer())
        .patch(`/users/${admin.user.id}/role`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ role: 'NUTRITIONIST' })
        .expect(409);

      expect((res.body as ErrorResponseBody).message).toMatch(
        /único administrador ativo/i,
      );
    });

    it('permite suspender um ADMIN quando existe outro ADMIN ativo', async () => {
      const tenant = await createTenant(
        TenantType.CLINIC,
        'CLINIC_ESSENTIAL',
        'TwoAdmins',
      );
      const adminA = await createMember(tenant.id, Role.ADMIN, 'TwoAdminA');
      const adminB = await createMember(tenant.id, Role.ADMIN, 'TwoAdminB');

      await request(app.getHttpServer())
        .delete(`/users/${adminB.user.id}`)
        .set('Authorization', `Bearer ${adminA.accessToken}`)
        .expect(200);
    });
  });

  describe('Isolamento entre tenants', () => {
    it('ADMIN de um tenant não enxerga usuário de outro tenant', async () => {
      const tenantA = await createTenant(
        TenantType.CLINIC,
        'CLINIC_ESSENTIAL',
        'IsolA',
      );
      const tenantB = await createTenant(
        TenantType.CLINIC,
        'CLINIC_ESSENTIAL',
        'IsolB',
      );
      const adminA = await createMember(tenantA.id, Role.ADMIN, 'IsolAdminA');
      const userB = await createMember(tenantB.id, Role.ADMIN, 'IsolAdminB');

      await request(app.getHttpServer())
        .get(`/users/${userB.user.id}`)
        .set('Authorization', `Bearer ${adminA.accessToken}`)
        .expect(404);
    });
  });

  describe('Reset de senha e suspensão/reativação pelo ADMIN do tenant', () => {
    it('reset de senha invalida a antiga e ativa a nova', async () => {
      const tenant = await createTenant(
        TenantType.CLINIC,
        'CLINIC_ESSENTIAL',
        'ResetPwd',
      );
      const admin = await createMember(tenant.id, Role.ADMIN, 'ResetAdmin');
      const member = await createMember(tenant.id, Role.NUTRITIONIST, 'ResetN');

      const resetRes = await request(app.getHttpServer())
        .post(`/users/${member.user.id}/reset-password`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(201);
      const { temporaryPassword } = resetRes.body as {
        temporaryPassword: string;
      };

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: member.user.email, password: DEFAULT_PASSWORD })
        .expect(401);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: member.user.email, password: temporaryPassword })
        .expect(200);
    });

    it('suspender bloqueia login e reativar restaura, sem exceder o limite do plano', async () => {
      const tenant = await createTenant(
        TenantType.CLINIC,
        'CLINIC_ESSENTIAL',
        'SuspendReact',
      );
      const admin = await createMember(tenant.id, Role.ADMIN, 'SuspAdmin');
      const member = await createMember(tenant.id, Role.NUTRITIONIST, 'SuspN');

      await request(app.getHttpServer())
        .delete(`/users/${member.user.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: member.user.email, password: DEFAULT_PASSWORD })
        .expect(401);

      await request(app.getHttpServer())
        .post(`/users/${member.user.id}/activate`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: member.user.email, password: DEFAULT_PASSWORD })
        .expect(200);
    });

    it('suspender preserva User, UserClinic e vínculos clínicos históricos — nada é apagado', async () => {
      const tenant = await createTenant(
        TenantType.CLINIC,
        'CLINIC_ESSENTIAL',
        'SuspendPreserve',
      );
      const admin = await createMember(tenant.id, Role.ADMIN, 'PresAdmin');
      const nutritionist = await createMember(
        tenant.id,
        Role.NUTRITIONIST,
        'PresNutri',
      );

      const patient = await prisma.patient.create({
        data: {
          tenantId: tenant.id,
          fullName: 'Paciente Vínculo Histórico',
          responsibleNutritionistId: nutritionist.user.id,
        },
      });

      await request(app.getHttpServer())
        .delete(`/users/${nutritionist.user.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200);

      const persistedUser = await prisma.user.findUnique({
        where: { id: nutritionist.user.id },
      });
      expect(persistedUser).not.toBeNull();

      const persistedMembership = await prisma.userClinic.findUnique({
        where: { id: nutritionist.userClinic.id },
      });
      expect(persistedMembership).not.toBeNull();
      expect(persistedMembership?.isActive).toBe(false);

      const persistedPatient = await prisma.patient.findUnique({
        where: { id: patient.id },
      });
      expect(persistedPatient?.responsibleNutritionistId).toBe(
        nutritionist.user.id,
      );

      const membershipStillVisible = await request(app.getHttpServer())
        .get(`/users/${nutritionist.user.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200);
      expect((membershipStillVisible.body as TeamMemberBody).isActive).toBe(
        false,
      );
    });
  });

  describe('Uso do plano — GET /users/usage', () => {
    it('reflete usados/limite corretamente', async () => {
      const tenant = await createTenant(
        TenantType.CLINIC,
        'CLINIC_ESSENTIAL',
        'UsageCheck',
      );
      const admin = await createMember(tenant.id, Role.ADMIN, 'UsageAdmin');
      await createMember(tenant.id, Role.NUTRITIONIST, 'UsageN');

      const res = await request(app.getHttpServer())
        .get('/users/usage')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200);

      const usage = res.body as UsageResponseBody;
      expect(usage.planCode).toBe('CLINIC_ESSENTIAL');
      expect(usage.maxUsers).toBe(3);
      expect(usage.usedUsers).toBe(2);
    });
  });
});
