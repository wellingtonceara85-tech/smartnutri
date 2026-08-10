import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { UsersModule } from '../users/users.module';
import { PlatformDashboardController } from './platform-dashboard.controller';
import { PlatformTenantsController } from './platform-tenants.controller';
import { PlatformUsersController } from './platform-users.controller';
import { PlatformUsersService } from './platform-users.service';
import { PlatformService } from './platform.service';

@Module({
  imports: [AuditModule, UsersModule],
  controllers: [
    PlatformDashboardController,
    PlatformTenantsController,
    PlatformUsersController,
  ],
  providers: [PlatformService, PlatformUsersService],
})
export class PlatformModule {}
