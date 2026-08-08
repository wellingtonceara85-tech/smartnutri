'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { AppointmentStatusBadge } from '@/components/appointment-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { listAppointments } from '@/lib/api/appointments';
import { getProfessionalProfile } from '@/lib/api/professional-profile';
import { useAuth } from '@/lib/auth-context';
import { formatAppointmentTime, localDateKeyToUtcMidnightIso, addDaysToDateKey, todayLocalDateKey } from '@/lib/appointment-datetime';
import { APPOINTMENT_MODALITY_LABELS } from '@/lib/types';

function timeBasedGreeting(hour: number): string {
  if (hour < 5) return 'Boa noite';
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function DashboardPage() {
  const { user, accessToken } = useAuth();

  const profileQuery = useQuery({
    queryKey: ['professional-profile'],
    queryFn: () => getProfessionalProfile(accessToken!),
    enabled: !!accessToken,
    staleTime: 60_000,
  });

  const today = todayLocalDateKey();
  const todayAppointmentsQuery = useQuery({
    queryKey: ['appointments-today', today],
    queryFn: () =>
      listAppointments(accessToken!, {
        startDate: localDateKeyToUtcMidnightIso(today),
        endDate: localDateKeyToUtcMidnightIso(addDaysToDateKey(today, 1)),
      }),
    enabled: !!accessToken,
  });

  const displayName = profileQuery.data?.displayName || user?.name || '';
  const firstName = displayName.split(' ')[0];
  const greeting = timeBasedGreeting(new Date().getHours());

  const todayAppointments = (todayAppointmentsQuery.data ?? []).filter(
    (a) => !['CANCELLED_BY_CLINIC', 'CANCELLED_BY_PATIENT', 'RESCHEDULED'].includes(a.status),
  );
  const awaitingConfirmation = todayAppointments.filter((a) => a.status === 'AWAITING_CONFIRMATION').length;
  const confirmed = todayAppointments.filter((a) => a.status === 'CONFIRMED').length;
  const noShows = todayAppointments.filter((a) => a.status === 'NO_SHOW').length;
  const nowIso = new Date().toISOString();
  const nextAppointment = [...todayAppointments]
    .filter((a) => a.scheduledAt >= nowIso)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-[1.75rem]">
          {greeting}, {firstName}!
        </h1>
        {todayAppointmentsQuery.isLoading ? (
          <Skeleton className="mt-1 h-5 w-64" />
        ) : todayAppointments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sua agenda está livre hoje.</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Você possui {todayAppointments.length} consulta{todayAppointments.length > 1 ? 's' : ''} agendada
            {todayAppointments.length > 1 ? 's' : ''} para hoje.
            {awaitingConfirmation > 0 && ` ${awaitingConfirmation} ainda aguarda${awaitingConfirmation > 1 ? 'm' : ''} confirmação.`}
          </p>
        )}
      </div>

      {todayAppointmentsQuery.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Consultas hoje</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{todayAppointments.length}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Confirmadas</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{confirmed}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Aguardando confirmação</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{awaitingConfirmation}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Faltas hoje</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{noShows}</CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Próximo atendimento</CardTitle>
            </CardHeader>
            <CardContent>
              {nextAppointment ? (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold">{formatAppointmentTime(nextAppointment.scheduledAt)}</span>
                    <AppointmentStatusBadge status={nextAppointment.status} />
                  </div>
                  <p className="font-medium">{nextAppointment.patient.fullName}</p>
                  <p className="text-sm text-muted-foreground">
                    {nextAppointment.appointmentType.name} · {APPOINTMENT_MODALITY_LABELS[nextAppointment.modality]}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum atendimento restante para hoje.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Button nativeButton={false} render={<Link href="/agenda" />} className="w-fit">
        <CalendarDays className="size-4" />
        Ver agenda completa
      </Button>
    </div>
  );
}
