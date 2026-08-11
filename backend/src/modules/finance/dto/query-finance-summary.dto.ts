import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

/** Sem período informado, o resumo usa o mês corrente (ver finance.service.ts). */
export class QueryFinanceSummaryDto {
  @ApiProperty({
    required: false,
    description: 'Início do período (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiProperty({ required: false, description: 'Fim do período (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
