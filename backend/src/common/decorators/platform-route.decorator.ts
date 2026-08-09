import { SetMetadata } from '@nestjs/common';

export const IS_PLATFORM_ROUTE_KEY = 'isPlatformRoute';

/**
 * Marca uma rota como isenta da exigência de tenant no TenantGuard —
 * necessário para os controllers `/platform/*` (autoridade global, sem
 * tenant) e para `/auth/me` (respondido tanto por sessão tenant-scoped
 * quanto platform-scoped). Nunca aplicar em rotas clínicas: isso não
 * concede acesso por si só, só permite passar pelo TenantGuard — a
 * autorização de fato continua em @Roles()/PlatformAdminGuard.
 */
export const PlatformRoute = () => SetMetadata(IS_PLATFORM_ROUTE_KEY, true);
