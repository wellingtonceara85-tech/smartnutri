import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest, AuthenticatedUser } from '../types/auth-request';

/**
 * Para uso nos controllers clínicos (tenant-scoped) de sempre — nunca nos
 * controllers `/platform/*`. O cast é seguro porque TenantGuard já rejeitou
 * qualquer sessão platform-scoped antes de chegar aqui, exceto em rotas
 * marcadas `@PlatformRoute()`, que devem usar `CurrentPlatformUser()`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user as AuthenticatedUser;
  },
);
