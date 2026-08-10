import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditAction, Prisma } from '../../generated/prisma/client';
import { UsersService } from '../users/users.service';
import { CreatePlatformUserDto } from './dto/create-platform-user.dto';
import { QueryPlatformUsersDto } from './dto/query-platform-users.dto';

const BCRYPT_ROUNDS = 12;

/**
 * Seleção explícita — nunca inclui passwordHash. Uma linha aqui representa
 * um vínculo usuário↔tenant (UserClinic), não só o User: é essa unidade
 * que carrega perfil/status dentro de um cliente específico, e é ela que
 * a Gestão de Usuários do Platform Admin lista/edita (Missão 0005.6).
 */
const USER_CLINIC_SELECT = {
  id: true,
  userId: true,
  tenantId: true,
  role: true,
  isActive: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      lastLoginAt: true,
    },
  },
  tenant: {
    select: { id: true, name: true, type: true, status: true },
  },
} satisfies Prisma.UserClinicSelect;

type UserClinicWithRelations = Prisma.UserClinicGetPayload<{
  select: typeof USER_CLINIC_SELECT;
}>;

@Injectable()
export class PlatformUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly usersService: UsersService,
  ) {}

  async listUsers(query: QueryPlatformUsersDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.UserClinicWhereInput = {};
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.role) where.role = query.role;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.tenantType || query.tenantStatus) {
      where.tenant = {
        ...(query.tenantType ? { type: query.tenantType } : {}),
        ...(query.tenantStatus ? { status: query.tenantStatus } : {}),
      };
    }
    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { tenant: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.userClinic.findMany({
        where,
        select: USER_CLINIC_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.userClinic.count({ where }),
    ]);

    return {
      data: items.map((item) => this.toListItem(item)),
      total,
      page,
      pageSize,
    };
  }

  async getUserById(userClinicId: string) {
    const membership = await this.findMembershipOrThrow(userClinicId);
    return this.toListItem(membership);
  }

  /**
   * Cria o vínculo reaproveitando UsersService.createForTenant — mesma
   * validação de e-mail duplicado, limite de plano e perfil permitido, sem
   * duplicar lógica. O próprio createForTenant já audita a criação (com
   * este actorUserId), então não registramos um segundo AuditLog aqui.
   */
  async createUser(actorUserId: string, dto: CreatePlatformUserDto) {
    const temporaryPassword = this.generateTemporaryPassword();

    await this.usersService.createForTenant(
      dto.tenantId,
      {
        name: dto.name,
        email: dto.email,
        role: dto.role,
        password: temporaryPassword,
      },
      actorUserId,
    );

    const membership = await this.prisma.userClinic.findFirstOrThrow({
      where: {
        tenantId: dto.tenantId,
        user: { email: dto.email.toLowerCase() },
      },
      orderBy: { createdAt: 'desc' },
      select: USER_CLINIC_SELECT,
    });

    return { user: this.toListItem(membership), temporaryPassword };
  }

  /**
   * Reset de senha de usuário de TENANT — deliberadamente separado do
   * comando exclusivo de Platform Admin (`scripts/manage-platform-admin.ts`,
   * que só opera sobre contas com isPlatformAdmin=true). Só passwordHash
   * muda; role/tenantId/isPlatformAdmin nunca são tocados aqui.
   */
  async resetPassword(actorUserId: string, userClinicId: string) {
    const membership = await this.findMembershipOrThrow(userClinicId);

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

    await this.prisma.user.update({
      where: { id: membership.userId },
      data: { passwordHash },
    });

    await this.audit.log({
      tenantId: membership.tenantId,
      actorUserId,
      entityType: 'User',
      entityId: membership.userId,
      action: AuditAction.UPDATE,
      metadata: { changeType: 'PASSWORD_RESET' },
    });

    return { temporaryPassword };
  }

  /** Suspende/reativa só este vínculo (UserClinic.isActive) — nunca o Tenant inteiro nem outros usuários dele. */
  async setActive(
    actorUserId: string,
    userClinicId: string,
    isActive: boolean,
  ) {
    const before = await this.findMembershipOrThrow(userClinicId);

    const updated = await this.prisma.userClinic.update({
      where: { id: userClinicId },
      data: { isActive },
      select: USER_CLINIC_SELECT,
    });

    await this.audit.log({
      tenantId: before.tenantId,
      actorUserId,
      entityType: 'User',
      entityId: before.userId,
      action: AuditAction.STATUS_CHANGE,
      before: { isActive: before.isActive },
      after: { isActive },
    });

    return this.toListItem(updated);
  }

  private async findMembershipOrThrow(
    userClinicId: string,
  ): Promise<UserClinicWithRelations> {
    const membership = await this.prisma.userClinic.findUnique({
      where: { id: userClinicId },
      select: USER_CLINIC_SELECT,
    });
    if (!membership) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return membership;
  }

  private generateTemporaryPassword(): string {
    return crypto.randomBytes(18).toString('base64url');
  }

  private toListItem(uc: UserClinicWithRelations) {
    return {
      id: uc.id,
      userId: uc.userId,
      name: uc.user.name,
      email: uc.user.email,
      role: uc.role,
      // Combina os dois flags que o JwtStrategy revalida a cada request —
      // reflete exatamente se este vínculo consegue autenticar agora.
      isActive: uc.isActive && uc.user.isActive,
      tenantId: uc.tenantId,
      tenantName: uc.tenant.name,
      tenantType: uc.tenant.type,
      tenantStatus: uc.tenant.status,
      createdAt: uc.createdAt,
      lastLoginAt: uc.user.lastLoginAt,
    };
  }
}
