import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  AuditAction,
  MealPlanOrganizationType,
  MealPlanStatus,
  Prisma,
  Role,
} from '../../generated/prisma/client';
import { CreateMealPlanDto } from './dto/create-meal-plan.dto';
import { MealDto } from './dto/meal.dto';
import { MealPlanDayDto } from './dto/meal-plan-day.dto';
import { ShareMealPlanDto } from './dto/share-meal-plan.dto';
import { UpdateMealPlanDto } from './dto/update-meal-plan.dto';

const MEAL_PLAN_INCLUDE = {
  days: {
    orderBy: { displayOrder: 'asc' },
    include: {
      meals: {
        orderBy: { displayOrder: 'asc' },
        include: {
          items: {
            orderBy: { displayOrder: 'asc' },
            include: {
              substitutions: { orderBy: { displayOrder: 'asc' } },
            },
          },
        },
      },
    },
  },
  nutritionistUser: { select: { id: true, name: true } },
  createdByUser: { select: { id: true, name: true } },
  updatedByUser: { select: { id: true, name: true } },
  sharedByUser: { select: { id: true, name: true } },
  appointment: {
    select: {
      id: true,
      scheduledAt: true,
      appointmentType: { select: { name: true } },
    },
  },
  treatmentCycle: { select: { id: true, cycleNumber: true } },
} satisfies Prisma.MealPlanInclude;

type MealPlanWithRelations = Prisma.MealPlanGetPayload<{
  include: typeof MEAL_PLAN_INCLUDE;
}>;

@Injectable()
export class MealPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, patientId: string) {
    await this.assertPatientInTenant(tenantId, patientId);

    return this.prisma.mealPlan.findMany({
      where: { tenantId, patientId, deletedAt: null },
      include: MEAL_PLAN_INCLUDE,
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async getById(tenantId: string, id: string) {
    return this.findOrThrow(tenantId, id);
  }

  async create(
    tenantId: string,
    actorUserId: string,
    actorRole: Role,
    patientId: string,
    dto: CreateMealPlanDto,
  ) {
    await this.assertPatientInTenant(tenantId, patientId);
    const nutritionistUserId = await this.resolveNutritionistUserId(
      tenantId,
      actorUserId,
      actorRole,
      dto.nutritionistUserId,
    );
    if (dto.appointmentId) {
      await this.assertAppointmentBelongsToPatient(
        tenantId,
        dto.appointmentId,
        patientId,
      );
    }
    if (dto.treatmentCycleId) {
      await this.assertTreatmentCycleBelongsToPatient(
        tenantId,
        dto.treatmentCycleId,
        patientId,
      );
    }

    const created = await this.prisma.mealPlan.create({
      data: {
        tenantId,
        patientId,
        nutritionistUserId,
        appointmentId: dto.appointmentId,
        treatmentCycleId: dto.treatmentCycleId,
        title: dto.title,
        objective: dto.objective,
        customObjective: dto.customObjective,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveUntil: dto.effectiveUntil
          ? new Date(dto.effectiveUntil)
          : undefined,
        organizationType: dto.organizationType,
        cycleLength: dto.cycleLength,
        generalGuidelines: dto.generalGuidelines,
        dailyWaterGoalMl: dto.dailyWaterGoalMl,
        patientVisibleNotes: dto.patientVisibleNotes,
        internalNotes: dto.internalNotes,
        createdByUserId: actorUserId,
        days: this.buildDaysCreateInputFromDto(
          tenantId,
          dto.organizationType,
          dto.days,
        ),
      },
      include: MEAL_PLAN_INCLUDE,
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'MealPlan',
      entityId: created.id,
      action: AuditAction.CREATE,
      after: this.toAuditJson(created),
    });

    return created;
  }

  async update(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: UpdateMealPlanDto,
  ) {
    const before = await this.findOrThrow(tenantId, id);

    if (dto.appointmentId) {
      await this.assertAppointmentBelongsToPatient(
        tenantId,
        dto.appointmentId,
        before.patientId,
      );
    }
    if (dto.treatmentCycleId) {
      await this.assertTreatmentCycleBelongsToPatient(
        tenantId,
        dto.treatmentCycleId,
        before.patientId,
      );
    }

    const effectiveOrganizationType =
      dto.organizationType ?? before.organizationType;
    const daysInput = this.buildDaysCreateInputFromDto(
      tenantId,
      effectiveOrganizationType,
      dto.days,
    );

    await this.prisma.mealPlan.update({
      where: { id },
      data: {
        title: dto.title,
        objective: dto.objective,
        customObjective: dto.customObjective,
        effectiveFrom: dto.effectiveFrom
          ? new Date(dto.effectiveFrom)
          : undefined,
        effectiveUntil: dto.effectiveUntil
          ? new Date(dto.effectiveUntil)
          : undefined,
        appointmentId: dto.appointmentId,
        treatmentCycleId: dto.treatmentCycleId,
        organizationType: dto.organizationType,
        cycleLength: dto.cycleLength,
        generalGuidelines: dto.generalGuidelines,
        dailyWaterGoalMl: dto.dailyWaterGoalMl,
        patientVisibleNotes: dto.patientVisibleNotes,
        internalNotes: dto.internalNotes,
        updatedByUserId: actorUserId,
        days: dto.days
          ? { deleteMany: {}, create: daysInput?.create }
          : undefined,
      },
    });

    const updated = await this.findOrThrow(tenantId, id);

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'MealPlan',
      entityId: id,
      action: AuditAction.UPDATE,
      before: this.toAuditJson(before),
      after: this.toAuditJson(updated),
    });

    return updated;
  }

