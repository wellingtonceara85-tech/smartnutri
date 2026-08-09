import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import type { StringValue } from 'ms';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantStatus } from '../../generated/prisma/client';

interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  tokenId: string;
}

export interface TenantUserSummary {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId: string;
  tenantName: string;
  isPlatformAdmin: false;
}

export interface PlatformUserSummary {
  id: string;
  name: string;
  email: string;
  isPlatformAdmin: true;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  user: TenantUserSummary | PlatformUserSummary;
}

interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

const REFRESH_TOKEN_BYTES = 48;

/** Mensagem amigável — nunca stack trace — quando o tenant está suspenso/cancelado (Missão 0005.5). */
const TENANT_SUSPENDED_MESSAGE =
  'Seu acesso ao SmartNutri está temporariamente suspenso. Entre em contato com o suporte.';

function parseDurationToMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) {
    throw new Error(`Formato de duração inválido: ${duration}`);
  }
  const value = Number(match[1]);
  const unit = match[2];
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit]!;
  return value * unitMs;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(
    email: string,
    password: string,
    meta: RequestMeta,
  ): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        userClinics: {
          where: { isActive: true },
          include: { tenant: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    if (user.isPlatformAdmin) {
      const tokens = await this.issueTokenPair(user.id, meta);
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          isPlatformAdmin: true,
        },
      };
    }

    const membership = user.userClinics[0];
    if (!membership) {
      throw new UnauthorizedException(
        'Usuário sem vínculo ativo com nenhuma clínica',
      );
    }
    this.assertTenantOperational(membership.tenant.status);

    const tokens = await this.issueTokenPair(user.id, meta, {
      tenantId: membership.tenantId,
      userClinicId: membership.id,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: membership.role,
        tenantId: membership.tenantId,
        tenantName: membership.tenant.name,
        isPlatformAdmin: false,
      },
    };
  }

  async refresh(
    refreshTokenCookie: string,
    meta: RequestMeta,
  ): Promise<TokenPair> {
    const [tokenId, secret] = refreshTokenCookie.split('.');
    if (!tokenId || !secret) {
      throw new UnauthorizedException('Sessão inválida');
    }

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { id: tokenId },
      include: {
        user: {
          include: {
            userClinics: {
              where: { isActive: true },
              include: { tenant: true },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    if (!storedToken || storedToken.tokenHash !== hashToken(secret)) {
      throw new UnauthorizedException('Sessão inválida');
    }

    if (storedToken.revokedAt) {
      // Reuso de token já rotacionado/revogado => possível token roubado: revoga toda a sessão do usuário.
      await this.prisma.refreshToken.updateMany({
        where: { userId: storedToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException(
        'Sessão inválida — todas as sessões foram encerradas por segurança',
      );
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Sessão expirada');
    }

    const user = storedToken.user;
    if (!user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Acesso revogado');
    }

    let tokens: IssuedTokens;
    let responseUser: TenantUserSummary | PlatformUserSummary;

    if (user.isPlatformAdmin) {
      tokens = await this.issueTokenPair(user.id, meta);
      responseUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        isPlatformAdmin: true,
      };
    } else {
      const membership = user.userClinics[0];
      if (!membership) {
        throw new UnauthorizedException('Acesso revogado');
      }
      this.assertTenantOperational(membership.tenant.status);

      tokens = await this.issueTokenPair(user.id, meta, {
        tenantId: membership.tenantId,
        userClinicId: membership.id,
      });
      responseUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: membership.role,
        tenantId: membership.tenantId,
        tenantName: membership.tenant.name,
        isPlatformAdmin: false,
      };
    }

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date(), replacedByTokenId: tokens.tokenId },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      user: responseUser,
    };
  }

  async logout(refreshTokenCookie: string | undefined): Promise<void> {
    if (!refreshTokenCookie) return;
    const [tokenId] = refreshTokenCookie.split('.');
    if (!tokenId) return;

    await this.prisma.refreshToken.updateMany({
      where: { id: tokenId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isPlatformAdmin: true,
        userClinics: {
          where: { isActive: true },
          select: {
            id: true,
            role: true,
            tenant: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }

  /** Sem stack trace — mensagem amigável para o usuário final (Missão 0005.5). */
  private assertTenantOperational(status: TenantStatus): void {
    if (
      status === TenantStatus.SUSPENDED ||
      status === TenantStatus.CANCELLED
    ) {
      throw new UnauthorizedException(TENANT_SUSPENDED_MESSAGE);
    }
  }

  /**
   * Emite o par de tokens. Sem `tenantContext`, o access token é
   * platform-scoped (`scope: 'platform'`, sem tenantId/userClinicId) — só
   * usado para `User.isPlatformAdmin === true`. Com `tenantContext`, mantém
   * o formato tenant-scoped de sempre.
   */
  private async issueTokenPair(
    userId: string,
    meta: RequestMeta,
    tenantContext?: { tenantId: string; userClinicId: string },
  ): Promise<IssuedTokens> {
    const payload = tenantContext
      ? {
          sub: userId,
          scope: 'tenant' as const,
          tenantId: tenantContext.tenantId,
          userClinicId: tenantContext.userClinicId,
        }
      : { sub: userId, scope: 'platform' as const };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ?? '15m') as StringValue,
    });

    const refreshSecret = crypto
      .randomBytes(REFRESH_TOKEN_BYTES)
      .toString('hex');
    const refreshExpiresInMs = parseDurationToMs(
      process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
    );
    const expiresAt = new Date(Date.now() + refreshExpiresInMs);

    const tokenRow = await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(refreshSecret),
        expiresAt,
        createdByIp: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    return {
      accessToken,
      refreshToken: `${tokenRow.id}.${refreshSecret}`,
      refreshTokenExpiresAt: expiresAt,
      tokenId: tokenRow.id,
    };
  }
}
