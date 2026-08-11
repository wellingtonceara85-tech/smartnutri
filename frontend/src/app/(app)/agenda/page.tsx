'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { AppointmentDetailDialog } from '@/components/appointment-detail-dialog';
import { AppointmentFormDialog } from '@/components/appointment-form-dialog';
import { AppointmentCompactRow, AppointmentRow } from '@/components/appointment-row';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { listAppointments } from '@/lib/api/appointments';
import { listNutritionists } from '@/lib/api/users';
import { useTenantAuth } from '@/lib/auth-context';
import {
  addDaysToDateKey,
  daysInMonth,
  formatAppointmentDate,
  localDateKeyToUtcMidnightIso,
  startOfMonthDateKey,
  startOfWeekDateKey,
  todayLocalDateKey,
  toLocalDateKey,
} from '@/lib/appointment-datetime';
import { APPOINTMENT_STATUS_LABELS, type Appointment, type AppointmentStatus } from '@/lib/types';

type ViewMode = 'day' | 'week' | 'month' | 'list';

const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const MONTH_NAMES_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];
const EMPTY_APPOINTMENTS: Appointment[] = [];

export default function AgendaPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <AgendaPageContent />
    </Suspense>
  );
}

function AgendaPageContent() {
  const { accessToken, user } = useTenantAuth();
  const searchParams = useSearchParams();

  const [view, setView] = useState<ViewMode>('day');
  const [anchorDate, setAnchorDate] = useState(() => searchParams.get('date') ?? todayLocalDateKey());
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'ALL'>('ALL');
  const [nutritionistFilter, setNutritionistFilter] = useState<string>('ALL');
  const [listTab, setListTab] = useState<'upcoming' | 'past'>('upcoming');

  // Estado inicial lido uma única vez da URL (link "Agendar retorno" vindo do
  // detalhe da consulta) — usar useState preguiçoso em vez de um efeito evita
  // o setState síncrono dentro de useEffect (cascading renders).
  const [formOpen, setFormOpen] = useState(() => searchParams.get('novaConsulta') === '1');
  const [formDefaultDate, setFormDefaultDate] = useState<string | undefined>(() => searchParams.get('date') ?? undefined);
  const [formPatientId, setFormPatientId] = useState<string | undefined>(() => searchParams.get('patientId') ?? undefined);
  const [formNutritionistId, setFormNutritionistId] = useState<string | undefined>(
    () => searchParams.get('nutritionistUserId') ?? undefined,
  );
  const [detailId, setDetailId] = useState<string | null>(null);

  const nutritionistsQuery = useQuery({
    queryKey: ['nutritionists'],
    queryFn: () => listNutritionists(accessToken!),
    enabled: !!accessToken,
  });
  const showNutritionistFilter = (nutritionistsQuery.data?.length ?? 0) > 1;

  const range = useMemo(() => {
    if (view === 'day') {
      return { start: anchorDate, end: addDaysToDateKey(anchorDate, 1) };
    }
    if (view === 'week') {
      const start = startOfWeekDateKey(anchorDate);
      return { start, end: addDaysToDateKey(start, 7) };
    }
    if (view === 'month') {
      const start = startOfMonthDateKey(anchorDate);
      const [y, m] = start.split('-').map(Number);
      return { start, end: addDaysToDateKey(start, daysInMonth(y, m)) };
    }
    // list: 60 dias para trás e 90 para frente, filtrado depois por aba
    return { start: addDaysToDateKey(todayLocalDateKey(), -60), end: addDaysToDateKey(todayLocalDateKey(), 90) };
  }, [view, anchorDate]);

  const appointmentsQuery = useQuery({
    queryKey: ['appointments', range.start, range.end, statusFilter, nutritionistFilter],
    queryFn: () =>
      listAppointments(accessToken!, {
        startDate: localDateKeyToUtcMidnightIso(range.start),
        endDate: localDateKeyToUtcMidnightIso(range.end),
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        nutritionistId: nutritionistFilter === 'ALL' ? undefined : nutritionistFilter,
      }),
    enabled: !!accessToken,
  });

  const appointments = appointmentsQuery.data ?? EMPTY_APPOINTMENTS;
  const byDateKey = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const appt of appointments) {
      const key = toLocalDateKey(appt.scheduledAt);
      const list = map.get(key) ?? [];
      list.push(appt);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    return map;
  }, [appointments]);

  function shiftAnchor(direction: 1 | -1) {
    if (view === 'day') setAnchorDate((d) => addDaysToDateKey(d, direction));
    else if (view === 'week') setAnchorDate((d) => addDaysToDateKey(d, direction * 7));
    else if (view === 'month') {
      const [y, m] = anchorDate.split('-').map(Number);
      const newMonth = m - 1 + direction;
      const newDate = new Date(Date.UTC(y, newMonth, 1));
      setAnchorDate(newDate.toISOString().slice(0, 10));
    }
  }

  function periodLabel(): string {
    if (view === 'day') return formatAppointmentDate(localDateKeyToUtcMidnightIso(anchorDate));
    if (view === 'week') {
      const start = startOfWeekDateKey(anchorDate);
      const end = addDaysToDateKey(start, 6);
      return `${formatAppointmentDate(localDateKeyToUtcMidnightIso(start))} – ${formatAppointmentDate(localDateKeyToUtcMidnightIso(end))}`;
    }
    if (view === 'month') {
      const [y, m] = anchorDate.split('-').map(Number);
      // Nome do mês vem de uma tabela fixa, nunca de Intl+Date: meia-noite UTC
      // do dia 1 é, em qualquer fuso a oeste de UTC (ex.: America/Sao_Paulo,
      // -03:00), ainda o dia 31 do mês anterior — formatar essa data (mesmo
      // com timeZone explícito) mostraria "julho" para "agosto". Como já
      // temos `m` como número, olhar na tabela evita o problema por completo.
      return `${MONTH_NAMES_PT[m - 1]} de ${y}`;
    }
    return 'Próximas e passadas';
  }

  function openNewAppointment(dateKey?: string) {
    setFormPatientId(undefined);
    setFormNutritionistId(undefined);
    setFormDefaultDate(dateKey);
    setFormOpen(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agenda</h1>
          <p className="text-sm text-muted-foreground">
            {appointmentsQuery.isLoading ? 'Carregando...' : `${appointments.length} consulta(s) no período`}
          </p>
        </div>
        <Button onClick={() => openNewAppointment(view === 'day' ? anchorDate : undefined)}>
          <Plus className="size-4" />
          Nova consulta
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {view !== 'list' && (
              <>
                <Button variant="outline" size="icon-sm" onClick={() => shiftAnchor(-1)} aria-label="Período anterior">
                  <ChevronLeft className="size-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAnchorDate(todayLocalDateKey())}>
                  Hoje
                </Button>
                <Button variant="outline" size="icon-sm" onClick={() => shiftAnchor(1)} aria-label="Próximo período">
                  <ChevronRight className="size-4" />
                </Button>
                <span className="ml-2 text-sm font-medium capitalize">{periodLabel()}</span>
              </>
            )}
          </div>

          <div className="flex gap-1">
            {(['day', 'week', 'month', 'list'] as ViewMode[]).map((v) => (
              <Button key={v} size="sm" variant={view === v ? 'default' : 'outline'} onClick={() => setView(v)}>
                {{ day: 'Dia', week: 'Semana', month: 'Mês', list: 'Lista' }[v]}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {showNutritionistFilter && (
            <Select value={nutritionistFilter} onValueChange={(v) => setNutritionistFilter(v ?? 'ALL')}>
              <SelectTrigger size="sm">
                <SelectValue placeholder="Nutricionista">
                  {(v: string) =>
                    v === 'ALL' ? 'Todos os nutricionistas' : (nutritionistsQuery.data?.find((n) => n.id === v)?.name ?? '')
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os nutricionistas</SelectItem>
                {nutritionistsQuery.data?.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as AppointmentStatus | 'ALL')}>
            <SelectTrigger size="sm">
              <SelectValue placeholder="Status">
                {(v: string) => (v === 'ALL' ? 'Todos os status' : APPOINTMENT_STATUS_LABELS[v as AppointmentStatus])}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os status</SelectItem>
              {(Object.keys(APPOINTMENT_STATUS_LABELS) as AppointmentStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {APPOINTMENT_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {appointmentsQuery.isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          {view === 'day' && (
            <DayView
              dateKey={anchorDate}
              appointments={byDateKey.get(anchorDate) ?? []}
              onSelect={setDetailId}
              onEmptySlotClick={() => openNewAppointment(anchorDate)}
            />
          )}
          {view === 'week' && (
            <WeekView startDateKey={startOfWeekDateKey(anchorDate)} byDateKey={byDateKey} onSelect={setDetailId} />
          )}
          {view === 'month' && (
            <MonthView
              monthStartKey={startOfMonthDateKey(anchorDate)}
              byDateKey={byDateKey}
              onDayClick={(key) => {
                setAnchorDate(key);
                setView('day');
              }}
            />
          )}
          {view === 'list' && (
            <ListView appointments={appointments} tab={listTab} onTabChange={setListTab} onSelect={setDetailId} />
          )}
        </>
      )}

      <AppointmentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        patientId={formPatientId}
        defaultDate={formDefaultDate}
        defaultNutritionistUserId={formNutritionistId ?? (user?.role === 'NUTRITIONIST' ? user.id : undefined)}
      />
      <AppointmentDetailDialog open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)} appointmentId={detailId} />
    </div>
  );
}

function DayView({
  dateKey,
  appointments,
  onSelect,
  onEmptySlotClick,
}: {
  dateKey: string;
  appointments: Appointment[];
  onSelect: (id: string) => void;
  onEmptySlotClick: () => void;
}) {
  if (appointments.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-12 text-center text-muted-foreground">
        <p>Nenhuma consulta agendada para {formatAppointmentDate(localDateKeyToUtcMidnightIso(dateKey))}.</p>
        <Button variant="outline" size="sm" onClick={onEmptySlotClick}>
          Agendar consulta neste dia
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {appointments.map((appt) => (
        <AppointmentRow key={appt.id} appointment={appt} onClick={() => onSelect(appt.id)} />
      ))}
    </div>
  );
}

function WeekView({
  startDateKey,
  byDateKey,
  onSelect,
}: {
  startDateKey: string;
  byDateKey: Map<string, Appointment[]>;
  onSelect: (id: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDaysToDateKey(startDateKey, i));
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[840px] grid-cols-7 gap-2">
        {days.map((dateKey, i) => (
          <Card key={dateKey}>
            <CardContent className="flex flex-col gap-2 p-2">
              <p className="text-center text-xs font-medium text-muted-foreground">
                {WEEKDAY_LABELS[i]} <span className="block text-sm text-foreground">{dateKey.slice(8, 10)}</span>
              </p>
              <div className="flex flex-col gap-1.5">
                {(byDateKey.get(dateKey) ?? []).map((appt) => (
                  <AppointmentCompactRow key={appt.id} appointment={appt} onClick={() => onSelect(appt.id)} />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function MonthView({
  monthStartKey,
  byDateKey,
  onDayClick,
}: {
  monthStartKey: string;
  byDateKey: Map<string, Appointment[]>;
  onDayClick: (dateKey: string) => void;
}) {
  const [year, month] = monthStartKey.split('-').map(Number);
  const totalDays = daysInMonth(year, month);
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0=domingo
  const leadingBlanks = firstWeekday === 0 ? 6 : firstWeekday - 1;
  const cells: (string | null)[] = [...Array(leadingBlanks).fill(null), ...Array.from({ length: totalDays }, (_, i) => addDaysToDateKey(monthStartKey, i))];
  const today = todayLocalDateKey();

  return (
    <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
      {WEEKDAY_LABELS.map((label) => (
        <div key={label} className="text-center text-xs font-medium text-muted-foreground">
          {label}
        </div>
      ))}
      {cells.map((dateKey, idx) => {
        if (!dateKey) return <div key={`blank-${idx}`} />;
        const dayAppointments = byDateKey.get(dateKey) ?? [];
        const isToday = dateKey === today;
        return (
          <button
            key={dateKey}
            type="button"
            onClick={() => onDayClick(dateKey)}
            className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border text-sm transition-colors hover:bg-muted ${
              isToday ? 'border-primary' : ''
            }`}
          >
            <span className={isToday ? 'font-semibold text-primary' : ''}>{dateKey.slice(8, 10)}</span>
            {dayAppointments.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">{dayAppointments.length}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ListView({
  appointments,
  tab,
  onTabChange,
  onSelect,
}: {
  appointments: Appointment[];
  tab: 'upcoming' | 'past';
  onTabChange: (tab: 'upcoming' | 'past') => void;
  onSelect: (id: string) => void;
}) {
  const nowIso = new Date().toISOString();
  const filtered = appointments
    .filter((a) => (tab === 'upcoming' ? a.scheduledAt >= nowIso : a.scheduledAt < nowIso))
    .sort((a, b) => (tab === 'upcoming' ? a.scheduledAt.localeCompare(b.scheduledAt) : b.scheduledAt.localeCompare(a.scheduledAt)));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5">
        <Button size="sm" variant={tab === 'upcoming' ? 'default' : 'outline'} onClick={() => onTabChange('upcoming')}>
          Próximas
        </Button>
        <Button size="sm" variant={tab === 'past' ? 'default' : 'outline'} onClick={() => onTabChange('past')}>
          Passadas
        </Button>
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          Nenhuma consulta {tab === 'upcoming' ? 'futura' : 'passada'} no período.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((appt) => (
            <div key={appt.id} className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">{formatAppointmentDate(appt.scheduledAt)}</p>
              <AppointmentRow appointment={appt} onClick={() => onSelect(appt.id)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