  async activate(tenantId: string, actorUserId: string, id: string) {
    const target = await this.findOrThrow(tenantId, id);
    if (target.status !== MealPlanStatus.DRAFT) {
      throw new BadRequestException(
        'Somente planos em rascunho podem ser ativados',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const currentActive = await tx.mealPlan.findFirst({
        where: {
          tenantId,
          patientId: target.patientId,
          status: MealPlanStatus.ACTIVE,
          deletedAt: null,
          id: { not: id },
        },
      });

      if (currentActive) {
        await tx.mealPlan.update({
          where: { id: currentActive.id },
          data: {
            status: MealPlanStatus.REPLACED,
            updatedByUserId: actorUserId,
          },
        });
        await this.audit.log({
          tenantId,
          actorUserId,
          entityType: 'MealPlan',
          entityId: currentActive.id,
          action: AuditAction.STATUS_CHANGE,
          before: { status: currentActive.status },
          after: { status: MealPlanStatus.REPLACED },
          metadata: { replacedByMealPlanId: id },
        });
      }

      await tx.mealPlan.update({
        where: { id },
        data: { status: MealPlanStatus.ACTIVE, updatedByUserId: actorUserId },
      });
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'MealPlan',
      entityId: id,
      action: AuditAction.STATUS_CHANGE,
      before: { status: target.status },
      after: { status: MealPlanStatus.ACTIVE },
    });

    return this.findOrThrow(tenantId, id);
  }

  async complete(tenantId: string, actorUserId: string, id: string) {
    const target = await this.findOrThrow(tenantId, id);
    if (target.status !== MealPlanStatus.ACTIVE) {
      throw new BadRequestException(
        'Somente planos ativos podem ser concluídos',
      );
    }

    await this.prisma.mealPlan.update({
      where: { id },
      data: { status: MealPlanStatus.COMPLETED, updatedByUserId: actorUserId },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'MealPlan',
      entityId: id,
      action: AuditAction.STATUS_CHANGE,
      before: { status: target.status },
      after: { status: MealPlanStatus.COMPLETED },
    });

    return this.findOrThrow(tenantId, id);
  }

  async archive(tenantId: string, actorUserId: string, id: string) {
    const before = await this.findOrThrow(tenantId, id);
    if (before.status === MealPlanStatus.ARCHIVED) {
      throw new BadRequestException('Este plano já está arquivado');
    }

    const archived = await this.prisma.mealPlan.update({
      where: { id },
      data: {
        status: MealPlanStatus.ARCHIVED,
        deletedAt: new Date(),
        updatedByUserId: actorUserId,
      },
      include: MEAL_PLAN_INCLUDE,
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'MealPlan',
      entityId: id,
      action: AuditAction.SOFT_DELETE,
      before: { status: before.status },
      after: { status: archived.status },
    });

    return archived;
  }

  async share(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: ShareMealPlanDto,
  ) {
    const before = await this.findOrThrow(tenantId, id);

    const updated = await this.prisma.mealPlan.update({
      where: { id },
      data: {
        isSharedWithPatient: dto.isSharedWithPatient,
        patientVisibleNotes: dto.patientVisibleNotes,
        sharedAt: dto.isSharedWithPatient ? new Date() : null,
        sharedByUserId: dto.isSharedWithPatient ? actorUserId : null,
      },
      include: MEAL_PLAN_INCLUDE,
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'MealPlan',
      entityId: id,
      action: AuditAction.UPDATE,
      before: { isSharedWithPatient: before.isSharedWithPatient },
      after: { isSharedWithPatient: updated.isSharedWithPatient },
      metadata: { field: 'isSharedWithPatient' },
    });

    return updated;
  }

