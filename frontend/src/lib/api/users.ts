import { apiFetch } from '../api-client';
import type { NutritionistOption } from '../types';

export function listNutritionists(accessToken: string) {
  return apiFetch<NutritionistOption[]>('/users/nutritionists', { accessToken });
}
