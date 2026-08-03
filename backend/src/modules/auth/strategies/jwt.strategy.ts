import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuthenticatedUser } from '../../../common/types/auth-request';

interface AccessTokenPayload {
  sub: string;
  tenantId: string;
  userClinicId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET as string,
    });
  }

  /**
   * Revalida o vínculo usuário↔clínica a cada request (não confia cegamente
   * no claim do JWT) para refletir imediatamente uma desativação de acesso.
   */
  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const userClinic = await this.prisma.userClinic.findUnique({
      where: { id: payload.userClinicId },
      include: { user: true },
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

    return {
      userId: userClinic.userId,
      tenantId: userClinic.tenantId,
      role: userClinic.role,
      userClinicId: userClinic.id,
    };
  }
}
