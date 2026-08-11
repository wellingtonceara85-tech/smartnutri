import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { Role } from '../src/generated/prisma/client';

/**
 * Testes e2e de "Alterar minha senha" (Missão 0006.4), contra a aplicação
 * Nest real (guards/pipes ativos) — mesmo padrão dos demais specs deste
 * projeto.
 */
describe('Change own password (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let tenant: { id: string };
  let userId: string;
  let accessToken: string;

  const runId = Date.now();
  const ORIGINAL_PASSWORD = 'Senha@Original123';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    prisma = moduleFixture.get(PrismaService);
    jwtService = moduleFixture.get(JwtService);

    tenant = await prisma.tenant.create({
      data: {
        name: 'Tenant Change Password E2E',
        slug: `change-password-e2e-${runId}`,
        email: 'a@teste.com',
        phone: '11111111',
      },
    });

    const user = await prisma.user.create({
      data: {
        name: `Usuário Senha E2E ${runId}`,
        email: `usuario-senha-e2e-${runId}@teste.com`,
        passwordHash: await bcrypt.hash(ORIGINAL_PASSWORD, 10),
      },
    });
    userId = user.id;
    const userClinic = await prisma.userClinic.create({
      data: { userId: user.id, tenantId: tenant.id, role: Role.NUTRITIONIST },
    });
    accessToken = await jwtService.signAsync(
      { sub: user.id, tenantId: tenant.id, userClinicId: userClinic.id },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' },
    );
  }, 30000);

  afterAll(async () => {
    await prisma.userClinic.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await app.close();
  }, 30000);

  it('requisição sem token é rejeitada (401)', async () => {
    await request(app.getHttpServer())
      .post('/users/me/change-password')
      .send({ currentPassword: ORIGINAL_PASSWORD, newPassword: 'NovaSenha456' })
      .expect(401);
  });

  it('rejeita senha nova abaixo do mínimo exigido (400)', async () => {
    await request(app.getHttpServer())
      .post('/users/me/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: ORIGINAL_PASSWORD, newPassword: '123' })
      .expect(400);
  });

  it('rejeita quando a senha atual está errada (401), sem afetar o login existente', async () => {
    await request(app.getHttpServer())
      .post('/users/me/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'senha-errada', newPassword: 'NovaSenha456' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `usuario-senha-e2e-${runId}@teste.com`, password: ORIGINAL_PASSWORD })
      .expect(200);
  });

  it('troca a senha com sucesso — login antigo passa a falhar, novo passa a funcionar', async () => {
    await request(app.getHttpServer())
      .post('/users/me/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: ORIGINAL_PASSWORD, newPassword: 'NovaSenha456' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `usuario-senha-e2e-${runId}@teste.com`, password: ORIGINAL_PASSWORD })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `usuario-senha-e2e-${runId}@teste.com`, password: 'NovaSenha456' })
      .expect(200);
  });
});
