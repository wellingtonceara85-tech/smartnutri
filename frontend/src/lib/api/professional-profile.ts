import { apiFetch } from '../api-client';
import type { ProfessionalProfile, UpdateProfessionalProfileValues } from '../types';

export function getProfessionalProfile(accessToken: string) {
  return apiFetch<ProfessionalProfile>('/professional-profile/me', { accessToken });
}

export function updateProfessionalProfile(accessToken: string, data: UpdateProfessionalProfileValues) {
  return apiFetch<ProfessionalProfile>('/professional-profile/me', {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify(data),
  });
}

function uploadImage(accessToken: string, path: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch<ProfessionalProfile>(path, { method: 'POST', accessToken, body: formData });
}

export function uploadProfilePhoto(accessToken: string, file: File) {
  return uploadImage(accessToken, '/professional-profile/me/photo', file);
}

export function uploadProfileLogo(accessToken: string, file: File) {
  return uploadImage(accessToken, '/professional-profile/me/logo', file);
}
