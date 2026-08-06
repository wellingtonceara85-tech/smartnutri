import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

/**
 * Faixa de referência opcional para qualquer campo da avaliação (ex.:
 * "weightKg", "bodyWaterLiters", "proteinKg") — genérica por `fieldKey` em
 * vez de min/max fixos por campo. O SmartNutri nunca diagnostica a partir
 * daqui, só exibe o valor informado de forma neutra.
 */
export class ReferenceRangeDto {
  @ApiProperty({ example: 'bodyWaterLiters' })
  @IsString()
  fieldKey!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  minValue?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  maxValue?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty({
    required: false,
    description:
      'Ex.: nome do equipamento — nunca usado para diagnóstico automático.',
  })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
