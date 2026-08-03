import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedRequest } from '../types/auth-request';

/**
 * Garante que toda rota autenticada carregue um tenantId resolvido.
 * A revalidação pesada (UserClinic.isActive, vínculo user↔tenant) já
 * acontece em JwtStrategy.validate() a cada request; este guard é a
 * rede de segurança final antes do controller/service rodarem, e o
 * ponto de extensão futuro para troca de clínica (multi-tenant real).
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

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!user?.tenantId) {
      throw new UnauthorizedException(
        'Clínica não identificada para este usuário',
      );
    }

    return true;
  }
}
