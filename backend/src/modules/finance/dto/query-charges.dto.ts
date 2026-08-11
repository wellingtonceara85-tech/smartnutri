import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

/** 'OVERDUE' é um filtro virtual (PENDING/PARTIALLY_PAID com dueDate no passado) — nunca um
 * valor persistido em ChargeStatus (Missão 0006, ver finance.service.ts). */
export const CHARGE_STATUS_FILTERS = [
  'PENDING',
  'PARTIALLY_PAID',
  'PAID',
  'CANCELLED',
  'OVERDUE',
] as const;
export type ChargeStatusFilter = (typeof CHARGE_STATUS_FILTERS)[number];

export class QueryChargesDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiProperty({ required: false, enum: CHARGE_STATUS_FILTERS })
  @IsOptional()
  @IsIn(CHARGE_STATUS_FILTERS)
  status?: ChargeStatusFilter;

  @ApiProperty({
    required: false,
    description: 'Vencimento a partir de (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiProperty({ required: false, description: 'Vencimento até (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
