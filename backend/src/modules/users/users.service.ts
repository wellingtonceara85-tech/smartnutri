import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role } from '../../generated/prisma/client';
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
}
