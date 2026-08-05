/** Remove tudo que não for dígito. */
export function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

function calculateCheckDigit(digits: string, weightStart: number): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += Number(digits[i]) * (weightStart - i);
  }
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

/**
 * Valida um CPF (formato + dígitos verificadores). Espera que `cpf` já
 * tenha sido normalizado ou normaliza internamente antes de validar.
 * CPFs com todos os dígitos iguais (000.000.000-00, 111.111.111-11, ...)
 * são sempre inválidos, mesmo que "passem" no cálculo do dígito verificador.
 */
export function isValidCpf(cpf: string): boolean {
  const digits = normalizeCpf(cpf);

  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const firstCheckDigit = calculateCheckDigit(digits.slice(0, 9), 10);
  const secondCheckDigit = calculateCheckDigit(
    digits.slice(0, 9) + firstCheckDigit,
    11,
  );

  return (
    digits ===
    digits.slice(0, 9) + String(firstCheckDigit) + String(secondCheckDigit)
  );
}
