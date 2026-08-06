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
import { CreateEvolutionDto } from './dto/create-evolution.dto';
import { EvolutionsService } from './evolutions.service';

/**
 * Aninhado em /patients/:patientId/evolutions — RECEPTION nunca recebe
 * @Roles aqui, então o guard global de roles já barra o módulo inteiro
 * para esse perfil (blackout completo, decisão explícita da missão).
 */
@ApiTags('evolutions')
@ApiBearerAuth()
@Controller('patients/:patientId/evolutions')
@Roles(Role.ADMIN, Role.NUTRITIONIST)
export class PatientEvolutionsController {
  constructor(private readonly evolutionsService: EvolutionsService) {}

  @Get()
  list(
    @CurrentTenant() tenantId: string,
    @Param('patientId', ParseUUIDPipe) patientId: string,
  ) {
    return this.evolutionsService.list(tenantId, patientId);
  }

  @Post()
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: CreateEvolutionDto,
  ) {
    return this.evolutionsService.create(
      tenantId,
      user.userId,
      user.role,
      patientId,
      dto,
    );
  }
}
