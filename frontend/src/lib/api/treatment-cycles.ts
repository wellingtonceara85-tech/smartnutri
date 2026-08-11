import { apiFetch } from '../api-client';
import type {
  CreateTreatmentCyclePayload,
  CycleStatus,
  QueryTreatmentCyclesParams,
  TreatmentCycle,
  TreatmentCycleListResponse,
  UpdateTreatmentCycleFinancialsPayload,
  UpdateTreatmentCyclePayload,
} from '../types';

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

export function listPatientTreatmentCycles(accessToken: string, patientId: string) {
  return apiFetch<TreatmentCycle[]>(`/patients/${patientId}/treatment-cycles`, { accessToken });
}

export function listTreatmentCycles(accessToken: string, query: QueryTreatmentCyclesParams = {}) {
  return apiFetch<TreatmentCycleListResponse>(`/treatment-cycles${buildQueryString(query)}`, { accessToken });
}

export function getTreatmentCycle(accessToken: string, id: string) {
  return apiFetch<TreatmentCycle>(`/treatment-cycles/${id}`, { accessToken });
}

export function createTreatmentCycle(
  accessToken: string,
  patientId: string,
  data: CreateTreatmentCyclePayload,
) {
  return apiFetch<TreatmentCycle>(`/patients/${patientId}/treatment-cycles`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify(data),
  });
}

export function updateTreatmentCycle(
  accessToken: string,
  id: string,
  data: UpdateTreatmentCyclePayload,
) {
  return apiFetch<TreatmentCycle>(`/treatment-cycles/${id}`, {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify(data),
  });
}

export function updateTreatmentCycleFinancials(
  accessToken: string,
  id: string,
  data: UpdateTreatmentCycleFinancialsPayload,
) {
  return apiFetch<TreatmentCycle>(`/treatment-cycles/${id}/financials`, {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify(data),
  });
}

export function updateTreatmentCycleStatus(
  accessToken: string,
  id: string,
  status: CycleStatus,
  closureReason?: string,
) {
  return apiFetch<TreatmentCycle>(`/treatment-cycles/${id}/status`, {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify({ status, closureReason }),
  });
}
