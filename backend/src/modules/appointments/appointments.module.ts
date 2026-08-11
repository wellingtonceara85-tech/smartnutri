import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { AppointmentTypesController } from './appointment-types.controller';
import { PatientAppointmentsController } from './patient-appointments.controller';

@Module({
  imports: [FinanceModule],
  controllers: [
    AppointmentsController,
    PatientAppointmentsController,
    AppointmentTypesController,
  ],
  providers: [AppointmentsService],
})
export class AppointmentsModule {}
