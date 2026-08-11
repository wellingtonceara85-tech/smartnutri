import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/types/auth-request';
import { Role } from '../../generated/prisma/client';
import { QueryTreatmentCyclesDto } from './dto/query-treatment-cycles.dto';
import { UpdateTreatmentCycleFinancialsDto } from './dto/update-treatment-cycle-financials.dto';
import { UpdateTreatmentCycleStatusDto } from './dto/update-treatment-cycle-status.dto';
import { UpdateTreatmentCycleDto } from './dto/update-treatment-cycle.dto';
import { TreatmentCyclesService } from './treatment-cycles.service';

/**
 * Sem @Roles de classe: qualquer papel autenticado pode ler um ciclo (a
 * mesma leitura usada na aba "Ciclos e planos" do paciente). Contratar
 * (patient-treatment-cycles.controller) e corrigir valores financeiros
 * (:id/financials) são abertos a ADMIN/RECEPTION/NUTRITIONIST (Missão
 * 0005.8, ajuste final, seções 1 e 4). Editar campos não-financeiros
 * (:id) e mudar status (:id/status) continuam ADMIN/RECEPTION — não
 * pedido para mudar nesta rodada.
 */
@ApiTags('treatment-cycles')
@ApiBearerAuth()
@Controller('treatment-cycles')
export class TreatmentCyclesController {
  constructor(
    private readonly treatmentCyclesService: TreatmentCyclesService,
  ) {}

  @Get()
  listAll(
    @CurrentTenant() tenantId: string,
    @Query() query: QueryTreatmentCyclesDto,
  ) {
    return this.treatmentCyclesService.listAll(tenantId, query);
  }

  @Get(':id')
  getById(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.treatmentCyclesService.getById(tenantId, id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.RECEPTION)
  update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTreatmentCycleDto,
  ) {
    return this.treatmentCyclesService.update(tenantId, user.userId, id, dto);
  }

  @Patch(':id/financials')
  @Roles(Role.ADMIN, Role.RECEPTION, Role.NUTRITIONIST)
  updateFinancials(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTreatmentCycleFinancialsDto,
  ) {
    return this.treatmentCyclesService.updateFinancials(
      tenantId,
      user.userId,
      id,
      dto,
    );
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.RECEPTION)
  updateStatus(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTreatmentCycleStatusDto,
  ) {
    return this.treatmentCyclesService.updateStatus(
      tenantId,
      user.userId,
      id,
      dto,
    );
  }
}
