import type { Request } from 'express';
import { Role } from '../../generated/prisma/client';

/** Payload decodificado do access token, anexado a `req.user` pelo JwtAuthGuard. */
export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  role: Role;
  userClinicId: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
