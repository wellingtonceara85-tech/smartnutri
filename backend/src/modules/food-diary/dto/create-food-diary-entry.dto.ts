import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Registro do que o paciente REALMENTE consumiu, feito pelo profissional
 * (fonte sempre PROFESSIONAL nesta missão — o backend decide isso, nunca o
 * cliente). Vínculo com plano/refeição prescritos é opcional.
 */
export class CreateFoodDiaryEntryDto {
  @ApiProperty()
  @IsDateString()
  entryDate!: string;

  @ApiProperty({ required: false, example: '12:30' })
  @IsOptional()
  @IsString()
  entryTime?: string;

  @ApiProperty()
  @IsString()
  mealName!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({ required: false, description: 'Plano alimentar prescrito relacionado, se houver.' })
  @IsOptional()
  @IsUUID()
  mealPlanId?: string;

  @ApiProperty({ required: false, description: 'Refeição prescrita relacionada, se houver.' })
  @IsOptional()
  @IsUUID()
  mealId?: string;
}
