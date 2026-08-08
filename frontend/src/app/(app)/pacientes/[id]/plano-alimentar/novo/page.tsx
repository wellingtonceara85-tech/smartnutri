'use client';

import { use } from 'react';
import { useSearchParams } from 'next/navigation';
import { MealPlanEditor } from '@/components/meal-plan-editor';

export default function NovoPlanoAlimentarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const appointmentId = searchParams.get('appointmentId') ?? undefined;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Novo plano alimentar</h1>
        <p className="text-sm text-muted-foreground">
          {appointmentId ? 'Plano vinculado à consulta selecionada' : 'Nova versão independente — não sobrescreve planos anteriores'}
        </p>
      </div>
      <MealPlanEditor mode="create" patientId={id} appointmentId={appointmentId} />
    </div>
  );
}
