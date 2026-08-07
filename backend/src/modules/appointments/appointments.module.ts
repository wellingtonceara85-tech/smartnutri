import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { AppointmentTypesController } from './appointment-types.controller';
import { PatientAppointmentsController } from './patient-appointments.controller';

@Module({
  controllers: [
    AppointmentsController,
    PatientAppointmentsController,
    AppointmentTypesController,
  ],
  providers: [AppointmentsService],
})
export class AppointmentsModule {}
