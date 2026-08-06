'use client';

import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { BodySilhouette } from '@/components/body-segment-map';
import { EvolutionMetricChart } from '@/components/evolution-metric-chart';
import { SegmentalBodyAnalysisCard } from '@/components/segmental-body-analysis-card';
import { listEvolutions } from '@/lib/api/evolutions';
import { updatePatientSilhouette } from '@/lib/api/patients';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { METRIC_CATALOG, buildMetricSeries } from '@/lib/evolution-metrics';
import { formatCalendarDate } from '@/lib/masks';
import type { PatientDetail } from '@/lib/types';

const SILHOUETTE_OPTIONS: { value: BodySilhouette; label: string }[] = [
  { value: 'MALE', label: 'Masculina' },
  { value: 'FEMALE', label: 'Feminina' },
  { value: 'NEUTRAL', label: 'Neutra' },
];

function suggestSilhouette(patient: PatientDetail): BodySilhouette {
  if (patient.gender === 'MALE') return 'MALE';
  if (patient.gender === 'FEMALE') return 'FEMALE';
  return 'NEUTRAL';
}

const OVERVIEW_METRIC_KEYS = ['weightKg', 'bmi', 'bodyFatPercent'];

export function PatientEvolutionTab({ patient }: { patient: PatientDetail }) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  const evolutionsQuery = useQuery({
    queryKey: ['evolutions', patient.id],
    queryFn: () => listEvolutions(accessToken!, patient.id),
    enabled: !!accessToken,
  });

  const silhouette: BodySilhouette =
    patient.bodySilhouettePreference === 'NOT_INFORMED' ? suggestSilhouette(patient) : patient.bodySilhouettePreference;

  async function handleSilhouetteChange(value: BodySilhouette) {
    if (!accessToken) return;
    try {
      await updatePatientSilhouette(accessToken, patient.id, value);
      await queryClient.invalidateQueries({ queryKey: ['patient', patient.id] });
      toast.success('Silhueta atualizada');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível atualizar a silhueta');
    }
  }

  if (evolutionsQuery.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (evolutionsQuery.isError) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-12 text-center text-muted-foreground">
        <p>Não foi possível carregar a evolução do paciente</p>
        <Button variant="outline" onClick={() => evolutionsQuery.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  const evolutions = evolutionsQuery.data ?? [];
  const latest = evolutions[0];
  const previous = evolutions[1] ?? null;
  const overviewMetrics = METRIC_CATALOG.filter((m) => OVERVIEW_METRIC_KEYS.includes(m.key));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Evolução corporal</h2>
          <p className="text-sm text-muted-foreground">
            {evolutions.length === 0 ? 'Nenhuma avaliação registrada ainda' : `${evolutions.length} avaliação(ões) registrada(s)`}
          </p>
        </div>
        <Button nativeButton={false} render={<Link href={`/pacientes/${patient.id}/evolucao/nova`} />}>
          <Plus className="size-4" />
          Nova avaliação
        </Button>
      </div>

      {evolutions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <p>Registre a primeira avaliação para começar a acompanhar a evolução deste paciente.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            {overviewMetrics.map((metric) => (
              <Card key={metric.key}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{metric.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <EvolutionMetricChart metric={metric} points={buildMetricSeries(evolutions, metric)} />
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Silhueta exibida na análise segmentar</p>
            <div className="flex gap-2">
              {SILHOUETTE_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={silhouette === option.value ? 'default' : 'outline'}
                  onClick={() => handleSilhouetteChange(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <SegmentalBodyAnalysisCard silhouette={silhouette} current={latest} previous={previous} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de avaliações</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y p-0">
              {evolutions.map((evolution) => (
                <Link
                  key={evolution.id}
                  href={`/pacientes/${patient.id}/evolucao/${evolution.id}`}
                  className="flex items-center justify-between gap-3 p-4 text-sm hover:bg-muted"
                >
                  <div>
                    <p className="font-medium">
                      {formatCalendarDate(evolution.assessmentDate)}
                      {evolution.title && <span className="text-muted-foreground"> — {evolution.title}</span>}
                    </p>
                    <p className="text-muted-foreground">{evolution.nutritionistUser.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {evolution.isSharedWithPatient && (
                      <Badge variant="secondary">
                        <Share2 className="size-3" />
                        Compartilhada
                      </Badge>
                    )}
                    {evolution.anthropometry?.weightKg && <span className="text-muted-foreground">{evolution.anthropometry.weightKg} kg</span>}
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
