'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AppointmentStatusBadge } from '@/components/appointment-status-badge';
import {
  cancelAppointment,
  completeAppointment,
  confirmAppointment,
  getAppointment,
  markNoShow,
  rescheduleAppointment,
  startAppointment,
} from '@/lib/api/appointments';
import { getProfessionalProfile } from '@/lib/api/professional-profile';
import { ApiError } from '@/lib/api-client';
import { useTenantAuth } from '@/lib/auth-context';
import {
  addDaysToDateKey,
  formatAppointmentDate,
  formatAppointmentDateTime,
  formatAppointmentTime,
  localDateTimeToUtcIso,
  toLocalDateKey,
  todayLocalDateKey,
} from '@/lib/appointment-datetime';
import { buildWhatsAppLink, formatAge, formatCalendarDate, maskPhone } from '@/lib/masks';
import { APPOINTMENT_MODALITY_LABELS, APPOINTMENT_STATUS_LABELS, PLATFORM_ROLE_LABELS } from '@/lib/types';

type ActionMode = 'view' | 'cancel' | 'reschedule' | 'noshow' | 'complete';

const RETURN_PRESETS_DAYS = [15, 30, 45, 60];

interface AppointmentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string | null;
}

export function AppointmentDetailDialog({ open, onOpenChange, appointmentId }: AppointmentDetailDialogProps) {
  const { accessToken, user } = useTenantAuth();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<ActionMode>('view');
  const [busy, setBusy] = useState(false);

  const [cancelReason, setCancelReason] = useState('');
  // Sem valor padrão de propósito (bug da Missão 0005.8, seção 7) — quem cancela precisa
  // escolher ativamente a origem, nunca herdar "paciente" silenciosamente.
  const [cancelledBy, setCancelledBy] = useState<'PATIENT' | 'CLINIC' | null>(null);
  const [noShowNotes, setNoShowNotes] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [completeClinicalNotes, setCompleteClinicalNotes] = useState('');
  const [completePatientNotes, setCompletePatientNotes] = useState('');

  const appointmentQuery = useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: () => getAppointment(accessToken!, appointmentId!),
    enabled: open && !!accessToken && !!appointmentId,
  });
  const profileQuery = useQuery({
    queryKey: ['professional-profile'],
    queryFn: () => getProfessionalProfile(accessToken!),
    enabled: open && !!accessToken,
  });

  const appointment = appointmentQuery.data;
  const canSeeClinical = user?.role !== 'RECEPTION';

  function resetActionState() {
    setMode('view');
    setCancelReason('');
    setCancelledBy(null);
    setNoShowNotes('');
    setRescheduleReason('');
    setCompleteClinicalNotes('');
    setCompletePatientNotes('');
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetActionState();
    onOpenChange(next);
  }

  async function invalidateAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] }),
      queryClient.invalidateQueries({ queryKey: ['appointments'] }),
      appointment ? queryClient.invalidateQueries({ queryKey: ['patient-appointments', appointment.patient.id] }) : Promise.resolve(),
    ]);
  }

  async function handleConfirm() {
    if (!accessToken || !appointmentId) return;
    setBusy(true);
    try {
      await confirmAppointment(accessToken, appointmentId);
      toast.success('Consulta confirmada');
      await invalidateAll();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível confirmar');
    } finally {
      setBusy(false);
    }
  }

  async function handleStart() {
    if (!accessToken || !appointmentId) return;
    setBusy(true);
    try {
      await startAppointment(accessToken, appointmentId);
      toast.success('Atendimento iniciado');
      await invalidateAll();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível iniciar o atendimento');
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelSubmit() {
    if (!accessToken || !appointmentId) return;
    if (!cancelReason.trim()) {
      toast.error('Informe o motivo do cancelamento');
      return;
    }
    if (!cancelledBy) {
      toast.error('Selecione quem solicitou o cancelamento');
      return;
    }
    setBusy(true);
    try {
      await cancelAppointment(accessToken, appointmentId, { reason: cancelReason, cancelledBy });
      toast.success('Consulta cancelada');
      resetActionState();
      await invalidateAll();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível cancelar');
    } finally {
      setBusy(false);
    }
  }

  async function handleNoShowSubmit() {
    if (!accessToken || !appointmentId) return;
    setBusy(true);
    try {
      await markNoShow(accessToken, appointmentId, noShowNotes || undefined);
      toast.success('Falta registrada');
      resetActionState();
      await invalidateAll();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível registrar a falta');
    } finally {
      setBusy(false);
    }
  }

  async function handleRescheduleSubmit() {
    if (!accessToken || !appointmentId) return;
    if (!rescheduleDate || !rescheduleTime) {
      toast.error('Informe a nova data e horário');
      return;
    }
    setBusy(true);
    try {
      await rescheduleAppointment(accessToken, appointmentId, {
        newScheduledAt: localDateTimeToUtcIso(rescheduleDate, rescheduleTime),
        reason: rescheduleReason || undefined,
      });
      toast.success('Consulta reagendada');
      resetActionState();
      await invalidateAll();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível reagendar');
    } finally {
      setBusy(false);
    }
  }

  async function handleCompleteSubmit() {
    if (!accessToken || !appointmentId) return;
    setBusy(true);
    try {
      await completeAppointment(accessToken, appointmentId, {
        clinicalNotes: canSeeClinical ? completeClinicalNotes || undefined : undefined,
        patientVisibleNotes: completePatientNotes || undefined,
      });
      toast.success('Consulta concluída');
      resetActionState();
      await invalidateAll();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível concluir a consulta');
    } finally {
      setBusy(false);
    }
  }

  function whatsAppMessage(): string {
    if (!appointment) return '';
    const patientFirstName = appointment.patient.fullName.split(' ')[0];
    const professionalName = profileQuery.data?.displayName ?? 'nossa equipe';
    return `Olá, ${patientFirstName}! Tudo bem?\n\nPassando para confirmar sua consulta com ${professionalName} no dia ${formatAppointmentDate(
      appointment.scheduledAt,
    )} às ${formatAppointmentTime(appointment.scheduledAt)}.\n\nAté lá!`;
  }

  async function handleCopyMessage() {
    try {
      await navigator.clipboard.writeText(whatsAppMessage());
      toast.success('Mensagem copiada');
    } catch {
      toast.error('Não foi possível copiar a mensagem');
    }
  }

  if (!appointment && appointmentQuery.isLoading) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg">
          <p className="p-6 text-center text-sm text-muted-foreground">Carregando...</p>
        </DialogContent>
      </Dialog>
    );
  }

  if (!appointment) {
    return null;
  }

  const whatsappPhone = appointment.patient.whatsappPhone ?? appointment.patient.primaryPhone;
  const age = formatAge(appointment.patient.birthDate);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {formatAppointmentDateTime(appointment.scheduledAt)}
            <AppointmentStatusBadge status={appointment.status} />
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border p-3">
            <p className="font-medium">{appointment.patient.fullName}</p>
            <p className="text-sm text-muted-foreground">
              {age !== null && `${age} anos · `}
              {appointment.patient.primaryPhone && maskPhone(appointment.patient.primaryPhone)}
            </p>
            <p className="text-sm text-muted-foreground">Nutricionista: {appointment.nutritionistUser.name}</p>
          </div>

          {appointment.treatmentCycle && appointment.sequenceNumber !== null ? (
            <div
              className={
                appointment.sequenceNumber > appointment.treatmentCycle.appointmentCountPlanned
                  ? 'rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30'
                  : 'rounded-lg border p-3 text-sm'
              }
            >
              <p className="font-medium">{appointment.treatmentCycle.plan.name}</p>
              <p className={appointment.sequenceNumber > appointment.treatmentCycle.appointmentCountPlanned ? 'font-medium text-amber-700 dark:text-amber-500' : 'text-muted-foreground'}>
                {appointment.sequenceNumber}ª consulta
                {appointment.sequenceNumber > appointment.treatmentCycle.appointmentCountPlanned
                  ? ` — excede as ${appointment.treatmentCycle.appointmentCountPlanned} consultas previstas no plano`
                  : ` de ${appointment.treatmentCycle.appointmentCountPlanned} previstas no plano`}
              </p>
            </div>
          ) : (
            appointment.standaloneValue && (
              <div className="rounded-lg border p-3 text-sm">
                <p className="text-xs text-muted-foreground">Consulta avulsa</p>
                <p>
                  {Number(appointment.standaloneValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  {appointment.standaloneFinalValue &&
                    Number(appointment.standaloneFinalValue) !== Number(appointment.standaloneValue) &&
                    ` → valor final ${Number(appointment.standaloneFinalValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
                  {appointment.standalonePaymentMethod && ` · ${appointment.standalonePaymentMethod.name}`}
                </p>
              </div>
            )
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Tipo</p>
              <p>{appointment.appointmentType.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Modalidade</p>
              <p>{APPOINTMENT_MODALITY_LABELS[appointment.modality]}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Duração</p>
              <p>{appointment.durationMinutes} minutos</p>
            </div>
            {appointment.location && (
              <div>
                <p className="text-xs text-muted-foreground">Local</p>
                <p>{appointment.location}</p>
              </div>
            )}
            {appointment.onlineMeetingUrl && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Link da reunião</p>
                <a href={appointment.onlineMeetingUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                  {appointment.onlineMeetingUrl}
                </a>
              </div>
            )}
          </div>

          {appointment.adminNotes && (
            <div>
              <p className="text-xs text-muted-foreground">Observações administrativas</p>
              <p className="text-sm">{appointment.adminNotes}</p>
            </div>
          )}
          {canSeeClinical && appointment.clinicalNotes && (
            <div>
              <p className="text-xs text-muted-foreground">Notas clínicas</p>
              <p className="text-sm">{appointment.clinicalNotes}</p>
            </div>
          )}

          {appointment.rescheduledFromAppointment && (
            <p className="text-xs text-muted-foreground">
              Reagendada a partir de {formatAppointmentDateTime(appointment.rescheduledFromAppointment.scheduledAt)}
            </p>
          )}
          {appointment.rescheduledIntoAppointment && (
            <p className="text-xs text-muted-foreground">
              Reagendada para {formatAppointmentDateTime(appointment.rescheduledIntoAppointment.scheduledAt)}
            </p>
          )}

          {appointment.patientEvolutions.length > 0 && (
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-sm font-medium">Avaliação corporal registrada</p>
              {appointment.patientEvolutions.map((evo) => (
                <Link
                  key={evo.id}
                  href={`/pacientes/${appointment.patient.id}/evolucao/${evo.id}`}
                  className="mt-1 flex items-center justify-between text-sm text-primary underline"
                >
                  <span>{formatCalendarDate(evo.assessmentDate)}</span>
                  <span>Visualizar evolução</span>
                </Link>
              ))}
            </div>
          )}

          {whatsappPhone && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<a href={buildWhatsAppLink(whatsappPhone, whatsAppMessage())} target="_blank" rel="noreferrer" />}
              >
                <MessageCircle className="size-4" />
                Abrir WhatsApp
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleCopyMessage}>
                <Copy className="size-4" />
                Copiar mensagem de confirmação
              </Button>
            </div>
          )}

          {mode === 'cancel' && (
            <div className="flex flex-col gap-3 rounded-lg border p-3">
              <p className="text-sm font-medium">Cancelar consulta</p>
              <div className="flex flex-col gap-1.5">
                <Label>Quem solicitou o cancelamento? *</Label>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={cancelledBy === 'PATIENT' ? 'default' : 'outline'}
                    onClick={() => setCancelledBy('PATIENT')}
                  >
                    O paciente
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={cancelledBy === 'CLINIC' ? 'default' : 'outline'}
                    onClick={() => setCancelledBy('CLINIC')}
                  >
                    A clínica
                  </Button>
                </div>
                {cancelledBy === null && (
                  <p className="text-xs text-muted-foreground">
                    Isso define se a consulta aparece como &quot;cancelada pelo paciente&quot; ou &quot;cancelada pela
                    clínica&quot; — quem executou a ação fica sempre registrado abaixo, independente dessa escolha.
                  </p>
                )}
              </div>
              <Label htmlFor="cancel-reason">Motivo</Label>
              <Textarea id="cancel-reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={resetActionState}>
                  Voltar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={handleCancelSubmit}
                  disabled={busy || !cancelledBy || !cancelReason.trim()}
                >
                  Confirmar cancelamento
                </Button>
              </div>
            </div>
          )}

          {mode === 'noshow' && (
            <div className="flex flex-col gap-3 rounded-lg border p-3">
              <p className="text-sm font-medium">Registrar falta</p>
              <Label htmlFor="noshow-notes">Observação (opcional)</Label>
              <Textarea id="noshow-notes" value={noShowNotes} onChange={(e) => setNoShowNotes(e.target.value)} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={resetActionState}>
                  Voltar
                </Button>
                <Button type="button" size="sm" onClick={handleNoShowSubmit} disabled={busy}>
                  Confirmar falta
                </Button>
              </div>
            </div>
          )}

          {mode === 'reschedule' && (
            <div className="flex flex-col gap-3 rounded-lg border p-3">
              <p className="text-sm font-medium">Reagendar consulta</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="resched-date">Nova data</Label>
                  <Input id="resched-date" type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="resched-time">Novo horário</Label>
                  <Input id="resched-time" type="time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} />
                </div>
              </div>
              <Label htmlFor="resched-reason">Motivo (opcional)</Label>
              <Textarea id="resched-reason" value={rescheduleReason} onChange={(e) => setRescheduleReason(e.target.value)} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={resetActionState}>
                  Voltar
                </Button>
                <Button type="button" size="sm" onClick={handleRescheduleSubmit} disabled={busy}>
                  Confirmar reagendamento
                </Button>
              </div>
            </div>
          )}

          {mode === 'complete' && (
            <div className="flex flex-col gap-3 rounded-lg border p-3">
              <p className="text-sm font-medium">Finalizar atendimento</p>
              {canSeeClinical && (
                <>
                  <Label htmlFor="complete-clinical">Notas clínicas (interno)</Label>
                  <Textarea
                    id="complete-clinical"
                    value={completeClinicalNotes}
                    onChange={(e) => setCompleteClinicalNotes(e.target.value)}
                  />
                </>
              )}
              <Label htmlFor="complete-patient">Nota visível ao paciente (opcional)</Label>
              <Textarea id="complete-patient" value={completePatientNotes} onChange={(e) => setCompletePatientNotes(e.target.value)} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={resetActionState}>
                  Voltar
                </Button>
                <Button type="button" size="sm" onClick={handleCompleteSubmit} disabled={busy}>
                  Marcar como realizada
                </Button>
              </div>
              {canSeeClinical && (
                <div className="flex flex-col gap-2 border-t pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={
                      <Link
                        href={`/pacientes/${appointment.patient.id}/evolucao/nova?appointmentId=${appointment.id}&assessmentDate=${toLocalDateKey(
                          appointment.scheduledAt,
                        )}&nutritionistUserId=${appointment.nutritionistUser.id}`}
                      />
                    }
                  >
                    Criar evolução corporal agora
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={`/pacientes/${appointment.patient.id}/plano-alimentar/novo?appointmentId=${appointment.id}`} />}
                  >
                    Criar plano alimentar agora
                  </Button>
                  <ReturnSuggestions patientId={appointment.patient.id} nutritionistUserId={appointment.nutritionistUser.id} />
                </div>
              )}
            </div>
          )}

          {appointment.statusHistory.length > 0 && (
            <details className="rounded-lg border p-3 text-sm">
              <summary className="cursor-pointer font-medium">Histórico de status</summary>
              <div className="mt-2 flex flex-col gap-2">
                {appointment.statusHistory.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline">{APPOINTMENT_STATUS_LABELS[entry.toStatus]}</Badge>
                      <span className="text-muted-foreground">
                        {entry.changedByUser.name}
                        {entry.changedByRole && ` (${PLATFORM_ROLE_LABELS[entry.changedByRole]})`}
                      </span>
                    </div>
                    <span className="text-muted-foreground">{formatAppointmentDateTime(entry.changedAt)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        {mode === 'view' && (
          <DialogFooter className="flex-wrap">
            {(appointment.status === 'SCHEDULED' || appointment.status === 'AWAITING_CONFIRMATION') && (
              <Button type="button" size="sm" onClick={handleConfirm} disabled={busy}>
                Confirmar consulta
              </Button>
            )}
            {(appointment.status === 'SCHEDULED' ||
              appointment.status === 'AWAITING_CONFIRMATION' ||
              appointment.status === 'CONFIRMED') && (
              <Button type="button" size="sm" variant="outline" onClick={handleStart} disabled={busy}>
                Iniciar atendimento
              </Button>
            )}
            {appointment.status === 'IN_PROGRESS' && (
              <Button type="button" size="sm" onClick={() => setMode('complete')}>
                Finalizar atendimento
              </Button>
            )}
            {['SCHEDULED', 'AWAITING_CONFIRMATION', 'CONFIRMED'].includes(appointment.status) && (
              <>
                <Button type="button" size="sm" variant="outline" onClick={() => setMode('reschedule')}>
                  Reagendar
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setMode('noshow')}>
                  Marcar falta
                </Button>
                <Button type="button" size="sm" variant="destructive" onClick={() => setMode('cancel')}>
                  Cancelar
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReturnSuggestions({ patientId, nutritionistUserId }: { patientId: string; nutritionistUserId: string }) {
  const today = todayLocalDateKey();
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-muted-foreground">Agendar próximo retorno</p>
      <div className="flex flex-wrap gap-1.5">
        {RETURN_PRESETS_DAYS.map((days) => (
          <Button
            key={days}
            type="button"
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <Link
                href={`/agenda?novaConsulta=1&patientId=${patientId}&nutritionistUserId=${nutritionistUserId}&date=${addDaysToDateKey(today, days)}`}
              />
            }
          >
            {days} dias
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={`/agenda?novaConsulta=1&patientId=${patientId}&nutritionistUserId=${nutritionistUserId}`} />}
        >
          Personalizado
        </Button>
      </div>
    </div>
  );
}
