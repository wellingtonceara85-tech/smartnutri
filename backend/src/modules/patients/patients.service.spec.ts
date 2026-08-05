import 'dotenv/config';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role } from '../../generated/prisma/client';
import { PatientsService } from './patients.service';

/**
 * Testes de integração — usam o Postgres real (o mesmo do docker-compose
 * de desenvolvimento) através de um tenant isolado criado e removido a
 * cada execução, para não colidir com os dados de seed.
 */
describe('PatientsService (integração)', () => {
  let service: PatientsService;
  let prisma: PrismaService;

  let tenantA: { id: string };
  let tenantB: { id: string };
  let nutritionistA: { id: string };
  let nutritionistB: { id: string };
  let actorUserId: string;

  const runId = Date.now();

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [PatientsService, AuditService, PrismaService],
    }).compile();

    service = moduleRef.get(PatientsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    tenantA = await prisma.tenant.create({
      data: {
        name: 'Tenant Teste A',
        slug: `teste-a-${runId}`,
        email: 'a@teste.com',
        phone: '11111111',
      },
    });
    tenantB = await prisma.tenant.create({
      data: {
        name: 'Tenant Teste B',
        slug: `teste-b-${runId}`,
        email: 'b@teste.com',
        phone: '22222222',
      },
    });

    nutritionistA = await prisma.user.create({
      data: {
        name: 'Nutri A',
        email: `nutri-a-${runId}@teste.com`,
        passwordHash: 'x',
      },
    });
    await prisma.userClinic.create({
      data: {
        userId: nutritionistA.id,
        tenantId: tenantA.id,
        role: Role.NUTRITIONIST,
      },
    });

    nutritionistB = await prisma.user.create({
      data: {
        name: 'Nutri B',
        email: `nutri-b-${runId}@teste.com`,
        passwordHash: 'x',
      },
    });
    await prisma.userClinic.create({
      data: {
        userId: nutritionistB.id,
        tenantId: tenantB.id,
        role: Role.NUTRITIONIST,
      },
    });

    const admin = await prisma.user.create({
      data: {
        name: 'Admin Teste',
        email: `admin-${runId}@teste.com`,
        passwordHash: 'x',
      },
    });
    actorUserId = admin.id;
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantA.id } });
    await prisma.tenant.delete({ where: { id: tenantB.id } });
    await prisma.user.deleteMany({
      where: { id: { in: [nutritionistA.id, nutritionistB.id, actorUserId] } },
    });
    await prisma.$disconnect();
  });

  it('cria um paciente válido', async () => {
    const patient = await service.create(tenantA.id, actorUserId, {
      fullName: 'Paciente Um',
    });
    expect(patient.id).toBeDefined();
    expect(patient.tenantId).toBe(tenantA.id);
    expect(patient.status).toBe('ACTIVE');
  });

  it('rejeita CPF duplicado dentro do mesmo tenant', async () => {
    await service.create(tenantA.id, actorUserId, {
      fullName: 'Paciente CPF 1',
      cpf: '529.982.247-25',
    });

    await expect(
      service.create(tenantA.id, actorUserId, {
        fullName: 'Paciente CPF 2',
        cpf: '52998224725',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('permite o mesmo CPF em tenants diferentes (isolamento por tenant)', async () => {
    const patient = await service.create(tenantB.id, actorUserId, {
      fullName: 'Paciente CPF Tenant B',
      cpf: '529.982.247-25',
    });
    expect(patient.cpf).toBe('52998224725');
  });

  it('normaliza o CPF armazenando apenas dígitos', async () => {
    const patient = await service.create(tenantA.id, actorUserId, {
      fullName: 'Paciente Normalizado',
      cpf: '111.444.777-35',
    });
    expect(patient.cpf).toBe('11144477735');
  });

  it('isola a listagem de pacientes por tenant', async () => {
    const result = await service.list(tenantA.id, {});
    const idsFromB = (await service.list(tenantB.id, {})).data.map((p) => p.id);
    const idsFromA = result.data.map((p) => p.id);
    expect(idsFromA.length).toBeGreaterThan(0);
    expect(idsFromA.some((id) => idsFromB.includes(id))).toBe(false);
  });

  it('aceita um nutricionista do mesmo tenant como responsável', async () => {
    const patient = await service.create(tenantA.id, actorUserId, {
      fullName: 'Paciente Com Nutricionista',
      responsibleNutritionistId: nutritionistA.id,
    });
    expect(patient.responsibleNutritionistId).toBe(nutritionistA.id);
  });

  it('rejeita nutricionista de outro tenant como responsável', async () => {
    await expect(
      service.create(tenantA.id, actorUserId, {
        fullName: 'Paciente Nutricionista Errado',
        responsibleNutritionistId: nutritionistB.id,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('pagina os resultados corretamente', async () => {
    for (let i = 0; i < 5; i++) {
      await service.create(tenantA.id, actorUserId, {
        fullName: `Paciente Paginação ${i}`,
      });
    }

    const page1 = await service.list(tenantA.id, { page: 1, pageSize: 3 });
    expect(page1.data).toHaveLength(3);
    expect(page1.total).toBeGreaterThanOrEqual(5);
  });

  it('busca pacientes por nome', async () => {
    await service.create(tenantA.id, actorUserId, {
      fullName: 'Wellington Buscável Silva',
    });
    const result = await service.list(tenantA.id, { search: 'Buscável' });
    expect(result.data.some((p) => p.fullName.includes('Buscável'))).toBe(true);
  });

  it('busca pacientes por telefone', async () => {
    await service.create(tenantA.id, actorUserId, {
      fullName: 'Paciente Telefone',
      primaryPhone: '(11) 91234-5678',
    });
    const result = await service.list(tenantA.id, { search: '91234-5678' });
    expect(result.data.some((p) => p.primaryPhone === '11912345678')).toBe(
      true,
    );
  });

  it('filtra pacientes por status', async () => {
    const created = await service.create(tenantA.id, actorUserId, {
      fullName: 'Paciente Inativo Filtro',
    });
    await service.updateStatus(tenantA.id, actorUserId, created.id, {
      status: 'INACTIVE',
    });

    const result = await service.list(tenantA.id, { status: 'INACTIVE' });
    expect(result.data.some((p) => p.id === created.id)).toBe(true);
    expect(result.data.every((p) => p.status === 'INACTIVE')).toBe(true);
  });

  it('altera o status do paciente', async () => {
    const created = await service.create(tenantA.id, actorUserId, {
      fullName: 'Paciente Status',
    });
    const updated = await service.updateStatus(
      tenantA.id,
      actorUserId,
      created.id,
      { status: 'PAUSED', reason: 'Férias' },
    );
    expect(updated.status).toBe('PAUSED');
  });

  it('arquiva um paciente (exclusão lógica, sem apagar o registro)', async () => {
    const created = await service.create(tenantA.id, actorUserId, {
      fullName: 'Paciente Arquivar',
    });
    const archived = await service.archive(tenantA.id, actorUserId, created.id);
    expect(archived.status).toBe('ARCHIVED');

    const stillExists = await service.getById(tenantA.id, created.id);
    expect(stillExists.id).toBe(created.id);
  });

  it('não permite acessar paciente de outro tenant por id (isolamento)', async () => {
    const patientInB = await service.create(tenantB.id, actorUserId, {
      fullName: 'Paciente Exclusivo B',
    });
    await expect(
      service.getById(tenantA.id, patientInB.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
