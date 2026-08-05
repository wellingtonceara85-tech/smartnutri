import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizeCpf } from '../../common/utils/cpf.util';
import { normalizePhone } from '../../common/utils/phone.util';
import { AuditAction, Prisma, Role } from '../../generated/prisma/client';
import { CreatePatientDto } from './dto/create-patient.dto';
import { QueryPatientsDto } from './dto/query-patients.dto';
import { UpdatePatientStatusDto } from './dto/update-patient-status.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

const PATIENT_LIST_SELECT = {
  id: true,
  fullName: true,
  socialName: true,
  primaryPhone: true,
  whatsappPhone: true,
  email: true,
  status: true,
  createdAt: true,
  responsibleNutritionist: { select: { id: true, name: true } },
} satisfies Prisma.PatientSelect;

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, query: QueryPatientsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.PatientWhereInput = { tenantId };

    if (query.status) {
      where.status = query.status;
    }
    if (query.responsibleNutritionistId) {
      where.responsibleNutritionistId = query.responsibleNutritionistId;
    }
    if (query.source) {
      where.source = { equals: query.source, mode: 'insensitive' };
    }
    if (query.search) {
      const search = query.search.trim();
      const searchDigits = search.replace(/\D/g, '');
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { socialName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        ...(searchDigits.length > 0
          ? [
              { cpf: { contains: searchDigits } },
              { primaryPhone: { contains: searchDigits } },
              { whatsappPhone: { contains: searchDigits } },
            ]
          : []),
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.patient.findMany({
        where,
        select: PATIENT_LIST_SELECT,
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortDir ?? 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.patient.count({ where }),
    ]);

    return {
      data: data.map((patient) => ({
        ...patient,
        currentPlan: null,
        nextAppointment: null,
        openBalance: null,
      })),
      total,
      page,
      pageSize,
    };
  }

  async getById(tenantId: string, id: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id, tenantId },
      include: {
        responsibleNutritionist: {
          select: { id: true, name: true, email: true },
        },
        treatmentCycles: true,
        appointments: { orderBy: { scheduledAt: 'desc' }, take: 5 },
        charges: true,
        patientEvolutions: true,
        documents: true,
      },
    });

    if (!patient) {
      throw new NotFoundException('Paciente não encontrado');
    }

    const auditLog = await this.prisma.auditLog.findMany({
      where: { tenantId, entityType: 'Patient', entityId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { actorUser: { select: { id: true, name: true } } },
    });

    return {
      ...patient,
      currentPlan: null,
      nextAppointment: null,
      openBalance: null,
      auditLog,
    };
  }

  async create(tenantId: string, actorUserId: string, dto: CreatePatientDto) {
    const data = await this.buildPersistedFields(tenantId, dto);

    try {
      const patient = await this.prisma.patient.create({
        data: { ...data, tenantId } as Prisma.PatientUncheckedCreateInput,
      });

      await this.audit.log({
        tenantId,
        actorUserId,
        entityType: 'Patient',
        entityId: patient.id,
        action: AuditAction.CREATE,
        after: this.toAuditJson(patient),
      });

      return patient;
    } catch (error) {
      throw this.translatePrismaError(error);
    }
  }

  async update(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: UpdatePatientDto,
  ) {
    const before = await this.prisma.patient.findFirst({
      where: { id, tenantId },
    });
    if (!before) {
      throw new NotFoundException('Paciente não encontrado');
    }

    const data = await this.buildPersistedFields(tenantId, dto);

    try {
      const patient = await this.prisma.patient.update({
        where: { id },
        data,
      });

      await this.audit.log({
        tenantId,
        actorUserId,
        entityType: 'Patient',
        entityId: patient.id,
        action: AuditAction.UPDATE,
        before: this.toAuditJson(before),
        after: this.toAuditJson(patient),
      });

      return patient;
    } catch (error) {
      throw this.translatePrismaError(error);
    }
  }

  async updateStatus(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: UpdatePatientStatusDto,
  ) {
    const before = await this.prisma.patient.findFirst({
      where: { id, tenantId },
    });
    if (!before) {
      throw new NotFoundException('Paciente não encontrado');
    }

    const patient = await this.prisma.patient.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'Patient',
      entityId: patient.id,
      action: AuditAction.STATUS_CHANGE,
      before: { status: before.status },
      after: { status: patient.status },
      metadata: dto.reason ? { reason: dto.reason } : null,
    });

    return patient;
  }

  async archive(tenantId: string, actorUserId: string, id: string) {
    const before = await this.prisma.patient.findFirst({
      where: { id, tenantId },
    });
    if (!before) {
      throw new NotFoundException('Paciente não encontrado');
    }

    const patient = await this.prisma.patient.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'Patient',
      entityId: patient.id,
      action: AuditAction.SOFT_DELETE,
      before: { status: before.status },
      after: { status: patient.status },
    });

    return patient;
  }

  /** Normaliza CPF/telefones e valida o nutricionista responsável antes de persistir. */
  private async buildPersistedFields(
    tenantId: string,
    dto: CreatePatientDto | UpdatePatientDto,
  ): Promise<Prisma.PatientUncheckedUpdateInput> {
    const data: Prisma.PatientUncheckedUpdateInput = { ...dto };

    if (dto.cpf !== undefined) {
      data.cpf = dto.cpf ? normalizeCpf(dto.cpf) : null;
    }
    if (dto.primaryPhone !== undefined) {
      data.primaryPhone = dto.primaryPhone
        ? normalizePhone(dto.primaryPhone)
        : null;
    }
    if (dto.secondaryPhone !== undefined) {
      data.secondaryPhone = dto.secondaryPhone
        ? normalizePhone(dto.secondaryPhone)
        : null;
    }
    if (dto.whatsappPhone !== undefined) {
      data.whatsappPhone = dto.whatsappPhone
        ? normalizePhone(dto.whatsappPhone)
        : null;
    }
    if (dto.emergencyContactPhone !== undefined) {
      data.emergencyContactPhone = dto.emergencyContactPhone
        ? normalizePhone(dto.emergencyContactPhone)
        : null;
    }
    if (dto.birthDate !== undefined) {
      data.birthDate = dto.birthDate ? new Date(dto.birthDate) : null;
    }

    if (
      dto.responsibleNutritionistId !== undefined &&
      dto.responsibleNutritionistId !== null
    ) {
      await this.assertNutritionistInTenant(
        tenantId,
        dto.responsibleNutritionistId,
      );
    }

    return data;
  }

  /** O nutricionista responsável precisa pertencer ao mesmo tenant e ter o perfil NUTRITIONIST. */
  private async assertNutritionistInTenant(
    tenantId: string,
    nutritionistUserId: string,
  ) {
    const membership = await this.prisma.userClinic.findUnique({
      where: { userId_tenantId: { userId: nutritionistUserId, tenantId } },
    });

    if (
      !membership ||
      !membership.isActive ||
      membership.role !== Role.NUTRITIONIST
    ) {
      throw new BadRequestException(
        'Nutricionista responsável inválido para esta clínica',
      );
    }
  }

  private translatePrismaError(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(
        'Já existe um paciente com este CPF nesta clínica',
      );
    }
    return error;
  }

  private toAuditJson(patient: Record<string, unknown>): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(patient)) as Prisma.InputJsonValue;
  }
}
