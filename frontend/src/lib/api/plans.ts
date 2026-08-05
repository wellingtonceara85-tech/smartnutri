import { apiFetch } from '../api-client';
import type { Plan, PlanFormValues, PlanListResponse } from '../types';

export interface PlansQuery {
  search?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

function buildQueryString(query: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function listPlans(accessToken: string, query: PlansQuery = {}) {
  return apiFetch<PlanListResponse>(`/plans${buildQueryString(query)}`, { accessToken });
}

export function getPlan(accessToken: string, id: string) {
  return apiFetch<Plan>(`/plans/${id}`, { accessToken });
}

export function createPlan(accessToken: string, data: PlanFormValues) {
  return apiFetch<Plan>('/plans', { method: 'POST', accessToken, body: JSON.stringify(data) });
}

export function updatePlan(accessToken: string, id: string, data: Partial<PlanFormValues>) {
  return apiFetch<Plan>(`/plans/${id}`, { method: 'PATCH', accessToken, body: JSON.stringify(data) });
}

export function updatePlanStatus(accessToken: string, id: string, isActive: boolean) {
  return apiFetch<Plan>(`/plans/${id}/status`, { method: 'PATCH', accessToken, body: JSON.stringify({ isActive }) });
}

export function archivePlan(accessToken: string, id: string) {
  return apiFetch<Plan>(`/plans/${id}`, { method: 'DELETE', accessToken });
}
