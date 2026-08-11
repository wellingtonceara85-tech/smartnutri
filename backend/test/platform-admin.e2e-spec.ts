import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { Role, TenantType } from '../src/generated/prisma/client';

interface TenantListResponseBody {
  data: { id: string }[];
}

interface TenantAdminActionResponseBody {
  status: string;
}

interface CreateTenantResponseBody {
  tenant: { id: string; type: string };
  owner: { email: string; temporaryPassword: string };
}

interface DashboardResponseBody {
  tenants: { total: number };
}

interface TenantDetailResponseBody {
  usage: { nutritionists: number };
}

interface ErrorResponseBody {
  message?: string;
  stack?: unknown;
}

/**
 * Testes e2e da Missão 0005.5 — isolamento entre autoridade global
 * (Platform Admin) e RBAC de tenant, ciclo de vida do tenant (suspender/
 * reativar) e criação de clientes SOLO/CLINIC. Usa a aplicação Nest real
 * (guards ativos), como os demais specs de RBAC deste projeto.
 */
describe('Platform Admin (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let tenantA: { id: string };
  let tenantB: { id: string };
  let tenantTokens: Record<'admin' | 'nutritionist' | 'reception', string>;
  let platformAdminToken: string;

  const runId = Date.now();

  async function createUserWithRole(
    tenantId: string,
    role: Role,
    label: string,
  ) {
    const user = await prisma.user.create({
      data: {
        name: `${label} ${runId}`,
        email: `${label.toLowerCase()}-plat-${runId}@teste.com`,
        passwordHash: 'x',
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

  async function signPlatformToken(userId: string) {
    return jwtService.signAsync(
      { sub: userId, scope: 'platform' },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' },
    );
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
        name: 'Tenant Platform RBAC A',
        slug: `platform-rbac-a-${runId}`,
        email: 'a@teste.com',
        phone: '11111111',
      },
    });
    tenantB = await prisma.tenant.create({
      data: {
        name: 'Tenant Platform RBAC B',
        slug: `platform-rbac-b-${runId}`,
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
    tenantTokens = {
      admin: admin.accessToken,
      nutritionist: nutritionist.accessToken,
      reception: reception.accessToken,
    };

    const platformAdmin = await prisma.user.create({
      data: {
        name: `Platform Admin ${runId}`,
        email: `platform-admin-${runId}@teste.com`,
        passwordHash: 'x',
        isPlatformAdmin: true,
      },
    });
    platformAdminToken = await signPlatformToken(platformAdmin.id);
  }, 30000);

  afterAll(async () => {
    await prisma.patient.deleteMany({
      where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
    await prisma.professionalProfile.deleteMany({
      where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
    await prisma.userClinic.deleteMany({
      where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantA.id, tenantB.id] } },
    });
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: { endsWith: `-plat-${runId}@teste.com` } },
          { email: { endsWith: `platform-admin-${runId}@teste.com` } },
          { email: { contains: `-solo-${runId}@teste.com` } },
          { email: { contains: `-clinic-${runId}@teste.com` } },
        ],
      },
    });
    await prisma.tenant.deleteMany({
      where: { slug: { contains: `-${runId}` } },
    });
    await app.close();
  }, 30000);

  describe('Isolamento entre autoridade global e RBAC de tenant', () => {
    it('PLATFORM_ADMIN acessa dashboard e listagem de clientes', async () => {
      await request(app.getHttpServer())
        .get('/platform/dashboard')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/platform/tenants')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .expect(200);

      const body = res.body as TenantListResponseBody;
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.some((t) => t.id === tenantA.id)).toBe(true);
      expect(body.data.some((t) => t.id === tenantB.id)).toBe(true);
    });

    it('ADMIN/NUTRITIONIST/RECEPTION de tenant recebem 403 em /platform/*', async () => {
      for (const role of ['admin', 'nutritionist', 'reception'] as const) {
        await request(app.getHttpServer())
          .get('/platform/dashboard')
          .set('Authorization', `Bearer ${tenantTokens[role]}`)
          .expect(403);

        await request(app.getHttpServer())
          .get('/platform/tenants')
          .set('Authorization', `Bearer ${tenantTokens[role]}`)
          .expect(403);
      }
    });

    it('PLATFORM_ADMIN não ganha acesso a rota clínica tenant-scoped', async () => {
      await request(app.getHttpServer())
        .get('/patients')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .expect(401);

      await request(app.getHttpServer())
        .get('/meal-plans/nonexistent-but-guard-runs-first')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .expect(401);
    });

    it('resposta de /platform/tenants só expõe os campos administrativos esperados — nunca campo clínico', async () => {
      const res = await request(app.getHttpServer())
        .get('/platform/tenants')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .expect(200);

      const allowedKeys = new Set([
        'id',
        'name',
        'type',
        'status',
        'responsibleName',
        'email',
        'phone',
        'planCode',
        'trialEndsAt',
        'userCount',
        'patientCount',
        'createdAt',
      ]);

      const body = res.body as { data: Record<string, unknown>[] };
      expect(body.data.length).toBeGreaterThan(0);
      for (const tenantItem of body.data) {
        for (const key of Object.keys(tenantItem)) {
          expect(allowedKeys.has(key)).toBe(true);
        }
      }
    });
  });

  describe('Ciclo de vida do tenant', () => {
    it('tenant suspenso rejeita login e revoga sessão já ativa, reativar restaura o acesso', async () => {
      const owner = await createUserWithRole(tenantB.id, Role.ADMIN, 'DonoB');

      // sessão já ativa continua funcionando antes de suspender
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      const suspendRes = await request(app.getHttpServer())
        .post(`/platform/tenants/${tenantB.id}/suspend`)
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .expect(201);
      expect((suspendRes.body as TenantAdminActionResponseBody).status).toBe(
        'SUSPENDED',
      );

      // sessão já emitida deixa de funcionar (revalidada a cada request)
      const blocked = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(401);
      const blockedBody = blocked.body as ErrorResponseBody;
      expect(blockedBody.message).toMatch(/suspenso/i);
      expect(blockedBody.stack).toBeUndefined();

      const activateRes = await request(app.getHttpServer())
        .post(`/platform/tenants/${tenantB.id}/activate`)
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .expect(201);
      expect((activateRes.body as TenantAdminActionResponseBody).status).toBe(
        'ACTIVE',
      );

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);
    });

    it('suspender não apaga nenhum dado do tenant', async () => {
      const patient = await prisma.patient.create({
        data: { tenantId: tenantA.id, fullName: `Paciente suspensão ${runId}` },
      });

      await request(app.getHttpServer())
        .post(`/platform/tenants/${tenantA.id}/suspend`)
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .expect(201);

      const stillThere = await prisma.patient.findUnique({
        where: { id: patient.id },
      });
      expect(stillThere).not.toBeNull();

      await request(app.getHttpServer())
        .post(`/platform/tenants/${tenantA.id}/activate`)
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .expect(201);
    });
  });

  describe('Criação de clientes', () => {
    let soloTenantId: string;

    it('cria cliente SOLO com exatamente um usuário proprietário (ADMIN)', async () => {
      const res = await request(app.getHttpServer())
        .post('/platform/tenants')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          type: 'SOLO',
          planCode: 'SOLO',
          name: `Nutri Solo Teste ${runId}`,
          responsibleName: 'Nutri Solo Teste',
          email: `nutri-solo-${runId}@teste.com`,
          phone: '11999990000',
        })
        .expect(201);

      const body = res.body as CreateTenantResponseBody;
      expect(body.owner.email).toBe(`nutri-solo-${runId}@teste.com`);
      expect(typeof body.owner.temporaryPassword).toBe('string');
      expect(body.owner.temporaryPassword.length).toBeGreaterThan(0);

      const memberships = await prisma.userClinic.findMany({
        where: { tenantId: body.tenant.id },
      });
      expect(memberships).toHaveLength(1);
      expect(memberships[0].role).toBe(Role.ADMIN);

      // Missão 0005.9 — todo tenant novo já nasce com os catálogos mínimos.
      const types = await prisma.appointmentType.findMany({
        where: { tenantId: body.tenant.id },
      });
      const methods = await prisma.paymentMethod.findMany({
        where: { tenantId: body.tenant.id },
      });
      expect(types).toHaveLength(6);
      expect(methods).toHaveLength(7);

      soloTenantId = body.tenant.id;
    });

    it('cria cliente CLINIC normalmente, com os mesmos catálogos mínimos (Missão 0005.9)', async () => {
      const res = await request(app.getHttpServer())
        .post('/platform/tenants')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          type: 'CLINIC',
          planCode: 'CLINIC_ESSENTIAL',
          name: `Clínica Teste ${runId}`,
          responsibleName: 'Responsável Clínica',
          email: `clinica-${runId}@teste.com`,
          phone: '11999991111',
        })
        .expect(201);

      const body = res.body as CreateTenantResponseBody;
      expect(body.tenant.type).toBe('CLINIC');

      const types = await prisma.appointmentType.findMany({
        where: { tenantId: body.tenant.id },
      });
      const methods = await prisma.paymentMethod.findMany({
        where: { tenantId: body.tenant.id },
      });
      expect(types).toHaveLength(6);
      expect(methods).toHaveLength(7);

      // Isolamento: os IDs dos catálogos do CLINIC não podem colidir com os do SOLO criado no teste anterior.
      const soloTypeIds = new Set(
        (
          await prisma.appointmentType.findMany({
            where: { tenantId: soloTenantId },
            select: { id: true },
          })
        ).map((t) => t.id),
      );
      for (const t of types) {
        expect(soloTypeIds.has(t.id)).toBe(false);
      }
    });

    it('ADMIN de tenant não consegue criar cliente (403)', async () => {
      await request(app.getHttpServer())
        .post('/platform/tenants')
        .set('Authorization', `Bearer ${tenantTokens.admin}`)
        .send({
          type: 'SOLO',
          planCode: 'SOLO',
          name: 'Tentativa indevida',
          responsibleName: 'Tentativa',
          email: `tentativa-${runId}@teste.com`,
          phone: '11999992222',
        })
        .expect(403);
    });
  });

  describe('Contadores do dashboard', () => {
    it('contagem de clientes reflete os tenants existentes', async () => {
      const [expectedTotal, res] = await Promise.all([
        prisma.tenant.count({ where: { deletedAt: null } }),
        request(app.getHttpServer())
          .get('/platform/dashboard')
          .set('Authorization', `Bearer ${platformAdminToken}`)
          .expect(200),
      ]);

      expect((res.body as DashboardResponseBody).tenants.total).toBe(
        expectedTotal,
      );
    });
  });

  describe('Métrica de nutricionistas (Ajuste 02)', () => {
    it('tenant SOLO conta o ADMIN único como nutricionista', async () => {
      const tenant = await prisma.tenant.create({
        data: {
          name: `Nutri Solo Metrica ${runId}`,
          slug: `metrica-solo-admin-${runId}`,
          email: `metrica-solo-${runId}@teste.com`,
          phone: '11999993333',
          type: TenantType.SOLO,
        },
      });
      await createUserWithRole(tenant.id, Role.ADMIN, 'AdminSoloMetrica');

      const res = await request(app.getHttpServer())
        .get(`/platform/tenants/${tenant.id}`)
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .expect(200);

      expect((res.body as TenantDetailResponseBody).usage.nutritionists).toBe(
        1,
      );
    });

    it('tenant CLINIC conta só os NUTRITIONIST — ADMIN e RECEPTION administrativos ficam de fora', async () => {
      const tenant = await prisma.tenant.create({
        data: {
          name: `Clinica Metrica ${runId}`,
          slug: `metrica-clinic-multi-${runId}`,
          email: `metrica-clinic-${runId}@teste.com`,
          phone: '11999994444',
          type: TenantType.CLINIC,
        },
      });
      await createUserWithRole(tenant.id, Role.ADMIN, 'AdminClinicaMetrica');
      await createUserWithRole(tenant.id, Role.NUTRITIONIST, 'NutriUmMetrica');
      await createUserWithRole(
        tenant.id,
        Role.NUTRITIONIST,
        'NutriDoisMetrica',
      );
      await createUserWithRole(tenant.id, Role.RECEPTION, 'RecepcaoMetrica');

      const res = await request(app.getHttpServer())
        .get(`/platform/tenants/${tenant.id}`)
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .expect(200);

      expect((res.body as TenantDetailResponseBody).usage.nutritionists).toBe(
        2,
      );
    });

    it('ADMIN de tenant SOLO com ProfessionalProfile próprio não é contado em dobro', async () => {
      const tenant = await prisma.tenant.create({
        data: {
          name: `Nutri Solo Perfil ${runId}`,
          slug: `metrica-solo-perfil-${runId}`,
          email: `metrica-solo-perfil-${runId}@teste.com`,
          phone: '11999995555',
          type: TenantType.SOLO,
        },
      });
      const { user: owner } = await createUserWithRole(
        tenant.id,
        Role.ADMIN,
        'AdminSoloPerfil',
      );
      await prisma.professionalProfile.create({
        data: {
          tenantId: tenant.id,
          userId: owner.id,
          displayName: owner.name,
          professionalName: owner.name,
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/platform/tenants/${tenant.id}`)
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .expect(200);

      expect((res.body as TenantDetailResponseBody).usage.nutritionists).toBe(
        1,
      );
    });

    it('ProfessionalProfile do ADMIN de uma clínica não infla a contagem de nutricionistas', async () => {
      const tenant = await prisma.tenant.create({
        data: {
          name: `Clinica Perfil ${runId}`,
          slug: `metrica-clinic-perfil-${runId}`,
          email: `metrica-clinic-perfil-${runId}@teste.com`,
          phone: '11999996666',
          type: TenantType.CLINIC,
        },
      });
      const { user: owner } = await createUserWithRole(
        tenant.id,
        Role.ADMIN,
        'AdminClinicaPerfil',
      );
      await createUserWithRole(
        tenant.id,
        Role.NUTRITIONIST,
        'NutriClinicaPerfil',
      );
      await prisma.professionalProfile.create({
        data: {
          tenantId: tenant.id,
          userId: owner.id,
          displayName: owner.name,
          professionalName: owner.name,
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/platform/tenants/${tenant.id}`)
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .expect(200);

      expect((res.body as TenantDetailResponseBody).usage.nutritionists).toBe(
        1,
      );
    });
  });
});
