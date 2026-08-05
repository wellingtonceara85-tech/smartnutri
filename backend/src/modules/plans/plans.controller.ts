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
import { CreatePlanDto } from './dto/create-plan.dto';
import { QueryPlansDto } from './dto/query-plans.dto';
import { UpdatePlanStatusDto } from './dto/update-plan-status.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PlansService } from './plans.service';

@ApiTags('plans')
@ApiBearerAuth()
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  list(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryPlansDto,
  ) {
    return this.plansService.list(tenantId, query, user.role);
  }

  @Get(':id')
  getById(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.plansService.getById(tenantId, id, user.role);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePlanDto,
  ) {
    return this.plansService.create(tenantId, user.userId, dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.plansService.update(tenantId, user.userId, id, dto);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN)
  updateStatus(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanStatusDto,
  ) {
    return this.plansService.updateStatus(tenantId, user.userId, id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  archive(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.plansService.archive(tenantId, user.userId, id);
  }
}
