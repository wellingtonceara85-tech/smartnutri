import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformRoute } from '../../common/decorators/platform-route.decorator';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { PlatformService } from './platform.service';

/** Autoridade real é PlatformAdminGuard, aplicado explicitamente aqui — nunca global. */
@ApiTags('platform')
@ApiBearerAuth()
@Controller('platform/dashboard')
@PlatformRoute()
@UseGuards(PlatformAdminGuard)
export class PlatformDashboardController {
  constructor(private readonly platformService: PlatformService) {}

  @Get()
  getDashboard() {
    return this.platformService.getDashboard();
  }
}
