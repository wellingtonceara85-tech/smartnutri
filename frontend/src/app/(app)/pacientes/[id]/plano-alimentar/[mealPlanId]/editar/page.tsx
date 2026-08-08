'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { MealPlanEditor } from '@/components/meal-plan-editor';
import { getMealPlan } from '@/lib/api/meal-plans';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

export default function EditarPlanoAlimentarPage({ params }: { params: Promise<{ id: string; mealPlanId: string }> }) {
  const { id, mealPlanId } = use(params);
  const { accessToken } = useAuth();

  const mealPlanQuery = useQuery({
    queryKey: ['meal-plan', mealPlanId],
    queryFn: () => getMealPlan(accessToken!, mealPlanId),
    enabled: !!accessToken,
  });

  if (mealPlanQuery.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (mealPlanQuery.isError || !mealPlanQuery.data) {
    return (
      <div className="flex flex-col items-center gap-2 p-12 text-center">
        <p className="font-medium">Não foi possível carregar o plano alimentar</p>
        <p className="text-sm text-muted-foreground">
          {mealPlanQuery.error instanceof ApiError ? mealPlanQuery.error.message : 'Tente novamente em instantes.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Editar plano alimentar</h1>
        <p className="text-sm text-muted-foreground">{mealPlanQuery.data.title}</p>
      </div>
      <MealPlanEditor mode="edit" patientId={id} mealPlan={mealPlanQuery.data} />
    </div>
  );
}
