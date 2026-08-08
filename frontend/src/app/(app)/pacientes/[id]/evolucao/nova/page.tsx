'use client';

import { use } from 'react';
import { useSearchParams } from 'next/navigation';
import { EvolutionForm } from '@/components/evolution-form';

export default function NovaAvaliacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const appointmentId = searchParams.get('appointmentId') ?? undefined;
  const defaultAssessmentDate = searchParams.get('assessmentDate') ?? undefined;
  const defaultNutritionistUserId = searchParams.get('nutritionistUserId') ?? undefined;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nova avaliação</h1>
        <p className="text-sm text-muted-foreground">
          {appointmentId
            ? 'Avaliação vinculada à consulta selecionada'
            : 'Registro independente — não sobrescreve avaliações anteriores'}
        </p>
      </div>
      <EvolutionForm
        mode="create"
        patientId={id}
        appointmentId={appointmentId}
        defaultAssessmentDate={defaultAssessmentDate}
        defaultNutritionistUserId={defaultNutritionistUserId}
      />
    </div>
  );
}
