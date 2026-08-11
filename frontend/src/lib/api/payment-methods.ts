import { apiFetch } from '../api-client';
import type { PaymentMethod } from '../types';

export function listPaymentMethods(accessToken: string) {
  return apiFetch<PaymentMethod[]>('/payment-methods', { accessToken });
}
