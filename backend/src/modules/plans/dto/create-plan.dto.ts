import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePlanDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Duração sugerida do plano em meses' })
  @IsInt()
  @Min(1)
  durationMonths: number;

  @ApiProperty({ description: 'Quantidade sugerida de consultas' })
  @IsInt()
  @Min(1)
  suggestedAppointments: number;

  @ApiProperty({ description: 'Intervalo sugerido entre consultas, em dias' })
  @IsInt()
  @Min(1)
  suggestedIntervalDays: number;

  @ApiProperty({ description: 'Valor padrão do plano' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  defaultPrice: number;

  @ApiProperty({ description: 'Quantidade padrão de parcelas' })
  @IsInt()
  @Min(1)
  defaultInstallments: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  allowsDiscount?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
