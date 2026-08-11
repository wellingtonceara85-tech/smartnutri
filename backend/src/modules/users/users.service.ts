import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuditService } from '../../common/audit/audit.service';
import {
  resolvePlanForTenant,
  type PlanDefinition,
} from '../../common/plans/plan-catalog';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  AuditAction,
  Prisma,
  Role,
  Tenant,
} from '../../generated/prisma/client';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const BCRYPT_ROUNDS = 12;

/** Nunca inclui passwordHash — toda leitura/retorno de User neste serviço passa por aqui. */
const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Lista TODA a equipe (ativa e suspensa) — uma tela de gestão precisa enxergar quem está suspenso para poder reativar. */
  async listForTenant(tenantId: string) {
    return this.prisma.userClinic.findMany({
      where: { tenantId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            isActive: true,
            lastLoginAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Lista enxuta de nutricionistas ativos do tenant — acessível a
   * qualquer perfil autenticado, para popular o seletor de "nutricionista
   * responsável" no cadastro de pacientes.
   */
  async listNutritionistsForTenant(tenantId: string) {
    const memberships = await this.prisma.userClinic.findMany({
      where: { tenantId, isActive: true, role: Role.NUTRITIONIST },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: 'asc' } },
    });

    return memberships.map((m) => ({ id: m.user.id, name: m.user.name }));
  }

  /** Uso do plano do tenant — usado tanto pela tela "Equipe e Acessos" quanto pelo detalhe do cliente no Platform Admin. */
  async getUsage(tenantId: string) {
    const tenant = await this.requireTenant(tenantId);
    const plan = resolvePlanForTenant(tenant);
    const usedUsers = await this.prisma.userClinic.count({
      where: { tenantId, isActive: true },
    });

    return {
      planCode: plan.code,
      planDisplayName: plan.displayName,
      maxUsers: plan.maxUsers,
      usedUsers,
      allowedRoles: plan.allowedRoles,
    };
  }

  async createForTenant(
    tenantId: string,
    dto: CreateUserDto,
    actorUserId?: string,
  ) {
    const tenant = await this.requireTenant(tenantId);
    const plan = this.assertRoleAllowedByPlan(tenant, dto.role);
    await this.assertSeatAvailable(tenant, plan);

    const email = dto.email.toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    let membership: Prisma.UserClinicGetPayload<{
      include: { user: { select: typeof SAFE_USER_SELECT } };
    }>;
    // Só preenchido quando a senha foi gerada por nós — nunca reexibimos uma senha que o chamador escolheu.
    let temporaryPassword: string | undefined;

    if (existingUser) {
      const existingMembership = await this.prisma.userClinic.findUnique({
        where: { userId_tenantId: { userId: existingUser.id, tenantId } },
      });
      if (existingMembership) {
        throw new ConflictException(
          'Este e-mail já está vinculado a esta clínica',
        );
      }

      membership = await this.prisma.userClinic.create({
        data: { userId: existingUser.id, tenantId, role: dto.role },
        include: { user: { select: SAFE_USER_SELECT } },
      });
    } else {
      // Sem senha informada (fluxo normal de "Adicionar usuário"): gera uma e devolve uma única vez.
      const usedPassword =
        dto.password ?? crypto.randomBytes(18).toString('base64url');
      if (!dto.password) temporaryPassword = usedPassword;

      const passwordHash = await bcrypt.hash(usedPassword, BCRYPT_ROUNDS);

      const user = await this.prisma.user.create({
        data: {
          name: dto.name,
          email,
          phone: dto.phone,
          passwordHash,
          userClinics: { create: { tenantId, role: dto.role } },
        },
        include: { userClinics: true },
      });
      membership = await this.prisma.userClinic.findUniqueOrThrow({
        where: { userId_tenantId: { userId: user.id, tenantId } },
        include: { user: { select: SAFE_USER_SELECT } },
      });
    }

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'User',
      entityId: membership.userId,
      action: AuditAction.CREATE,
      after: { email, role: dto.role },
    });

    return { ...membership, temporaryPassword };
  }

  async getForTenant(tenantId: string, userId: string) {
    const membership = await this.prisma.userClinic.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      include: { user: { select: SAFE_USER_SELECT } },
    });

    if (!membership) {
      throw new NotFoundException('Usuário não encontrado nesta clínica');
    }

    return membership;
  }

  async updateForTenant(tenantId: string, userId: string, dto: UpdateUserDto) {
    await this.getForTenant(tenantId, userId);

    return this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name, phone: dto.phone },
      select: SAFE_USER_SELECT,
    });
  }

  async updateRole(
    tenantId: string,
    userId: string,
    role: Role,
    actorUserId?: string,
  ) {
    const current = await this.getForTenant(tenantId, userId);
    const tenant = await this.requireTenant(tenantId);
    this.assertRoleAllowedByPlan(tenant, role);

    if (
      current.role === Role.ADMIN &&
      role !== Role.ADMIN &&
      current.isActive
    ) {
      await this.assertNotLastActiveAdmin(tenantId);
    }

    const updated = await this.prisma.userClinic.update({
      where: { userId_tenantId: { userId, tenantId } },
      data: { role },
      include: { user: { select: SAFE_USER_SELECT } },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'User',
      entityId: userId,
      action: AuditAction.UPDATE,
      before: { role: current.role },
      after: { role },
      metadata: { changeType: 'ROLE_CHANGE' },
    });

    return updated;
  }

  async deactivateForTenant(
    tenantId: string,
    userId: string,
    actorUserId?: string,
  ) {
    const membership = await this.getForTenant(tenantId, userId);
    if (membership.role === Role.ADMIN && membership.isActive) {
      await this.assertNotLastActiveAdmin(tenantId);
    }

    const updated = await this.prisma.userClinic.update({
      where: { userId_tenantId: { userId, tenantId } },
      data: { isActive: false },
      include: { user: { select: SAFE_USER_SELECT } },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'User',
      entityId: userId,
      action: AuditAction.STATUS_CHANGE,
      before: { isActive: membership.isActive },
      after: { isActive: false },
    });

    return updated;
  }

  async activateForTenant(
    tenantId: string,
    userId: string,
    actorUserId?: string,
  ) {
    const membership = await this.getForTenant(tenantId, userId);
    const tenant = await this.requireTenant(tenantId);
    const plan = resolvePlanForTenant(tenant);
    await this.assertSeatAvailable(tenant, plan);

    const updated = await this.prisma.userClinic.update({
      where: { userId_tenantId: { userId, tenantId } },
      data: { isActive: true },
      include: { user: { select: SAFE_USER_SELECT } },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'User',
      entityId: userId,
      action: AuditAction.STATUS_CHANGE,
      before: { isActive: membership.isActive },
      after: { isActive: true },
    });

    return updated;
  }

  async resetPasswordForTenant(
    tenantId: string,
    userId: string,
    actorUserId?: string,
  ): Promise<string> {
    await this.getForTenant(tenantId, userId);

    const temporaryPassword = crypto.randomBytes(18).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      entityType: 'User',
      entityId: userId,
      action: AuditAction.UPDATE,
      metadata: { changeType: 'PASSWORD_RESET' },
    });

    return temporaryPassword;
  }

  /**
   * Autosserviço: o próprio usuário troca a senha (Missão 0006.4), sempre exigindo a senha
   * atual — nunca acessível para outro usuário, mesmo ADMIN (isso continua sendo o
   * reset-password acima, que gera uma senha nova em vez de exigir a antiga).
   */
  async changeOwnPassword(
    tenantId: string,
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<void> {
    await this.getForTenant(tenantId, userId);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const currentPasswordMatches = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!currentPasswordMatches) {
      throw new UnauthorizedException('Senha atual incorreta');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.audit.log({
      tenantId,
      actorUserId: userId,
      entityType: 'User',
      entityId: userId,
      action: AuditAction.UPDATE,
      metadata: { changeType: 'PASSWORD_CHANGE_SELF' },
    });
  }

  private async requireTenant(tenantId: string): Promise<Tenant> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId, deletedAt: null },
    });
    if (!tenant) {
      throw new NotFoundException('Cliente não encontrado');
    }
    return tenant;
  }

  /** Perfil precisa estar entre os permitidos pelo plano contratado — fonte única (Missão 0005.7). */
  private assertRoleAllowedByPlan(tenant: Tenant, role: Role): PlanDefinition {
    const plan = resolvePlanForTenant(tenant);
    if (!plan.allowedRoles.includes(role)) {
      throw new ConflictException(
        `O plano "${plan.displayName}" não permite o perfil selecionado.`,
      );
    }
    return plan;
  }

  /**
   * Licença = UserClinic ATIVO (seção 9 da missão). Suspender libera vaga
   * de propósito — é o mecanismo normal para "alguém saiu, vou contratar
   * outra pessoa", não uma brecha: nunca há mais gente com sessão válida
   * simultânea do que o plano permite, que é a garantia que realmente
   * importa para um modelo de licenciamento por assento.
   */
  private async assertSeatAvailable(
    tenant: Tenant,
    plan: PlanDefinition,
  ): Promise<void> {
    const activeCount = await this.prisma.userClinic.count({
      where: { tenantId: tenant.id, isActive: true },
    });
    if (activeCount >= plan.maxUsers) {
      throw new ConflictException(
        `Seu plano permite até ${plan.maxUsers} usuário${plan.maxUsers === 1 ? '' : 's'}. Para adicionar outro membro à equipe, será necessário alterar o plano.`,
      );
    }
  }

  /**
   * Evita o tenant ficar sem administrador ativo (seção 11) — aplicado só
   * às rotas de autosserviço do próprio tenant. O Platform Admin (ação
   * excepcional/suporte) não passa por aqui de propósito: continua podendo
   * suspender mesmo o único ADMIN num incidente de segurança, e sempre
   * pode criar um novo usuário para o cliente em seguida.
   */
  private async assertNotLastActiveAdmin(tenantId: string): Promise<void> {
    const activeAdminCount = await this.prisma.userClinic.count({
      where: { tenantId, role: Role.ADMIN, isActive: true },
    });
    if (activeAdminCount <= 1) {
      throw new ConflictException(
        'Não é possível remover o único administrador ativo deste cliente. Promova outro usuário a Administrador antes.',
      );
    }
  }
}
