'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { listTreatmentCycles } from '@/lib/api/treatment-cycles';
import { listPatients } from '@/lib/api/patients';
import { ApiError } from '@/lib/api-client';
import { useTenantAuth } from '@/lib/auth-context';
import { CYCLE_STATUS_LABELS, type CycleStatus, type TreatmentCycleListItem } from '@/lib/types';

const PAGE_SIZE = 20;

const STATUS_BADGE_VARIANT: Record<CycleStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'outline',
  ACTIVE: 'default',
  PAUSED: 'secondary',
  COMPLETED: 'secondary',
  CANCELLED: 'destructive',
  RENEWED: 'outline',
};

function dateFormat(value: string) {
  return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function dateTimeFormat(value: string) {
  return new Date(value).toLocaleString('pt-BR');
}

function progressLabel(cycle: TreatmentCycleListItem) {
  const done = cycle._count.appointments;
  const planned = cycle.appointmentCountPlanned;
  const exceeds = done > planned;
  return { text: `${done} de ${planned}`, exceeds };
}

export default function CiclosPage() {
  const { accessToken } = useTenantAuth();

  const [patientSearch, setPatientSearch] = useState('');
  const [patientFilter, setPatientFilter] = useState<{ id: string; fullName: string } | null>(null);
  const [status, setStatus] = useState<CycleStatus | 'ALL'>('ACTIVE');
  const [page, setPage] = useState(1);

  const cyclesQuery = useQuery({
    queryKey: ['treatment-cycles-all', { patientId: patientFilter?.id, status, page }],
    queryFn: () =>
      listTreatmentCycles(accessToken!, {
        patientId: patientFilter?.id,
        status: status === 'ALL' ? undefined : status,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: !!accessToken,
  });

  const patientSearchQuery = useQuery({
    queryKey: ['patients-search-ciclos', patientSearch],
    queryFn: () => listPatients(accessToken!, { search: patientSearch, pageSize: 6 }),
    enabled: !patientFilter && patientSearch.trim().length >= 2,
  });

  const totalPages = useMemo(() => {
    if (!cyclesQuery.data) return 1;
    return Math.max(1, Math.ceil(cyclesQuery.data.total / PAGE_SIZE));
  }, [cyclesQuery.data]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ciclos</h1>
        <p className="text-sm text-muted-foreground">Contratações e acompanhamentos em andamento por paciente</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>Filtre por paciente ou status do ciclo</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <div className="relative flex-1 sm:min-w-56">
            {patientFilter ? (
              <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <span className="font-medium">{patientFilter.fullName}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPatientFilter(null);
                    setPatientSearch('');
                    setPage(1);
                  }}
                >
                  Limpar
                </Button>
              </div>
            ) : (
              <>
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar paciente..."
                  className="pl-9"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                />
                {patientSearchQuery.data && patientSearchQuery.data.data.length > 0 && (
                  <div className="absolute z-10 mt-1 flex w-full flex-col divide-y rounded-lg border bg-popover shadow-md">
                    {patientSearchQuery.data.data.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        className="px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => {
                          setPatientFilter({ id: p.id, fullName: p.fullName });
                          setPage(1);
                        }}
                      >
                        {p.fullName}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <Select
            value={status}
            onValueChange={(v) => {
              setStatus((v as CycleStatus | 'ALL') ?? 'ALL');
              setPage(1);
            }}
          >
            <SelectTrigger className="sm:w-52">
              <SelectValue placeholder="Status">
                {(v: string) => (v === 'ALL' ? 'Todos os status' : CYCLE_STATUS_LABELS[v as CycleStatus])}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os status</SelectItem>
              {Object.entries(CYCLE_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {cyclesQuery.isLoading ? (
            <div className="flex flex-col gap-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : cyclesQuery.isError ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center">
              <p className="font-medium">Não foi possível carregar os ciclos</p>
              <p className="text-sm text-muted-foreground">
                {cyclesQuery.error instanceof ApiError ? cyclesQuery.error.message : 'Tente novamente em instantes.'}
              </p>
              <Button variant="outline" onClick={() => cyclesQuery.refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : cyclesQuery.data?.data.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center">
              <p className="font-medium">Nenhum ciclo encontrado</p>
              <p className="text-sm text-muted-foreground">Ajuste os filtros para ver outros ciclos.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Consultas</TableHead>
                    <TableHead>Próxima consulta</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cyclesQuery.data?.data.map((cycle) => {
                    const progress = progressLabel(cycle);
                    const nextAppointment = cycle.appointments[0];
                    return (
                      <TableRow key={cycle.id}>
                        <TableCell>
                          <Link href={`/pacientes/${cycle.patient.id}`} className="font-medium hover:underline">
                            {cycle.patient.fullName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{cycle.plan.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {dateFormat(cycle.startDate)}
                          {cycle.expectedEndDate ? ` – ${dateFormat(cycle.expectedEndDate)}` : ''}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_BADGE_VARIANT[cycle.status]}>{CYCLE_STATUS_LABELS[cycle.status]}</Badge>
                        </TableCell>
                        <TableCell className={progress.exceeds ? 'font-medium text-amber-700 dark:text-amber-500' : undefined}>
                          {progress.text}
                          {progress.exceeds && ' — excede o previsto'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {nextAppointment ? dateTimeFormat(nextAppointment.scheduledAt) : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/pacientes/${cycle.patient.id}`} />}>
                            Ver paciente
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {cyclesQuery.data && cyclesQuery.data.total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {cyclesQuery.data.total} ciclo{cyclesQuery.data.total === 1 ? '' : 's'} — página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
