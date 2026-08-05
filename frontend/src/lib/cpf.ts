import { onlyDigits } from './masks';

function calculateCheckDigit(digits: string, weightStart: number): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) sum += Number(digits[i]) * (weightStart - i);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCpf(cpf: string): boolean {
  const digits = onlyDigits(cpf);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const firstCheckDigit = calculateCheckDigit(digits.slice(0, 9), 10);
  const secondCheckDigit = calculateCheckDigit(digits.slice(0, 9) + firstCheckDigit, 11);

  return digits === digits.slice(0, 9) + String(firstCheckDigit) + String(secondCheckDigit);
}
