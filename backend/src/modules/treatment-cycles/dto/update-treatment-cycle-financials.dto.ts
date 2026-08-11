import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { DiscountType } from '../../../generated/prisma/client';

/**
 * Correção de valores já contratados (Missão 0005.8, ajuste final, seção 4)
 * — nunca sobrescreve silenciosamente: todo campo enviado é comparado antes/
 * depois e gravado no AuditLog (entityType 'TreatmentCycle', action UPDATE,
 * metadata.correction=true), com `reason` obrigatório. Campos omitidos
 * mantêm o valor atual. `discount`/`finalValue` são sempre recalculados no
 * servidor a partir de contractedValue + discountType/discountValue.
 */
export class UpdateTreatmentCycleFinancialsDto {
  @ApiProperty({ required: false, description: 'Novo preço-base contratado' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  contractedValue?: number;

  @ApiProperty({ enum: DiscountType, required: false })
  @IsOptional()
  @IsEnum(DiscountType)
  discountType?: DiscountType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountValue?: number;

  @ApiProperty({
    required: false,
    description: 'Remove a forma de pagamento se enviado null',
  })
  @IsOptional()
  @IsUUID()
  paymentMethodId?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  downPayment?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  installmentCount?: number;

  @ApiProperty({ description: 'Motivo da correção — obrigatório' })
  @IsString()
  @MinLength(3)
  reason!: string;
}
