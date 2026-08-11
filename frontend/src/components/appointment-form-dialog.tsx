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
import { listPaymentMethods } from '@/lib/api/payment-methods';
import { getPatient, listPatients } from '@/lib/api/patients';
import { listPatientTreatmentCycles } from '@/lib/api/treatment-cycles';
import { listNutritionists } from '@/lib/api/users';
import { ApiError } from '@/lib/api-client';
import { useTenantAuth } from '@/lib/auth-context';
import { localDateTimeToUtcIso, todayLocalDateKey } from '@/lib/appointment-datetime';
import { maskPhone } from '@/lib/masks';
import {
  APPOINTMENT_MODALITY_LABELS,
  type AppointmentModality,
  type AppointmentType,
  type DiscountType,
} from '@/lib/types';

function currencyFormat(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

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
  const { accessToken, user } = useTenantAuth();
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
  // null = ainda não escolhido manualmente — assume o único ciclo ativo do paciente, se houver.
  const [linkChoice, setLinkChoice] = useState<string | null>(null);
  const [standaloneValue, setStandaloneValue] = useState('');
  const [standaloneDiscountType, setStandaloneDiscountType] = useState<DiscountType>('PERCENTAGE');
  const [standaloneDiscountValue, setStandaloneDiscountValue] = useState('');
  const [standalonePaymentMethodId, setStandalonePaymentMethodId] = useState<string | null>(null);

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
  const paymentMethodsQuery = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => listPaymentMethods(accessToken!),
    enabled: !!accessToken,
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

  const treatmentCyclesQuery = useQuery({
    queryKey: ['patient-treatment-cycles', selectedPatient?.id],
    queryFn: () => listPatientTreatmentCycles(accessToken!, selectedPatient!.id),
    enabled: !!accessToken && !!selectedPatient,
  });
  const activeCycles = (treatmentCyclesQuery.data ?? []).filter((c) => c.status === 'ACTIVE');
  const AVULSO_VALUE = 'AVULSO';
  // Se o paciente foi trocado depois de uma escolha manual, linkChoice pode apontar para um
  // ciclo que não existe mais na lista atual (nenhum <SelectItem> corresponderia) — nesse caso
  // o Select cairia no fallback do Base UI e renderizaria o UUID cru como rótulo. Por isso a
  // escolha só é respeitada se ainda for válida para o paciente selecionado agora; do contrário
  // volta a auto-escolher, sem precisar de efeito para "resetar" o estado ao trocar de paciente.
  const linkChoiceStillValid =
    linkChoice !== null && (linkChoice === AVULSO_VALUE || activeCycles.some((c) => c.id === linkChoice));
  const effectiveLink = linkChoiceStillValid
    ? (linkChoice as string)
    : activeCycles.length > 0
      ? activeCycles[0].id
      : AVULSO_VALUE;
  const selectedCycle = activeCycles.find((c) => c.id === effectiveLink) ?? null;

  function cycleLinkLabel(v: string): string {
    if (v === AVULSO_VALUE) return 'Avulsa (sem plano)';
    const cycle = activeCycles.find((c) => c.id === v);
    if (!cycle) return '';
    const nextSequence = cycle._count.appointments + 1;
    const exceeds = nextSequence > cycle.appointmentCountPlanned;
    return `${cycle.plan.name} — ${nextSequence}ª consulta${
      exceeds ? ` (excede as ${cycle.appointmentCountPlanned} previstas no plano)` : ` de ${cycle.appointmentCountPlanned}`
    }`;
  }

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

  const standalonePreview = (() => {
    const value = Number(standaloneValue) || 0;
    if (value <= 0) return null;
    const discount = Number(standaloneDiscountValue) || 0;
    const discountAmount = standaloneDiscountType === 'PERCENTAGE' ? (value * discount) / 100 : discount;
    const finalValue = Math.max(value - discountAmount, 0);
    return discount > 0
      ? `Valor final: ${currencyFormat(finalValue)} (${currencyFormat(value)} − ${currencyFormat(discountAmount)})`
      : `Valor final: ${currencyFormat(finalValue)}`;
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
        treatmentCycleId: selectedCycle ? selectedCycle.id : undefined,
        standaloneValue: !selectedCycle && standaloneValue ? Number(standaloneValue) : undefined,
        standaloneDiscountType: !selectedCycle && standaloneValue ? standaloneDiscountType : undefined,
        standaloneDiscountValue:
          !selectedCycle && standaloneValue && standaloneDiscountValue ? Number(standaloneDiscountValue) : undefined,
        standalonePaymentMethodId: !selectedCycle && standalonePaymentMethodId ? standalonePaymentMethodId : undefined,
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
                <SelectValue placeholder="Selecione">
                  {(v: string) => nutritionistsQuery.data?.find((n) => n.id === v)?.name ?? ''}
                </SelectValue>
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
              <SelectValue placeholder="Selecione">
                {(v: string) => typesQuery.data?.find((t) => t.id === v)?.name ?? ''}
              </SelectValue>
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

        {selectedPatient && (
          <div className="flex flex-col gap-3 rounded-lg border p-3">
            {activeCycles.length > 0 ? (
              <>
                <Label>Cobrança</Label>
                <Select value={effectiveLink} onValueChange={(v) => v && setLinkChoice(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione">{(v: string) => cycleLinkLabel(v)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {activeCycles.map((cycle) => (
                      <SelectItem key={cycle.id} value={cycle.id}>
                        {cycleLinkLabel(cycle.id)}
                      </SelectItem>
                    ))}
                    <SelectItem value={AVULSO_VALUE}>Avulsa (sem plano)</SelectItem>
                  </SelectContent>
                </Select>
                {selectedCycle && (
                  <p
                    className={
                      selectedCycle._count.appointments + 1 > selectedCycle.appointmentCountPlanned
                        ? 'text-xs font-medium text-amber-700 dark:text-amber-500'
                        : 'text-xs text-muted-foreground'
                    }
                  >
                    {selectedCycle._count.appointments + 1 > selectedCycle.appointmentCountPlanned
                      ? `${selectedCycle._count.appointments + 1}ª consulta — excede as ${selectedCycle.appointmentCountPlanned} consultas previstas no plano. O agendamento não é bloqueado, mas fica sinalizado aqui.`
                      : 'Vinculada ao plano contratado — valor e desconto já definidos na contratação, não são pedidos de novo.'}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Paciente sem plano ativo — informe os valores da consulta avulsa abaixo (opcional).
              </p>
            )}

            {!selectedCycle && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="appt-standalone-value">Valor da consulta</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    id="appt-standalone-value"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="R$"
                    value={standaloneValue}
                    onChange={(e) => setStandaloneValue(e.target.value)}
                  />
                  <Select
                    value={standalonePaymentMethodId ?? ''}
                    onValueChange={(v) => setStandalonePaymentMethodId(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Forma de pagamento">
                        {(v: string) => paymentMethodsQuery.data?.find((m) => m.id === v)?.name ?? ''}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethodsQuery.data?.map((method) => (
                        <SelectItem key={method.id} value={method.id}>
                          {method.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {standaloneValue && (
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant={standaloneDiscountType === 'FIXED' ? 'default' : 'outline'}
                        onClick={() => setStandaloneDiscountType('FIXED')}
                      >
                        R$
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={standaloneDiscountType === 'PERCENTAGE' ? 'default' : 'outline'}
                        onClick={() => setStandaloneDiscountType('PERCENTAGE')}
                      >
                        %
                      </Button>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Desconto"
                      className="flex-1"
                      value={standaloneDiscountValue}
                      onChange={(e) => setStandaloneDiscountValue(e.target.value)}
                    />
                  </div>
                )}
                {standalonePreview && <p className="text-xs text-muted-foreground">{standalonePreview}</p>}
              </div>
            )}
          </div>
        )}

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
