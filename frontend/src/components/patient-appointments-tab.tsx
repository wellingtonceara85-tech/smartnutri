'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { AppointmentDetailDialog } from '@/components/appointment-detail-dialog';
import { AppointmentFormDialog } from '@/components/appointment-form-dialog';
import { AppointmentRow } from '@/components/appointment-row';
import { AppointmentStatusBadge } from '@/components/appointment-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { listPatientAppointments } from '@/lib/api/appointments';
import { useAuth } from '@/lib/auth-context';
import { formatAppointmentDateTime } from '@/lib/appointment-datetime';
import { APPOINTMENT_MODALITY_LABELS } from '@/lib/types';

export function PatientAppointmentsTab({ patientId }: { patientId: string }) {
  const { accessToken } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const appointmentsQuery = useQuery({
    queryKey: ['patient-appointments', patientId],
    queryFn: () => listPatientAppointments(accessToken!, patientId),
    enabled: !!accessToken,
  });

  if (appointmentsQuery.isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const appointments = appointmentsQuery.data ?? [];
  const nowIso = new Date().toISOString();
  const next = appointments
    .filter((a) => a.scheduledAt >= nowIso && !['CANCELLED_BY_CLINIC', 'CANCELLED_BY_PATIENT', 'RESCHEDULED'].includes(a.status))
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];
  const history = [...appointments].sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Consultas</h2>
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus className="size-4" />
          Agendar consulta
        </Button>
      </div>

      {next ? (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-base">Próxima consulta</CardTitle>
          </CardHeader>
          <CardContent>
            <button type="button" className="flex w-full flex-col gap-1 text-left" onClick={() => setDetailId(next.id)}>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">{formatAppointmentDateTime(next.scheduledAt)}</span>
                <AppointmentStatusBadge status={next.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {next.appointmentType.name} · {APPOINTMENT_MODALITY_LABELS[next.modality]} · {next.nutritionistUser.name}
              </p>
            </button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhuma consulta futura agendada.
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Histórico</h3>
        {history.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
            Nenhuma consulta registrada ainda.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {history.map((appt) => (
              <AppointmentRow key={appt.id} appointment={appt} onClick={() => setDetailId(appt.id)} />
            ))}
          </div>
        )}
      </div>

      <AppointmentFormDialog open={formOpen} onOpenChange={setFormOpen} patientId={patientId} />
      <AppointmentDetailDialog open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)} appointmentId={detailId} />
    </div>
  );
}
