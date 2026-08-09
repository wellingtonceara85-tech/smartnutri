import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import {
  AuditAction,
  FoodDiarySource,
  FoodDiaryStatus,
  Prisma,
} from '../../generated/prisma/client';
import { CreateFoodDiaryEntryDto } from './dto/create-food-diary-entry.dto';
import { ReviewFoodDiaryEntryDto } from './dto/review-food-diary-entry.dto';
import { UpdateFoodDiaryEntryDto } from './dto/update-food-diary-entry.dto';

const FOOD_DIARY_INCLUDE = {
  photos: { where: { deletedAt: null }, orderBy: { displayOrder: 'asc' } },
  mealPlan: { select: { id: true, title: true, version: true } },
  meal: {
    select: {
      id: true,
      name: true,
      mealPlanDay: { select: { id: true, name: true } },
    },
  },
  createdByUser: { select: { id: true, name: true } },
  reviewedByUser: { select: { id: true, name: true } },
} satisfies Prisma.FoodDiaryEntryInclude;

@Injectable()
export class FoodDiaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  async list(
    tenantId: string,
    patientId: string,
    filters?: { status?: FoodDiaryStatus; dateFrom?: string; dateTo?: string },
  ) {
    await this.assertPatientInTenant(tenantId, patientId);

    const entries = await this.prisma.foodDiaryEntry.findMany({
      where: {
        tenantId,
        patientId,
        deletedAt: null,
        status: filters?.status,
        entryDate: {
          gte: filters?.dateFrom ? new Date(filters.dateFrom) : undefined,
          lte: filters?.dateTo ? new Date(filters.dateTo) : undefined,
        },
      },
      include: FOOD_DIARY_INCLUDE,
      orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
    });

    return Promise.all(entries.map((entry) => this.withPhotoUrls(entry)));
  }

  async getById(tenantId: string, id: string) {
    const entry = await this.findOrThrow(tenantId, id);
    return this.withPhotoUrls(entry);
  }

  async create(
    tenantId: string,
    actorUserId: string,
    patientId: string,
    dto: CreateFoodDiaryEntryDto,
  ) {
    await this.assertPatientInTenant(tenantId, patientId);
    if (dto.mealPlanId) {
      await this.assertMealPlanBelongsToPatient(
        tenantId,
        dto.mealPlanId,
        patientId,
      );
    }
    if (dto.mealId) {
      await this.assertMealBelongsToPlan(tenantId, dto.mealId, dto.mealPlanId);
    }

    const created = await this.prisma.foodDiaryEntry.create({
      data: {
        tenantId,
        patientId,
        mealPlanId: dto.mealPlanId,
        mealId: dto.mealId,
        entryDate: new Date(dto.entryDate),
        entryTime: dto.entryTime,
        mealName: dto.mealName,
        comment: dto.comment,
        source: FoodDiarySource.PROFESSIONAL,
        status: FoodDiaryStatus.PENDING_REVIEW,
        createdByUserId: actorUserId,
      },
      include: FOOD_DIARY_INCLUDE,
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'FoodDiaryEntry',
      entityId: created.id,
      action: AuditAction.CREATE,
      after: this.toAuditJson(created),
    });

    return this.withPhotoUrls(created);
  }

  async update(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: UpdateFoodDiaryEntryDto,
  ) {
    const before = await this.findOrThrow(tenantId, id);

    if (dto.mealPlanId) {
      await this.assertMealPlanBelongsToPatient(
        tenantId,
        dto.mealPlanId,
        before.patientId,
      );
    }
    if (dto.mealId) {
      await this.assertMealBelongsToPlan(
        tenantId,
        dto.mealId,
        dto.mealPlanId ?? before.mealPlanId ?? undefined,
      );
    }

    const updated = await this.prisma.foodDiaryEntry.update({
      where: { id },
      data: {
        entryDate: dto.entryDate ? new Date(dto.entryDate) : undefined,
        entryTime: dto.entryTime,
        mealName: dto.mealName,
        comment: dto.comment,
        mealPlanId: dto.mealPlanId,
        mealId: dto.mealId,
      },
      include: FOOD_DIARY_INCLUDE,
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'FoodDiaryEntry',
      entityId: id,
      action: AuditAction.UPDATE,
      before: this.toAuditJson(before),
      after: this.toAuditJson(updated),
    });

    return this.withPhotoUrls(updated);
  }

  async review(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: ReviewFoodDiaryEntryDto,
  ) {
    if (dto.status === FoodDiaryStatus.PENDING_REVIEW) {
      throw new BadRequestException('Status de avaliação inválido');
    }
    const before = await this.findOrThrow(tenantId, id);

    const updated = await this.prisma.foodDiaryEntry.update({
      where: { id },
      data: {
        status: dto.status,
        nutritionistFeedback: dto.nutritionistFeedback,
        reviewedByUserId: actorUserId,
        reviewedAt: new Date(),
      },
      include: FOOD_DIARY_INCLUDE,
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'FoodDiaryEntry',
      entityId: id,
      action: AuditAction.STATUS_CHANGE,
      before: { status: before.status },
      after: { status: updated.status },
    });

    return this.withPhotoUrls(updated);
  }

  async archive(tenantId: string, actorUserId: string, id: string) {
    const before = await this.findOrThrow(tenantId, id);

    await this.prisma.foodDiaryEntry.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'FoodDiaryEntry',
      entityId: id,
      action: AuditAction.SOFT_DELETE,
      before: { status: before.status },
    });
  }

  async addPhoto(
    tenantId: string,
    actorUserId: string,
    entryId: string,
    file: Express.Multer.File,
  ) {
    const entry = await this.findOrThrow(tenantId, entryId);

    const extension =
      file.mimetype === 'image/png'
        ? 'png'
        : file.mimetype === 'image/webp'
          ? 'webp'
          : 'jpg';
    const key = `tenants/${tenantId}/patients/${entry.patientId}/food-diary/${entryId}/${Date.now()}.${extension}`;
    await this.storage.upload({
      key,
      body: file.buffer,
      contentType: file.mimetype,
    });

    const photo = await this.prisma.foodDiaryPhoto.create({
      data: {
        tenantId,
        foodDiaryEntryId: entryId,
        storageKey: key,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'FoodDiaryPhoto',
      entityId: photo.id,
      action: AuditAction.CREATE,
      after: { foodDiaryEntryId: entryId },
    });

    return {
      ...photo,
      url: await this.storage.getDownloadUrl(photo.storageKey),
    };
  }

  async removePhoto(
    tenantId: string,
    actorUserId: string,
    entryId: string,
    photoId: string,
  ) {
    const photo = await this.prisma.foodDiaryPhoto.findFirst({
      where: {
        id: photoId,
        foodDiaryEntryId: entryId,
        tenantId,
        deletedAt: null,
      },
    });
    if (!photo) {
      throw new NotFoundException('Foto não encontrada');
    }

    await this.prisma.foodDiaryPhoto.update({
      where: { id: photoId },
      data: { deletedAt: new Date() },
    });
    await this.storage.delete(photo.storageKey).catch(() => undefined);

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'FoodDiaryPhoto',
      entityId: photoId,
      action: AuditAction.SOFT_DELETE,
    });
  }

  private async findOrThrow(tenantId: string, id: string) {
    const entry = await this.prisma.foodDiaryEntry.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: FOOD_DIARY_INCLUDE,
    });
    if (!entry) {
      throw new NotFoundException(
        'Registro do diário alimentar não encontrado',
      );
    }
    return entry;
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

  private async assertMealPlanBelongsToPatient(
    tenantId: string,
    mealPlanId: string,
    patientId: string,
  ) {
    const mealPlan = await this.prisma.mealPlan.findFirst({
      where: { id: mealPlanId, tenantId, patientId, deletedAt: null },
    });
    if (!mealPlan) {
      throw new NotFoundException(
        'Plano alimentar não encontrado para este paciente',
      );
    }
    return mealPlan;
  }

  private async assertMealBelongsToPlan(
    tenantId: string,
    mealId: string,
    mealPlanId?: string,
  ) {
    const meal = await this.prisma.meal.findFirst({
      where: {
        id: mealId,
        tenantId,
        mealPlanDay: { mealPlanId: mealPlanId ?? undefined },
      },
    });
    if (!meal) {
      throw new BadRequestException(
        'Refeição informada não pertence ao plano alimentar indicado',
      );
    }
    return meal;
  }

  private async withPhotoUrls<T extends { photos: { storageKey: string }[] }>(
    entry: T,
  ): Promise<T & { photos: (T['photos'][number] & { url: string })[] }> {
    const photos = await Promise.all(
      entry.photos.map(async (photo) => ({
        ...photo,
        url: await this.storage.getDownloadUrl(photo.storageKey),
      })),
    );
    return { ...entry, photos };
  }

  private toAuditJson(value: Record<string, unknown>): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
