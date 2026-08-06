import { Module } from '@nestjs/common';
import { EvolutionsController } from './evolutions.controller';
import { PatientEvolutionsController } from './patient-evolutions.controller';
import { EvolutionsService } from './evolutions.service';

@Module({
  controllers: [PatientEvolutionsController, EvolutionsController],
  providers: [EvolutionsService],
})
export class EvolutionsModule {}
