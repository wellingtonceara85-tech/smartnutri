import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPlatformUser } from '../../common/decorators/current-platform-user.decorator';
import { PlatformRoute } from '../../common/decorators/platform-route.decorator';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import type { PlatformAuthenticatedUser } from '../../common/types/auth-request';
import { ChangeTenantPlanDto } from './dto/change-tenant-plan.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { QueryPlatformTenantsDto } from './dto/query-platform-tenants.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { PlatformService } from './platform.service';

/** Autoridade real é PlatformAdminGuard, aplicado explicitamente aqui — nunca global. */
@ApiTags('platform')
@ApiBearerAuth()
@Controller('platform/tenants')
@PlatformRoute()
@UseGuards(PlatformAdminGuard)
export class PlatformTenantsController {
  constructor(private readonly platformService: PlatformService) {}

  @Get()
  list(@Query() query: QueryPlatformTenantsDto) {
    return this.platformService.listTenants(query);
  }

  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.platformService.getTenantById(id);
  }

  @Get(':id/users')
  listUsers(@Param('id', ParseUUIDPipe) id: string) {
    return this.platformService.listTenantUsers(id);
  }

  @Post()
  create(
    @CurrentPlatformUser() admin: PlatformAuthenticatedUser,
    @Body() dto: CreateTenantDto,
  ) {
    return this.platformService.createTenant(admin.userId, dto);
  }

  @Patch(':id')
  update(
    @CurrentPlatformUser() admin: PlatformAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.platformService.updateTenant(id, admin.userId, dto);
  }

  @Patch(':id/plan')
  changePlan(
    @CurrentPlatformUser() admin: PlatformAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeTenantPlanDto,
  ) {
    return this.platformService.changeTenantPlan(id, admin.userId, dto);
  }

  @Post(':id/activate')
  activate(
    @CurrentPlatformUser() admin: PlatformAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.platformService.activateTenant(id, admin.userId);
  }

  @Post(':id/suspend')
  suspend(
    @CurrentPlatformUser() admin: PlatformAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.platformService.suspendTenant(id, admin.userId);
  }
}
