import { apiFetch } from '../api-client';
import type {
  CreateTenantFormValues,
  CreateTenantResponse,
  PlatformDashboard,
  PlatformTenantDetail,
  PlatformTenantListResponse,
  PlatformTenantUser,
  QueryPlatformTenantsParams,
  UpdateTenantFormValues,
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

export function getPlatformDashboard(accessToken: string) {
  return apiFetch<PlatformDashboard>('/platform/dashboard', { accessToken });
}

export function listPlatformTenants(accessToken: string, query: QueryPlatformTenantsParams = {}) {
  return apiFetch<PlatformTenantListResponse>(`/platform/tenants${buildQueryString(query)}`, { accessToken });
}

export function getPlatformTenant(accessToken: string, id: string) {
  return apiFetch<PlatformTenantDetail>(`/platform/tenants/${id}`, { accessToken });
}

export function listPlatformTenantUsers(accessToken: string, id: string) {
  return apiFetch<PlatformTenantUser[]>(`/platform/tenants/${id}/users`, { accessToken });
}

export function createPlatformTenant(accessToken: string, data: CreateTenantFormValues) {
  return apiFetch<CreateTenantResponse>('/platform/tenants', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(data),
  });
}

export function updatePlatformTenant(accessToken: string, id: string, data: UpdateTenantFormValues) {
  return apiFetch<PlatformTenantDetail>(`/platform/tenants/${id}`, {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify(data),
  });
}

export function activatePlatformTenant(accessToken: string, id: string) {
  return apiFetch<PlatformTenantDetail>(`/platform/tenants/${id}/activate`, {
    method: 'POST',
    accessToken,
  });
}

export function suspendPlatformTenant(accessToken: string, id: string) {
  return apiFetch<PlatformTenantDetail>(`/platform/tenants/${id}/suspend`, {
    method: 'POST',
    accessToken,
  });
}
