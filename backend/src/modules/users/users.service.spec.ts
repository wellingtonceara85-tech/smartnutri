import 'dotenv/config';
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role, TenantType } from '../../generated/prisma/client';
import { UsersService } from './users.service';

describe('UsersService.changeOwnPassword (integração)', () => {
  let service: UsersService;
  let prisma: PrismaService;

  let tenant: { id: string };
  let user: { id: string };

  const runId = Date.now();
  const INITIAL_PASSWORD = 'SenhaAtual123';

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [UsersService, AuditService, PrismaService],
    }).compile();

    service = moduleRef.get(UsersService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    tenant = await prisma.tenant.create({
      data: {
        name: 'Tenant Change Password',
        slug: `change-password-${runId}`,
        email: 'a@teste.com',
        phone: '11111111',
      },
    });

    const passwordHash = await bcrypt.hash(INITIAL_PASSWORD, 12);
    const createdUser = await prisma.user.create({
      data: {
        name: 'Usuário Teste Senha',
        email: `usuario-senha-${runId}@teste.com`,
        passwordHash,
      },
    });
    user = createdUser;
    await prisma.userClinic.create({
      data: { userId: user.id, tenantId: tenant.id, role: Role.NUTRITIONIST },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.userClinic.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }, 30000);

  it('rejeita quando a senha atual informada está errada, sem alterar o hash', async () => {
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });

    await expect(
      service.changeOwnPassword(tenant.id, user.id, {
        currentPassword: 'senha-errada',
        newPassword: 'NovaSenha456',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(after.passwordHash).toBe(before.passwordHash);
  });

  it('troca a senha quando a atual está correta, e a nova senha passa a autenticar', async () => {
    await service.changeOwnPassword(tenant.id, user.id, {
      currentPassword: INITIAL_PASSWORD,
      newPassword: 'NovaSenha456',
    });

    const updated = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    const matchesNew = await bcrypt.compare(
      'NovaSenha456',
      updated.passwordHash,
    );
    const matchesOld = await bcrypt.compare(
      INITIAL_PASSWORD,
      updated.passwordHash,
    );
    expect(matchesNew).toBe(true);
    expect(matchesOld).toBe(false);
  });

  it('grava a troca no AuditLog, sem expor a senha', async () => {
    const entry = await prisma.auditLog.findFirst({
      where: { tenantId: tenant.id, entityType: 'User', entityId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(entry).not.toBeNull();
    expect(
      (entry?.metadata as { changeType?: string } | null)?.changeType,
    ).toBe('PASSWORD_CHANGE_SELF');
    expect(JSON.stringify(entry)).not.toContain('NovaSenha456');
  });

  it('não permite trocar a senha de um usuário que não pertence ao tenant informado', async () => {
    const otherTenant = await prisma.tenant.create({
      data: {
        name: 'Outro Tenant Change Password',
        slug: `change-password-other-${runId}`,
        email: 'b@teste.com',
        phone: '22222222',
      },
    });

    await expect(
      service.changeOwnPassword(otherTenant.id, user.id, {
        currentPassword: 'NovaSenha456',
        newPassword: 'MaisUmaSenha789',
      }),
    ).rejects.toThrow();

    await prisma.tenant.delete({ where: { id: otherTenant.id } });
  });
});

describe('UsersService.listNutritionistsForTenant (integração)', () => {
  let service: UsersService;
  let prisma: PrismaService;

  let soloTenant: { id: string };
  let soloAdmin: { id: string; name: string };
  let clinicTenant: { id: string };
  let clinicAdmin: { id: string; name: string };
  let clinicNutritionist: { id: string; name: string };

  const runId = Date.now();

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [UsersService, AuditService, PrismaService],
    }).compile();

    service = moduleRef.get(UsersService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    soloTenant = await prisma.tenant.create({
      data: {
        name: 'Tenant Independente Lista',
        slug: `list-nutri-solo-${runId}`,
        email: 'solo@teste.com',
        phone: '11111111',
        type: TenantType.SOLO,
      },
    });
    soloAdmin = await prisma.user.create({
      data: {
        name: 'Admin Independente Lista',
        email: `admin-solo-lista-${runId}@teste.com`,
        passwordHash: 'x',
      },
    });
    await prisma.userClinic.create({
      data: { userId: soloAdmin.id, tenantId: soloTenant.id, role: Role.ADMIN },
    });

    clinicTenant = await prisma.tenant.create({
      data: {
        name: 'Tenant Clínica Lista',
        slug: `list-nutri-clinic-${runId}`,
        email: 'clinic@teste.com',
        phone: '22222222',
        type: TenantType.CLINIC,
      },
    });
    clinicAdmin = await prisma.user.create({
      data: {
        name: 'Admin Clínica Lista',
        email: `admin-clinic-lista-${runId}@teste.com`,
        passwordHash: 'x',
      },
    });
    await prisma.userClinic.create({
      data: {
        userId: clinicAdmin.id,
        tenantId: clinicTenant.id,
        role: Role.ADMIN,
      },
    });
    clinicNutritionist = await prisma.user.create({
      data: {
        name: 'Nutri Clínica Lista',
        email: `nutri-clinic-lista-${runId}@teste.com`,
        passwordHash: 'x',
      },
    });
    await prisma.userClinic.create({
      data: {
        userId: clinicNutritionist.id,
        tenantId: clinicTenant.id,
        role: Role.NUTRITIONIST,
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.userClinic.deleteMany({
      where: { tenantId: { in: [soloTenant.id, clinicTenant.id] } },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: [soloAdmin.id, clinicAdmin.id, clinicNutritionist.id] },
      },
    });
    await prisma.tenant.delete({ where: { id: soloTenant.id } });
    await prisma.tenant.delete({ where: { id: clinicTenant.id } });
    await prisma.$disconnect();
  });

  it('inclui o ADMIN do plano Independente como nutricionista da clínica', async () => {
    const list = await service.listNutritionistsForTenant(soloTenant.id);
    expect(list).toEqual([{ id: soloAdmin.id, name: soloAdmin.name }]);
  });

  it('em um tenant CLINIC, lista só quem tem papel NUTRITIONIST — não o ADMIN', async () => {
    const list = await service.listNutritionistsForTenant(clinicTenant.id);
    expect(list).toEqual([
      { id: clinicNutritionist.id, name: clinicNutritionist.name },
    ]);
  });
});
