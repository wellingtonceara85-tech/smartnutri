import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/auth-request';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.ADMIN)
  list(@CurrentTenant() tenantId: string) {
    return this.usersService.listForTenant(tenantId);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateUserDto) {
    return this.usersService.createForTenant(tenantId, dto);
  }

  @Get('nutritionists')
  listNutritionists(@CurrentTenant() tenantId: string) {
    return this.usersService.listNutritionistsForTenant(tenantId);
  }

  @Get(':id')
  get(
    @CurrentTenant() tenantId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    // Admin vê qualquer usuário da clínica; demais perfis só a si mesmos.
    if (currentUser.role !== Role.ADMIN && currentUser.userId !== id) {
      return this.usersService.getForTenant(tenantId, currentUser.userId);
    }
    return this.usersService.getForTenant(tenantId, id);
  }

  @Patch(':id')
  update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    const targetId = currentUser.role === Role.ADMIN ? id : currentUser.userId;
    return this.usersService.updateForTenant(tenantId, targetId, dto);
  }

  @Patch(':id/role')
  @Roles(Role.ADMIN)
  updateRole(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.usersService.updateRole(tenantId, id, dto.role);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  deactivate(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.usersService.deactivateForTenant(tenantId, id);
  }
}
