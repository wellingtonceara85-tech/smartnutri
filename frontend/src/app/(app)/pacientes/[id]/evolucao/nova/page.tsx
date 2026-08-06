'use client';

import { use } from 'react';
import { EvolutionForm } from '@/components/evolution-form';

export default function NovaAvaliacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Nova avaliação</h1>
        <p className="text-muted-foreground">Registro independente — não sobrescreve avaliações anteriores</p>
      </div>
      <EvolutionForm mode="create" patientId={id} />
    </div>
  );
}