  /** Cópia totalmente independente — nunca referencia o plano original. */
  async duplicate(tenantId: string, actorUserId: string, id: string) {
    const original = await this.findOrThrow(tenantId, id);

    const created = await this.prisma.mealPlan.create({
      data: {
        tenantId,
        patientId: original.patientId,
        nutritionistUserId: original.nutritionistUserId,
        treatmentCycleId: original.treatmentCycleId,
        title: `${original.title} (cópia)`,
        objective: original.objective,
        customObjective: original.customObjective,
        effectiveFrom: original.effectiveFrom,
        effectiveUntil: original.effectiveUntil,
        status: MealPlanStatus.DRAFT,
        version: 1,
        parentMealPlanId: null,
        organizationType: original.organizationType,
        cycleLength: original.cycleLength,
        generalGuidelines: original.generalGuidelines,
        dailyWaterGoalMl: original.dailyWaterGoalMl,
        patientVisibleNotes: original.patientVisibleNotes,
        internalNotes: original.internalNotes,
        createdByUserId: actorUserId,
        days: this.cloneDaysCreateInput(tenantId, original.days),
      },
      include: MEAL_PLAN_INCLUDE,
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'MealPlan',
      entityId: created.id,
      action: AuditAction.CREATE,
      after: this.toAuditJson(created),
      metadata: { duplicatedFromMealPlanId: id },
    });

    return created;
  }

  /** Nova versão encadeada — o plano original permanece intocado até ser explicitamente ativado. */
  async createNewVersion(tenantId: string, actorUserId: string, id: string) {
    const original = await this.findOrThrow(tenantId, id);

    const created = await this.prisma.mealPlan.create({
      data: {
        tenantId,
        patientId: original.patientId,
        nutritionistUserId: original.nutritionistUserId,
        treatmentCycleId: original.treatmentCycleId,
        title: original.title,
        objective: original.objective,
        customObjective: original.customObjective,
        effectiveFrom: original.effectiveFrom,
        effectiveUntil: original.effectiveUntil,
        status: MealPlanStatus.DRAFT,
        version: original.version + 1,
        parentMealPlanId: original.id,
        organizationType: original.organizationType,
        cycleLength: original.cycleLength,
        generalGuidelines: original.generalGuidelines,
        dailyWaterGoalMl: original.dailyWaterGoalMl,
        patientVisibleNotes: original.patientVisibleNotes,
        internalNotes: original.internalNotes,
        createdByUserId: actorUserId,
        days: this.cloneDaysCreateInput(tenantId, original.days),
      },
      include: MEAL_PLAN_INCLUDE,
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'MealPlan',
      entityId: created.id,
      action: AuditAction.CREATE,
      after: this.toAuditJson(created),
      metadata: { newVersionOfMealPlanId: id, version: created.version },
    });

    return created;
  }

