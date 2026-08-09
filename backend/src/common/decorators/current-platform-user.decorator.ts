import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import {
  AuthenticatedRequest,
  PlatformAuthenticatedUser,
} from '../types/auth-request';

/**
 * Para uso exclusivo nos controllers `/platform/*`. O cast é seguro porque
 * essas rotas exigem PlatformAdminGuard, que já rejeita qualquer sessão
 * tenant-scoped antes de chegar aqui.
 */
export const CurrentPlatformUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PlatformAuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user as PlatformAuthenticatedUser;
  },
);
