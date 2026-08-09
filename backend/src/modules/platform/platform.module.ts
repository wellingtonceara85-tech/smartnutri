import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { PlatformDashboardController } from './platform-dashboard.controller';
import { PlatformTenantsController } from './platform-tenants.controller';
import { PlatformService } from './platform.service';

@Module({
  imports: [AuditModule],
  controllers: [PlatformDashboardController, PlatformTenantsController],
  providers: [PlatformService],
})
export class PlatformModule {}
