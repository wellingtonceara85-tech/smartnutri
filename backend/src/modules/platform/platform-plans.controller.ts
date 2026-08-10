import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformRoute } from '../../common/decorators/platform-route.decorator';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { PLAN_CATALOG } from '../../common/plans/plan-catalog';

/**
 * Expõe o catálogo de planos (fonte única, `common/plans/plan-catalog.ts`)
 * para o frontend do Platform Admin nunca precisar duplicar essa
 * definição — Missão 0005.7.
 */
@ApiTags('platform')
@ApiBearerAuth()
@Controller('platform/plans')
@PlatformRoute()
@UseGuards(PlatformAdminGuard)
export class PlatformPlansController {
  @Get()
  list() {
    return Object.values(PLAN_CATALOG);
  }
}
