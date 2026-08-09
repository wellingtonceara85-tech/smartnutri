import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../../generated/prisma/client';
import { AuthenticatedRequest } from '../types/auth-request';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Sem @Roles(...) na rota => qualquer usuário autenticado pode acessar.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Sessão platform-scoped nunca satisfaz @Roles(...) — são universos de
    // autorização separados (ver TenantGuard/PlatformAdminGuard). Na prática
    // TenantGuard já barra isso antes; esta checagem é só defensiva.
    if (
      !user ||
      user.scope !== 'tenant' ||
      !requiredRoles.includes(user.role)
    ) {
      throw new ForbiddenException(
        'Seu perfil não tem permissão para esta ação',
      );
    }

    return true;
  }
}
