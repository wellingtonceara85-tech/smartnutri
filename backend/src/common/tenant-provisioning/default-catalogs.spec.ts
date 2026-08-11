import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_APPOINTMENT_TYPES,
  DEFAULT_PAYMENT_METHOD_NAMES,
  provisionDefaultCatalogs,
} from './default-catalogs';

describe('provisionDefaultCatalogs (integração)', () => {
  let prisma: PrismaService;

  let tenantA: { id: string };
  let tenantB: { id: string };

  const runId = Date.now();

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    tenantA = await prisma.tenant.create({
      data: {
        name: 'Tenant Catalogs A',
        slug: `catalogs-a-${runId}`,
        email: `catalogs-a-${runId}@teste.com`,
        phone: '11111111',
      },
    });
    tenantB = await prisma.tenant.create({
      data: {
        name: 'Tenant Catalogs B',
        slug: `catalogs-b-${runId}`,
        email: `catalogs-b-${runId}@teste.com`,
        phone: '22222222',
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantA.id, tenantB.id] } },
    });
    await prisma.$disconnect();
  }, 30000);

  it('cria os 6 tipos de consulta e as 7 formas de pagamento padrão', async () => {
    await provisionDefaultCatalogs(prisma, tenantA.id);

    const types = await prisma.appointmentType.findMany({
      where: { tenantId: tenantA.id },
    });
    const methods = await prisma.paymentMethod.findMany({
      where: { tenantId: tenantA.id },
    });

    expect(types).toHaveLength(DEFAULT_APPOINTMENT_TYPES.length);
    expect(types.map((t) => t.name).sort()).toEqual(
      [...DEFAULT_APPOINTMENT_TYPES.map((t) => t.name)].sort(),
    );
    expect(methods).toHaveLength(DEFAULT_PAYMENT_METHOD_NAMES.length);
    expect(methods.map((m) => m.name).sort()).toEqual(
      [...DEFAULT_PAYMENT_METHOD_NAMES].sort(),
    );
  });

  it('é idempotente — rodar de novo para o mesmo tenant não duplica linhas', async () => {
    await provisionDefaultCatalogs(prisma, tenantA.id);
    await provisionDefaultCatalogs(prisma, tenantA.id);

    const types = await prisma.appointmentType.count({
      where: { tenantId: tenantA.id },
    });
    const methods = await prisma.paymentMethod.count({
      where: { tenantId: tenantA.id },
    });

    expect(types).toBe(DEFAULT_APPOINTMENT_TYPES.length);
    expect(methods).toBe(DEFAULT_PAYMENT_METHOD_NAMES.length);
  });

  it('isola os catálogos entre tenants — provisionar A não afeta B', async () => {
    const typesB = await prisma.appointmentType.count({
      where: { tenantId: tenantB.id },
    });
    const methodsB = await prisma.paymentMethod.count({
      where: { tenantId: tenantB.id },
    });

    expect(typesB).toBe(0);
    expect(methodsB).toBe(0);

    await provisionDefaultCatalogs(prisma, tenantB.id);

    const typesA = await prisma.appointmentType.count({
      where: { tenantId: tenantA.id },
    });
    const typesBAfter = await prisma.appointmentType.count({
      where: { tenantId: tenantB.id },
    });

    expect(typesA).toBe(DEFAULT_APPOINTMENT_TYPES.length);
    expect(typesBAfter).toBe(DEFAULT_APPOINTMENT_TYPES.length);
  });
});
