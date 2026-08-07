'use client';

import { AppointmentStatusBadge } from '@/components/appointment-status-badge';
import { formatAppointmentTime } from '@/lib/appointment-datetime';
import type { Appointment } from '@/lib/types';

export function AppointmentRow({ appointment, onClick }: { appointment: Appointment; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted"
    >
      <div className="flex items-center gap-3">
        <span className="w-12 shrink-0 font-medium tabular-nums">{formatAppointmentTime(appointment.scheduledAt)}</span>
        <div>
          <p className="font-medium">{appointment.patient.fullName}</p>
          <p className="text-muted-foreground">{appointment.appointmentType.name}</p>
        </div>
      </div>
      <AppointmentStatusBadge status={appointment.status} />
    </button>
  );
}

export function AppointmentCompactRow({ appointment, onClick }: { appointment: Appointment; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col gap-0.5 rounded-md border p-1.5 text-left text-xs transition-colors hover:bg-muted"
    >
      <span className="font-medium tabular-nums">{formatAppointmentTime(appointment.scheduledAt)}</span>
      <span className="truncate">{appointment.patient.fullName}</span>
      <AppointmentStatusBadge status={appointment.status} className="w-fit" />
    </button>
  );
}
