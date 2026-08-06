import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import {
  ageInYears,
  classifyBmi,
  computeBmi,
} from '../../common/utils/bmi.util';
import {
  AuditAction,
  EvolutionPhotoType,
  Prisma,
  Role,
} from '../../generated/prisma/client';
import { CreateEvolutionDto } from './dto/create-evolution.dto';
import { ShareEvolutionDto } from './dto/share-evolution.dto';
import { UpdateEvolutionDto } from './dto/update-evolution.dto';

const EVOLUTION_INCLUDE = {
  anthropometry: true,
  bioimpedance: { include: { segmentalImpedanceMeasurements: true } },
  segmentalMeasurements: true,
  referenceRanges: true,
  photos: { where: { deletedAt: null } },
  nutritionistUser: { select: { id: true, name: true } },
  createdByUser: { select: { id: true, name: true } },
} satisfies Prisma.PatientEvolutionInclude;

@Injectable()
export class EvolutionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  async list(tenantId: string, patientId: string) {
    await this.assertPatientInTenant(tenantId, patientId);

    const evolutions = await this.prisma.patientEvolution.findMany({
      where: { tenantId, patientId, deletedAt: null },
      include: EVOLUTION_INCLUDE,
      orderBy: { assessmentDate: 'desc' },
    });

    return Promise.all(
      evolutions.map((evolution) => this.withPhotoUrls(evolution)),
    );
  }

  async getById(tenantId: string, id: string) {
    const evolution = await this.findOrThrow(tenantId, id);
    return this.withPhotoUrls(evolution);
  }

  async create(
    tenantId: string,
    actorUserId: string,
    actorRole: Role,
    patientId: string,
    dto: CreateEvolutionDto,
  ) {
    await this.assertPatientInTenant(tenantId, patientId);
    const nutritionistUserId = await this.resolveNutritionistUserId(
      tenantId,
      actorUserId,
      actorRole,
      dto.nutritionistUserId,
    );

    const bmiFields = await this.computeBmiFields(
      patientId,
      dto.assessmentDate,
      dto.anthropometry,
    );

    const created = await this.prisma.patientEvolution.create({
      data: {
        tenantId,
        patientId,
        nutritionistUserId,
        createdByUserId: actorUserId,
        assessmentDate: new Date(dto.assessmentDate),
        assessmentTime: dto.assessmentTime,
        title: dto.title,
        objective: dto.objective,
        clinicalNotes: dto.clinicalNotes,
        internalNotes: dto.internalNotes,
        anthropometry: dto.anthropometry
          ? { create: { tenantId, ...dto.anthropometry, ...bmiFields } }
          : undefined,
        bioimpedance: dto.bioimpedance
          ? {
              create: {
                tenantId,
                ...dto.bioimpedance,
                segmentalImpedanceMeasurements: dto
                  .segmentalImpedanceMeasurements?.length
                  ? {
                      create: dto.segmentalImpedanceMeasurements.map((m) => ({
                        tenantId,
                        ...m,
                      })),
                    }
                  : undefined,
              },
            }
          : undefined,
        segmentalMeasurements: dto.segmentalMeasurements?.length
          ? {
              create: dto.segmentalMeasurements.map((m) => ({
                tenantId,
                ...m,
              })),
            }
          : undefined,
        referenceRanges: dto.referenceRanges?.length
          ? { create: dto.referenceRanges.map((r) => ({ tenantId, ...r })) }
          : undefined,
      },
      include: EVOLUTION_INCLUDE,
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'PatientEvolution',
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
    dto: UpdateEvolutionDto,
  ) {
    const before = await this.findOrThrow(tenantId, id);

    const bmiFields = dto.anthropometry
      ? await this.computeBmiFields(
          before.patientId,
          dto.assessmentDate ?? before.assessmentDate.toISOString(),
          dto.anthropometry,
        )
      : undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.patientEvolution.update({
        where: { id },
        data: {
          updatedByUserId: actorUserId,
          assessmentDate: dto.assessmentDate
            ? new Date(dto.assessmentDate)
            : undefined,
          assessmentTime: dto.assessmentTime,
          title: dto.title,
          objective: dto.objective,
          clinicalNotes: dto.clinicalNotes,
          internalNotes: dto.internalNotes,
        },
      });

      if (dto.anthropometry) {
        await tx.anthropometricMeasurement.upsert({
          where: { evolutionId: id },
          create: {
            tenantId,
            evolutionId: id,
            ...dto.anthropometry,
            ...bmiFields,
          },
          update: { ...dto.anthropometry, ...bmiFields },
        });
      }

      if (dto.bioimpedance) {
        const bioimpedance = await tx.bioimpedanceMeasurement.upsert({
          where: { evolutionId: id },
          create: { tenantId, evolutionId: id, ...dto.bioimpedance },
          update: { ...dto.bioimpedance },
        });

        if (dto.segmentalImpedanceMeasurements) {
          await tx.segmentalImpedanceMeasurement.deleteMany({
            where: { bioimpedanceMeasurementId: bioimpedance.id },
          });
          if (dto.segmentalImpedanceMeasurements.length > 0) {
            await tx.segmentalImpedanceMeasurement.createMany({
              data: dto.segmentalImpedanceMeasurements.map((m) => ({
                tenantId,
                bioimpedanceMeasurementId: bioimpedance.id,
                ...m,
              })),
            });
          }
        }
      }

      if (dto.segmentalMeasurements) {
        await tx.segmentalBodyMeasurement.deleteMany({
          where: { evolutionId: id },
        });
        if (dto.segmentalMeasurements.length > 0) {
          await tx.segmentalBodyMeasurement.createMany({
            data: dto.segmentalMeasurements.map((m) => ({
              tenantId,
              evolutionId: id,
              ...m,
            })),
          });
        }
      }

      if (dto.referenceRanges) {
        await tx.measurementReferenceRange.deleteMany({
          where: { evolutionId: id },
        });
        if (dto.referenceRanges.length > 0) {
          await tx.measurementReferenceRange.createMany({
            data: dto.referenceRanges.map((r) => ({
              tenantId,
              evolutionId: id,
              ...r,
            })),
          });
        }
      }
    });

    const updated = await this.findOrThrow(tenantId, id);

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'PatientEvolution',
      entityId: id,
      action: AuditAction.UPDATE,
      before: this.toAuditJson(before),
      after: this.toAuditJson(updated),
    });

    return this.withPhotoUrls(updated);
  }

  async archive(tenantId: string, actorUserId: string, id: string) {
    const before = await this.findOrThrow(tenantId, id);

    const archived = await this.prisma.patientEvolution.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        deletedAt: new Date(),
        updatedByUserId: actorUserId,
      },
      include: EVOLUTION_INCLUDE,
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'PatientEvolution',
      entityId: id,
      action: AuditAction.SOFT_DELETE,
      before: { status: before.status },
      after: { status: archived.status },
    });

    return this.withPhotoUrls(archived);
  }

  async share(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: ShareEvolutionDto,
  ) {
    const before = await this.findOrThrow(tenantId, id);

    const updated = await this.prisma.patientEvolution.update({
      where: { id },
      data: {
        isSharedWithPatient: dto.isSharedWithPatient,
        patientVisibleNotes: dto.patientVisibleNotes,
        sharedAt: dto.isSharedWithPatient ? new Date() : null,
        sharedByUserId: dto.isSharedWithPatient ? actorUserId : null,
      },
      include: EVOLUTION_INCLUDE,
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'PatientEvolution',
      entityId: id,
      action: AuditAction.UPDATE,
      before: { isSharedWithPatient: before.isSharedWithPatient },
      after: { isSharedWithPatient: updated.isSharedWithPatient },
      metadata: { field: 'isSharedWithPatient' },
    });

    return this.withPhotoUrls(updated);
  }

  async addPhoto(
    tenantId: string,
    actorUserId: string,
    evolutionId: string,
    type: EvolutionPhotoType,
    file: Express.Multer.File,
  ) {
    await this.findOrThrow(tenantId, evolutionId);

    const extension =
      file.mimetype === 'image/png'
        ? 'png'
        : file.mimetype === 'image/webp'
          ? 'webp'
          : 'jpg';
    const key = `evolutions/${tenantId}/${evolutionId}/${type.toLowerCase()}-${Date.now()}.${extension}`;
    await this.storage.upload({
      key,
      body: file.buffer,
      contentType: file.mimetype,
    });

    const photo = await this.prisma.evolutionPhoto.create({
      data: {
        tenantId,
        evolutionId,
        type,
        storageKey: key,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedByUserId: actorUserId,
      },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'EvolutionPhoto',
      entityId: photo.id,
      action: AuditAction.CREATE,
      after: { evolutionId, type },
    });

    return {
      ...photo,
      url: await this.storage.getDownloadUrl(photo.storageKey),
    };
  }

  async removePhoto(
    tenantId: string,
    actorUserId: string,
    evolutionId: string,
    photoId: string,
  ) {
    const photo = await this.prisma.evolutionPhoto.findFirst({
      where: { id: photoId, evolutionId, tenantId, deletedAt: null },
    });
    if (!photo) {
      throw new NotFoundException('Foto não encontrada');
    }

    await this.prisma.evolutionPhoto.update({
      where: { id: photoId },
      data: { deletedAt: new Date() },
    });
    await this.storage.delete(photo.storageKey).catch(() => undefined);

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'EvolutionPhoto',
      entityId: photoId,
      action: AuditAction.SOFT_DELETE,
    });
  }

  private async findOrThrow(tenantId: string, id: string) {
    const evolution = await this.prisma.patientEvolution.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: EVOLUTION_INCLUDE,
    });
    if (!evolution) {
      throw new NotFoundException('Avaliação não encontrada');
    }
    return evolution;
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
        'Informe o nutricionista responsável pela avaliação',
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

  /** IMC calculado e persistido no servidor — nunca confia em cálculo do frontend. */
  private async computeBmiFields(
    patientId: string,
    assessmentDateIso: string,
    anthropometry?: { weightKg?: number; heightCm?: number },
  ): Promise<{ bmi: number | null; bmiClassification: string | null }> {
    const bmi = computeBmi(anthropometry?.weightKg, anthropometry?.heightCm);
    if (bmi === null) {
      return { bmi: null, bmiClassification: null };
    }

    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
    });
    const age = ageInYears(
      patient?.birthDate ?? null,
      new Date(assessmentDateIso),
    );

    return { bmi, bmiClassification: classifyBmi(bmi, age) };
  }

  private async withPhotoUrls<T extends { photos: { storageKey: string }[] }>(
    evolution: T,
  ): Promise<T & { photos: (T['photos'][number] & { url: string })[] }> {
    const photos = await Promise.all(
      evolution.photos.map(async (photo) => ({
        ...photo,
        url: await this.storage.getDownloadUrl(photo.storageKey),
      })),
    );
    return { ...evolution, photos };
  }

  private toAuditJson(value: Record<string, unknown>): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
