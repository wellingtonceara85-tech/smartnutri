import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, Prisma } from '../../generated/prisma/client';

interface LogEntryParams {
  tenantId: string;
  actorUserId?: string | null;
  entityType: string;
  entityId: string;
  action: AuditAction;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  metadata?: Prisma.InputJsonValue | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: LogEntryParams): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId: params.tenantId,
        actorUserId: params.actorUserId ?? null,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        beforeJson: params.before ?? Prisma.JsonNull,
        afterJson: params.after ?? Prisma.JsonNull,
        metadata: params.metadata ?? Prisma.JsonNull,
      },
    });
  }
}
