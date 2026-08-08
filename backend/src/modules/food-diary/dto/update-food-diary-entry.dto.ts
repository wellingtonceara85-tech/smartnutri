import { PartialType } from '@nestjs/swagger';
import { CreateFoodDiaryEntryDto } from './create-food-diary-entry.dto';

export class UpdateFoodDiaryEntryDto extends PartialType(CreateFoodDiaryEntryDto) {}
