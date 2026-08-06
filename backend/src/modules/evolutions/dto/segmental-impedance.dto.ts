import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

/**
 * Uma linha por frequência — estrutura flexível para aceitar equipamentos
 * com uma, duas ou múltiplas frequências (não colunas fixas para 20kHz/100kHz).
 * Seção avançada e opcional do formulário; nunca exigida para salvar uma avaliação.
 */
export class SegmentalImpedanceDto {
  @ApiProperty({ example: 20 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  frequencyValue!: number;

  @ApiProperty({ required: false, default: 'kHz' })
  @IsOptional()
  @IsString()
  frequencyUnit?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  rightArmOhms?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  leftArmOhms?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  trunkOhms?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  rightLegOhms?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  leftLegOhms?: number;

  @ApiProperty({ required: false, default: 'ohm' })
  @IsOptional()
  @IsString()
  impedanceUnit?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  deviceManufacturer?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
