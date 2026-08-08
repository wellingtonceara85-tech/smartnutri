'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, Share2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { listMealPlans } from '@/lib/api/meal-plans';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { formatCalendarDate } from '@/lib/masks';
import { MEAL_PLAN_STATUS_LABELS, type MealPlanStatus } from '@/lib/types';

const STATUS_VARIANT: Record<MealPlanStatus, 'default' | 'secondary' | 'outline'> = {
  DRAFT: 'outline',
  ACTIVE: 'default',
  REPLACED: 'secondary',
  COMPLETED: 'secondary',
  ARCHIVED: 'secondary',
};

export function PatientMealPlanTab({ patientId }: { patientId: string }) {
  const { accessToken } = useAuth();

  const mealPlansQuery = useQuery({
    queryKey: ['meal-plans', patientId],
    queryFn: () => listMealPlans(accessToken!, patientId),
    enabled: !!accessToken,
  });

  if (mealPlansQuery.isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (mealPlansQuery.isError) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-12 text-center text-muted-foreground">
        <p>Não foi possível carregar os planos alimentares</p>
        <p className="text-sm">{mealPlansQuery.error instanceof ApiError ? mealPlansQuery.error.message : ''}</p>
        <Button variant="outline" onClick={() => mealPlansQuery.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  const mealPlans = mealPlansQuery.data ?? [];
  const active = mealPlans.find((p) => p.status === 'ACTIVE');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Plano alimentar</h2>
          <p className="text-sm text-muted-foreground">
            {mealPlans.length === 0 ? 'Nenhum plano cadastrado ainda' : `${mealPlans.length} versão(ões) registrada(s)`}
          </p>
        </div>
        <Button nativeButton={false} render={<Link href={`/pacientes/${patientId}/plano-alimentar/novo`} />}>
          <Plus className="size-4" />
          Novo plano
        </Button>
      </div>

      {mealPlans.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <p>Crie o primeiro plano alimentar para este paciente.</p>
        </div>
      ) : (
        <>
          {active && (
            <Card>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-xs text-muted-foreground">Plano ativo</p>
                  <Link href={`/pacientes/${patientId}/plano-alimentar/${active.id}`} className="font-medium hover:underline">
                    {active.title}
                  </Link>
                  <p className="text-sm text-muted-foreground">v{active.version} · {active.nutritionistUser.name}</p>
                </div>
                <Badge variant={STATUS_VARIANT.ACTIVE}>{MEAL_PLAN_STATUS_LABELS.ACTIVE}</Badge>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="flex flex-col divide-y p-0">
              {mealPlans.map((plan) => (
                <Link
                  key={plan.id}
                  href={`/pacientes/${patientId}/plano-alimentar/${plan.id}`}
                  className="flex items-center justify-between gap-3 p-4 text-sm hover:bg-muted"
                >
                  <div>
                    <p className="font-medium">
                      {plan.title} <span className="text-muted-foreground">v{plan.version}</span>
                    </p>
                    <p className="text-muted-foreground">
                      {formatCalendarDate(plan.effectiveFrom)} · {plan.nutritionistUser.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {plan.isSharedWithPatient && (
                      <Badge variant="secondary">
                        <Share2 className="size-3" />
                        Compartilhado
                      </Badge>
                    )}
                    <Badge variant={STATUS_VARIANT[plan.status]}>{MEAL_PLAN_STATUS_LABELS[plan.status]}</Badge>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
