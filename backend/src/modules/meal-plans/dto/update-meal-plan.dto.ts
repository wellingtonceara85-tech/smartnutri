import { PartialType } from '@nestjs/swagger';
import { CreateMealPlanDto } from './create-meal-plan.dto';

/**
 * Quando `days` é enviado, substitui a árvore inteira de dias/refeições/
 * itens/substituições (o editor sempre envia o estado completo, nunca
 * deltas). Quando omitido, os dias existentes são preservados.
 */
export class UpdateMealPlanDto extends PartialType(CreateMealPlanDto) {}
