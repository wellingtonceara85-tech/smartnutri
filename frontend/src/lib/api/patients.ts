import { apiFetch } from '../api-client';
import type { PatientDetail, PatientFormValues, PatientListResponse, PatientStatus } from '../types';

export interface PatientsQuery {
  search?: string;
  status?: PatientStatus;
  responsibleNutritionistId?: string;
  source?: string;
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

export function listPatients(accessToken: string, query: PatientsQuery = {}) {
  return apiFetch<PatientListResponse>(`/patients${buildQueryString(query)}`, { accessToken });
}

export function getPatient(accessToken: string, id: string) {
  return apiFetch<PatientDetail>(`/patients/${id}`, { accessToken });
}

export function createPatient(accessToken: string, data: PatientFormValues) {
  return apiFetch<PatientDetail>('/patients', { method: 'POST', accessToken, body: JSON.stringify(data) });
}

export function updatePatient(accessToken: string, id: string, data: Partial<PatientFormValues>) {
  return apiFetch<PatientDetail>(`/patients/${id}`, { method: 'PATCH', accessToken, body: JSON.stringify(data) });
}

export function updatePatientStatus(accessToken: string, id: string, status: PatientStatus, reason?: string) {
  return apiFetch<PatientDetail>(`/patients/${id}/status`, {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify({ status, reason }),
  });
}

export function archivePatient(accessToken: string, id: string) {
  return apiFetch<PatientDetail>(`/patients/${id}`, { method: 'DELETE', accessToken });
}
