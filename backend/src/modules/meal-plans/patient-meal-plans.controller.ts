import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/types/auth-request';
import { Role } from '../../generated/prisma/client';
import { CreateMealPlanDto } from './dto/create-meal-plan.dto';
import { MealPlansService } from './meal-plans.service';

/**
 * Aninhado em /patients/:patientId/meal-plans — RECEPTION nunca recebe
 * @Roles aqui, então o guard global de roles já barra o módulo inteiro
 * para esse perfil (blackout completo, decisão explícita da missão).
 */
@ApiTags('meal-plans')
@ApiBearerAuth()
@Controller('patients/:patientId/meal-plans')
@Roles(Role.ADMIN, Role.NUTRITIONIST)
export class PatientMealPlansController {
  constructor(private readonly mealPlansService: MealPlansService) {}

  @Get()
  list(
    @CurrentTenant() tenantId: string,
    @Param('patientId', ParseUUIDPipe) patientId: string,
  ) {
    return this.mealPlansService.list(tenantId, patientId);
  }

  @Post()
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: CreateMealPlanDto,
  ) {
    return this.mealPlansService.create(tenantId, user.userId, user.role, patientId, dto);
  }
}
