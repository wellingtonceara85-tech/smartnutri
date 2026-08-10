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

interface PlatformUserItem {
  id: string;
  userId: string;
  email: string;
  role: string;
  isActive: boolean;
  tenantId: string;
  tenantName: string;
}

interface PlatformUserListResponseBody {
  data: PlatformUserItem[];
  total: number;
}

interface CreatePlatformUserResponseBody {
  user: PlatformUserItem;
  temporaryPassword: string;
}

interface ResetPasswordResponseBody {
  temporaryPassword: string;
}

interface ErrorResponseBody {
  message?: string;
}

/**
 * Testes e2e da Missão 0005.6 — Gestão de Usuários do Platform Admin:
 * listagem/filtro global, criação de usuário em qualquer tenant, regra de
 * SOLO (no máximo um usuário), redefinição de senha e suspensão/
 * reativação por vínculo (UserClinic), sem afetar o tenant inteiro.
 */
describe('Platform Users (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let tenantClinicA: { id: string };
  let tenantClinicB: { id: string };
  let tenantSolo: { id: string };
  let clinicAAdminToken: string;
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
        email: `${label.toLowerCase()}-platusr-${runId}@teste.com`,
        passwordHash: await bcrypt.hash('Senha@Original123', 10),
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

    tenantClinicA = await prisma.tenant.create({
      data: {
        name: `Clinica PlatUsr A ${runId}`,
        slug: `platusr-clinic-a-${runId}`,
        email: 'a@teste.com',
        phone: '11111111',
        type: TenantType.CLINIC,
      },
    });
    tenantClinicB = await prisma.tenant.create({
      data: {
        name: `Clinica PlatUsr B ${runId}`,
        slug: `platusr-clinic-b-${runId}`,
        email: 'b@teste.com',
        phone: '22222222',
        type: TenantType.CLINIC,
      },
    });
    tenantSolo = await prisma.tenant.create({
      data: {
        name: `Solo PlatUsr ${runId}`,
        slug: `platusr-solo-${runId}`,
        email: 'solo@teste.com',
        phone: '33333333',
        type: TenantType.SOLO,
      },
    });

    const adminA = await createUserWithRole(
      tenantClinicA.id,
      Role.ADMIN,
      'AdminA',
    );
    clinicAAdminToken = adminA.accessToken;

    await createUserWithRole(tenantSolo.id, Role.ADMIN, 'SoloOwner');

    const platformAdmin = await prisma.user.create({
      data: {
        name: `Platform Admin PlatUsr ${runId}`,
        email: `platform-admin-platusr-${runId}@teste.com`,
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
    await prisma.userClinic.deleteMany({
      where: {
        tenantId: { in: [tenantClinicA.id, tenantClinicB.id, tenantSolo.id] },
      },
    });
    await prisma.tenant.deleteMany({
      where: { slug: { contains: `-${runId}` } },
    });
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: { endsWith: `-platusr-${runId}@teste.com` } },
          { email: { contains: `-platusr-novo-${runId}@teste.com` } },
        ],
      },
    });
    await app.close();
  }, 30000);

  it('PLATFORM_ADMIN lista usuários globalmente', async () => {
    const res = await request(app.getHttpServer())
      .get('/platform/users')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .expect(200);

    const body = res.body as PlatformUserListResponseBody;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.some((u) => u.tenantId === tenantClinicA.id)).toBe(true);
  });

  it('ADMIN de tenant recebe 403 em /platform/users', async () => {
    await request(app.getHttpServer())
      .get('/platform/users')
      .set('Authorization', `Bearer ${clinicAAdminToken}`)
      .expect(403);
  });

  it('filtro por tenantId isola corretamente entre tenants', async () => {
    const res = await request(app.getHttpServer())
      .get(`/platform/users?tenantId=${tenantClinicA.id}`)
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .expect(200);

    const body = res.body as PlatformUserListResponseBody;
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.every((u) => u.tenantId === tenantClinicA.id)).toBe(true);
  });

  it('cria usuário associado corretamente ao tenant informado', async () => {
    const email = `novo-platusr-novo-${runId}@teste.com`;
    const res = await request(app.getHttpServer())
      .post('/platform/users')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({
        tenantId: tenantClinicB.id,
        name: 'Novo Usuario Teste',
        email,
        role: 'NUTRITIONIST',
      })
      .expect(201);

    const body = res.body as CreatePlatformUserResponseBody;
    expect(body.user.email).toBe(email);
    expect(body.user.tenantId).toBe(tenantClinicB.id);
    expect(body.user.role).toBe('NUTRITIONIST');
    expect(typeof body.temporaryPassword).toBe('string');
    expect(body.temporaryPassword.length).toBeGreaterThan(0);
    expect(JSON.stringify(body.user)).not.toMatch(/passwordHash/i);
  });

  it('rejeita e-mail duplicado no mesmo tenant', async () => {
    const email = `dup-platusr-novo-${runId}@teste.com`;
    await request(app.getHttpServer())
      .post('/platform/users')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({
        tenantId: tenantClinicB.id,
        name: 'Original',
        email,
        role: 'RECEPTION',
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/platform/users')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({
        tenantId: tenantClinicB.id,
        name: 'Duplicado',
        email,
        role: 'RECEPTION',
      })
      .expect(409);

    expect((res.body as ErrorResponseBody).message).toMatch(
      /já está vinculado/i,
    );
  });

  it('impede criar um segundo usuário em tenant SOLO', async () => {
    const res = await request(app.getHttpServer())
      .post('/platform/users')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({
        tenantId: tenantSolo.id,
        name: 'Segundo Usuario Solo',
        email: `segundo-solo-platusr-novo-${runId}@teste.com`,
        role: 'NUTRITIONIST',
      })
      .expect(409);

    expect((res.body as ErrorResponseBody).message).toMatch(/SOLO/i);
  });

  it('redefine senha — a antiga deixa de autenticar e a nova autentica', async () => {
    const created = await createUserWithRole(
      tenantClinicA.id,
      Role.RECEPTION,
      'ParaReset',
    );

    const loginBefore = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: created.user.email, password: 'Senha@Original123' });
    expect(loginBefore.status).toBe(200);

    const resetRes = await request(app.getHttpServer())
      .post(`/platform/users/${created.userClinic.id}/reset-password`)
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .expect(201);
    const { temporaryPassword } = resetRes.body as ResetPasswordResponseBody;

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: created.user.email, password: 'Senha@Original123' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: created.user.email, password: temporaryPassword })
      .expect(200);
  });

  it('suspende o usuário (bloqueia login) e reativa (restaura login) sem afetar o tenant', async () => {
    const created = await createUserWithRole(
      tenantClinicA.id,
      Role.NUTRITIONIST,
      'ParaSuspender',
    );

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: created.user.email, password: 'Senha@Original123' })
      .expect(200);

    const suspendRes = await request(app.getHttpServer())
      .post(`/platform/users/${created.userClinic.id}/suspend`)
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .expect(201);
    expect((suspendRes.body as PlatformUserItem).isActive).toBe(false);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: created.user.email, password: 'Senha@Original123' })
      .expect(401);

    // Outro usuário do mesmo tenant continua funcionando normalmente.
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: `admina-platusr-${runId}@teste.com`,
        password: 'Senha@Original123',
      })
      .expect(200);

    const activateRes = await request(app.getHttpServer())
      .post(`/platform/users/${created.userClinic.id}/activate`)
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .expect(201);
    expect((activateRes.body as PlatformUserItem).isActive).toBe(true);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: created.user.email, password: 'Senha@Original123' })
      .expect(200);
  });

  it('resposta de /platform/users só expõe campos administrativos — nunca passwordHash nem dado clínico', async () => {
    const res = await request(app.getHttpServer())
      .get('/platform/users')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .expect(200);

    const allowedKeys = new Set([
      'id',
      'userId',
      'name',
      'email',
      'role',
      'isActive',
      'tenantId',
      'tenantName',
      'tenantType',
      'tenantStatus',
      'createdAt',
      'lastLoginAt',
    ]);

    const body = res.body as PlatformUserListResponseBody;
    expect(body.data.length).toBeGreaterThan(0);
    for (const item of body.data) {
      for (const key of Object.keys(item)) {
        expect(allowedKeys.has(key)).toBe(true);
      }
    }
  });
});
