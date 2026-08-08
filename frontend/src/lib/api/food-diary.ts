import { apiFetch } from '../api-client';
import type {
  FoodDiaryEntry,
  FoodDiaryEntryFormValues,
  FoodDiaryPhoto,
  QueryFoodDiaryParams,
  ReviewFoodDiaryEntryValues,
} from '../types';

export function listFoodDiaryEntries(accessToken: string, patientId: string, params?: QueryFoodDiaryParams) {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params?.dateTo) query.set('dateTo', params.dateTo);
  const qs = query.toString();
  return apiFetch<FoodDiaryEntry[]>(`/patients/${patientId}/food-diary${qs ? `?${qs}` : ''}`, { accessToken });
}

export function getFoodDiaryEntry(accessToken: string, id: string) {
  return apiFetch<FoodDiaryEntry>(`/food-diary/${id}`, { accessToken });
}

export function createFoodDiaryEntry(accessToken: string, patientId: string, data: FoodDiaryEntryFormValues) {
  return apiFetch<FoodDiaryEntry>(`/patients/${patientId}/food-diary`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify(data),
  });
}

export function updateFoodDiaryEntry(accessToken: string, id: string, data: Partial<FoodDiaryEntryFormValues>) {
  return apiFetch<FoodDiaryEntry>(`/food-diary/${id}`, {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify(data),
  });
}

export function archiveFoodDiaryEntry(accessToken: string, id: string) {
  return apiFetch<void>(`/food-diary/${id}`, { method: 'DELETE', accessToken });
}

export function reviewFoodDiaryEntry(accessToken: string, id: string, data: ReviewFoodDiaryEntryValues) {
  return apiFetch<FoodDiaryEntry>(`/food-diary/${id}/review`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify(data),
  });
}

export function uploadFoodDiaryPhoto(accessToken: string, entryId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch<FoodDiaryPhoto>(`/food-diary/${entryId}/photos`, {
    method: 'POST',
    accessToken,
    body: formData,
  });
}

export function removeFoodDiaryPhoto(accessToken: string, entryId: string, photoId: string) {
  return apiFetch<void>(`/food-diary/${entryId}/photos/${photoId}`, { method: 'DELETE', accessToken });
}
