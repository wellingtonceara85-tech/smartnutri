import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { AnthropometricDto } from './anthropometric.dto';
import { BioimpedanceDto } from './bioimpedance.dto';
import { ReferenceRangeDto } from './reference-range.dto';
import { SegmentalImpedanceDto } from './segmental-impedance.dto';
import { SegmentalMeasurementDto } from './segmental-measurement.dto';

/**
 * Cria um novo snapshot independente de avaliação — nunca sobrescreve uma
 * avaliação anterior. Seções (antropometria, bioimpedância, segmentar) são
 * todas opcionais; o profissional registra só o que mediu nesta data.
 */
export class CreateEvolutionDto {
  @ApiProperty()
  @IsDateString()
  assessmentDate!: string;

  @ApiProperty({ required: false, example: '14:30' })
  @IsOptional()
  @IsString()
  assessmentTime?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  objective?: string;

  @ApiProperty({
    required: false,
    description: 'Nota clínica interna — nunca visível ao paciente.',
  })
  @IsOptional()
  @IsString()
  clinicalNotes?: string;

  @ApiProperty({
    required: false,
    description: 'Nota interna da equipe — nunca visível ao paciente.',
  })
  @IsOptional()
  @IsString()
  internalNotes?: string;

  @ApiProperty({
    required: false,
    description: 'Se omitido, assume o próprio autor (quando nutricionista).',
  })
  @IsOptional()
  @IsUUID()
  nutritionistUserId?: string;

  @ApiProperty({ required: false, type: AnthropometricDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AnthropometricDto)
  anthropometry?: AnthropometricDto;

  @ApiProperty({ required: false, type: BioimpedanceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BioimpedanceDto)
  bioimpedance?: BioimpedanceDto;

  @ApiProperty({ required: false, type: [SegmentalMeasurementDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SegmentalMeasurementDto)
  segmentalMeasurements?: SegmentalMeasurementDto[];

  @ApiProperty({
    required: false,
    type: [SegmentalImpedanceDto],
    description:
      'Seção avançada e opcional — impedância por frequência, nunca exigida.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SegmentalImpedanceDto)
  segmentalImpedanceMeasurements?: SegmentalImpedanceDto[];

  @ApiProperty({ required: false, type: [ReferenceRangeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReferenceRangeDto)
  referenceRanges?: ReferenceRangeDto[];
}
