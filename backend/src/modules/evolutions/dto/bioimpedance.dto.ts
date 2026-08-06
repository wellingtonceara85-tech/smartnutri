import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

/** Campos variam por equipamento de bioimpedância — todos opcionais. */
export class BioimpedanceDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  bodyFatPercent?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fatMassKg?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  leanMassKg?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  muscleMassKg?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  skeletalMuscleMassKg?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  musclePercent?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  bodyWaterLiters?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  bodyWaterPercent?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  proteinKg?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  proteinPercent?: number;

  @ApiProperty({
    required: false,
    description: 'Minerais — distinto de massa óssea.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  mineralMassKg?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  boneMassKg?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  visceralFatLevel?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  basalMetabolicRateKcal?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  metabolicAge?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  waistHipRatio?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  obesityDegreePercent?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bodyType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  impedanceOhms?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  deviceManufacturer?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    required: false,
    description:
      'Pontuação geral fornecida pelo equipamento — nunca calculada pelo SmartNutri.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  bodyCompositionScore?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  bodyCompositionScoreMaximum?: number;

  @ApiProperty({ required: false, example: 'Pontuação da composição corporal' })
  @IsOptional()
  @IsString()
  bodyCompositionScoreLabel?: string;

  @ApiProperty({
    required: false,
    description: 'De onde veio a pontuação (nome do equipamento/protocolo).',
  })
  @IsOptional()
  @IsString()
  bodyCompositionScoreSource?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  referenceWeightKg?: number;

  @ApiProperty({
    required: false,
    description:
      'Ajuste de peso sugerido pelo equipamento/nutricionista — pode ser negativo, positivo ou zero.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  recommendedWeightChangeKg?: number;

  @ApiProperty({
    required: false,
    description: 'Pode ser negativo, positivo ou zero.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  recommendedFatChangeKg?: number;

  @ApiProperty({
    required: false,
    description: 'Pode ser negativo, positivo ou zero.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  recommendedMuscleChangeKg?: number;
}
