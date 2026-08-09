import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest, AuthenticatedUser } from '../types/auth-request';

/**
 * Extrai o tenantId do usuário autenticado — todo service tenant-scoped
 * recebe isso como 1º argumento. Nunca usado em controllers `/platform/*`
 * (TenantGuard já rejeita sessão platform-scoped antes de chegar aqui).
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return (request.user as AuthenticatedUser).tenantId;
  },
);
