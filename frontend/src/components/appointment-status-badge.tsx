import { cn } from '@/lib/utils';
import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from '@/lib/types';

/**
 * Cores semânticas fixas (nunca `var(--primary)`/`var(--secondary)` do tenant) —
 * o significado clínico de cada status precisa ser reconhecível independente
 * da identidade visual escolhida pela nutricionista (seção 34 da missão).
 */
const STATUS_CLASSES: Record<AppointmentStatus, string> = {
  SCHEDULED: 'bg-muted text-muted-foreground',
  AWAITING_CONFIRMATION: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400',
  CONFIRMED: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400',
  IN_PROGRESS: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-400',
  DONE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400',
  CANCELLED_BY_CLINIC: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  CANCELLED_BY_PATIENT: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  NO_SHOW: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400',
  RESCHEDULED: 'bg-muted text-muted-foreground border border-border',
};

export function AppointmentStatusBadge({ status, className }: { status: AppointmentStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 w-fit shrink-0 items-center rounded-4xl px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        STATUS_CLASSES[status],
        className,
      )}
    >
      {APPOINTMENT_STATUS_LABELS[status]}
    </span>
  );
}
