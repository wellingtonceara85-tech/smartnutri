'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createAppointment, listAppointmentTypes } from '@/lib/api/appointments';
import { getPatient, listPatients } from '@/lib/api/patients';
import { listNutritionists } from '@/lib/api/users';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { localDateTimeToUtcIso, todayLocalDateKey } from '@/lib/appointment-datetime';
import { maskPhone } from '@/lib/masks';
import { APPOINTMENT_MODALITY_LABELS, type AppointmentModality, type AppointmentType } from '@/lib/types';

const DURATION_PRESETS = [30, 45, 60, 90];

interface PreselectedPatient {
  id: string;
  fullName: string;
  primaryPhone: string | null;
  whatsappPhone: string | null;
  status: string;
}

interface AppointmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quando vem do perfil do paciente (ou de "agendar retorno"), o paciente já chega selecionado e travado. */
  patientId?: string;
  defaultDate?: string;
  defaultNutritionistUserId?: string;
  onCreated?: () => void;
}

/**
 * O conteúdo do formulário é remontado (via `key`) toda vez que o diálogo
 * abre — em vez de um `useEffect` "resetando" cada campo manualmente a cada
 * abertura (setState síncrono dentro de efeito, cascata de renders). Um
 * `useState` preguiçoso já nasce com o valor certo em cada montagem nova.
 */
export function AppointmentFormDialog({
  open,
  onOpenChange,
  patientId,
  defaultDate,
  defaultNutritionistUserId,
  onCreated,
}: AppointmentFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <AppointmentFormBody
          key={open ? `open-${patientId ?? 'search'}-${defaultDate ?? ''}` : 'closed'}
          onOpenChange={onOpenChange}
          patientId={patientId}
          defaultDate={defaultDate}
          defaultNutritionistUserId={defaultNutritionistUserId}
          onCreated={onCreated}
        />
      </DialogContent>
    </Dialog>
  );
}

