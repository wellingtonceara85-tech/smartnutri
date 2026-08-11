'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ClipboardList, Printer, Repeat, Users, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { listAppointments } from '@/lib/api/appointments';
import { listPatients } from '@/lib/api/patients';
import { listTreatmentCycles } from '@/lib/api/treatment-cycles';
import { getFinanceSummary } from '@/lib/api/finance';
import { useTenantAuth } from '@/lib/auth-context';

function currencyFormat(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function monthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function monthYearLabel(date: Date) {
  const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const NON_REALIZED_STATUSES = new Set(['CANCELLED_BY_CLINIC', 'CANCELLED_BY_PATIENT', 'RESCHEDULED']);

/**
 * Primeira versão do Relatórios (Missão 0006.2): só compõe indicadores a
 * partir de endpoints que já existem (pacientes, agenda, financeiro,
 * ciclos) — sem motor de relatórios novo, sem BI. Uma versão definitiva
 * (filtros de período, exportação, gráficos) fica para uma missão própria.
 */
export default function RelatoriosPage() {
  const { accessToken } = useTenantAuth();
  const now = new Date();
  const { start, end } = monthRange(now);
  const periodLabel = monthYearLabel(now);
  const issuedAtLabel = now.toLocaleString('pt-BR');

  const activePatientsQuery = useQuery({
    queryKey: ['reports-active-patients'],
    queryFn: () => listPatients(accessToken!, { status: 'ACTIVE', pageSize: 1 }),
    enabled: !!accessToken,
  });

  const totalPatientsQuery = useQuery({
    queryKey: ['reports-total-patients'],
    queryFn: () => listPatients(accessToken!, { pageSize: 1 }),
    enabled: !!accessToken,
  });

  const appointmentsThisMonthQuery = useQuery({
    queryKey: ['reports-appointments-month', start, end],
    queryFn: () => listAppointments(accessToken!, { startDate: start, endDate: end }),
    enabled: !!accessToken,
  });

  const activeCyclesQuery = useQuery({
    queryKey: ['reports-active-cycles'],
    queryFn: () => listTreatmentCycles(accessToken!, { status: 'ACTIVE', pageSize: 1 }),
    enabled: !!accessToken,
  });

  const financeSummaryQuery = useQuery({
    queryKey: ['reports-finance-summary'],
    queryFn: () => getFinanceSummary(accessToken!),
    enabled: !!accessToken,
  });

  const isLoading =
    activePatientsQuery.isLoading ||
    totalPatientsQuery.isLoading ||
    appointmentsThisMonthQuery.isLoading ||
    activeCyclesQuery.isLoading ||
    financeSummaryQuery.isLoading;

  const appointments = appointmentsThisMonthQuery.data ?? [];
  const realized = appointments.filter((a) => a.status === 'DONE').length;
  const cancelled = appointments.filter(
    (a) => a.status === 'CANCELLED_BY_CLINIC' || a.status === 'CANCELLED_BY_PATIENT',
  ).length;
  const upcoming = appointments.filter((a) => !NON_REALIZED_STATUSES.has(a.status) && a.status !== 'DONE').length;

  return (
    <div className="print-report flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            {periodLabel} · Indicadores do mês atual, a partir dos dados já cadastrados
          </p>
          <p className="text-xs text-muted-foreground">Emitido em {issuedAtLabel}</p>
        </div>
        <Button variant="outline" size="sm" className="no-print" onClick={() => window.print()}>
          <Printer className="size-4" />
          Imprimir relatório
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="break-inside-avoid-page">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pacientes ativos</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {activePatientsQuery.data?.total ?? 0}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  de {totalPatientsQuery.data?.total ?? 0}
                </span>
              </CardContent>
            </Card>
            <Card className="break-inside-avoid-page">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ciclos ativos</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{activeCyclesQuery.data?.total ?? 0}</CardContent>
            </Card>
            <Card className="break-inside-avoid-page">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Recebido no mês</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {currencyFormat(financeSummaryQuery.data?.recebidoNoPeriodo ?? 0)}
              </CardContent>
            </Card>
            <Card className="break-inside-avoid-page">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Vencido</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold text-amber-700 dark:text-amber-500">
                {currencyFormat(financeSummaryQuery.data?.vencido ?? 0)}
              </CardContent>
            </Card>
          </div>

          <Card className="break-inside-avoid-page">
            <CardHeader>
              <CardTitle className="text-base">Atendimentos no mês</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-4 text-center sm:text-left">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-xl font-semibold">{appointments.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Realizadas</p>
                <p className="text-xl font-semibold">{realized}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Canceladas</p>
                <p className="text-xl font-semibold">{cancelled}</p>
              </div>
              <div className="col-span-3 border-t pt-3 text-sm text-muted-foreground sm:col-span-1 sm:border-0 sm:pt-0">
                Restantes no mês: {upcoming}
              </div>
            </CardContent>
          </Card>

          <Card className="break-inside-avoid-page">
            <CardHeader>
              <CardTitle className="text-base">A receber</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {currencyFormat(financeSummaryQuery.data?.aReceber ?? 0)}
              <p className="mt-1 text-sm font-normal text-muted-foreground">
                Total pendente em cobranças abertas, independente do mês de vencimento.
              </p>
            </CardContent>
          </Card>
        </>
      )}

      <Card className="no-print">
        <CardHeader>
          <CardTitle className="text-base">Atalhos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/pacientes" />}>
            <Users className="size-4" />
            Pacientes
          </Button>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/agenda" />}>
            <CalendarDays className="size-4" />
            Agenda
          </Button>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/ciclos" />}>
            <Repeat className="size-4" />
            Ciclos
          </Button>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/financeiro" />}>
            <Wallet className="size-4" />
            Financeiro
          </Button>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/planos" />}>
            <ClipboardList className="size-4" />
            Planos
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
