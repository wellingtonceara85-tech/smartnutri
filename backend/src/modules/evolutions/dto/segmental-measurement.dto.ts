import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import {
  BodySegment,
  SegmentalMetricType,
} from '../../../generated/prisma/client';

export class SegmentalMeasurementDto {
  @ApiProperty({ enum: BodySegment })
  @IsEnum(BodySegment)
  segment!: BodySegment;

  @ApiProperty({ enum: SegmentalMetricType })
  @IsEnum(SegmentalMetricType)
  metricType!: SegmentalMetricType;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valueKg!: number;

  @ApiProperty({
    required: false,
    description:
      'O próprio equipamento indica quando o valor (geralmente gordura) é estimado.',
  })
  @IsOptional()
  @IsBoolean()
  isEstimated?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  referenceMinKg?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  referenceMaxKg?: number;
}
