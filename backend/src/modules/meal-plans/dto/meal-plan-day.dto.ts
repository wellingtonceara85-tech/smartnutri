import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { WeekDay } from '../../../generated/prisma/client';
import { MealDto } from './meal.dto';

/**
 * Um dia/rotina dentro do plano (Missão 0005.1). `name` é sempre texto
 * livre e editável (ex.: "Segunda-feira", "Dia 1", "Dia de treino") —
 * nunca um enum fixo. `weekDay` só faz sentido em organizationType WEEKLY;
 * `dayNumber` é uso livre (principalmente em CUSTOM_CYCLE).
 */
export class MealPlanDayDto {
  @ApiProperty({ example: 'Segunda-feira' })
  @IsString()
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  dayNumber?: number;

  @ApiProperty({ required: false, enum: WeekDay })
  @IsOptional()
  @IsEnum(WeekDay)
  weekDay?: WeekDay;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false, type: [MealDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MealDto)
  meals?: MealDto[];
}
