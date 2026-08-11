import { Module } from '@nestjs/common';
import { PatientTreatmentCyclesController } from './patient-treatment-cycles.controller';
import { TreatmentCyclesController } from './treatment-cycles.controller';
import { TreatmentCyclesService } from './treatment-cycles.service';

@Module({
  controllers: [TreatmentCyclesController, PatientTreatmentCyclesController],
  providers: [TreatmentCyclesService],
  exports: [TreatmentCyclesService],
})
export class TreatmentCyclesModule {}
