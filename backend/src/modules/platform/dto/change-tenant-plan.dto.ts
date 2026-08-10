import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { PLAN_CODES, type PlanCode } from '../../../common/plans/plan-catalog';

/**
 * Troca de plano pelo Platform Admin (Missão 0005.7). Aceita qualquer
 * código do catálogo, incluindo internos (ex.: DEMO_INTERNAL) — só o
 * Platform Admin usa este endpoint, então planos internos são
 * legitimamente atribuíveis aqui (diferente da criação normal de
 * cliente, que os exclui).
 */
export class ChangeTenantPlanDto {
  @ApiProperty({ enum: PLAN_CODES })
  @IsIn(PLAN_CODES)
  planCode: PlanCode;
}
