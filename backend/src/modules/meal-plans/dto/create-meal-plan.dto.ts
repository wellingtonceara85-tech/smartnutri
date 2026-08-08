import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { MealDto } from './meal.dto';

/**
 * Cria uma nova versão independente de plano — nunca sobrescreve um plano
 * existente. `meals` é opcional: um plano pode começar vazio e ser montado
 * depois pelo editor.
 */
export class CreateMealPlanDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  objective?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  customObjective?: string;

  @ApiProperty()
  @IsDateString()
  effectiveFrom!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  effectiveUntil?: string;

  @ApiProperty({
    required: false,
    description: 'Se omitido, assume o próprio autor (quando nutricionista).',
  })
  @IsOptional()
  @IsUUID()
  nutritionistUserId?: string;

  @ApiProperty({
    required: false,
    description: 'Consulta em que este plano foi criado, se houver.',
  })
  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  treatmentCycleId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  generalGuidelines?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  dailyWaterGoalMl?: number;

  @ApiProperty({
    required: false,
    description: 'Texto pensado para o paciente ler.',
  })
  @IsOptional()
  @IsString()
  patientVisibleNotes?: string;

  @ApiProperty({
    required: false,
    description:
      'Nota interna da equipe — nunca visível ao paciente, nunca impressa.',
  })
  @IsOptional()
  @IsString()
  internalNotes?: string;

  @ApiProperty({ required: false, type: [MealDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MealDto)
  meals?: MealDto[];
}
