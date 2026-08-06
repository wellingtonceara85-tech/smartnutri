import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuditModule } from './common/audit/audit.module';
import { StorageModule } from './common/storage/storage.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ClinicsModule } from './modules/clinics/clinics.module';
import { PatientsModule } from './modules/patients/patients.module';
import { PlansModule } from './modules/plans/plans.module';
import { ProfessionalProfileModule } from './modules/professional-profile/professional-profile.module';
import { EvolutionsModule } from './modules/evolutions/evolutions.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.password',
        ],
      },
    }),
    PrismaModule,
    AuditModule,
    StorageModule,
    AuthModule,
    UsersModule,
    ClinicsModule,
    PatientsModule,
    PlansModule,
    ProfessionalProfileModule,
    EvolutionsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Ordem importa: autentica -> resolve tenant -> checa role.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
