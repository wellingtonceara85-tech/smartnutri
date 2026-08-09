import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../types/auth-request';

/**
 * Autoridade real dos controllers `/platform/*` (Missão 0005.5). Aplicado
 * explicitamente via `@UseGuards(PlatformAdminGuard)` em cada controller —
 * nunca global — para manter a superfície de rotas administrativas
 * pequena e auditável. Rejeita qualquer sessão que não seja
 * `scope === 'platform'`, inclusive ADMIN de tenant: não existe
 * `if (role === ADMIN) bypass`, a autoridade de plataforma é um claim
 * totalmente separado do RBAC de tenant.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (user?.scope !== 'platform') {
      throw new ForbiddenException(
        'Esta área é exclusiva da administração da plataforma',
      );
    }

    return true;
  }
}
