/** Remove tudo que não for dígito. Persistência nunca depende de máscara. */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** Telefone brasileiro: DDD (2) + fixo (8) ou celular (9) = 10 ou 11 dígitos. */
export function isValidPhone(phone: string): boolean {
  const digits = normalizePhone(phone);
  return digits.length === 10 || digits.length === 11;
}

/**
 * Gera o link do WhatsApp a partir de um telefone brasileiro já
 * normalizado (ou não — normaliza internamente). Assume DDI +55.
 */
export function buildWhatsAppLink(phone: string): string {
  const digits = normalizePhone(phone);
  const withCountryCode = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${withCountryCode}`;
}
