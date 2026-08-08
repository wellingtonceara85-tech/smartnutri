import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/types/auth-request';
import { Role } from '../../generated/prisma/client';
import { ShareMealPlanDto } from './dto/share-meal-plan.dto';
import { UpdateMealPlanDto } from './dto/update-meal-plan.dto';
import { MealPlansService } from './meal-plans.service';

/** RECEPTION nunca recebe @Roles aqui — blackout completo do módulo clínico. */
@ApiTags('meal-plans')
@ApiBearerAuth()
@Controller('meal-plans')
@Roles(Role.ADMIN, Role.NUTRITIONIST)
export class MealPlansController {
  constructor(private readonly mealPlansService: MealPlansService) {}

  @Get(':id')
  getById(@CurrentTenant() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.mealPlansService.getById(tenantId, id);
  }

  @Patch(':id')
  update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMealPlanDto,
  ) {
    return this.mealPlansService.update(tenantId, user.userId, id, dto);
  }

  @Delete(':id')
  archive(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.mealPlansService.archive(tenantId, user.userId, id);
  }

  @Patch(':id/share')
  share(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ShareMealPlanDto,
  ) {
    return this.mealPlansService.share(tenantId, user.userId, id, dto);
  }

  @Post(':id/activate')
  activate(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.mealPlansService.activate(tenantId, user.userId, id);
  }

  @Post(':id/complete')
  complete(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.mealPlansService.complete(tenantId, user.userId, id);
  }

  @Post(':id/duplicate')
  duplicate(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.mealPlansService.duplicate(tenantId, user.userId, id);
  }

  @Post(':id/new-version')
  createNewVersion(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.mealPlansService.createNewVersion(tenantId, user.userId, id);
  }
}
