import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { DiscountType } from '../../../generated/prisma/client';

export class CreateTreatmentCycleDto {
  @ApiProperty({ description: 'Plano contratado' })
  @IsUUID()
  planId: string;

  @ApiProperty({ description: 'Data de início da contratação' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ enum: DiscountType, required: false, default: 'FIXED' })
  @IsOptional()
  @IsEnum(DiscountType)
  discountType?: DiscountType;

  @ApiProperty({
    required: false,
    default: 0,
    description:
      'Valor bruto do desconto — em R$ se discountType=FIXED, ou o número do percentual (ex.: 10) se PERCENTAGE. Nunca altera o preço-base do plano.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountValue?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  downPayment?: number;

  @ApiProperty({
    required: false,
    description: 'Se omitido, usa Plan.defaultInstallments',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  installmentCount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
