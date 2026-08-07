/**
 * Formatação de data/hora de consultas — sempre no fuso da clínica, nunca no
 * fuso do navegador de quem está olhando a tela.
 *
 * Diferente de `PatientEvolution.assessmentDate` (um `DATE` puro, sem
 * componente de hora — resolvido em masks.ts fatiando a string ISO),
 * `Appointment.scheduledAt` é um instante real (`DateTime`/timestamptz): o
 * mesmo agendamento tem que aparecer no mesmo dia e horário para a
 * nutricionista em São Paulo e para alguém abrindo o sistema de outro fuso.
 * Por isso aqui a conversão é proposital, sempre fixada no fuso da clínica
 * via `Intl.DateTimeFormat({ timeZone })`, nunca `toLocaleString()` sem opção
 * de fuso (que usaria o fuso do dispositivo).
 *
 * `DEFAULT_TIMEZONE` cobre a Etapa inicial da Missão 0004 (America/Sao_Paulo,
 * sem horário de verão desde 2019 — por isso o offset fixo de -03:00 abaixo
 * também é seguro). Quando o timezone por tenant/profissional for exposto
 * pela API, os componentes devem passar esse valor em vez do default.
 */
export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';
const FIXED_UTC_OFFSET = '-03:00';

export function formatAppointmentDate(isoDateTime: string, timeZone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(isoDateTime),
  );
}

export function formatAppointmentWeekdayShort(isoDateTime: string, timeZone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone, weekday: 'short' }).format(new Date(isoDateTime));
}

export function formatAppointmentTime(isoDateTime: string, timeZone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit' }).format(
    new Date(isoDateTime),
  );
}

export function formatAppointmentDateTime(isoDateTime: string, timeZone: string = DEFAULT_TIMEZONE): string {
  return `${formatAppointmentDate(isoDateTime, timeZone)} ${formatAppointmentTime(isoDateTime, timeZone)}`;
}

/** `YYYY-MM-DD` do instante informado, já no fuso da clínica (não no fuso do navegador). */
export function toLocalDateKey(isoDateTime: string, timeZone: string = DEFAULT_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(
    new Date(isoDateTime),
  );
  const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

/** `YYYY-MM-DD` de "agora", no fuso da clínica. */
export function todayLocalDateKey(timeZone: string = DEFAULT_TIMEZONE): string {
  return toLocalDateKey(new Date().toISOString(), timeZone);
}

/**
 * Converte um `YYYY-MM-DD` (calendário da clínica) no instante UTC correspondente
 * à meia-noite local daquele dia — usado para montar os limites `startDate`/
 * `endDate` das buscas por período (dia/semana/mês) sem depender do fuso do
 * navegador de quem está filtrando.
 */
export function localDateKeyToUtcMidnightIso(localDateKey: string): string {
  return new Date(`${localDateKey}T00:00:00${FIXED_UTC_OFFSET}`).toISOString();
}

/** `YYYY-MM-DD` + `HH:mm` no fuso da clínica → instante UTC (ISO) correspondente. */
export function localDateTimeToUtcIso(localDateKey: string, localTime: string): string {
  return new Date(`${localDateKey}T${localTime}:00${FIXED_UTC_OFFSET}`).toISOString();
}

/** `HH:mm` do instante informado, no fuso da clínica — para pré-preencher campos <input type="time">. */
export function toLocalTimeKey(isoDateTime: string, timeZone: string = DEFAULT_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(
    new Date(isoDateTime),
  );
  const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${lookup.hour}:${lookup.minute}`;
}

export function addDaysToDateKey(localDateKey: string, days: number): string {
  const [year, month, day] = localDateKey.split('-').map(Number);
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

/** Segunda-feira (fuso da clínica) da semana que contém `localDateKey`. */
export function startOfWeekDateKey(localDateKey: string): string {
  const [year, month, day] = localDateKey.split('-').map(Number);
  const base = new Date(Date.UTC(year, month - 1, day));
  const weekday = base.getUTCDay(); // 0 = domingo
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
  return addDaysToDateKey(localDateKey, diffToMonday);
}

export function startOfMonthDateKey(localDateKey: string): string {
  return `${localDateKey.slice(0, 7)}-01`;
}

export function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}
