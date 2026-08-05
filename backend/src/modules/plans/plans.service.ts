import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditAction, Prisma, Role } from '../../generated/prisma/client';
import { CreatePlanDto } from './dto/create-plan.dto';
import { QueryPlansDto } from './dto/query-plans.dto';
import { UpdatePlanStatusDto } from './dto/update-plan-status.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, query: QueryPlansDto, requesterRole: Role) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.PlanWhereInput = { tenantId, deletedAt: null };

    // Recepção só enxerga planos ativos, independentemente do filtro pedido.
    if (requesterRole === Role.RECEPTION) {
      where.isActive = true;
    } else if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.plan.findMany({
        where,
        orderBy: { [query.sortBy ?? 'name']: query.sortDir ?? 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.plan.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async getById(tenantId: string, id: string, requesterRole?: Role) {
    const where: Prisma.PlanWhereInput = { id, tenantId, deletedAt: null };
    if (requesterRole === Role.RECEPTION) {
      where.isActive = true;
    }

    const plan = await this.prisma.plan.findFirst({ where });
    if (!plan) {
      throw new NotFoundException('Plano não encontrado');
    }
    return plan;
  }

  async create(tenantId: string, actorUserId: string, dto: CreatePlanDto) {
    try {
      const plan = await this.prisma.plan.create({
        data: { ...dto, tenantId },
      });

      await this.audit.log({
        tenantId,
        actorUserId,
        entityType: 'Plan',
        entityId: plan.id,
        action: AuditAction.CREATE,
        after: this.toAuditJson(plan),
      });

      return plan;
    } catch (error) {
      throw this.translatePrismaError(error);
    }
  }

  async update(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: UpdatePlanDto,
  ) {
    const before = await this.getById(tenantId, id);

    try {
      const plan = await this.prisma.plan.update({
        where: { id },
        data: dto,
      });

      await this.audit.log({
        tenantId,
        actorUserId,
        entityType: 'Plan',
        entityId: plan.id,
        action: AuditAction.UPDATE,
        before: this.toAuditJson(before),
        after: this.toAuditJson(plan),
      });

      return plan;
    } catch (error) {
      throw this.translatePrismaError(error);
    }
  }

  async updateStatus(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: UpdatePlanStatusDto,
  ) {
    const before = await this.getById(tenantId, id);

    const plan = await this.prisma.plan.update({
      where: { id },
      data: { isActive: dto.isActive },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'Plan',
      entityId: plan.id,
      action: AuditAction.STATUS_CHANGE,
      before: { isActive: before.isActive },
      after: { isActive: plan.isActive },
    });

    return plan;
  }

  /**
   * Exclusão sempre lógica (deletedAt). Planos referenciados por algum
   * ciclo de tratamento nunca podem ser removidos, nem logicamente.
   */
  async archive(tenantId: string, actorUserId: string, id: string) {
    const before = await this.getById(tenantId, id);

    const cyclesUsingPlan = await this.prisma.treatmentCycle.count({
      where: { planId: id },
    });
    if (cyclesUsingPlan > 0) {
      throw new ConflictException(
        'Este plano já foi usado em ciclos de acompanhamento e não pode ser excluído — inative-o em vez disso',
      );
    }

    const plan = await this.prisma.plan.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'Plan',
      entityId: plan.id,
      action: AuditAction.SOFT_DELETE,
      before: this.toAuditJson(before),
    });

    return plan;
  }

  private translatePrismaError(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(
        'Já existe um plano com este nome nesta clínica',
      );
    }
    return error;
  }

  private toAuditJson(plan: Record<string, unknown>): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(plan)) as Prisma.InputJsonValue;
  }
}
