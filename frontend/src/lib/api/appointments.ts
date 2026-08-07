import { apiFetch } from '../api-client';
import type {
  Appointment,
  AppointmentType,
  CreateAppointmentPayload,
  QueryAppointmentsParams,
  UpdateAppointmentPayload,
} from '../types';

function toQueryString(params: QueryAppointmentsParams): string {
  const search = new URLSearchParams();
  if (params.startDate) search.set('startDate', params.startDate);
  if (params.endDate) search.set('endDate', params.endDate);
  if (params.nutritionistId) search.set('nutritionistId', params.nutritionistId);
  if (params.patientId) search.set('patientId', params.patientId);
  if (params.status) search.set('status', params.status);
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export function listAppointments(accessToken: string, params: QueryAppointmentsParams = {}) {
  return apiFetch<Appointment[]>(`/appointments${toQueryString(params)}`, { accessToken });
}

export function getAppointment(accessToken: string, id: string) {
  return apiFetch<Appointment>(`/appointments/${id}`, { accessToken });
}

export function listAppointmentTypes(accessToken: string) {
  return apiFetch<AppointmentType[]>('/appointment-types', { accessToken });
}

export function listPatientAppointments(accessToken: string, patientId: string) {
  return apiFetch<Appointment[]>(`/patients/${patientId}/appointments`, { accessToken });
}

export function createAppointment(accessToken: string, data: CreateAppointmentPayload) {
  return apiFetch<Appointment>('/appointments', { method: 'POST', accessToken, body: JSON.stringify(data) });
}

export function updateAppointment(accessToken: string, id: string, data: UpdateAppointmentPayload) {
  return apiFetch<Appointment>(`/appointments/${id}`, { method: 'PATCH', accessToken, body: JSON.stringify(data) });
}

export function confirmAppointment(accessToken: string, id: string, confirmationNotes?: string) {
  return apiFetch<Appointment>(`/appointments/${id}/confirm`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify({ confirmationNotes }),
  });
}

export function startAppointment(accessToken: string, id: string) {
  return apiFetch<Appointment>(`/appointments/${id}/start`, { method: 'POST', accessToken, body: JSON.stringify({}) });
}

export function completeAppointment(
  accessToken: string,
  id: string,
  data: { clinicalNotes?: string; patientVisibleNotes?: string },
) {
  return apiFetch<Appointment>(`/appointments/${id}/complete`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify(data),
  });
}

export function cancelAppointment(
  accessToken: string,
  id: string,
  data: { reason: string; cancelledBy: 'PATIENT' | 'CLINIC'; notes?: string },
) {
  return apiFetch<Appointment>(`/appointments/${id}/cancel`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify(data),
  });
}

export function markNoShow(accessToken: string, id: string, notes?: string) {
  return apiFetch<Appointment>(`/appointments/${id}/no-show`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify({ notes }),
  });
}

export function rescheduleAppointment(
  accessToken: string,
  id: string,
  data: { newScheduledAt: string; newDurationMinutes?: number; reason?: string },
) {
  return apiFetch<Appointment>(`/appointments/${id}/reschedule`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify(data),
  });
}
