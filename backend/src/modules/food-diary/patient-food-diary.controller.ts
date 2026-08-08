import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/types/auth-request';
import { FoodDiaryStatus, Role } from '../../generated/prisma/client';
import { CreateFoodDiaryEntryDto } from './dto/create-food-diary-entry.dto';
import { FoodDiaryService } from './food-diary.service';

/**
 * Aninhado em /patients/:patientId/food-diary — RECEPTION nunca recebe
 * @Roles aqui, então o guard global de roles já barra o módulo inteiro
 * (fotos, comentários, feedback e registro ficam totalmente inacessíveis).
 */
@ApiTags('food-diary')
@ApiBearerAuth()
@Controller('patients/:patientId/food-diary')
@Roles(Role.ADMIN, Role.NUTRITIONIST)
export class PatientFoodDiaryController {
  constructor(private readonly foodDiaryService: FoodDiaryService) {}

  @Get()
  list(
    @CurrentTenant() tenantId: string,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query('status') status?: FoodDiaryStatus,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.foodDiaryService.list(tenantId, patientId, { status, dateFrom, dateTo });
  }

  @Post()
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: CreateFoodDiaryEntryDto,
  ) {
    return this.foodDiaryService.create(tenantId, user.userId, patientId, dto);
  }
}
