import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

/**
 * Só campos não-financeiros — para corrigir valor/desconto/forma de
 * pagamento/entrada/parcelas, use `UpdateTreatmentCycleFinancialsDto`
 * (`PATCH /treatment-cycles/:id/financials`), que exige motivo e audita
 * antes/depois (Missão 0005.8, ajuste final, seção 4).
 */
export class UpdateTreatmentCycleDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  expectedEndDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
