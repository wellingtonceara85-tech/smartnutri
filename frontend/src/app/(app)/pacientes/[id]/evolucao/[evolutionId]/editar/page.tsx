'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EvolutionForm } from '@/components/evolution-form';
import { Skeleton } from '@/components/ui/skeleton';
import { getEvolution } from '@/lib/api/evolutions';
import { useAuth } from '@/lib/auth-context';
import { formatCalendarDate } from '@/lib/masks';

export default function EditarAvaliacaoPage({ params }: { params: Promise<{ id: string; evolutionId: string }> }) {
  const { id, evolutionId } = use(params);
  const { accessToken } = useAuth();

  const evolutionQuery = useQuery({
    queryKey: ['evolution', evolutionId],
    queryFn: () => getEvolution(accessToken!, evolutionId),
    enabled: !!accessToken,
  });

  if (evolutionQuery.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!evolutionQuery.data) {
    return <p className="text-sm text-muted-foreground">Avaliação não encontrada.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Editar avaliação</h1>
        <p className="text-sm text-muted-foreground">{formatCalendarDate(evolutionQuery.data.assessmentDate)}</p>
      </div>
      <EvolutionForm mode="edit" patientId={id} evolution={evolutionQuery.data} />
    </div>
  );
}
