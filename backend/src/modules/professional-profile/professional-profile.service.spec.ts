import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { ProfessionalProfileService } from './professional-profile.service';

jest.setTimeout(15000);

describe('ProfessionalProfileService (integração)', () => {
  let service: ProfessionalProfileService;
  let prisma: PrismaService;

  let tenantA: { id: string; name: string };
  let tenantB: { id: string; name: string };
  let actorUserId: string;

  const runId = Date.now();

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ProfessionalProfileService,
        AuditService,
        PrismaService,
        StorageService,
      ],
    }).compile();

    service = moduleRef.get(ProfessionalProfileService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    tenantA = await prisma.tenant.create({
      data: {
        name: 'Tenant Profile A',
        slug: `profile-a-${runId}`,
        email: 'a@teste.com',
        phone: '11111111',
      },
    });
    tenantB = await prisma.tenant.create({
      data: {
        name: 'Tenant Profile B',
        slug: `profile-b-${runId}`,
        email: 'b@teste.com',
        phone: '22222222',
      },
    });

    const admin = await prisma.user.create({
      data: {
        name: 'Admin Teste',
        email: `admin-profile-${runId}@teste.com`,
        passwordHash: 'x',
      },
    });
    actorUserId = admin.id;
  });

  afterAll(async () => {
    await prisma.professionalProfile.deleteMany({
      where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
    await prisma.tenant.delete({ where: { id: tenantA.id } });
    await prisma.tenant.delete({ where: { id: tenantB.id } });
    await prisma.user.delete({ where: { id: actorUserId } });
    await prisma.$disconnect();
  });

  it('cria um perfil padrão a partir do tenant na primeira leitura', async () => {
    const profile = await service.getOwn(tenantA.id);
    expect(profile.tenantId).toBe(tenantA.id);
    expect(profile.displayName).toBe(tenantA.name);
    expect(profile.paletteKey).toBe('sage');
  });

  it('não repete a criação em leituras subsequentes', async () => {
    const first = await service.getOwn(tenantA.id);
    const second = await service.getOwn(tenantA.id);
    expect(second.id).toBe(first.id);
  });

  it('atualiza a identidade do profissional sem depender do nome do tenant', async () => {
    await service.getOwn(tenantB.id);
    const updated = await service.updateOwn(
      tenantB.id,
      {
        displayName: 'Dra. Ana',
        professionalName: 'Ana Paula Souza',
        crnNumber: '99999',
      },
      actorUserId,
    );
    expect(updated.displayName).toBe('Dra. Ana');
    expect(updated.crnNumber).toBe('99999');
  });

  it('isola o perfil por tenant (unique)', async () => {
    const profileA = await service.getOwn(tenantA.id);
    const profileB = await service.getOwn(tenantB.id);
    expect(profileA.id).not.toBe(profileB.id);
  });
});
