import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  computeDiscountAmount,
  computeFinalValue,
} from '../../common/utils/money.util';
import {
  AppointmentStatus,
  AuditAction,
  CycleStatus,
  Prisma,
  Role,
} from '../../generated/prisma/client';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { CompleteAppointmentDto } from './dto/complete-appointment.dto';
import { ConfirmAppointmentDto } from './dto/confirm-appointment.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { NoShowAppointmentDto } from './dto/no-show-appointment.dto';
import { QueryAppointmentsDto } from './dto/query-appointments.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

const APPOINTMENT_INCLUDE = {
  patient: {
    select: {
      id: true,
      fullName: true,
      primaryPhone: true,
      whatsappPhone: true,
      birthDate: true,
      status: true,
    },
  },
  nutritionistUser: { select: { id: true, name: true } },
  appointmentType: { select: { id: true, name: true, color: true } },
  treatmentCycle: {
    select: {
      id: true,
      cycleNumber: true,
      appointmentCountPlanned: true,
      plan: { select: { id: true, name: true } },
    },
  },
  standalonePaymentMethod: { select: { id: true, name: true } },
  createdByUser: { select: { id: true, name: true } },
  rescheduledFromAppointment: { select: { id: true, scheduledAt: true } },
  rescheduledIntoAppointment: { select: { id: true, scheduledAt: true } },
  statusHistory: {
    orderBy: { changedAt: 'asc' as const },
    include: { changedByUser: { select: { id: true, name: true } } },
  },
  patientEvolutions: {
    where: { deletedAt: null },
    select: { id: true, assessmentDate: true, title: true },
  },
} satisfies Prisma.AppointmentInclude;

/**
 * Consultas que ocupam a agenda para fins de conflito de horário — canceladas
 * e reagendadas liberam o horário; as demais (inclusive NO_SHOW e DONE)
 * continuam contando como ocupação real daquele intervalo.
 */
const STATUSES_EXCLUDED_FROM_CONFLICT: AppointmentStatus[] = [
  AppointmentStatus.CANCELLED_BY_CLINIC,
  AppointmentStatus.CANCELLED_BY_PATIENT,
  AppointmentStatus.RESCHEDULED,
];

const ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  [AppointmentStatus.SCHEDULED]: [
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.IN_PROGRESS,
    AppointmentStatus.CANCELLED_BY_CLINIC,
    AppointmentStatus.CANCELLED_BY_PATIENT,
    AppointmentStatus.RESCHEDULED,
    AppointmentStatus.NO_SHOW,
  ],
  [AppointmentStatus.AWAITING_CONFIRMATION]: [
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.IN_PROGRESS,
    AppointmentStatus.CANCELLED_BY_CLINIC,
    AppointmentStatus.CANCELLED_BY_PATIENT,
    AppointmentStatus.RESCHEDULED,
    AppointmentStatus.NO_SHOW,
  ],
  [AppointmentStatus.CONFIRMED]: [
    AppointmentStatus.IN_PROGRESS,
    AppointmentStatus.CANCELLED_BY_CLINIC,
    AppointmentStatus.CANCELLED_BY_PATIENT,
    AppointmentStatus.RESCHEDULED,
    AppointmentStatus.NO_SHOW,
  ],
  [AppointmentStatus.IN_PROGRESS]: [AppointmentStatus.DONE],
  [AppointmentStatus.DONE]: [],
  [AppointmentStatus.CANCELLED_BY_CLINIC]: [],
  [AppointmentStatus.CANCELLED_BY_PATIENT]: [],
  [AppointmentStatus.NO_SHOW]: [],
  [AppointmentStatus.RESCHEDULED]: [],
};

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  [AppointmentStatus.SCHEDULED]: 'Agendada',
  [AppointmentStatus.AWAITING_CONFIRMATION]: 'Aguardando confirmação',
  [AppointmentStatus.CONFIRMED]: 'Confirmada',
  [AppointmentStatus.IN_PROGRESS]: 'Em atendimento',
  [AppointmentStatus.DONE]: 'Realizada',
  // Rótulo neutro de propósito — quem exatamente cancelou (admin/recepção/
  // nutricionista) vem de AppointmentStatusHistory.changedByRole, nunca
  // presumido pelo status em si (bug da Missão 0005.8, seção 7).
  [AppointmentStatus.CANCELLED_BY_CLINIC]: 'Cancelada pela clínica',
  [AppointmentStatus.CANCELLED_BY_PATIENT]: 'Cancelada pelo paciente',
  [AppointmentStatus.NO_SHOW]: 'Não compareceu',
  [AppointmentStatus.RESCHEDULED]: 'Reagendada',
};

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, query: QueryAppointmentsDto) {
    const where: Prisma.AppointmentWhereInput = {
      tenantId,
      deletedAt: null,
      ...(query.nutritionistId
        ? { nutritionistUserId: query.nutritionistId }
        : {}),
      ...(query.patientId ? { patientId: query.patientId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.startDate || query.endDate
        ? {
            scheduledAt: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    return this.prisma.appointment.findMany({
      where,
      include: APPOINTMENT_INCLUDE,
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async listForPatient(tenantId: string, patientId: string) {
    await this.assertPatientInTenant(tenantId, patientId);
    return this.prisma.appointment.findMany({
      where: { tenantId, patientId, deletedAt: null },
      include: APPOINTMENT_INCLUDE,
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async getById(tenantId: string, id: string, actorRole: Role) {
    const appointment = await this.findOrThrow(tenantId, id);
    return this.sanitizeForRole(appointment, actorRole);
  }

  async create(
    tenantId: string,
    actorUserId: string,
    actorRole: Role,
    dto: CreateAppointmentDto,
  ) {
    await this.assertPatientInTenant(tenantId, dto.patientId);
    await this.assertAppointmentTypeInTenant(tenantId, dto.appointmentTypeId);
    const nutritionistUserId = await this.resolveNutritionistUserId(
      tenantId,
      actorUserId,
      actorRole,
      dto.nutritionistUserId,
    );

    const start = new Date(dto.scheduledAt);
    const end = this.addMinutes(start, dto.durationMinutes);
    await this.assertNoConflict(tenantId, nutritionistUserId, start, end);

    const { sequenceNumber, standaloneFinalValue } =
      await this.resolvePricingFields(tenantId, dto);

    const initialStatus = dto.isConfirmed
      ? AppointmentStatus.CONFIRMED
      : AppointmentStatus.AWAITING_CONFIRMATION;

    const created = await this.prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.create({
        data: {
          tenantId,
          treatmentCycleId: dto.treatmentCycleId,
          sequenceNumber,
          patientId: dto.patientId,
          nutritionistUserId,
          appointmentTypeId: dto.appointmentTypeId,
          scheduledAt: start,
          durationMinutes: dto.durationMinutes,
          modality: dto.modality,
          location: dto.location,
          onlineMeetingUrl: dto.onlineMeetingUrl,
          adminNotes: dto.adminNotes,
          status: initialStatus,
          confirmedAt: dto.isConfirmed ? new Date() : null,
          createdByUserId: actorUserId,
          standaloneValue: dto.standaloneValue,
          standaloneDiscountType: dto.standaloneDiscountType,
          standaloneDiscountValue: dto.standaloneDiscountValue,
          standaloneFinalValue,
          standalonePaymentMethodId: dto.standalonePaymentMethodId,
        },
        include: APPOINTMENT_INCLUDE,
      });
      await tx.appointmentStatusHistory.create({
        data: {
          tenantId,
          appointmentId: appointment.id,
          fromStatus: null,
          toStatus: initialStatus,
          changedByUserId: actorUserId,
          changedByRole: actorRole,
          reason: 'Consulta criada',
        },
      });
      return appointment;
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'Appointment',
      entityId: created.id,
      action: AuditAction.CREATE,
      after: this.toAuditSafeJson(created),
    });

    return this.sanitizeForRole(
      await this.findOrThrow(tenantId, created.id),
      actorRole,
    );
  }

  async update(
    tenantId: string,
    actorUserId: string,
    actorRole: Role,
    id: string,
    dto: UpdateAppointmentDto,
  ) {
    this.assertClinicalNotesAllowed(actorRole, dto.clinicalNotes);
    const before = await this.findOrThrow(tenantId, id);

    if (dto.appointmentTypeId) {
      await this.assertAppointmentTypeInTenant(tenantId, dto.appointmentTypeId);
    }

    const nutritionistUserId =
      dto.nutritionistUserId ?? before.nutritionistUserId;
    if (dto.nutritionistUserId) {
      await this.resolveNutritionistUserId(
        tenantId,
        actorUserId,
        Role.ADMIN,
        dto.nutritionistUserId,
      );
    }

    const start = dto.scheduledAt
      ? new Date(dto.scheduledAt)
      : before.scheduledAt;
    const duration = dto.durationMinutes ?? before.durationMinutes;
    if (dto.scheduledAt || dto.durationMinutes || dto.nutritionistUserId) {
      const end = this.addMinutes(start, duration);
      await this.assertNoConflict(tenantId, nutritionistUserId, start, end, id);
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        appointmentTypeId: dto.appointmentTypeId,
        nutritionistUserId: dto.nutritionistUserId,
        scheduledAt: dto.scheduledAt ? start : undefined,
        durationMinutes: dto.durationMinutes,
        modality: dto.modality,
        location: dto.location,
        onlineMeetingUrl: dto.onlineMeetingUrl,
        adminNotes: dto.adminNotes,
        clinicalNotes: dto.clinicalNotes,
        updatedByUserId: actorUserId,
      },
      include: APPOINTMENT_INCLUDE,
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'Appointment',
      entityId: id,
      action: AuditAction.UPDATE,
      before: this.toAuditSafeJson(before),
      after: this.toAuditSafeJson(updated),
    });

    return this.sanitizeForRole(updated, actorRole);
  }

  async confirm(
    tenantId: string,
    actorUserId: string,
    actorRole: Role,
    id: string,
    dto: ConfirmAppointmentDto,
  ) {
    const before = await this.findOrThrow(tenantId, id);
    this.assertTransition(before.status, AppointmentStatus.CONFIRMED);

    const updated = await this.transitionStatus(
      tenantId,
      actorUserId,
      actorRole,
      id,
      before.status,
      AppointmentStatus.CONFIRMED,
      dto.confirmationNotes,
      { confirmedAt: new Date(), confirmationNotes: dto.confirmationNotes },
    );

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'Appointment',
      entityId: id,
      action: AuditAction.STATUS_CHANGE,
      before: { status: before.status },
      after: { status: updated.status },
      metadata: { action: 'confirm' },
    });

    return this.sanitizeForRole(updated, actorRole);
  }

  async start(
    tenantId: string,
    actorUserId: string,
    actorRole: Role,
    id: string,
  ) {
    const before = await this.findOrThrow(tenantId, id);
    this.assertTransition(before.status, AppointmentStatus.IN_PROGRESS);

    const updated = await this.transitionStatus(
      tenantId,
      actorUserId,
      actorRole,
      id,
      before.status,
      AppointmentStatus.IN_PROGRESS,
      'Atendimento iniciado',
    );

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'Appointment',
      entityId: id,
      action: AuditAction.STATUS_CHANGE,
      before: { status: before.status },
      after: { status: updated.status },
      metadata: { action: 'start' },
    });

    return this.sanitizeForRole(updated, actorRole);
  }

  async complete(
    tenantId: string,
    actorUserId: string,
    actorRole: Role,
    id: string,
    dto: CompleteAppointmentDto,
  ) {
    this.assertClinicalNotesAllowed(actorRole, dto.clinicalNotes);
    const before = await this.findOrThrow(tenantId, id);
    this.assertTransition(before.status, AppointmentStatus.DONE);

    const updated = await this.transitionStatus(
      tenantId,
      actorUserId,
      actorRole,
      id,
      before.status,
      AppointmentStatus.DONE,
      'Consulta realizada',
      {
        completedAt: new Date(),
        clinicalNotes: dto.clinicalNotes,
        patientVisibleNotes: dto.patientVisibleNotes,
      },
    );

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'Appointment',
      entityId: id,
      action: AuditAction.STATUS_CHANGE,
      before: { status: before.status },
      after: { status: updated.status },
      metadata: { action: 'complete' },
    });

    return this.sanitizeForRole(updated, actorRole);
  }

  async cancel(
    tenantId: string,
    actorUserId: string,
    actorRole: Role,
    id: string,
    dto: CancelAppointmentDto,
  ) {
    const before = await this.findOrThrow(tenantId, id);
    const toStatus =
      dto.cancelledBy === 'PATIENT'
        ? AppointmentStatus.CANCELLED_BY_PATIENT
        : AppointmentStatus.CANCELLED_BY_CLINIC;
    this.assertTransition(before.status, toStatus);

    const updated = await this.transitionStatus(
      tenantId,
      actorUserId,
      actorRole,
      id,
      before.status,
      toStatus,
      dto.reason,
      { cancelledAt: new Date(), cancellationReason: dto.reason },
    );

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'Appointment',
      entityId: id,
      action: AuditAction.CANCEL,
      before: { status: before.status },
      after: { status: updated.status, reason: dto.reason },
    });

    return this.sanitizeForRole(updated, actorRole);
  }

  async noShow(
    tenantId: string,
    actorUserId: string,
    actorRole: Role,
    id: string,
    dto: NoShowAppointmentDto,
  ) {
    const before = await this.findOrThrow(tenantId, id);
    this.assertTransition(before.status, AppointmentStatus.NO_SHOW);

    const updated = await this.transitionStatus(
      tenantId,
      actorUserId,
      actorRole,
      id,
      before.status,
      AppointmentStatus.NO_SHOW,
      dto.notes ?? 'Paciente não compareceu',
      { noShowAt: new Date() },
    );

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'Appointment',
      entityId: id,
      action: AuditAction.STATUS_CHANGE,
      before: { status: before.status },
      after: { status: updated.status },
      metadata: { action: 'no-show' },
    });

    return this.sanitizeForRole(updated, actorRole);
  }

  async reschedule(
    tenantId: string,
    actorUserId: string,
    actorRole: Role,
    id: string,
    dto: RescheduleAppointmentDto,
  ) {
    const original = await this.findOrThrow(tenantId, id);
    this.assertTransition(original.status, AppointmentStatus.RESCHEDULED);

    const newDuration = dto.newDurationMinutes ?? original.durationMinutes;
    const newStart = new Date(dto.newScheduledAt);
    const newEnd = this.addMinutes(newStart, newDuration);
    await this.assertNoConflict(
      tenantId,
      original.nutritionistUserId,
      newStart,
      newEnd,
    );

    const createdId = await this.prisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id },
        data: {
          status: AppointmentStatus.RESCHEDULED,
          updatedByUserId: actorUserId,
        },
      });
      await tx.appointmentStatusHistory.create({
        data: {
          tenantId,
          appointmentId: id,
          fromStatus: original.status,
          toStatus: AppointmentStatus.RESCHEDULED,
          changedByUserId: actorUserId,
          changedByRole: actorRole,
          reason: dto.reason ?? 'Reagendada',
        },
      });

      const created = await tx.appointment.create({
        data: {
          tenantId,
          treatmentCycleId: original.treatmentCycleId,
          sequenceNumber: original.sequenceNumber,
          patientId: original.patientId,
          nutritionistUserId: original.nutritionistUserId,
          appointmentTypeId: original.appointmentTypeId,
          scheduledAt: newStart,
          durationMinutes: newDuration,
          modality: original.modality,
          location: original.location,
          onlineMeetingUrl: original.onlineMeetingUrl,
          adminNotes: original.adminNotes,
          status: AppointmentStatus.SCHEDULED,
          rescheduledFromAppointmentId: id,
          createdByUserId: actorUserId,
          standaloneValue: original.standaloneValue,
          standaloneDiscountType: original.standaloneDiscountType,
          standaloneDiscountValue: original.standaloneDiscountValue,
          standaloneFinalValue: original.standaloneFinalValue,
          standalonePaymentMethodId: original.standalonePaymentMethodId,
        },
      });
      await tx.appointmentStatusHistory.create({
        data: {
          tenantId,
          appointmentId: created.id,
          fromStatus: null,
          toStatus: AppointmentStatus.SCHEDULED,
          changedByRole: actorRole,
          changedByUserId: actorUserId,
          reason: dto.reason ? `Reagendada: ${dto.reason}` : 'Reagendada',
        },
      });
      return created.id;
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'Appointment',
      entityId: id,
      action: AuditAction.RESCHEDULE,
      before: { status: original.status },
      after: { status: 'RESCHEDULED', newAppointmentId: createdId },
    });

    return this.sanitizeForRole(
      await this.findOrThrow(tenantId, createdId),
      actorRole,
    );
  }

  // --------------------------------------------------------------------

  private async transitionStatus(
    tenantId: string,
    actorUserId: string,
    actorRole: Role,
    id: string,
    fromStatus: AppointmentStatus,
    toStatus: AppointmentStatus,
    reason: string | undefined,
    extraData: Prisma.AppointmentUncheckedUpdateInput = {},
  ) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id },
        data: { status: toStatus, updatedByUserId: actorUserId, ...extraData },
        include: APPOINTMENT_INCLUDE,
      });
      await tx.appointmentStatusHistory.create({
        data: {
          tenantId,
          appointmentId: id,
          fromStatus,
          toStatus,
          changedByUserId: actorUserId,
          changedByRole: actorRole,
          reason,
        },
      });
      return updated;
    });
  }

  private assertTransition(from: AppointmentStatus, to: AppointmentStatus) {
    const allowed = ALLOWED_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(
        `Não é possível mudar de "${STATUS_LABELS[from]}" para "${STATUS_LABELS[to]}"`,
      );
    }
  }

  private assertClinicalNotesAllowed(
    actorRole: Role,
    clinicalNotes: string | undefined,
  ) {
    if (clinicalNotes !== undefined && actorRole === Role.RECEPTION) {
      throw new ForbiddenException(
        'Recepção não pode registrar ou alterar notas clínicas',
      );
    }
  }

  private sanitizeForRole<T extends { clinicalNotes: string | null }>(
    appointment: T,
    actorRole: Role,
  ): T {
    if (actorRole !== Role.RECEPTION) {
      return appointment;
    }
    return { ...appointment, clinicalNotes: null };
  }

  private async assertNoConflict(
    tenantId: string,
    nutritionistUserId: string,
    start: Date,
    end: Date,
    excludeAppointmentId?: string,
  ) {
    // scheduledAt + durationMinutes > start  <=>  overlap — Prisma não compara duas colunas
    // calculadas, então buscamos candidatos que começam antes do fim do novo horário
    // (`scheduledAt < end`) e filtramos o fim deles (`scheduledAt + duration > start`) em memória.
    const candidates = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        nutritionistUserId,
        deletedAt: null,
        id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
        status: { notIn: STATUSES_EXCLUDED_FROM_CONFLICT },
        scheduledAt: { lt: end },
      },
      select: {
        id: true,
        scheduledAt: true,
        durationMinutes: true,
        patient: { select: { fullName: true } },
      },
    });

    const overlapping = candidates.find(
      (c) => this.addMinutes(c.scheduledAt, c.durationMinutes) > start,
    );
    if (overlapping) {
      throw new BadRequestException(
        `Conflito de horário: já existe uma consulta com ${overlapping.patient.fullName} às ${overlapping.scheduledAt.toISOString()} para este nutricionista`,
      );
    }
  }

  private async findOrThrow(tenantId: string, id: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: APPOINTMENT_INCLUDE,
    });
    if (!appointment) {
      throw new NotFoundException('Consulta não encontrada');
    }
    return appointment;
  }

  private async assertPatientInTenant(tenantId: string, patientId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId },
    });
    if (!patient) {
      throw new NotFoundException('Paciente não encontrado');
    }
    return patient;
  }

  /**
   * treatmentCycleId e os campos standalone* são mutuamente exclusivos
   * (seção 5 da Missão 0005.8) — um ciclo já carrega seu próprio valor, uma
   * consulta avulsa pode opcionalmente registrar o dela. sequenceNumber e
   * standaloneFinalValue nunca vêm do cliente, sempre calculados aqui.
   */
  private async resolvePricingFields(
    tenantId: string,
    dto: CreateAppointmentDto,
  ): Promise<{
    sequenceNumber?: number;
    standaloneFinalValue?: Prisma.Decimal;
  }> {
    const hasStandaloneFields =
      dto.standaloneValue !== undefined ||
      dto.standaloneDiscountType !== undefined ||
      dto.standaloneDiscountValue !== undefined ||
      dto.standalonePaymentMethodId !== undefined;

    if (dto.treatmentCycleId && hasStandaloneFields) {
      throw new BadRequestException(
        'Consulta vinculada a um ciclo não deve informar valor/desconto avulso',
      );
    }

    if (dto.treatmentCycleId) {
      const cycle = await this.prisma.treatmentCycle.findFirst({
        where: {
          id: dto.treatmentCycleId,
          tenantId,
          patientId: dto.patientId,
          deletedAt: null,
        },
      });
      if (!cycle) {
        throw new NotFoundException(
          'Ciclo de tratamento não encontrado para este paciente',
        );
      }
      if (cycle.status !== CycleStatus.ACTIVE) {
        throw new BadRequestException(
          'Só é possível vincular consultas a um ciclo ativo',
        );
      }
      const existingCount = await this.prisma.appointment.count({
        where: { treatmentCycleId: dto.treatmentCycleId, deletedAt: null },
      });
      return { sequenceNumber: existingCount + 1 };
    }

    if (dto.standalonePaymentMethodId) {
      const method = await this.prisma.paymentMethod.findFirst({
        where: { id: dto.standalonePaymentMethodId, tenantId },
      });
      if (!method) {
        throw new NotFoundException('Forma de pagamento não encontrada');
      }
    }

    if (dto.standaloneValue === undefined) {
      return {};
    }

    const discountType = dto.standaloneDiscountType ?? 'FIXED';
    const discountValue = dto.standaloneDiscountValue ?? 0;
    if (discountType === 'PERCENTAGE' && discountValue > 100) {
      throw new BadRequestException(
        'Desconto percentual não pode passar de 100%',
      );
    }
    const discount = computeDiscountAmount(
      dto.standaloneValue,
      discountType,
      discountValue,
    );
    return {
      standaloneFinalValue: computeFinalValue(dto.standaloneValue, discount, 0),
    };
  }

  private async assertAppointmentTypeInTenant(
    tenantId: string,
    appointmentTypeId: string,
  ) {
    const type = await this.prisma.appointmentType.findFirst({
      where: { id: appointmentTypeId, tenantId },
    });
    if (!type) {
      throw new NotFoundException('Tipo de consulta não encontrado');
    }
    return type;
  }

  /** Sem nutritionistUserId explícito, só o próprio nutricionista pode se auto-atribuir. */
  private async resolveNutritionistUserId(
    tenantId: string,
    actorUserId: string,
    actorRole: Role,
    requestedNutritionistUserId?: string,
  ): Promise<string> {
    const candidateId =
      requestedNutritionistUserId ??
      (actorRole === Role.NUTRITIONIST ? actorUserId : undefined);
    if (!candidateId) {
      throw new BadRequestException(
        'Informe o nutricionista responsável pela consulta',
      );
    }

    const membership = await this.prisma.userClinic.findUnique({
      where: { userId_tenantId: { userId: candidateId, tenantId } },
    });
    if (
      !membership ||
      !membership.isActive ||
      membership.role !== Role.NUTRITIONIST
    ) {
      throw new BadRequestException(
        'Nutricionista informado é inválido para esta clínica',
      );
    }

    return candidateId;
  }

  private addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60000);
  }

  /** Nunca inclui o texto de notas clínicas/administrativas/visíveis ao paciente no AuditLog. */
  private toAuditSafeJson(
    appointment: Record<string, unknown>,
  ): Prisma.InputJsonValue {
    const notesFields = [
      'clinicalNotes',
      'adminNotes',
      'patientVisibleNotes',
      'confirmationNotes',
    ];
    const safe = Object.fromEntries(
      Object.entries(appointment).filter(([key]) => !notesFields.includes(key)),
    );
    return JSON.parse(JSON.stringify(safe)) as Prisma.InputJsonValue;
  }
}
