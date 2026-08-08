import { PartialType } from '@nestjs/swagger';
import { CreateMealPlanDto } from './create-meal-plan.dto';

/**
 * Quando `meals` é enviado, substitui a árvore inteira de refeições/itens/
 * substituições (o editor sempre envia o estado completo, nunca deltas).
 * Quando omitido, as refeições existentes são preservadas.
 */
export class UpdateMealPlanDto extends PartialType(CreateMealPlanDto) {}
