import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/types/auth-request';
import { Role } from '../../generated/prisma/client';
import { CreateTreatmentCycleDto } from './dto/create-treatment-cycle.dto';
import { TreatmentCyclesService } from './treatment-cycles.service';

@ApiTags('treatment-cycles')
@ApiBearerAuth()
@Controller('patients/:patientId/treatment-cycles')
export class PatientTreatmentCyclesController {
  constructor(
    private readonly treatmentCyclesService: TreatmentCyclesService,
  ) {}

  @Get()
  list(
    @CurrentTenant() tenantId: string,
    @Param('patientId', ParseUUIDPipe) patientId: string,
  ) {
    return this.treatmentCyclesService.listForPatient(tenantId, patientId);
  }

  @Post()
  @Roles(Role.ADMIN, Role.RECEPTION, Role.NUTRITIONIST)
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: CreateTreatmentCycleDto,
  ) {
    return this.treatmentCyclesService.create(
      tenantId,
      user.userId,
      patientId,
      dto,
    );
  }
}
