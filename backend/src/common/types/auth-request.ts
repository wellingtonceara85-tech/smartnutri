import type { Request } from 'express';
import { Role } from '../../generated/prisma/client';

/**
 * Payload decodificado do access token, anexado a `req.user` pelo
 * JwtAuthGuard — sessão tenant-scoped (todo controller clínico existente).
 * `scope: 'tenant'` é o discriminante da união com `PlatformAuthenticatedUser`.
 */
export interface AuthenticatedUser {
  scope: 'tenant';
  userId: string;
  tenantId: string;
  role: Role;
  userClinicId: string;
}

/**
 * Sessão platform-scoped (Missão 0005.5) — autoridade global do SaaS, sem
 * nenhum tenant associado. Só alcança rotas marcadas com `@PlatformRoute()`;
 * em qualquer outra rota o TenantGuard rejeita antes do controller rodar,
 * então este tipo nunca aparece nos ~20 controllers clínicos existentes.
 */
export interface PlatformAuthenticatedUser {
  scope: 'platform';
  userId: string;
}

export type AnyAuthenticatedUser =
  AuthenticatedUser | PlatformAuthenticatedUser;

export interface AuthenticatedRequest extends Request {
  user: AnyAuthenticatedUser;
}
