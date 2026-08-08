'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Mail, MessageCircle, Pencil, Phone } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PatientAppointmentsTab } from '@/components/patient-appointments-tab';
import { PatientEvolutionTab } from '@/components/patient-evolution-tab';
import { PatientFoodDiaryTab } from '@/components/patient-food-diary-tab';
import { PatientMealPlanTab } from '@/components/patient-meal-plan-tab';
import { PatientStatusBadge } from '@/components/patient-status-badge';
import { listPatientAppointments } from '@/lib/api/appointments';
import { getPatient } from '@/lib/api/patients';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { formatAppointmentDateTime } from '@/lib/appointment-datetime';
import { buildWhatsAppLink, formatAge, maskPhone } from '@/lib/masks';
import { GENDER_LABELS } from '@/lib/types';

const AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATE: 'Cadastro criado',
  UPDATE: 'Dados atualizados',
  CANCEL: 'Cancelamento',
  RESCHEDULE: 'Reagendamento',
  PAYMENT: 'Pagamento registrado',
  REFUND: 'Estorno',
  STATUS_CHANGE: 'Status alterado',
  SOFT_DELETE: 'Arquivado',
};

function EmptyTab({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-12 text-center text-muted-foreground">
      <p>{message}</p>
    </div>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export default function PacienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { accessToken, user } = useAuth();
  const canSeeEvolution = user?.role === 'ADMIN' || user?.role === 'NUTRITIONIST';

  const patientQuery = useQuery({
    queryKey: ['patient', id],
    queryFn: () => getPatient(accessToken!, id),
    enabled: !!accessToken,
  });

  const appointmentsQuery = useQuery({
    queryKey: ['patient-appointments', id],
    queryFn: () => listPatientAppointments(accessToken!, id),
    enabled: !!accessToken,
  });

  if (patientQuery.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (patientQuery.isError || !patientQuery.data) {
    return (
      <div className="flex flex-col items-center gap-2 p-12 text-center">
        <p className="font-medium">Não foi possível carregar o paciente</p>
        <p className="text-sm text-muted-foreground">
          {patientQuery.error instanceof ApiError ? patientQuery.error.message : 'Tente novamente em instantes.'}
        </p>
      </div>
    );
  }

  const patient = patientQuery.data;
  const age = formatAge(patient.birthDate);
  const whatsapp = patient.whatsappPhone ?? patient.primaryPhone;

  const appointments = appointmentsQuery.data ?? [];
  const nowIso = new Date().toISOString();
  const nextAppointment = appointments
    .filter((a) => a.scheduledAt >= nowIso && !['CANCELLED_BY_CLINIC', 'CANCELLED_BY_PATIENT', 'RESCHEDULED'].includes(a.status))
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];
  const lastCompletedAppointment = appointments
    .filter((a) => a.status === 'DONE')
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))[0];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="size-14">
              <AvatarFallback className="text-lg">{initials(patient.fullName)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{patient.fullName}</h1>
                <PatientStatusBadge status={patient.status} />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {age !== null && <span>{age} anos</span>}
                {patient.primaryPhone && (
                  <span className="flex items-center gap-1">
                    <Phone className="size-3.5" /> {maskPhone(patient.primaryPhone)}
                  </span>
                )}
                {patient.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="size-3.5" /> {patient.email}
                  </span>
                )}
                {patient.responsibleNutritionist && <span>Nutricionista: {patient.responsibleNutritionist.name}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {whatsapp && (
              <Button
                variant="outline"
                nativeButton={false}
                render={<a href={buildWhatsAppLink(whatsapp)} target="_blank" rel="noreferrer" />}
              >
                <MessageCircle className="size-4" />
                WhatsApp
              </Button>
            )}
            <Button nativeButton={false} render={<Link href={`/pacientes/${patient.id}/editar`} />}>
              <Pencil className="size-4" />
              Editar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="cycles">Ciclos e planos</TabsTrigger>
          <TabsTrigger value="appointments">Consultas</TabsTrigger>
          <TabsTrigger value="financial">Financeiro</TabsTrigger>
          {canSeeEvolution && <TabsTrigger value="evolution">Evolução</TabsTrigger>}
          {canSeeEvolution && <TabsTrigger value="meal-plan">Plano Alimentar</TabsTrigger>}
          {canSeeEvolution && <TabsTrigger value="food-diary">Diário Alimentar</TabsTrigger>}
          <TabsTrigger value="documents">Documentos</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Plano atual</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">Não disponível</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Próxima consulta</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {nextAppointment ? (
                  <>
                    <p className="text-foreground">{formatAppointmentDateTime(nextAppointment.scheduledAt)}</p>
                    <p>{nextAppointment.appointmentType.name}</p>
                  </>
                ) : (
                  'Não disponível'
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Saldo em aberto</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">Não disponível</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Último atendimento</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {lastCompletedAppointment ? (
                  <>
                    <p className="text-foreground">{formatAppointmentDateTime(lastCompletedAppointment.scheduledAt)}</p>
                    <p>{lastCompletedAppointment.appointmentType.name}</p>
                  </>
                ) : (
                  'Não disponível'
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados cadastrais</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <InfoField label="Nome social" value={patient.socialName} />
              <InfoField label="CPF" value={patient.cpf} />
              <InfoField label="Sexo" value={patient.gender ? GENDER_LABELS[patient.gender] : undefined} />
              <InfoField label="Profissão" value={patient.occupation} />
              <InfoField label="Telefone secundário" value={patient.secondaryPhone ? maskPhone(patient.secondaryPhone) : undefined} />
              <InfoField
                label="Endereço"
                value={[patient.street, patient.number, patient.neighborhood, patient.city, patient.state]
                  .filter(Boolean)
                  .join(', ')}
              />
              <InfoField label="Contato de emergência" value={patient.emergencyContactName} />
              <InfoField
                label="Telefone de emergência"
                value={patient.emergencyContactPhone ? maskPhone(patient.emergencyContactPhone) : undefined}
              />
              <InfoField label="Origem" value={patient.source} />
              <InfoField label="Cadastrado em" value={new Date(patient.createdAt).toLocaleString('pt-BR')} />
              <div className="sm:col-span-2">
                <InfoField label="Observações administrativas" value={patient.administrativeNotes} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cycles">
          <EmptyTab message="Nenhum ciclo de acompanhamento cadastrado ainda — disponível em uma próxima etapa." />
        </TabsContent>
        <TabsContent value="appointments">
          <PatientAppointmentsTab patientId={patient.id} />
        </TabsContent>
        <TabsContent value="financial">
          <EmptyTab message="Nenhuma movimentação financeira registrada ainda — disponível em uma próxima etapa." />
        </TabsContent>
        {canSeeEvolution && (
          <TabsContent value="evolution">
            <PatientEvolutionTab patient={patient} />
          </TabsContent>
        )}
        {canSeeEvolution && (
          <TabsContent value="meal-plan">
            <PatientMealPlanTab patientId={patient.id} />
          </TabsContent>
        )}
        {canSeeEvolution && (
          <TabsContent value="food-diary">
            <PatientFoodDiaryTab patientId={patient.id} />
          </TabsContent>
        )}
        <TabsContent value="documents">
          <EmptyTab message="Nenhum documento anexado ainda — disponível em uma próxima etapa." />
        </TabsContent>
        <TabsContent value="history">
          {patient.auditLog.length === 0 ? (
            <EmptyTab message="Nenhum evento registrado ainda." />
          ) : (
            <Card>
              <CardContent className="divide-y p-0">
                {patient.auditLog.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-4 text-sm">
                    <div>
                      <p className="font-medium">{AUDIT_ACTION_LABELS[entry.action] ?? entry.action}</p>
                      <p className="text-sm text-muted-foreground">{entry.actorUser?.name ?? 'Sistema'}</p>
                    </div>
                    <span className="text-muted-foreground">{new Date(entry.createdAt).toLocaleString('pt-BR')}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value || <span className="text-muted-foreground">Não informado</span>}</p>
    </div>
  );
}
