import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPlatformUser } from '../../common/decorators/current-platform-user.decorator';
import { PlatformRoute } from '../../common/decorators/platform-route.decorator';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import type { PlatformAuthenticatedUser } from '../../common/types/auth-request';
import { CreatePlatformUserDto } from './dto/create-platform-user.dto';
import { QueryPlatformUsersDto } from './dto/query-platform-users.dto';
import { PlatformUsersService } from './platform-users.service';

/** Autoridade real é PlatformAdminGuard, aplicado explicitamente aqui — nunca global (Missão 0005.6). */
@ApiTags('platform')
@ApiBearerAuth()
@Controller('platform/users')
@PlatformRoute()
@UseGuards(PlatformAdminGuard)
export class PlatformUsersController {
  constructor(private readonly platformUsersService: PlatformUsersService) {}

  @Get()
  list(@Query() query: QueryPlatformUsersDto) {
    return this.platformUsersService.listUsers(query);
  }

  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.platformUsersService.getUserById(id);
  }

  @Post()
  create(
    @CurrentPlatformUser() admin: PlatformAuthenticatedUser,
    @Body() dto: CreatePlatformUserDto,
  ) {
    return this.platformUsersService.createUser(admin.userId, dto);
  }

  @Post(':id/reset-password')
  resetPassword(
    @CurrentPlatformUser() admin: PlatformAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.platformUsersService.resetPassword(admin.userId, id);
  }

  @Post(':id/activate')
  activate(
    @CurrentPlatformUser() admin: PlatformAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.platformUsersService.setActive(admin.userId, id, true);
  }

  @Post(':id/suspend')
  suspend(
    @CurrentPlatformUser() admin: PlatformAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.platformUsersService.setActive(admin.userId, id, false);
  }
}
