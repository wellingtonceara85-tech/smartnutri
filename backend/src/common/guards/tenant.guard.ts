import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { IS_PLATFORM_ROUTE_KEY } from '../decorators/platform-route.decorator';
import { AuthenticatedRequest } from '../types/auth-request';

/**
 * Garante que toda rota autenticada carregue um tenantId resolvido.
 * A revalidação pesada (UserClinic.isActive, vínculo user↔tenant) já
 * acontece em JwtStrategy.validate() a cada request; este guard é a
 * rede de segurança final antes do controller/service rodarem, e o
 * ponto de extensão futuro para troca de clínica (multi-tenant real).
 *
 * `@PlatformRoute()` (Missão 0005.5) isenta a rota dessa exigência — usado
 * só em `/auth/me` e nos controllers `/platform/*`, cuja autoridade global
 * (sem tenant) é verificada separadamente por PlatformAdminGuard. Nenhuma
 * rota clínica existente usa esse decorator, então o comportamento delas
 * é idêntico ao de antes desta missão.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const skipsTenantRequirement = this.reflector.getAllAndOverride<boolean>(
      IS_PLATFORM_ROUTE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skipsTenantRequirement) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (user?.scope !== 'tenant' || !user.tenantId) {
      throw new UnauthorizedException(
        'Clínica não identificada para este usuário',
      );
    }

    return true;
  }
}
