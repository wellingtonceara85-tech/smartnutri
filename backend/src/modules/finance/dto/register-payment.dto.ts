import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class RegisterPaymentDto {
  @ApiProperty({ description: 'Cobrança que está sendo paga' })
  @IsUUID()
  chargeId!: string;

  @ApiProperty()
  @IsUUID()
  paymentMethodId!: string;

  @ApiProperty({
    required: false,
    description: 'Se omitido, usa o saldo restante da cobrança',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @ApiProperty({
    required: false,
    description: 'Se omitido, usa a data/hora atual',
  })
  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  referenceNote?: string;
}