  private async findOrThrow(
    tenantId: string,
    id: string,
  ): Promise<MealPlanWithRelations> {
    const mealPlan = await this.prisma.mealPlan.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: MEAL_PLAN_INCLUDE,
    });
    if (!mealPlan) {
      throw new NotFoundException('Plano alimentar não encontrado');
    }
    return mealPlan;
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

  private async assertAppointmentBelongsToPatient(
    tenantId: string,
    appointmentId: string,
    patientId: string,
  ) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId, patientId, deletedAt: null },
    });
    if (!appointment) {
      throw new NotFoundException('Consulta não encontrada para este paciente');
    }
    return appointment;
  }

  private async assertTreatmentCycleBelongsToPatient(
    tenantId: string,
    treatmentCycleId: string,
    patientId: string,
  ) {
    const cycle = await this.prisma.treatmentCycle.findFirst({
      where: { id: treatmentCycleId, tenantId, patientId },
    });
    if (!cycle) {
      throw new NotFoundException(
        'Ciclo de tratamento não encontrado para este paciente',
      );
    }
    return cycle;
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
        'Informe o nutricionista responsável pelo plano',
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

  /**
   * Se `days` vier vazio/ausente e o plano for DAILY, cria automaticamente
   * um único dia "Rotina diária" — todo MealPlan tem pelo menos um
   * MealPlanDay, mesmo no modo mais simples (seção 9/10 da Missão 0005.1).
   * Para WEEKLY/CUSTOM_CYCLE sem dias informados, o plano começa vazio
   * (o editor monta os dias depois), igual ao comportamento já existente
   * para `meals` na Missão 0005.
   */
  private buildDaysCreateInputFromDto(
    tenantId: string,
    organizationType: MealPlanOrganizationType | undefined,
    days?: MealPlanDayDto[],
  ): Prisma.MealPlanDayCreateNestedManyWithoutMealPlanInput | undefined {
    if (!days?.length) {
      if (
        (organizationType ?? MealPlanOrganizationType.DAILY) ===
        MealPlanOrganizationType.DAILY
      ) {
        return {
          create: [
            {
              tenantId,
              name: 'Rotina diária',
              dayNumber: 1,
              displayOrder: 0,
            },
          ],
        };
      }
      return undefined;
    }

    return {
      create: days.map((day, dayIndex) => ({
        tenantId,
        name: day.name,
        dayNumber: day.dayNumber,
        weekDay: day.weekDay,
        displayOrder: day.displayOrder ?? dayIndex,
        notes: day.notes,
        meals: this.buildMealsCreateInputFromDto(tenantId, day.meals),
      })),
    };
  }

  private buildMealsCreateInputFromDto(
    tenantId: string,
    meals?: MealDto[],
  ): Prisma.MealCreateNestedManyWithoutMealPlanDayInput | undefined {
    if (!meals?.length) return undefined;

    return {
      create: meals.map((meal, mealIndex) => ({
        tenantId,
        name: meal.name,
        scheduledTime: meal.scheduledTime,
        timeDescription: meal.timeDescription,
        instructions: meal.instructions,
        displayOrder: meal.displayOrder ?? mealIndex,
        items: meal.items?.length
          ? {
              create: meal.items.map((item, itemIndex) => ({
                tenantId,
                description: item.description,
                quantity: item.quantity,
                unit: item.unit,
                householdMeasure: item.householdMeasure,
                instructions: item.instructions,
                displayOrder: item.displayOrder ?? itemIndex,
                substitutions: item.substitutions?.length
                  ? {
                      create: item.substitutions.map((sub, subIndex) => ({
                        tenantId,
                        description: sub.description,
                        quantity: sub.quantity,
                        unit: sub.unit,
                        householdMeasure: sub.householdMeasure,
                        notes: sub.notes,
                        displayOrder: sub.displayOrder ?? subIndex,
                      })),
                    }
                  : undefined,
              })),
            }
          : undefined,
      })),
    };
  }

  private cloneDaysCreateInput(
    tenantId: string,
    days: MealPlanWithRelations['days'],
  ): Prisma.MealPlanDayCreateNestedManyWithoutMealPlanInput | undefined {
    if (!days.length) return undefined;

    return {
      create: days.map((day) => ({
        tenantId,
        name: day.name,
        dayNumber: day.dayNumber,
        weekDay: day.weekDay,
        displayOrder: day.displayOrder,
        notes: day.notes,
        meals: this.cloneMealsCreateInput(tenantId, day.meals),
      })),
    };
  }

  private cloneMealsCreateInput(
    tenantId: string,
    meals: MealPlanWithRelations['days'][number]['meals'],
  ): Prisma.MealCreateNestedManyWithoutMealPlanDayInput | undefined {
    if (!meals.length) return undefined;

    return {
      create: meals.map((meal) => ({
        tenantId,
        name: meal.name,
        scheduledTime: meal.scheduledTime,
        timeDescription: meal.timeDescription,
        instructions: meal.instructions,
        displayOrder: meal.displayOrder,
        items: meal.items.length
          ? {
              create: meal.items.map((item) => ({
                tenantId,
                description: item.description,
                quantity: item.quantity ?? undefined,
                unit: item.unit,
                householdMeasure: item.householdMeasure,
                instructions: item.instructions,
                displayOrder: item.displayOrder,
                substitutions: item.substitutions.length
                  ? {
                      create: item.substitutions.map((sub) => ({
                        tenantId,
                        description: sub.description,
                        quantity: sub.quantity ?? undefined,
                        unit: sub.unit,
                        householdMeasure: sub.householdMeasure,
                        notes: sub.notes,
                        displayOrder: sub.displayOrder,
                      })),
                    }
                  : undefined,
              })),
            }
          : undefined,
      })),
    };
  }

  private toAuditJson(value: Record<string, unknown>): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
