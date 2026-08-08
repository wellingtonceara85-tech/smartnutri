import { apiFetch } from '../api-client';
import type { MealPlan, MealPlanFormValues } from '../types';

export function listMealPlans(accessToken: string, patientId: string) {
  return apiFetch<MealPlan[]>(`/patients/${patientId}/meal-plans`, { accessToken });
}

export function getMealPlan(accessToken: string, id: string) {
  return apiFetch<MealPlan>(`/meal-plans/${id}`, { accessToken });
}

export function createMealPlan(accessToken: string, patientId: string, data: MealPlanFormValues) {
  return apiFetch<MealPlan>(`/patients/${patientId}/meal-plans`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify(data),
  });
}

export function updateMealPlan(accessToken: string, id: string, data: Partial<MealPlanFormValues>) {
  return apiFetch<MealPlan>(`/meal-plans/${id}`, {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify(data),
  });
}

export function archiveMealPlan(accessToken: string, id: string) {
  return apiFetch<MealPlan>(`/meal-plans/${id}`, { method: 'DELETE', accessToken });
}

export function activateMealPlan(accessToken: string, id: string) {
  return apiFetch<MealPlan>(`/meal-plans/${id}/activate`, { method: 'POST', accessToken });
}

export function completeMealPlan(accessToken: string, id: string) {
  return apiFetch<MealPlan>(`/meal-plans/${id}/complete`, { method: 'POST', accessToken });
}

export function duplicateMealPlan(accessToken: string, id: string) {
  return apiFetch<MealPlan>(`/meal-plans/${id}/duplicate`, { method: 'POST', accessToken });
}

export function createNewMealPlanVersion(accessToken: string, id: string) {
  return apiFetch<MealPlan>(`/meal-plans/${id}/new-version`, { method: 'POST', accessToken });
}

export function shareMealPlan(accessToken: string, id: string, isSharedWithPatient: boolean, patientVisibleNotes?: string) {
  return apiFetch<MealPlan>(`/meal-plans/${id}/share`, {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify({ isSharedWithPatient, patientVisibleNotes }),
  });
}
