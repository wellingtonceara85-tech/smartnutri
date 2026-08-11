import { apiFetch } from '../api-client';
import type {
  Charge,
  ChargeListResponse,
  FinanceSummary,
  QueryChargesParams,
  RegisterPaymentPayload,
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

export function getFinanceSummary(accessToken: string, query: { from?: string; to?: string } = {}) {
  return apiFetch<FinanceSummary>(`/finance/summary${buildQueryString(query)}`, { accessToken });
}

export function listCharges(accessToken: string, query: QueryChargesParams = {}) {
  return apiFetch<ChargeListResponse>(`/finance/charges${buildQueryString(query)}`, { accessToken });
}

export function getCharge(accessToken: string, id: string) {
  return apiFetch<Charge>(`/finance/charges/${id}`, { accessToken });
}

export function registerPayment(accessToken: string, data: RegisterPaymentPayload) {
  return apiFetch<{ id: string }>('/finance/payments', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(data),
  });
}

export function voidPayment(accessToken: string, paymentId: string, reason: string) {
  return apiFetch<{ status: string }>(`/finance/payments/${paymentId}/void`, {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify({ reason }),
  });
}
