import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/types/auth-request';
import { Role } from '../../generated/prisma/client';
import { CreatePatientDto } from './dto/create-patient.dto';
import { QueryPatientsDto } from './dto/query-patients.dto';
import { UpdatePatientStatusDto } from './dto/update-patient-status.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PatientsService } from './patients.service';

@ApiTags('patients')
@ApiBearerAuth()
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  list(@CurrentTenant() tenantId: string, @Query() query: QueryPatientsDto) {
    return this.patientsService.list(tenantId, query);
  }

  @Get(':id')
  getById(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.patientsService.getById(tenantId, id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.NUTRITIONIST, Role.RECEPTION)
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePatientDto,
  ) {
    return this.patientsService.create(tenantId, user.userId, dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.NUTRITIONIST, Role.RECEPTION)
  update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePatientDto,
  ) {
    return this.patientsService.update(tenantId, user.userId, id, dto);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.RECEPTION)
  updateStatus(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePatientStatusDto,
  ) {
    return this.patientsService.updateStatus(tenantId, user.userId, id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  archive(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.patientsService.archive(tenantId, user.userId, id);
  }
}
