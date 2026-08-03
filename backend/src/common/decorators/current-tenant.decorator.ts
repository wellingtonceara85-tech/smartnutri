import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest } from '../types/auth-request';

/** Extrai o tenantId do usuário autenticado — todo service tenant-scoped recebe isso como 1º argumento. */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user.tenantId;
  },
);
