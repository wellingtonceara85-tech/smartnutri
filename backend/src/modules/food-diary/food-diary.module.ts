import { Module } from '@nestjs/common';
import { FoodDiaryController } from './food-diary.controller';
import { PatientFoodDiaryController } from './patient-food-diary.controller';
import { FoodDiaryService } from './food-diary.service';

@Module({
  controllers: [PatientFoodDiaryController, FoodDiaryController],
  providers: [FoodDiaryService],
})
export class FoodDiaryModule {}
