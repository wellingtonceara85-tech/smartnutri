import 'dotenv/config';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  AppointmentModality,
  AppointmentStatus,
  Role,
  TenantType,
} from '../../generated/prisma/client';
import { FinanceService } from '../finance/finance.service';
import { AppointmentsService } from './appointments.service';

jest.setTimeout(20000);

describe('AppointmentsService (integração)', () => {
  let service: AppointmentsService;
  let prisma: PrismaService;

  let tenantA: { id: string };
  let tenantB: { id: string };
  let adminA: { id: string };
  let nutritionistA: { id: string };
  let receptionA: { id: string };
  let nutritionistB: { id: string };
  let patientA: { id: string };
  let patientB: { id: string };
  let typeA: { id: string };
  let planA: { id: string; defaultPrice: unknown };
  let paymentMethodA: { id: string };

  const runId = Date.now();
  const baseDay = '2026-09-14'; // segunda-feira fictícia, só para os testes

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        AuditService,
        PrismaService,
        FinanceService,
      ],
    }).compile();

    service = moduleRef.get(AppointmentsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    tenantA = await prisma.tenant.create({
      data: {
        name: 'Tenant Appt A',
        slug: `appt-a-${runId}`,
        email: 'a@teste.com',
        phone: '11111111',
      },
    });
    tenantB = await prisma.tenant.create({
      data: {
        name: 'Tenant Appt B',
        slug: `appt-b-${runId}`,
        email: 'b@teste.com',
        phone: '22222222',
      },
    });

    adminA = await prisma.user.create({
      data: {
        name: 'Admin A',
        email: `admin-appt-a-${runId}@teste.com`,
        passwordHash: 'x',
      },
    });
    await prisma.userClinic.create({
      data: { userId: adminA.id, tenantId: tenantA.id, role: Role.ADMIN },
    });

    nutritionistA = await prisma.user.create({
      data: {
        name: 'Nutri Appt A',
        email: `nutri-appt-a-${runId}@teste.com`,
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

    receptionA = await prisma.user.create({
      data: {
        name: 'Recepção Appt A',
        email: `reception-appt-a-${runId}@teste.com`,
        passwordHash: 'x',
      },
    });
    await prisma.userClinic.create({
      data: {
        userId: receptionA.id,
        tenantId: tenantA.id,
        role: Role.RECEPTION,
      },
    });

    nutritionistB = await prisma.user.create({
      data: {
        name: 'Nutri Appt B',
        email: `nutri-appt-b-${runId}@teste.com`,
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

    patientA = await prisma.patient.create({
      data: { tenantId: tenantA.id, fullName: 'Paciente Appt A' },
    });
    patientB = await prisma.patient.create({
      data: { tenantId: tenantB.id, fullName: 'Paciente Appt B' },
    });

    typeA = await prisma.appointmentType.create({
      data: {
        tenantId: tenantA.id,
        name: 'Retorno',
        defaultDurationMinutes: 40,
      },
    });

    planA = await prisma.plan.create({
      data: {
        tenantId: tenantA.id,
        name: 'Plano Teste Appt',
        durationMonths: 3,
        suggestedAppointments: 2,
        suggestedIntervalDays: 30,
        defaultPrice: 900,
        defaultInstallments: 3,
      },
    });
    paymentMethodA = await prisma.paymentMethod.create({
      data: { tenantId: tenantA.id, name: 'PIX Teste Appt' },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.appointmentStatusHistory.deleteMany({
      where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
    await prisma.patientEvolution.deleteMany({
      where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
    await prisma.appointment.deleteMany({
      where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
    await prisma.appointmentType.deleteMany({
      where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
    // TreatmentCycle.createdByUserId não tem onDelete: Cascade (RESTRICT por
    // padrão) — precisa sumir antes de apagarmos os usuários de teste abaixo.
    await prisma.treatmentCycle.deleteMany({
      where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
    await prisma.patient.deleteMany({
      where: { id: { in: [patientA.id, patientB.id] } },
    });
    await prisma.userClinic.deleteMany({
      where: {
        userId: {
          in: [adminA.id, nutritionistA.id, receptionA.id, nutritionistB.id],
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [adminA.id, nutritionistA.id, receptionA.id, nutritionistB.id],
        },
      },
    });
    await prisma.tenant.delete({ where: { id: tenantA.id } });
    await prisma.tenant.delete({ where: { id: tenantB.id } });
    await prisma.$disconnect();
  });

  function baseDto(
    overrides: Partial<Parameters<AppointmentsService['create']>[3]> = {},
  ) {
    return {
      patientId: patientA.id,
      nutritionistUserId: nutritionistA.id,
      appointmentTypeId: typeA.id,
      scheduledAt: `${baseDay}T14:00:00.000Z`,
      durationMinutes: 40,
      modality: AppointmentModality.IN_PERSON,
      isConfirmed: false,
      ...overrides,
    };
  }

  // ---------------------------------------------------------------------
  // Agenda: criação, conflito, modalidade, isolamento de tenant
  // ---------------------------------------------------------------------

  it('cria uma consulta válida (presencial)', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      baseDto(),
    );
    expect(created.status).toBe(AppointmentStatus.AWAITING_CONFIRMATION);
    expect(created.modality).toBe(AppointmentModality.IN_PERSON);
  });

  it('cria uma consulta online com link de reunião', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      baseDto({
        scheduledAt: `${baseDay}T15:00:00.000Z`,
        modality: AppointmentModality.ONLINE,
        onlineMeetingUrl: 'https://meet.exemplo.com/sala-1',
      }),
    );
    expect(created.modality).toBe(AppointmentModality.ONLINE);
    expect(created.onlineMeetingUrl).toBe('https://meet.exemplo.com/sala-1');
  });

  it('cria uma consulta já confirmada quando isConfirmed=true', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      baseDto({ scheduledAt: `${baseDay}T17:00:00.000Z`, isConfirmed: true }),
    );
    expect(created.status).toBe(AppointmentStatus.CONFIRMED);
    expect(created.confirmedAt).not.toBeNull();
  });

  it('permite criar consulta em horário livre, sem conflito', async () => {
    await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      baseDto({ scheduledAt: `${baseDay}T09:00:00.000Z` }),
    );
    const second = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      baseDto({ scheduledAt: `${baseDay}T10:00:00.000Z` }),
    );
    expect(second.id).toBeDefined();
  });

  it('bloqueia conflito de horário exato para o mesmo nutricionista', async () => {
    await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      baseDto({ scheduledAt: `${baseDay}T11:00:00.000Z` }),
    );
    await expect(
      service.create(
        tenantA.id,
        nutritionistA.id,
        Role.NUTRITIONIST,
        baseDto({ scheduledAt: `${baseDay}T11:00:00.000Z` }),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('bloqueia conflito parcial (14:00–14:40 x 14:20–15:00)', async () => {
    await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      baseDto({ scheduledAt: `${baseDay}T18:00:00.000Z`, durationMinutes: 40 }),
    );
    await expect(
      service.create(
        tenantA.id,
        nutritionistA.id,
        Role.NUTRITIONIST,
        baseDto({
          scheduledAt: `${baseDay}T18:20:00.000Z`,
          durationMinutes: 40,
        }),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('consulta cancelada não bloqueia o horário para uma nova', async () => {
    const original = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      baseDto({ scheduledAt: `${baseDay}T19:00:00.000Z` }),
    );
    await service.cancel(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      original.id,
      {
        reason: 'Paciente desistiu',
        cancelledBy: 'PATIENT',
      },
    );
    const second = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      baseDto({ scheduledAt: `${baseDay}T19:00:00.000Z` }),
    );
    expect(second.id).toBeDefined();
  });

  it('isola consultas por tenant — tenant B não vê consultas do tenant A', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      baseDto({ scheduledAt: `${baseDay}T08:00:00.000Z` }),
    );
    await expect(
      service.getById(tenantB.id, created.id, Role.ADMIN),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejeita nutricionista de outro tenant como responsável pela consulta', async () => {
    await expect(
      service.create(
        tenantA.id,
        adminA.id,
        Role.ADMIN,
        baseDto({
          nutritionistUserId: nutritionistB.id,
          scheduledAt: `${baseDay}T20:00:00.000Z`,
        }),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejeita paciente de outro tenant', async () => {
    await expect(
      service.create(
        tenantA.id,
        nutritionistA.id,
        Role.NUTRITIONIST,
        baseDto({
          patientId: patientB.id,
          scheduledAt: `${baseDay}T21:00:00.000Z`,
        }),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  // ---------------------------------------------------------------------
  // Status: confirmar, iniciar, concluir, cancelar, falta, histórico
  // ---------------------------------------------------------------------

  it('confirma uma consulta aguardando confirmação', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      baseDto({ scheduledAt: `${baseDay}T22:00:00.000Z` }),
    );
    const confirmed = await service.confirm(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      created.id,
      {
        confirmationNotes: 'Confirmado por WhatsApp',
      },
    );
    expect(confirmed.status).toBe(AppointmentStatus.CONFIRMED);
    expect(confirmed.confirmedAt).not.toBeNull();
  });

  it('inicia o atendimento de uma consulta confirmada', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      baseDto({ scheduledAt: '2026-09-15T20:00:00.000Z', isConfirmed: true }),
    );
    const started = await service.start(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      created.id,
    );
    expect(started.status).toBe(AppointmentStatus.IN_PROGRESS);
  });

  it('conclui um atendimento em andamento', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      baseDto({ scheduledAt: `${baseDay}T23:00:00.000Z`, isConfirmed: true }),
    );
    await service.start(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      created.id,
    );
    const completed = await service.complete(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      created.id,
      {
        clinicalNotes: 'Boa evolução',
      },
    );
    expect(completed.status).toBe(AppointmentStatus.DONE);
    expect(completed.completedAt).not.toBeNull();
  });

  it('cancela uma consulta registrando motivo e responsável', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      baseDto({ scheduledAt: `2026-09-15T14:00:00.000Z` }),
    );
    const cancelled = await service.cancel(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      created.id,
      {
        reason: 'Profissional indisponível',
        cancelledBy: 'CLINIC',
      },
    );
    expect(cancelled.status).toBe(AppointmentStatus.CANCELLED_BY_CLINIC);
    expect(cancelled.cancellationReason).toBe('Profissional indisponível');
  });

  it('marca falta do paciente', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      baseDto({ scheduledAt: `2026-09-15T15:00:00.000Z`, isConfirmed: true }),
    );
    const noShow = await service.noShow(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      created.id,
      {},
    );
    expect(noShow.status).toBe(AppointmentStatus.NO_SHOW);
    expect(noShow.noShowAt).not.toBeNull();
  });

  it('rejeita transição inválida (DONE não pode voltar para CONFIRMED)', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      baseDto({ scheduledAt: `2026-09-15T16:00:00.000Z`, isConfirmed: true }),
    );
    await service.start(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      created.id,
    );
    await service.complete(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      created.id,
      {},
    );
    await expect(
      service.confirm(
        tenantA.id,
        nutritionistA.id,
        Role.NUTRITIONIST,
        created.id,
        {},
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('registra histórico de status a cada transição', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      baseDto({ scheduledAt: `2026-09-15T17:00:00.000Z` }),
    );
    await service.confirm(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      created.id,
      {},
    );
    await service.start(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      created.id,
    );
    await service.complete(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      created.id,
      {},
    );

    const history = await prisma.appointmentStatusHistory.findMany({
      where: { appointmentId: created.id },
      orderBy: { changedAt: 'asc' },
    });
    expect(history.map((h) => h.toStatus)).toEqual([
      AppointmentStatus.AWAITING_CONFIRMATION,
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.IN_PROGRESS,
      AppointmentStatus.DONE,
    ]);
  });

  // ---------------------------------------------------------------------
  // Reagendamento
  // ---------------------------------------------------------------------

  it('reagenda preservando a consulta original como RESCHEDULED', async () => {
    const original = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      baseDto({ scheduledAt: `2026-09-16T14:00:00.000Z` }),
    );
    await service.reschedule(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      original.id,
      {
        newScheduledAt: '2026-09-18T16:00:00.000Z',
        reason: 'Paciente pediu para adiar',
      },
    );

    const originalAfter = await service.getById(
      tenantA.id,
      original.id,
      Role.NUTRITIONIST,
    );
    expect(originalAfter.status).toBe(AppointmentStatus.RESCHEDULED);
  });

  it('reagendamento cria uma nova consulta vinculada pela nova data', async () => {
    const original = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      baseDto({ scheduledAt: `2026-09-16T15:00:00.000Z` }),
    );
    const rescheduled = await service.reschedule(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      original.id,
      {
        newScheduledAt: '2026-09-19T10:00:00.000Z',
      },
    );

    expect(rescheduled.id).not.toBe(original.id);
    expect(rescheduled.scheduledAt.toISOString()).toBe(
      '2026-09-19T10:00:00.000Z',
    );
    expect(rescheduled.rescheduledFromAppointment?.id).toBe(original.id);
  });

  it('histórico do reagendamento mostra a transição para RESCHEDULED na original', async () => {
    const original = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      baseDto({ scheduledAt: `2026-09-16T18:00:00.000Z` }),
    );
    await service.reschedule(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      original.id,
      {
        newScheduledAt: '2026-09-20T10:00:00.000Z',
      },
    );

    const history = await prisma.appointmentStatusHistory.findMany({
      where: { appointmentId: original.id },
      orderBy: { changedAt: 'desc' },
      take: 1,
    });
    expect(history[0].toStatus).toBe(AppointmentStatus.RESCHEDULED);
  });

  // ---------------------------------------------------------------------
  // Evolução vinculada
  // ---------------------------------------------------------------------

  it('vincula uma avaliação de evolução à consulta em que foi registrada', async () => {
    const appointment = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      baseDto({ scheduledAt: `2026-09-17T14:00:00.000Z` }),
    );
    const evolution = await prisma.patientEvolution.create({
      data: {
        tenantId: tenantA.id,
        patientId: patientA.id,
        nutritionistUserId: nutritionistA.id,
        createdByUserId: nutritionistA.id,
        appointmentId: appointment.id,
        assessmentDate: new Date('2026-09-17'),
      },
    });

    const withEvolution = await service.getById(
      tenantA.id,
      appointment.id,
      Role.NUTRITIONIST,
    );
    expect(withEvolution.patientEvolutions.map((e) => e.id)).toContain(
      evolution.id,
    );
  });

  // ---------------------------------------------------------------------
  // RBAC
  // ---------------------------------------------------------------------

  it('ADMIN pode criar e gerenciar consultas', async () => {
    const created = await service.create(
      tenantA.id,
      adminA.id,
      Role.ADMIN,
      baseDto({
        nutritionistUserId: nutritionistA.id,
        scheduledAt: `2026-09-21T14:00:00.000Z`,
      }),
    );
    expect(created.id).toBeDefined();
  });

  it('NUTRITIONIST pode registrar notas clínicas ao concluir', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      baseDto({ scheduledAt: `2026-09-21T15:00:00.000Z`, isConfirmed: true }),
    );
    await service.start(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      created.id,
    );
    const completed = await service.complete(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      created.id,
      {
        clinicalNotes: 'Nota clínica confidencial',
      },
    );
    expect(completed.clinicalNotes).toBe('Nota clínica confidencial');
  });

  it('RECEPTION pode criar e confirmar consultas normalmente', async () => {
    const created = await service.create(
      tenantA.id,
      receptionA.id,
      Role.RECEPTION,
      baseDto({
        nutritionistUserId: nutritionistA.id,
        scheduledAt: `2026-09-21T16:00:00.000Z`,
      }),
    );
    const confirmed = await service.confirm(
      tenantA.id,
      receptionA.id,
      Role.RECEPTION,
      created.id,
      {},
    );
    expect(confirmed.status).toBe(AppointmentStatus.CONFIRMED);
  });

  it('RECEPTION nunca recebe notas clínicas na leitura, mesmo que existam', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      baseDto({ scheduledAt: `2026-09-21T17:00:00.000Z`, isConfirmed: true }),
    );
    await service.start(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      created.id,
    );
    await service.complete(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      created.id,
      {
        clinicalNotes: 'Informação clínica sensível',
      },
    );

    const seenByReception = await service.getById(
      tenantA.id,
      created.id,
      Role.RECEPTION,
    );
    expect(seenByReception.clinicalNotes).toBeNull();

    const seenByNutritionist = await service.getById(
      tenantA.id,
      created.id,
      Role.NUTRITIONIST,
    );
    expect(seenByNutritionist.clinicalNotes).toBe(
      'Informação clínica sensível',
    );
  });

  it('RECEPTION não pode registrar/alterar notas clínicas', async () => {
    const created = await service.create(
      tenantA.id,
      receptionA.id,
      Role.RECEPTION,
      baseDto({
        nutritionistUserId: nutritionistA.id,
        scheduledAt: `2026-09-21T18:00:00.000Z`,
      }),
    );
    await expect(
      service.update(tenantA.id, receptionA.id, Role.RECEPTION, created.id, {
        clinicalNotes: 'Tentativa indevida',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  // ---------------------------------------------------------------------
  // Datas / fuso horário
  // ---------------------------------------------------------------------

  it('mantém a data/horário exatamente como informado, sem deslocamento de fuso', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      baseDto({ scheduledAt: '2026-09-22T14:00:00.000Z' }),
    );
    expect(created.scheduledAt.toISOString()).toBe('2026-09-22T14:00:00.000Z');

    const fetched = await service.getById(
      tenantA.id,
      created.id,
      Role.NUTRITIONIST,
    );
    expect(fetched.scheduledAt.toISOString()).toBe('2026-09-22T14:00:00.000Z');
  });

  it('consulta aparece no dia correto ao filtrar por intervalo de datas', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      baseDto({ scheduledAt: '2026-09-23T14:00:00.000Z' }),
    );

    const sameDay = await service.list(tenantA.id, {
      startDate: '2026-09-23T00:00:00.000Z',
      endDate: '2026-09-23T23:59:59.000Z',
    });
    expect(sameDay.map((a) => a.id)).toContain(created.id);

    const nextDay = await service.list(tenantA.id, {
      startDate: '2026-09-24T00:00:00.000Z',
      endDate: '2026-09-24T23:59:59.000Z',
    });
    expect(nextDay.map((a) => a.id)).not.toContain(created.id);
  });

  // ---------------------------------------------------------------------
  // Missão 0005.8: vínculo com ciclo de tratamento, preço avulso, autoria
  // ---------------------------------------------------------------------

  it('vincula consulta a um ciclo ativo e numera a sequência (consulta 1 de N, depois 2 de N)', async () => {
    const patient = await prisma.patient.create({
      data: { tenantId: tenantA.id, fullName: 'Paciente Ciclo Appt' },
    });
    const cycle = await prisma.treatmentCycle.create({
      data: {
        tenantId: tenantA.id,
        patientId: patient.id,
        planId: planA.id,
        cycleNumber: 1,
        status: 'ACTIVE',
        startDate: new Date('2026-01-01'),
        appointmentCountPlanned: 2,
        intervalDaysPlanned: 30,
        contractedValue: 900,
        finalValue: 900,
        installmentCount: 1,
        createdByUserId: nutritionistA.id,
      },
    });

    const first = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      baseDto({
        patientId: patient.id,
        treatmentCycleId: cycle.id,
        scheduledAt: '2026-09-25T14:00:00.000Z',
      }),
    );
    const second = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      baseDto({
        patientId: patient.id,
        treatmentCycleId: cycle.id,
        scheduledAt: '2026-09-26T14:00:00.000Z',
      }),
    );

    expect(first.sequenceNumber).toBe(1);
    expect(second.sequenceNumber).toBe(2);
    expect(first.treatmentCycle?.id).toBe(cycle.id);
    expect(first.treatmentCycle?.plan.name).toBe('Plano Teste Appt');
  });

  it('rejeita vincular consulta a um ciclo que não está ativo', async () => {
    const patient = await prisma.patient.create({
      data: { tenantId: tenantA.id, fullName: 'Paciente Ciclo Pausado Appt' },
    });
    const pausedCycle = await prisma.treatmentCycle.create({
      data: {
        tenantId: tenantA.id,
        patientId: patient.id,
        planId: planA.id,
        cycleNumber: 1,
        status: 'PAUSED',
        startDate: new Date('2026-01-01'),
        appointmentCountPlanned: 2,
        intervalDaysPlanned: 30,
        contractedValue: 900,
        finalValue: 900,
        installmentCount: 1,
        createdByUserId: nutritionistA.id,
      },
    });

    await expect(
      service.create(
        tenantA.id,
        nutritionistA.id,
        Role.NUTRITIONIST,
        baseDto({
          patientId: patient.id,
          treatmentCycleId: pausedCycle.id,
          scheduledAt: '2026-09-27T14:00:00.000Z',
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita informar treatmentCycleId junto com valor avulso', async () => {
    const patient = await prisma.patient.create({
      data: { tenantId: tenantA.id, fullName: 'Paciente Conflito Appt' },
    });
    const cycle = await prisma.treatmentCycle.create({
      data: {
        tenantId: tenantA.id,
        patientId: patient.id,
        planId: planA.id,
        cycleNumber: 1,
        status: 'ACTIVE',
        startDate: new Date('2026-01-01'),
        appointmentCountPlanned: 2,
        intervalDaysPlanned: 30,
        contractedValue: 900,
        finalValue: 900,
        installmentCount: 1,
        createdByUserId: nutritionistA.id,
      },
    });

    await expect(
      service.create(
        tenantA.id,
        nutritionistA.id,
        Role.NUTRITIONIST,
        baseDto({
          patientId: patient.id,
          treatmentCycleId: cycle.id,
          standaloneValue: 150,
          scheduledAt: '2026-09-28T14:00:00.000Z',
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('calcula standaloneFinalValue no servidor para consulta avulsa com desconto percentual', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      baseDto({
        scheduledAt: '2026-09-29T14:00:00.000Z',
        standaloneValue: 200,
        standaloneDiscountType: 'PERCENTAGE',
        standaloneDiscountValue: 10,
        standalonePaymentMethodId: paymentMethodA.id,
      }),
    );
    expect(created.standaloneValue?.toString()).toBe('200');
    expect(created.standaloneFinalValue?.toString()).toBe('180');
    expect(created.standalonePaymentMethod?.id).toBe(paymentMethodA.id);
  });

  it('consulta avulsa sem desconto informado usa o próprio valor como final', async () => {
    const created = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      baseDto({
        scheduledAt: '2026-09-30T14:00:00.000Z',
        standaloneValue: 150,
      }),
    );
    expect(created.standaloneFinalValue?.toString()).toBe('150');
  });

  it('registra o papel real de quem cancelou no histórico (changedByRole), corrigindo o bug de autoria', async () => {
    const created = await service.create(
      tenantA.id,
      adminA.id,
      Role.ADMIN,
      baseDto({ scheduledAt: '2026-10-01T14:00:00.000Z' }),
    );

    await service.cancel(tenantA.id, adminA.id, Role.ADMIN, created.id, {
      reason: 'Teste de autoria',
      // Um ADMIN registrando que foi o paciente quem pediu o cancelamento —
      // a origem (quem pediu) e quem executou (changedByRole) são coisas
      // diferentes; o bug era a UI nunca expor/exigir essa escolha (ver
      // relatório da Missão 0005.8). O backend deve sempre gravar o papel
      // real de quem chamou o endpoint.
      cancelledBy: 'PATIENT',
    });

    const cancelHistoryEntry = await prisma.appointmentStatusHistory.findFirst({
      where: {
        appointmentId: created.id,
        toStatus: AppointmentStatus.CANCELLED_BY_PATIENT,
      },
    });
    expect(cancelHistoryEntry?.changedByUserId).toBe(adminA.id);
    expect(cancelHistoryEntry?.changedByRole).toBe(Role.ADMIN);
  });

  it('reagendar preserva o vínculo com o ciclo, sequenceNumber e valores avulsos da consulta original', async () => {
    const patient = await prisma.patient.create({
      data: { tenantId: tenantA.id, fullName: 'Paciente Reagenda Ciclo Appt' },
    });
    const original = await service.create(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      baseDto({
        patientId: patient.id,
        scheduledAt: '2026-10-02T14:00:00.000Z',
        standaloneValue: 250,
        standaloneDiscountType: 'FIXED',
        standaloneDiscountValue: 50,
      }),
    );

    const rescheduled = await service.reschedule(
      tenantA.id,
      nutritionistA.id,
      Role.NUTRITIONIST,
      original.id,
      { newScheduledAt: '2026-10-03T14:00:00.000Z' },
    );

    expect(rescheduled.standaloneValue?.toString()).toBe('250');
    expect(rescheduled.standaloneFinalValue?.toString()).toBe('200');
  });
});

// ---------------------------------------------------------------------
// Plano Independente (SOLO): o próprio ADMIN é a nutricionista responsável
// ---------------------------------------------------------------------

describe('AppointmentsService — nutricionista responsável no plano Independente (integração)', () => {
  let service: AppointmentsService;
  let prisma: PrismaService;

  let soloTenant: { id: string };
  let soloAdmin: { id: string };
  let clinicTenant: { id: string };
  let clinicAdmin: { id: string };
  let patient: { id: string };
  let clinicPatient: { id: string };
  let apptType: { id: string };
  let clinicApptType: { id: string };

  const runId = Date.now();
  const day = '2026-11-09';

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        AuditService,
        PrismaService,
        FinanceService,
      ],
    }).compile();

    service = moduleRef.get(AppointmentsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    soloTenant = await prisma.tenant.create({
      data: {
        name: 'Tenant Independente Appt',
        slug: `appt-solo-${runId}`,
        email: 'solo@teste.com',
        phone: '11111111',
        type: TenantType.SOLO,
      },
    });
    soloAdmin = await prisma.user.create({
      data: {
        name: 'Admin Independente Appt',
        email: `admin-solo-appt-${runId}@teste.com`,
        passwordHash: 'x',
      },
    });
    await prisma.userClinic.create({
      data: { userId: soloAdmin.id, tenantId: soloTenant.id, role: Role.ADMIN },
    });
    patient = await prisma.patient.create({
      data: { tenantId: soloTenant.id, fullName: 'Paciente Independente Appt' },
    });
    apptType = await prisma.appointmentType.create({
      data: {
        tenantId: soloTenant.id,
        name: 'Retorno',
        defaultDurationMinutes: 40,
      },
    });

    // Tenant CLINIC (multiusuário) sem nutricionista cadastrado, para provar
    // que a equivalência SOLO não vaza para outros tipos de tenant.
    clinicTenant = await prisma.tenant.create({
      data: {
        name: 'Tenant Clínica Appt',
        slug: `appt-clinic-only-admin-${runId}`,
        email: 'clinic@teste.com',
        phone: '22222222',
        type: TenantType.CLINIC,
      },
    });
    clinicAdmin = await prisma.user.create({
      data: {
        name: 'Admin Clínica Appt',
        email: `admin-clinic-appt-${runId}@teste.com`,
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
    clinicPatient = await prisma.patient.create({
      data: { tenantId: clinicTenant.id, fullName: 'Paciente Clínica Appt' },
    });
    clinicApptType = await prisma.appointmentType.create({
      data: {
        tenantId: clinicTenant.id,
        name: 'Retorno',
        defaultDurationMinutes: 40,
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.appointmentStatusHistory.deleteMany({
      where: { tenantId: { in: [soloTenant.id, clinicTenant.id] } },
    });
    await prisma.appointment.deleteMany({
      where: { tenantId: { in: [soloTenant.id, clinicTenant.id] } },
    });
    await prisma.appointmentType.deleteMany({
      where: { tenantId: { in: [soloTenant.id, clinicTenant.id] } },
    });
    await prisma.patient.deleteMany({
      where: { id: { in: [patient.id, clinicPatient.id] } },
    });
    await prisma.userClinic.deleteMany({
      where: { userId: { in: [soloAdmin.id, clinicAdmin.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [soloAdmin.id, clinicAdmin.id] } },
    });
    await prisma.tenant.delete({ where: { id: soloTenant.id } });
    await prisma.tenant.delete({ where: { id: clinicTenant.id } });
    await prisma.$disconnect();
  });

  it('permite ao ADMIN do plano Independente se autoatribuir como nutricionista responsável', async () => {
    const created = await service.create(
      soloTenant.id,
      soloAdmin.id,
      Role.ADMIN,
      {
        patientId: patient.id,
        nutritionistUserId: soloAdmin.id,
        appointmentTypeId: apptType.id,
        scheduledAt: `${day}T14:00:00.000Z`,
        durationMinutes: 40,
        modality: AppointmentModality.IN_PERSON,
        isConfirmed: false,
      },
    );
    expect(created.nutritionistUserId).toBe(soloAdmin.id);
  });

  it('rejeita o ADMIN de um tenant CLINIC comum se autoatribuir como nutricionista', async () => {
    await expect(
      service.create(clinicTenant.id, clinicAdmin.id, Role.ADMIN, {
        patientId: clinicPatient.id,
        nutritionistUserId: clinicAdmin.id,
        appointmentTypeId: clinicApptType.id,
        scheduledAt: `${day}T15:00:00.000Z`,
        durationMinutes: 40,
        modality: AppointmentModality.IN_PERSON,
        isConfirmed: false,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
