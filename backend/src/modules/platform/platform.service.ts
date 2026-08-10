import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuditService } from '../../common/audit/audit.service';
import {
  PLAN_CATALOG,
  resolvePlanForTenant,
} from '../../common/plans/plan-catalog';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  AuditAction,
  Prisma,
  Role,
  Tenant,
  TenantStatus,
  TenantType,
} from '../../generated/prisma/client';
import { ChangeTenantPlanDto } from './dto/change-tenant-plan.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { QueryPlatformTenantsDto } from './dto/query-platform-tenants.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

const BCRYPT_ROUNDS = 12;
const TRIAL_DEFAULT_DAYS = 14;

const TENANT_LIST_INCLUDE = {
  professionalProfile: { select: { professionalName: true } },
  _count: { select: { userClinics: true, patients: true } },
} satisfies Prisma.TenantInclude;

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Indicadores agregados da plataforma — nunca conteúdo clínico (seção 13:
   * nada de peso, diagnóstico, plano alimentar, evolução, fotos).
   */
  async getDashboard() {
    const [
      totalTenants,
      activeTenants,
      trialTenants,
      suspendedTenants,
      cancelledTenants,
      soloTenants,
      clinicTenants,
      nutritionists,
      internalUsers,
      totalPatients,
    ] = await this.prisma.$transaction([
      this.prisma.tenant.count({ where: { deletedAt: null } }),
      this.prisma.tenant.count({
        where: { deletedAt: null, status: TenantStatus.ACTIVE },
      }),
      this.prisma.tenant.count({
        where: { deletedAt: null, status: TenantStatus.TRIAL },
      }),
      this.prisma.tenant.count({
        where: { deletedAt: null, status: TenantStatus.SUSPENDED },
      }),
      this.prisma.tenant.count({
        where: { deletedAt: null, status: TenantStatus.CANCELLED },
      }),
      this.prisma.tenant.count({
        where: { deletedAt: null, type: TenantType.SOLO },
      }),
      this.prisma.tenant.count({
        where: { deletedAt: null, type: TenantType.CLINIC },
      }),
      this.prisma.userClinic.count({ where: this.nutritionistWhere() }),
      this.prisma.userClinic.count({
        where: { isActive: true, user: { isActive: true, deletedAt: null } },
      }),
      this.prisma.patient.count({ where: { deletedAt: null } }),
    ]);

    return {
      tenants: {
        total: totalTenants,
        active: activeTenants,
        trial: trialTenants,
        suspended: suspendedTenants,
        cancelled: cancelledTenants,
        solo: soloTenants,
        clinic: clinicTenants,
      },
      nutritionists,
      internalUsers,
      patients: totalPatients,
    };
  }

  async listTenants(query: QueryPlatformTenantsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.TenantWhereInput = { deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [tenants, total] = await this.prisma.$transaction([
      this.prisma.tenant.findMany({
        where,
        include: TENANT_LIST_INCLUDE,
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortDir ?? 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      data: tenants.map((tenant) => this.toTenantListItem(tenant)),
      total,
      page,
      pageSize,
    };
  }

  async getTenantById(id: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id, deletedAt: null },
      include: TENANT_LIST_INCLUDE,
    });
    if (!tenant) {
      throw new NotFoundException('Cliente não encontrado');
    }

    const [userCount, nutritionistCount, patientCount, appointmentCount] =
      await this.prisma.$transaction([
        this.prisma.userClinic.count({
          where: { tenantId: id, isActive: true },
        }),
        this.prisma.userClinic.count({
          where: this.nutritionistWhere({ tenantId: id }),
        }),
        this.prisma.patient.count({ where: { tenantId: id, deletedAt: null } }),
        this.prisma.appointment.count({
          where: { tenantId: id, deletedAt: null },
        }),
      ]);

    const plan = resolvePlanForTenant(tenant);

    return {
      ...this.toTenantListItem(tenant),
      plan: {
        code: plan.code,
        displayName: plan.displayName,
        maxUsers: plan.maxUsers,
        isInternal: plan.isInternal,
      },
      usage: {
        users: userCount,
        maxUsers: plan.maxUsers,
        nutritionists: nutritionistCount,
        patients: patientCount,
        appointments: appointmentCount,
      },
    };
  }

  /** Nunca inclui dado clínico — só identidade/status do vínculo (seção 16). */
  async listTenantUsers(tenantId: string) {
    await this.assertTenantExists(tenantId);

    const memberships = await this.prisma.userClinic.findMany({
      where: { tenantId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
            lastLoginAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((membership) => ({
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      role: membership.role,
      isActive: membership.isActive && membership.user.isActive,
      lastLoginAt: membership.user.lastLoginAt,
    }));
  }

  /** Cria o cliente e seu usuário proprietário (ADMIN do tenant) de forma transacional (seção 21). */
  async createTenant(actorUserId: string, dto: CreateTenantDto) {
    const plan = PLAN_CATALOG[dto.planCode];
    if (plan.isInternal || plan.tenantType !== dto.type) {
      throw new ConflictException(
        `O plano "${plan.displayName}" não é compatível com o tipo de cliente selecionado.`,
      );
    }
    await this.assertEmailAvailable(dto.email);
    const slug = await this.buildUniqueSlug(dto.name);
    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);
    const isTrial = dto.startAsTrial ?? false;
    const now = new Date();

    const { tenant, owner } = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.name,
          slug,
          email: dto.email.toLowerCase(),
          phone: dto.phone,
          type: dto.type,
          status: isTrial ? TenantStatus.TRIAL : TenantStatus.ACTIVE,
          planCode: dto.planCode,
          trialStartsAt: isTrial ? now : undefined,
          trialEndsAt: isTrial
            ? new Date(now.getTime() + TRIAL_DEFAULT_DAYS * 24 * 60 * 60 * 1000)
            : undefined,
          activatedAt: isTrial ? undefined : now,
        },
      });

      const owner = await tx.user.create({
        data: {
          name: dto.responsibleName,
          email: dto.email.toLowerCase(),
          passwordHash,
        },
      });

      await tx.userClinic.create({
        data: { userId: owner.id, tenantId: tenant.id, role: Role.ADMIN },
      });

      // Stub mínimo — o próprio cliente continua responsável por completar
      // (logo, cores, CRN etc.), conforme seção 22.
      await tx.professionalProfile.create({
        data: {
          tenantId: tenant.id,
          userId: owner.id,
          displayName: dto.responsibleName,
          professionalName: dto.responsibleName,
          email: dto.email.toLowerCase(),
        },
      });

      return { tenant, owner };
    });

    await this.audit.log({
      tenantId: tenant.id,
      actorUserId,
      entityType: 'Tenant',
      entityId: tenant.id,
      action: AuditAction.CREATE,
      after: this.toAuditJson(tenant),
      metadata: { type: dto.type },
    });

    return {
      tenant: await this.getTenantById(tenant.id),
      owner: {
        id: owner.id,
        name: owner.name,
        email: owner.email,
        // Provisória — devolvida uma única vez nesta resposta; não fica logada em lugar nenhum.
        temporaryPassword,
      },
    };
  }

  async updateTenant(
    tenantId: string,
    actorUserId: string,
    dto: UpdateTenantDto,
  ) {
    const before = await this.assertTenantExists(tenantId);

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: dto.name,
        email: dto.email?.toLowerCase(),
        phone: dto.phone,
      },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'Tenant',
      entityId: tenantId,
      action: AuditAction.UPDATE,
      before: this.toAuditJson(before),
      after: this.toAuditJson(updated),
    });

    return this.getTenantById(tenantId);
  }

  /**
   * Troca de plano (Missão 0005.7, seção 14). Nunca suspende/remove
   * usuário automaticamente — se a equipe atual não cabe no plano novo,
   * a troca é bloqueada até o próprio cliente reduzir a equipe.
   */
  async changeTenantPlan(
    tenantId: string,
    actorUserId: string,
    dto: ChangeTenantPlanDto,
  ) {
    const tenant = await this.assertTenantExists(tenantId);
    const currentPlan = resolvePlanForTenant(tenant);
    const newPlan = PLAN_CATALOG[dto.planCode];

    if (newPlan.tenantType !== tenant.type) {
      throw new ConflictException(
        `O plano "${newPlan.displayName}" não é compatível com o tipo deste cliente.`,
      );
    }

    const activeUsers = await this.prisma.userClinic.count({
      where: { tenantId, isActive: true },
    });
    if (activeUsers > newPlan.maxUsers) {
      throw new ConflictException(
        `Este cliente possui ${activeUsers} usuários ativos. O plano "${newPlan.displayName}" permite até ${newPlan.maxUsers}. Reduza a equipe antes de concluir a alteração.`,
      );
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { planCode: dto.planCode },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'Tenant',
      entityId: tenantId,
      action: AuditAction.UPDATE,
      before: { planCode: currentPlan.code },
      after: { planCode: newPlan.code },
      metadata: { changeType: 'PLAN_CHANGE' },
    });

    return this.getTenantById(tenantId);
  }

  /** Nunca apaga dados — só muda o status (seção 17). */
  async activateTenant(tenantId: string, actorUserId: string) {
    const before = await this.assertTenantExists(tenantId);

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: TenantStatus.ACTIVE, activatedAt: new Date() },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'Tenant',
      entityId: tenantId,
      action: AuditAction.STATUS_CHANGE,
      before: { status: before.status },
      after: { status: updated.status },
    });

    return this.getTenantById(tenantId);
  }

  /** Bloqueia login do tenant (ver JwtStrategy) — dados permanecem intactos. */
  async suspendTenant(tenantId: string, actorUserId: string) {
    const before = await this.assertTenantExists(tenantId);

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: TenantStatus.SUSPENDED, suspendedAt: new Date() },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'Tenant',
      entityId: tenantId,
      action: AuditAction.STATUS_CHANGE,
      before: { status: before.status },
      after: { status: updated.status },
    });

    return this.getTenantById(tenantId);
  }

  /**
   * Um nutricionista "real" da plataforma é: (a) qualquer UserClinic com
   * role NUTRITIONIST, ou (b) o ADMIN de um tenant SOLO — que, por
   * definição arquitetural, é a própria nutricionista exercendo a clínica
   * com um único usuário (seção 6 da auditoria). O @@unique([userId,
   * tenantId]) do UserClinic garante que uma linha só pode casar com um
   * dos dois ramos do OR, então a contagem nunca duplica a mesma pessoa
   * no mesmo tenant. Independe de ProfessionalProfile (identidade visual,
   * não vínculo funcional) — resolvido inteiramente com Role + TenantType
   * já existentes, sem migration nova.
   */
  private nutritionistWhere(
    extra?: Prisma.UserClinicWhereInput,
  ): Prisma.UserClinicWhereInput {
    return {
      isActive: true,
      user: { isActive: true, deletedAt: null },
      OR: [
        { role: Role.NUTRITIONIST },
        {
          role: Role.ADMIN,
          tenant: { type: TenantType.SOLO, deletedAt: null },
        },
      ],
      ...extra,
    };
  }

  private async assertTenantExists(tenantId: string): Promise<Tenant> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId, deletedAt: null },
    });
    if (!tenant) {
      throw new NotFoundException('Cliente não encontrado');
    }
    return tenant;
  }

  private async assertEmailAvailable(email: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Já existe um usuário com este e-mail');
    }
  }

  private async buildUniqueSlug(name: string): Promise<string> {
    // Faixa Unicode dos diacríticos combinantes (U+0300 a U+036F), montada a
    // partir dos code points para não depender de caractere literal no arquivo.
    const diacriticsStart = String.fromCharCode(0x0300);
    const diacriticsEnd = String.fromCharCode(0x036f);
    const DIACRITICS_PATTERN = new RegExp(
      `[${diacriticsStart}-${diacriticsEnd}]`,
      'g',
    );
    const base =
      name
        .toLowerCase()
        .normalize('NFD')
        .replace(DIACRITICS_PATTERN, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'cliente';

    let candidate = base;
    let suffix = 1;
    while (
      await this.prisma.tenant.findUnique({ where: { slug: candidate } })
    ) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
    return candidate;
  }

  private generateTemporaryPassword(): string {
    return crypto.randomBytes(9).toString('base64url');
  }

  private toTenantListItem(
    tenant: Tenant & {
      professionalProfile: { professionalName: string } | null;
      _count: { userClinics: number; patients: number };
    },
  ) {
    return {
      id: tenant.id,
      name: tenant.name,
      type: tenant.type,
      status: tenant.status,
      responsibleName: tenant.professionalProfile?.professionalName ?? null,
      email: tenant.email,
      phone: tenant.phone,
      planCode: tenant.planCode,
      trialEndsAt: tenant.trialEndsAt,
      userCount: tenant._count.userClinics,
      patientCount: tenant._count.patients,
      createdAt: tenant.createdAt,
    };
  }

  private toAuditJson(value: Record<string, unknown>): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
