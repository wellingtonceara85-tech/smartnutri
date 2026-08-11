'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, RotateCcw, Search } from 'lucide-react';
import { ChargeStatusBadge } from '@/components/charge-status-badge';
import { RegisterPaymentDialog } from '@/components/register-payment-dialog';
import { VoidPaymentDialog } from '@/components/void-payment-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFinanceSummary, listCharges } from '@/lib/api/finance';
import { listPatients } from '@/lib/api/patients';
import { ApiError } from '@/lib/api-client';
import { useTenantAuth } from '@/lib/auth-context';
import type { Charge, ChargeStatusFilter } from '@/lib/types';

const PAGE_SIZE = 20;

const STATUS_FILTER_LABELS: Record<ChargeStatusFilter | 'ALL', string> = {
  ALL: 'Todos os status',
  PENDING: 'Pendente',
  PARTIALLY_PAID: 'Parcialmente pago',
  PAID: 'Pago',
  CANCELLED: 'Cancelado',
  OVERDUE: 'Vencido',
};

function currencyFormat(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dateFormat(value: string) {
  return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function originLabel(charge: Charge) {
  if (!charge.origin) return '—';
  if (charge.origin.type === 'CYCLE') {
    return `${charge.origin.planName} — Parcela ${charge.installmentNumber}/${charge.installmentTotal}`;
  }
  return `Consulta avulsa — ${charge.origin.appointmentTypeName}`;
}

export default function FinanceiroPage() {
  const { accessToken } = useTenantAuth();

  const [patientSearch, setPatientSearch] = useState('');
  const [patientFilter, setPatientFilter] = useState<{ id: string; fullName: string } | null>(null);
  const [status, setStatus] = useState<ChargeStatusFilter | 'ALL'>('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [payTarget, setPayTarget] = useState<Charge | null>(null);
  const [voidTarget, setVoidTarget] = useState<Charge | null>(null);

  const summaryQuery = useQuery({
    queryKey: ['finance-summary'],
    queryFn: () => getFinanceSummary(accessToken!),
    enabled: !!accessToken,
  });

  const chargesQuery = useQuery({
    queryKey: ['finance-charges', { patientId: patientFilter?.id, status, from, to, page }],
    queryFn: () =>
      listCharges(accessToken!, {
        patientId: patientFilter?.id,
        status: status === 'ALL' ? undefined : status,
        from: from || undefined,
        to: to || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: !!accessToken,
  });

  const patientSearchQuery = useQuery({
    queryKey: ['patients-search-finance', patientSearch],
    queryFn: () => listPatients(accessToken!, { search: patientSearch, pageSize: 6 }),
    enabled: !patientFilter && patientSearch.trim().length >= 2,
  });

  const totalPages = useMemo(() => {
    if (!chargesQuery.data) return 1;
    return Math.max(1, Math.ceil(chargesQuery.data.total / PAGE_SIZE));
  }, [chargesQuery.data]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
        <p className="text-sm text-muted-foreground">
          Quem deve, quanto deve, quando vence e o que já foi pago.
        </p>
      </div>

      {summaryQuery.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : summaryQuery.isError ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            {summaryQuery.error instanceof ApiError
              ? summaryQuery.error.message
              : 'Não foi possível carregar o resumo financeiro.'}
          </CardContent>
        </Card>
      ) : (
        summaryQuery.data && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Recebido no mês</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">
                  {currencyFormat(summaryQuery.data.recebidoNoPeriodo)}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">A receber</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">
                  {currencyFormat(summaryQuery.data.aReceber)}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Vencido</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold text-amber-700 dark:text-amber-500">
                  {currencyFormat(summaryQuery.data.vencido)}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Próximos recebimentos</CardTitle>
                </CardHeader>
                <CardContent>
                  {summaryQuery.data.proximosRecebimentos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nada previsto por enquanto.</p>
                  ) : (
                    <div className="flex flex-col divide-y">
                      {summaryQuery.data.proximosRecebimentos.map((item) => (
                        <div key={item.chargeId} className="flex items-center justify-between py-2 text-sm">
                          <div>
                            <p className="font-medium">{item.patientName}</p>
                            <p className="text-muted-foreground">{dateFormat(item.dueDate)}</p>
                          </div>
                          <span className="font-medium">{currencyFormat(item.remaining)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Movimentações recentes</CardTitle>
                </CardHeader>
                <CardContent>
                  {summaryQuery.data.movimentacoesRecentes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum pagamento registrado ainda.</p>
                  ) : (
                    <div className="flex flex-col divide-y">
                      {summaryQuery.data.movimentacoesRecentes.map((item) => (
                        <div key={item.id} className="flex items-center justify-between py-2 text-sm">
                          <div>
                            <p className="font-medium">{item.patientName}</p>
                            <p className="text-muted-foreground">
                              {dateFormat(item.paidAt)} · {item.paymentMethodName}
                            </p>
                          </div>
                          <span className="font-medium">{currencyFormat(item.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>Filtre as cobranças por paciente, status ou período de vencimento</CardDescription>
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
              setStatus((v as ChargeStatusFilter | 'ALL') ?? 'ALL');
              setPage(1);
            }}
          >
            <SelectTrigger className="sm:w-52">
              <SelectValue placeholder="Status">
                {(v: string) => STATUS_FILTER_LABELS[v as ChargeStatusFilter | 'ALL']}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_FILTER_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            className="sm:w-40"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
          <Input
            type="date"
            className="sm:w-40"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {chargesQuery.isLoading ? (
            <div className="flex flex-col gap-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : chargesQuery.isError ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center">
              <p className="font-medium">Não foi possível carregar as cobranças</p>
              <Button variant="outline" onClick={() => chargesQuery.refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : chargesQuery.data?.data.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center">
              <p className="font-medium">Nenhuma cobrança encontrada</p>
              <p className="text-sm text-muted-foreground">Ajuste os filtros para ver outras cobranças.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Desconto</TableHead>
                    <TableHead>Final</TableHead>
                    <TableHead>Forma de pagamento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pago em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chargesQuery.data?.data.map((charge) => (
                    <TableRow key={charge.id}>
                      <TableCell>
                        <Link href={`/pacientes/${charge.patient.id}`} className="font-medium hover:underline">
                          {charge.patient.fullName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{originLabel(charge)}</TableCell>
                      <TableCell>{dateFormat(charge.dueDate)}</TableCell>
                      <TableCell>{currencyFormat(charge.amount)}</TableCell>
                      <TableCell>{Number(charge.discount) > 0 ? currencyFormat(charge.discount) : '—'}</TableCell>
                      <TableCell className="font-medium">{currencyFormat(charge.finalValue)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {charge.paymentMethodName ?? '—'}
                      </TableCell>
                      <TableCell>
                        <ChargeStatusBadge status={charge.status} isOverdue={charge.isOverdue} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {charge.paidAt ? dateFormat(charge.paidAt) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {(charge.status === 'PENDING' || charge.status === 'PARTIALLY_PAID') && (
                          <Button size="sm" variant="outline" onClick={() => setPayTarget(charge)}>
                            <CheckCircle2 className="size-4" />
                            Marcar como pago
                          </Button>
                        )}
                        {charge.status === 'PAID' && charge.paymentId && (
                          <Button size="sm" variant="ghost" onClick={() => setVoidTarget(charge)}>
                            <RotateCcw className="size-4" />
                            Reverter
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {chargesQuery.data && chargesQuery.data.total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {chargesQuery.data.total} cobrança{chargesQuery.data.total === 1 ? '' : 's'} — página {page} de{' '}
            {totalPages}
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

      {payTarget && (
        <RegisterPaymentDialog open={!!payTarget} onOpenChange={(open) => !open && setPayTarget(null)} charge={payTarget} />
      )}
      {voidTarget && (
        <VoidPaymentDialog open={!!voidTarget} onOpenChange={(open) => !open && setVoidTarget(null)} charge={voidTarget} />
      )}
    </div>
  );
}
