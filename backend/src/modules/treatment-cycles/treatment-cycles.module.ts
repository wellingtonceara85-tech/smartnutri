import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { PatientTreatmentCyclesController } from './patient-treatment-cycles.controller';
import { TreatmentCyclesController } from './treatment-cycles.controller';
import { TreatmentCyclesService } from './treatment-cycles.service';

@Module({
  imports: [FinanceModule],
  controllers: [TreatmentCyclesController, PatientTreatmentCyclesController],
  providers: [TreatmentCyclesService],
  exports: [TreatmentCyclesService],
})
export class TreatmentCyclesModule {}
