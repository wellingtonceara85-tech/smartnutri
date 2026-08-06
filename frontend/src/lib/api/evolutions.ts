import { apiFetch } from '../api-client';
import type { EvolutionFormValues, EvolutionPhoto, EvolutionPhotoTypeEnum, PatientEvolution } from '../types';

export function listEvolutions(accessToken: string, patientId: string) {
  return apiFetch<PatientEvolution[]>(`/patients/${patientId}/evolutions`, { accessToken });
}

export function getEvolution(accessToken: string, id: string) {
  return apiFetch<PatientEvolution>(`/evolutions/${id}`, { accessToken });
}

export function createEvolution(accessToken: string, patientId: string, data: EvolutionFormValues) {
  return apiFetch<PatientEvolution>(`/patients/${patientId}/evolutions`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify(data),
  });
}

export function updateEvolution(accessToken: string, id: string, data: Partial<EvolutionFormValues>) {
  return apiFetch<PatientEvolution>(`/evolutions/${id}`, {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify(data),
  });
}

export function archiveEvolution(accessToken: string, id: string) {
  return apiFetch<PatientEvolution>(`/evolutions/${id}`, { method: 'DELETE', accessToken });
}

export function shareEvolution(accessToken: string, id: string, isSharedWithPatient: boolean, patientVisibleNotes?: string) {
  return apiFetch<PatientEvolution>(`/evolutions/${id}/share`, {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify({ isSharedWithPatient, patientVisibleNotes }),
  });
}

export function uploadEvolutionPhoto(
  accessToken: string,
  evolutionId: string,
  type: EvolutionPhotoTypeEnum,
  file: File,
) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);
  return apiFetch<EvolutionPhoto>(`/evolutions/${evolutionId}/photos`, {
    method: 'POST',
    accessToken,
    body: formData,
  });
}

export function removeEvolutionPhoto(accessToken: string, evolutionId: string, photoId: string) {
  return apiFetch<void>(`/evolutions/${evolutionId}/photos/${photoId}`, { method: 'DELETE', accessToken });
}
