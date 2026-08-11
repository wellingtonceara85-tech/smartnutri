'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TreatmentCycleFormDialog } from '@/components/treatment-cycle-form-dialog';
import { TreatmentCycleFinancialsDialog } from '@/components/treatment-cycle-financials-dialog';
import { listPatientTreatmentCycles } from '@/lib/api/treatment-cycles';
import { useTenantAuth } from '@/lib/auth-context';
import { CYCLE_STATUS_LABELS, DISCOUNT_TYPE_LABELS, type TreatmentCycle } from '@/lib/types';

const FINANCIALLY_EDITABLE_STATUSES: TreatmentCycle['status'][] = ['DRAFT', 'ACTIVE', 'PAUSED'];

function currencyFormat(value: string) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dateFormat(value: string) {
  return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

const STATUS_BADGE_VARIANT: Record<TreatmentCycle['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'outline',
  ACTIVE: 'default',
  PAUSED: 'secondary',
  COMPLETED: 'secondary',
  CANCELLED: 'destructive',
  RENEWED: 'outline',
};

function CycleCard({
  cycle,
  highlight,
  canCorrectFinancials,
  patientId,
}: {
  cycle: TreatmentCycle;
  highlight?: boolean;
  canCorrectFinancials: boolean;
  patientId: string;
}) {
  const [financialsOpen, setFinancialsOpen] = useState(false);
  const canCorrect = canCorrectFinancials && FINANCIALLY_EDITABLE_STATUSES.includes(cycle.status);

  return (
    <Card className={highlight ? 'border-primary/40' : undefined}>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium">{cycle.plan.name}</p>
            <p className="text-sm text-muted-foreground">
              {dateFormat(cycle.startDate)}
              {cycle.expectedEndDate ? ` – ${dateFormat(cycle.expectedEndDate)}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_BADGE_VARIANT[cycle.status]}>{CYCLE_STATUS_LABELS[cycle.status]}</Badge>
            {canCorrect && (
              <Button
                size="icon-sm"
                variant="ghost"
                title="Corrigir valores"
                onClick={() => setFinancialsOpen(true)}
              >
                <Pencil className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Consultas</p>
            <p className={cycle._count.appointments > cycle.appointmentCountPlanned ? 'font-medium text-amber-700 dark:text-amber-500' : undefined}>
              {cycle._count.appointments} de {cycle.appointmentCountPlanned}
              {cycle._count.appointments > cycle.appointmentCountPlanned && ' — excede o previsto'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Preço-base</p>
            <p>{currencyFormat(cycle.contractedValue)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Desconto</p>
            <p>
              {Number(cycle.discountValue) > 0
                ? `${cycle.discountValue}${DISCOUNT_TYPE_LABELS[cycle.discountType]} (${currencyFormat(cycle.discount)})`
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Valor final</p>
            <p className="font-medium text-foreground">{currencyFormat(cycle.finalValue)}</p>
          </div>
        </div>
        {(cycle.paymentMethod || cycle.notes) && (
          <p className="text-sm text-muted-foreground">
            {cycle.paymentMethod && <>Forma de pagamento: {cycle.paymentMethod.name}</>}
            {cycle.paymentMethod && cycle.notes && ' · '}
            {cycle.notes}
          </p>
        )}
      </CardContent>
      {canCorrect && (
        <TreatmentCycleFinancialsDialog
          open={financialsOpen}
          onOpenChange={setFinancialsOpen}
          cycle={cycle}
          patientId={patientId}
        />
      )}
    </Card>
  );
}

export function PatientTreatmentCyclesTab({ patientId }: { patientId: string }) {
  const { accessToken, user } = useTenantAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'RECEPTION' || user?.role === 'NUTRITIONIST';
  const canCorrectFinancials = canManage;
  const [formOpen, setFormOpen] = useState(false);

  const cyclesQuery = useQuery({
    queryKey: ['patient-treatment-cycles', patientId],
    queryFn: () => listPatientTreatmentCycles(accessToken!, patientId),
    enabled: !!accessToken,
  });

  if (cyclesQuery.isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const cycles = cyclesQuery.data ?? [];
  const active = cycles.find((c) => c.status === 'ACTIVE');
  const history = cycles.filter((c) => c.id !== active?.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Ciclos e planos</h2>
        {canManage && (
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="size-4" />
            Nova contratação
          </Button>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Plano atual</h3>
        {active ? (
          <CycleCard cycle={active} highlight canCorrectFinancials={canCorrectFinancials} patientId={patientId} />
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhuma contratação ativa no momento.
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Histórico de contratações</h3>
          <div className="flex flex-col gap-3">
            {history.map((cycle) => (
              <CycleCard
                key={cycle.id}
                cycle={cycle}
                canCorrectFinancials={canCorrectFinancials}
                patientId={patientId}
              />
            ))}
          </div>
        </div>
      )}

      {cycles.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Este paciente ainda não contratou nenhum plano — consultas podem continuar sendo agendadas avulsas.
        </p>
      )}

      <TreatmentCycleFormDialog open={formOpen} onOpenChange={setFormOpen} patientId={patientId} />
    </div>
  );
}