function AppointmentFormBody({
  onOpenChange,
  patientId,
  defaultDate,
  defaultNutritionistUserId,
  onCreated,
}: Omit<AppointmentFormDialogProps, 'open'>) {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();

  const lockedPatientQuery = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => getPatient(accessToken!, patientId!),
    enabled: !!accessToken && !!patientId,
  });

  const [patientSearch, setPatientSearch] = useState('');
  const [manualPatient, setManualPatient] = useState<PreselectedPatient | null>(null);
  const [manualNutritionistId, setManualNutritionistId] = useState<string | null>(null);
  const [appointmentTypeId, setAppointmentTypeId] = useState('');
  const [date, setDate] = useState(defaultDate ?? todayLocalDateKey());
  const [startTime, setStartTime] = useState('09:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [customDuration, setCustomDuration] = useState(false);
  const [modality, setModality] = useState<AppointmentModality>('IN_PERSON');
  const [location, setLocation] = useState('');
  const [onlineMeetingUrl, setOnlineMeetingUrl] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const nutritionistsQuery = useQuery({
    queryKey: ['nutritionists'],
    queryFn: () => listNutritionists(accessToken!),
    enabled: !!accessToken,
  });
  const typesQuery = useQuery({
    queryKey: ['appointment-types'],
    queryFn: () => listAppointmentTypes(accessToken!),
    enabled: !!accessToken,
  });
  const patientSearchQuery = useQuery({
    queryKey: ['patients-search', patientSearch],
    queryFn: () => listPatients(accessToken!, { search: patientSearch, pageSize: 6 }),
    enabled: !patientId && patientSearch.trim().length >= 2,
  });

  // Paciente travado (perfil/retorno) vem da query; busca manual vive em estado local — nunca sincronizados via efeito.
  const selectedPatient: PreselectedPatient | null = patientId
    ? lockedPatientQuery.data
      ? {
          id: lockedPatientQuery.data.id,
          fullName: lockedPatientQuery.data.fullName,
          primaryPhone: lockedPatientQuery.data.primaryPhone,
          whatsappPhone: lockedPatientQuery.data.whatsappPhone,
          status: lockedPatientQuery.data.status,
        }
      : null
    : manualPatient;

  // Nutricionista efetivo: escolha manual > pré-preenchido > único disponível > o próprio ator, nessa ordem — derivado, não sincronizado.
  const nutritionistUserId =
    manualNutritionistId ??
    defaultNutritionistUserId ??
    (nutritionistsQuery.data?.length === 1 ? nutritionistsQuery.data[0].id : undefined) ??
    (user?.role === 'NUTRITIONIST' ? user.id : undefined) ??
    '';

  function handleTypeChange(typeId: string | null) {
    if (!typeId) return;
    setAppointmentTypeId(typeId);
    const type = typesQuery.data?.find((t: AppointmentType) => t.id === typeId);
    if (type && !customDuration) {
      setDurationMinutes(type.defaultDurationMinutes);
    }
  }

  const endTimeLabel = (() => {
    const [h, m] = startTime.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return '--:--';
    const totalMinutes = h * 60 + m + durationMinutes;
    const endH = Math.floor(totalMinutes / 60) % 24;
    const endM = totalMinutes % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  })();

  async function handleSubmit() {
    if (!accessToken) return;
    if (!selectedPatient) {
      toast.error('Selecione o paciente');
      return;
    }
    if (!appointmentTypeId) {
      toast.error('Selecione o tipo da consulta');
      return;
    }
    if (!nutritionistUserId) {
      toast.error('Selecione o nutricionista responsável');
      return;
    }

    setSubmitting(true);
    try {
      await createAppointment(accessToken, {
        patientId: selectedPatient.id,
        nutritionistUserId,
        appointmentTypeId,
        scheduledAt: localDateTimeToUtcIso(date, startTime),
        durationMinutes,
        modality,
        location: location || undefined,
        onlineMeetingUrl: onlineMeetingUrl || undefined,
        adminNotes: adminNotes || undefined,
        isConfirmed,
      });
      toast.success('Consulta agendada');
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['patient-appointments', selectedPatient.id] });
      onOpenChange(false);
      onCreated?.();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível agendar a consulta');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Nova consulta</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label>Paciente</Label>
          {selectedPatient ? (
            <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              <div>
                <p className="font-medium">{selectedPatient.fullName}</p>
                {selectedPatient.primaryPhone && <p className="text-muted-foreground">{maskPhone(selectedPatient.primaryPhone)}</p>}
              </div>
              {!patientId && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setManualPatient(null)}>
                  Trocar
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Input
                placeholder="Buscar paciente por nome..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
              />
              {patientSearchQuery.data && patientSearchQuery.data.data.length > 0 && (
                <div className="flex flex-col divide-y rounded-lg border">
                  {patientSearchQuery.data.data.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      className="flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() =>
                        setManualPatient({
                          id: p.id,
                          fullName: p.fullName,
                          primaryPhone: p.primaryPhone,
                          whatsappPhone: p.whatsappPhone,
                          status: p.status,
                        })
                      }
                    >
                      <span className="font-medium">{p.fullName}</span>
                      <span className="text-muted-foreground">{p.primaryPhone ? maskPhone(p.primaryPhone) : ''}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {nutritionistsQuery.data && nutritionistsQuery.data.length > 1 && (
          <div className="flex flex-col gap-2">
            <Label>Profissional</Label>
            <Select value={nutritionistUserId} onValueChange={(v) => setManualNutritionistId(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {nutritionistsQuery.data.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="appt-date">Data</Label>
            <Input id="appt-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="appt-start">Início</Label>
            <Input id="appt-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>Duração</Label>
            <div className="flex flex-wrap gap-1.5">
              {DURATION_PRESETS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  size="sm"
                  variant={!customDuration && durationMinutes === preset ? 'default' : 'outline'}
                  onClick={() => {
                    setCustomDuration(false);
                    setDurationMinutes(preset);
                  }}
                >
                  {preset}min
                </Button>
              ))}
              <Button type="button" size="sm" variant={customDuration ? 'default' : 'outline'} onClick={() => setCustomDuration(true)}>
                Outro
              </Button>
            </div>
            {customDuration && (
              <Input
                type="number"
                min={10}
                max={480}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value) || 0)}
              />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label>Fim previsto</Label>
            <p className="flex h-8 items-center text-sm text-muted-foreground">{endTimeLabel}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Tipo de consulta</Label>
          <Select value={appointmentTypeId} onValueChange={handleTypeChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {typesQuery.data?.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Modalidade</Label>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(APPOINTMENT_MODALITY_LABELS) as AppointmentModality[]).map((m) => (
              <Button key={m} type="button" size="sm" variant={modality === m ? 'default' : 'outline'} onClick={() => setModality(m)}>
                {APPOINTMENT_MODALITY_LABELS[m]}
              </Button>
            ))}
          </div>
        </div>

        {modality === 'ONLINE' ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="appt-link">Link da reunião</Label>
            <Input
              id="appt-link"
              placeholder="https://..."
              value={onlineMeetingUrl}
              onChange={(e) => setOnlineMeetingUrl(e.target.value)}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="appt-location">Local</Label>
            <Input id="appt-location" placeholder="Ex.: Consultório 1" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="appt-notes">Observações administrativas</Label>
          <Textarea id="appt-notes" value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Confirmação</Label>
          <div className="flex gap-1.5">
            <Button type="button" size="sm" variant={!isConfirmed ? 'default' : 'outline'} onClick={() => setIsConfirmed(false)}>
              Aguardar confirmação
            </Button>
            <Button type="button" size="sm" variant={isConfirmed ? 'default' : 'outline'} onClick={() => setIsConfirmed(true)}>
              Já confirmada
            </Button>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Salvando...' : 'Agendar consulta'}
        </Button>
      </DialogFooter>
    </>
  );
}
