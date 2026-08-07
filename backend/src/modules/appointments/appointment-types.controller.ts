import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

@ApiTags('appointment-types')
@ApiBearerAuth()
@Controller('appointment-types')
export class AppointmentTypesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@CurrentTenant() tenantId: string) {
    return this.prisma.appointmentType.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }
}
