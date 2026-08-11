import { apiFetch } from '../api-client';
import type {
  ChangePasswordPayload,
  CreateTeamMemberFormValues,
  CreateTeamMemberResponse,
  NutritionistOption,
  PlatformRole,
  ResetTeamMemberPasswordResponse,
  TeamMember,
  TeamUsage,
} from '../types';

export function listNutritionists(accessToken: string) {
  return apiFetch<NutritionistOption[]>('/users/nutritionists', { accessToken });
}

export function listTeamMembers(accessToken: string) {
  return apiFetch<TeamMember[]>('/users', { accessToken });
}

export function getTeamUsage(accessToken: string) {
  return apiFetch<TeamUsage>('/users/usage', { accessToken });
}

export function createTeamMember(accessToken: string, data: CreateTeamMemberFormValues) {
  return apiFetch<CreateTeamMemberResponse>('/users', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(data),
  });
}

export function updateTeamMemberRole(accessToken: string, userId: string, role: PlatformRole) {
  return apiFetch<TeamMember>(`/users/${userId}/role`, {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify({ role }),
  });
}

export function resetTeamMemberPassword(accessToken: string, userId: string) {
  return apiFetch<ResetTeamMemberPasswordResponse>(`/users/${userId}/reset-password`, {
    method: 'POST',
    accessToken,
  });
}

export function activateTeamMember(accessToken: string, userId: string) {
  return apiFetch<TeamMember>(`/users/${userId}/activate`, {
    method: 'POST',
    accessToken,
  });
}

export function deactivateTeamMember(accessToken: string, userId: string) {
  return apiFetch<TeamMember>(`/users/${userId}`, {
    method: 'DELETE',
    accessToken,
  });
}

export function changeOwnPassword(accessToken: string, data: ChangePasswordPayload) {
  return apiFetch<{ status: string }>('/users/me/change-password', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(data),
  });
}
