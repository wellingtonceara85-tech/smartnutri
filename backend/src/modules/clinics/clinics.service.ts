import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdateClinicDto } from './dto/update-clinic.dto';

@Injectable()
export class ClinicsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOwn(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Clínica não encontrada');
    }
    return tenant;
  }

  async updateOwn(tenantId: string, dto: UpdateClinicDto) {
    await this.getOwn(tenantId);
    return this.prisma.tenant.update({ where: { id: tenantId }, data: dto });
  }
}
