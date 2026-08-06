export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function maskCpf(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function maskPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d{1,4})$/, '$1-$2');
  }
  return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}

export function maskCep(value: string): string {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.replace(/(\d{5})(\d{1,3})$/, '$1-$2');
}

export function buildWhatsAppLink(phone: string): string {
  const digits = onlyDigits(phone);
  const withCountryCode = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${withCountryCode}`;
}

/**
 * Formata uma data "só calendário" (ex.: `PatientEvolution.assessmentDate`)
 * usando os dígitos gravados diretamente, sem passar por `Date`/fuso local.
 * O backend grava esse campo como `DATE` puro (meia-noite UTC); convertê-lo
 * para `Date` e formatar com `toLocaleDateString` usa o fuso do navegador e
 * pode exibir o dia anterior para quem está a oeste de UTC. Fatiar a string
 * ISO evita esse problema por completo.
 */
export function formatCalendarDate(isoValue: string, yearFormat: 'numeric' | '2-digit' = 'numeric'): string {
  const [year, month, day] = isoValue.slice(0, 10).split('-');
  return `${day}/${month}/${yearFormat === '2-digit' ? year.slice(-2) : year}`;
}

export function formatAge(birthDateIso: string | null | undefined): number | null {
  if (!birthDateIso) return null;
  const birthDate = new Date(birthDateIso);
  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}
