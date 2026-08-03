import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../generated/prisma/client';
import { ClinicsService } from './clinics.service';
import { UpdateClinicDto } from './dto/update-clinic.dto';

@ApiTags('clinics')
@ApiBearerAuth()
@Controller('clinics')
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  @Get('me')
  getOwn(@CurrentTenant() tenantId: string) {
    return this.clinicsService.getOwn(tenantId);
  }

  @Patch('me')
  @Roles(Role.ADMIN)
  updateOwn(@CurrentTenant() tenantId: string, @Body() dto: UpdateClinicDto) {
    return this.clinicsService.updateOwn(tenantId, dto);
  }
}
