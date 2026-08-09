import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AnyAuthenticatedUser } from '../../../common/types/auth-request';
import { TenantStatus } from '../../../generated/prisma/client';

interface TenantAccessTokenPayload {
  sub: string;
  scope: 'tenant';
  tenantId: string;
  userClinicId: string;
}

interface PlatformAccessTokenPayload {
  sub: string;
  scope: 'platform';
}

type AccessTokenPayload = TenantAccessTokenPayload | PlatformAccessTokenPayload;

/** Mensagem amigável — nunca stack trace — quando o tenant está suspenso/cancelado (Missão 0005.5). */
const TENANT_SUSPENDED_MESSAGE =
  'Seu acesso ao SmartNutri está temporariamente suspenso. Entre em contato com o suporte.';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET as string,
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AnyAuthenticatedUser> {
    if (payload.scope === 'platform') {
      return this.validatePlatformScope(payload);
    }
    return this.validateTenantScope(payload);
  }

  /** Platform Admin não passa por UserClinic — identidade global, sem tenant. */
  private async validatePlatformScope(
    payload: PlatformAccessTokenPayload,
  ): Promise<AnyAuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isPlatformAdmin || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Sessão inválida ou acesso revogado');
    }

    return { scope: 'platform', userId: user.id };
  }

  /**
   * Revalida o vínculo usuário↔clínica a cada request (não confia cegamente
   * no claim do JWT) para refletir imediatamente uma desativação de acesso.
   * Também revalida o status do tenant (Missão 0005.5): SUSPENDED/CANCELLED
   * derruba a sessão com mensagem amigável, nunca stack trace.
   */
  private async validateTenantScope(
    payload: TenantAccessTokenPayload,
  ): Promise<AnyAuthenticatedUser> {
    const userClinic = await this.prisma.userClinic.findUnique({
      where: { id: payload.userClinicId },
      include: { user: true, tenant: true },
    });

    if (
      !userClinic ||
      !userClinic.isActive ||
      !userClinic.user.isActive ||
      userClinic.user.deletedAt ||
      userClinic.userId !== payload.sub ||
      userClinic.tenantId !== payload.tenantId
    ) {
      throw new UnauthorizedException('Sessão inválida ou acesso revogado');
    }

    if (
      userClinic.tenant.status === TenantStatus.SUSPENDED ||
      userClinic.tenant.status === TenantStatus.CANCELLED
    ) {
      throw new UnauthorizedException(TENANT_SUSPENDED_MESSAGE);
    }

    return {
      scope: 'tenant',
      userId: userClinic.userId,
      tenantId: userClinic.tenantId,
      role: userClinic.role,
      userClinicId: userClinic.id,
    };
  }
}
