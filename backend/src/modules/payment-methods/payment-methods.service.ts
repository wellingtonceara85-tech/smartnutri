import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class PaymentMethodsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Catálogo tenant-scoped (Missão 0005.8) — sem gestão via UI ainda, só seed; lista as ativas. */
  async list(tenantId: string) {
    return this.prisma.paymentMethod.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }
}
