import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role, TenantType } from '../../generated/prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listForTenant(tenantId: string) {
    return this.prisma.userClinic.findMany({
      where: { tenantId, isActive: true },
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

  async createForTenant(tenantId: string, dto: CreateUserDto) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId, deletedAt: null },
    });
    if (!tenant) {
      throw new NotFoundException('Cliente não encontrado');
    }
    await this.assertSoloTenantHasRoomForUser(tenant.id, tenant.type);

    const email = dto.email.toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      const existingMembership = await this.prisma.userClinic.findUnique({
        where: { userId_tenantId: { userId: existingUser.id, tenantId } },
      });
      if (existingMembership) {
        throw new ConflictException(
          'Este e-mail já está vinculado a esta clínica',
        );
      }

      return this.prisma.userClinic.create({
        data: { userId: existingUser.id, tenantId, role: dto.role },
        include: { user: true },
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

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

    return user;
  }

  async getForTenant(tenantId: string, userId: string) {
    const membership = await this.prisma.userClinic.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      include: { user: true },
    });

    if (!membership || !membership.isActive) {
      throw new NotFoundException('Usuário não encontrado nesta clínica');
    }

    return membership;
  }

  async updateForTenant(tenantId: string, userId: string, dto: UpdateUserDto) {
    await this.getForTenant(tenantId, userId);

    return this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name, phone: dto.phone },
    });
  }

  async updateRole(tenantId: string, userId: string, role: Role) {
    await this.getForTenant(tenantId, userId);

    return this.prisma.userClinic.update({
      where: { userId_tenantId: { userId, tenantId } },
      data: { role },
    });
  }

  async deactivateForTenant(tenantId: string, userId: string) {
    await this.getForTenant(tenantId, userId);

    return this.prisma.userClinic.update({
      where: { userId_tenantId: { userId, tenantId } },
      data: { isActive: false },
    });
  }

  /**
   * Tenant SOLO representa nutricionista independente — o modelo comercial
   * (Missão 0005.5) é exatamente um usuário fazendo tudo. Um segundo
   * UserClinic ativo descaracterizaria isso silenciosamente, então é
   * bloqueado aqui, na única porta de entrada de criação de usuário —
   * protege tanto `POST /users` (ADMIN do próprio tenant) quanto a criação
   * pelo Platform Admin (Missão 0005.6), que reaproveita este método.
   */
  private async assertSoloTenantHasRoomForUser(
    tenantId: string,
    tenantType: TenantType,
  ): Promise<void> {
    if (tenantType !== TenantType.SOLO) return;

    const activeCount = await this.prisma.userClinic.count({
      where: { tenantId, isActive: true },
    });
    if (activeCount >= 1) {
      throw new ConflictException(
        'Este cliente é do tipo "nutricionista independente" (SOLO) e já possui um usuário — o modelo permite apenas um.',
      );
    }
  }
}
