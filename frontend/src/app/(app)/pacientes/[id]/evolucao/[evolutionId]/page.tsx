'use client';

import { use, useRef } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Pencil, Printer, Share2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EvolutionComparison } from '@/components/evolution-comparison';
import { BODY_SEGMENT_LABELS, type BodySegmentId } from '@/components/body-segment-map';
import {
  archiveEvolution,
  getEvolution,
  listEvolutions,
  removeEvolutionPhoto,
  shareEvolution,
  uploadEvolutionPhoto,
} from '@/lib/api/evolutions';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import {
  ANTHROPOMETRY_FIELDS,
  BIOIMPEDANCE_COMPOSITION_FIELDS,
  BIOIMPEDANCE_CONTROL_FIELDS,
  BIOIMPEDANCE_INDICATOR_FIELDS,
  SKINFOLD_FIELDS,
} from '@/lib/evolution-form-fields';
import { compareSegmentalMeasurements } from '@/lib/evolution-metrics';
import { formatAppointmentDateTime } from '@/lib/appointment-datetime';
import { formatCalendarDate } from '@/lib/masks';
import { EVOLUTION_PHOTO_TYPE_LABELS, type EvolutionPhotoTypeEnum } from '@/lib/types';

const PHOTO_TYPES: EvolutionPhotoTypeEnum[] = ['FRONT', 'BACK', 'RIGHT_PROFILE', 'LEFT_PROFILE', 'OTHER'];

function ValueGrid<T extends object>({
  fields,
  source,
}: {
  fields: { key: string; label: string; unit: string }[];
  source: T | null;
}) {
  const record = source as Record<string, unknown> | null;
  const filled = fields.filter((f) => record?.[f.key] !== null && record?.[f.key] !== undefined);
  if (!record || filled.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum dado registrado nesta seção.</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {filled.map((field) => (
        <div key={field.key}>
          <p className="text-xs text-muted-foreground">{field.label}</p>
          <p className="text-sm font-medium">
            {String(record[field.key])} {field.unit}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function EvolucaoDetailPage({ params }: { params: Promise<{ id: string; evolutionId: string }> }) {
  const { id, evolutionId } = use(params);
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const pendingPhotoType = useRef<EvolutionPhotoTypeEnum>('FRONT');

  const evolutionQuery = useQuery({
    queryKey: ['evolution', evolutionId],
    queryFn: () => getEvolution(accessToken!, evolutionId),
    enabled: !!accessToken,
  });

  const historyQuery = useQuery({
    queryKey: ['evolutions', id],
    queryFn: () => listEvolutions(accessToken!, id),
    enabled: !!accessToken,
  });

  function invalidate() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ['evolution', evolutionId] }),
      queryClient.invalidateQueries({ queryKey: ['evolutions', id] }),
    ]);
  }

  async function handleShareToggle() {
    if (!accessToken || !evolutionQuery.data) return;
    try {
      await shareEvolution(accessToken, evolutionId, !evolutionQuery.data.isSharedWithPatient);
      toast.success(evolutionQuery.data.isSharedWithPatient ? 'Compartilhamento removido' : 'Avaliação marcada como compartilhável');
      await invalidate();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível atualizar o compartilhamento');
    }
  }

  async function handleArchive() {
    if (!accessToken) return;
    if (!confirm('Arquivar esta avaliação? Ela sai do histórico ativo, mas não é apagada.')) return;
    try {
      await archiveEvolution(accessToken, evolutionId);
      toast.success('Avaliação arquivada');
      await invalidate();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível arquivar a avaliação');
    }
  }

  async function handlePhotoSelected(file: File) {
    if (!accessToken) return;
    try {
      await uploadEvolutionPhoto(accessToken, evolutionId, pendingPhotoType.current, file);
      toast.success('Foto enviada');
      await invalidate();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível enviar a foto');
    }
  }

  async function handleRemovePhoto(photoId: string) {
    if (!accessToken) return;
    if (!confirm('Remover esta foto?')) return;
    try {
      await removeEvolutionPhoto(accessToken, evolutionId, photoId);
      toast.success('Foto removida');
      await invalidate();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não foi possível remover a foto');
    }
  }

  if (evolutionQuery.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (!evolutionQuery.data) {
    return <p className="text-sm text-muted-foreground">Avaliação não encontrada.</p>;
  }

  const evolution = evolutionQuery.data;
  const history = historyQuery.data ?? [];
  const sortedDesc = [...history].sort((a, b) => b.assessmentDate.localeCompare(a.assessmentDate));
  const currentIndex = sortedDesc.findIndex((e) => e.id === evolution.id);
  const previous = currentIndex >= 0 ? sortedDesc[currentIndex + 1] : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {formatCalendarDate(evolution.assessmentDate)}
            {evolution.title && <span className="text-muted-foreground"> — {evolution.title}</span>}
          </h1>
          <p className="text-sm text-muted-foreground">Responsável: {evolution.nutritionistUser.name}</p>
          {evolution.appointment && (
            <p className="text-sm text-muted-foreground">
              Consulta relacionada: {evolution.appointment.appointmentType.name} —{' '}
              {formatAppointmentDateTime(evolution.appointment.scheduledAt)}
            </p>
          )}
          {evolution.isSharedWithPatient && <Badge variant="secondary">Compartilhada com o paciente</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/pacientes/${id}/evolucao/${evolutionId}/imprimir`} target="_blank" />}
          >
            <Printer className="size-4" />
            Imprimir
          </Button>
          <Button variant="outline" onClick={handleShareToggle}>
            <Share2 className="size-4" />
            {evolution.isSharedWithPatient ? 'Remover compartilhamento' : 'Compartilhar'}
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href={`/pacientes/${id}/evolucao/${evolutionId}/editar`} />}>
            <Pencil className="size-4" />
            Editar
          </Button>
          <Button variant="outline" onClick={handleArchive}>
            <Trash2 className="size-4" />
            Arquivar
          </Button>
        </div>
      </div>

      {previous && <EvolutionComparison previous={previous} current={evolution} />}

      {evolution.objective && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Objetivo desta fase</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{evolution.objective}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Antropometria</CardTitle>
        </CardHeader>
        <CardContent>
          <ValueGrid fields={ANTHROPOMETRY_FIELDS} source={evolution.anthropometry} />
          {evolution.anthropometry?.bmiClassification && (
            <p className="mt-3 text-sm text-muted-foreground">IMC: {evolution.anthropometry.bmiClassification}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dobras cutâneas</CardTitle>
        </CardHeader>
        <CardContent>
          <ValueGrid fields={SKINFOLD_FIELDS} source={evolution.anthropometry} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bioimpedância — composição corporal</CardTitle>
        </CardHeader>
        <CardContent>
          <ValueGrid fields={BIOIMPEDANCE_COMPOSITION_FIELDS} source={evolution.bioimpedance} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bioimpedância — indicadores</CardTitle>
        </CardHeader>
        <CardContent>
          <ValueGrid fields={BIOIMPEDANCE_INDICATOR_FIELDS} source={evolution.bioimpedance} />
          {evolution.bioimpedance?.bodyCompositionScoreLabel && (
            <p className="mt-3 text-sm text-muted-foreground">
              {evolution.bioimpedance.bodyCompositionScoreLabel}
              {evolution.bioimpedance.bodyCompositionScoreSource && ` — fonte: ${evolution.bioimpedance.bodyCompositionScoreSource}`}
            </p>
          )}
        </CardContent>
      </Card>

      {(evolution.bioimpedance?.referenceWeightKg ||
        evolution.bioimpedance?.recommendedWeightChangeKg ||
        evolution.bioimpedance?.recommendedFatChangeKg ||
        evolution.bioimpedance?.recommendedMuscleChangeKg) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Controle e metas</CardTitle>
            <p className="text-xs text-muted-foreground">
              Fornecido pelo equipamento ou definido pela nutricionista — sem interpretação automática.
            </p>
          </CardHeader>
          <CardContent>
            <ValueGrid fields={BIOIMPEDANCE_CONTROL_FIELDS} source={evolution.bioimpedance} />
          </CardContent>
        </Card>
      )}

      {evolution.segmentalMeasurements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Análise segmentar</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-4">Segmento</th>
                    <th className="p-4">Massa gorda</th>
                    <th className="p-4">Massa magra</th>
                  </tr>
                </thead>
                <tbody>
                  {(['RIGHT_ARM', 'LEFT_ARM', 'TRUNK', 'RIGHT_LEG', 'LEFT_LEG'] as BodySegmentId[]).map((segment) => {
                    const fat = evolution.segmentalMeasurements.find((m) => m.segment === segment && m.metricType === 'FAT_MASS_KG');
                    const lean = evolution.segmentalMeasurements.find((m) => m.segment === segment && m.metricType === 'LEAN_MASS_KG');
                    if (!fat && !lean) return null;
                    return (
                      <tr key={segment} className="border-b last:border-0">
                        <td className="p-4 font-medium">{BODY_SEGMENT_LABELS[segment]}</td>
                        <td className="p-4">
                          {fat ? (
                            <>
                              {fat.valueKg} kg
                              {fat.isEstimated && <span className="ml-1 text-xs text-muted-foreground">(estimado)</span>}
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-4">{lean ? `${lean.valueKg} kg` : <span className="text-muted-foreground">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {previous && (
              <div className="border-t p-4 text-sm text-muted-foreground">
                <p className="mb-2 font-medium text-foreground">Diferença em relação à avaliação anterior</p>
                {compareSegmentalMeasurements(previous, evolution)
                  .filter((d) => d.absoluteDiff !== null)
                  .map((d) => (
                    <p key={`${d.segment}-${d.metricType}`}>
                      {BODY_SEGMENT_LABELS[d.segment]} —{' '}
                      {d.metricType === 'FAT_MASS_KG' ? 'massa gorda' : 'massa magra'}:{' '}
                      {d.absoluteDiff! > 0 ? '+' : ''}
                      {d.absoluteDiff} kg
                    </p>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(evolution.bioimpedance?.segmentalImpedanceMeasurements.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Impedância por frequência</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-4">Frequência</th>
                    <th className="p-4">Braço dir.</th>
                    <th className="p-4">Braço esq.</th>
                    <th className="p-4">Tronco</th>
                    <th className="p-4">Perna dir.</th>
                    <th className="p-4">Perna esq.</th>
                  </tr>
                </thead>
                <tbody>
                  {evolution.bioimpedance?.segmentalImpedanceMeasurements.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="p-4 font-medium">
                        {row.frequencyValue} {row.frequencyUnit}
                      </td>
                      <td className="p-4">{row.rightArmOhms ?? '—'}</td>
                      <td className="p-4">{row.leftArmOhms ?? '—'}</td>
                      <td className="p-4">{row.trunkOhms ?? '—'}</td>
                      <td className="p-4">{row.rightLegOhms ?? '—'}</td>
                      <td className="p-4">{row.leftLegOhms ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {evolution.referenceRanges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Referências informadas</CardTitle>
            <p className="text-xs text-muted-foreground">A interpretação é sempre da nutricionista — o SmartNutri só exibe o valor.</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            {evolution.referenceRanges.map((range) => (
              <p key={range.id}>
                <span className="font-medium">{range.fieldKey}:</span> Referência informada
                {range.minValue !== null || range.maxValue !== null
                  ? `: ${range.minValue ?? '?'} a ${range.maxValue ?? '?'} ${range.unit ?? ''}`.trimEnd()
                  : ''}
                {range.source && ` (${range.source})`}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fotos de evolução</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handlePhotoSelected(file);
              e.target.value = '';
            }}
          />
          <div className="flex flex-wrap gap-2">
            {PHOTO_TYPES.map((type) => (
              <Button
                key={type}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  pendingPhotoType.current = type;
                  photoInputRef.current?.click();
                }}
              >
                <Camera className="size-4" />
                {EVOLUTION_PHOTO_TYPE_LABELS[type]}
              </Button>
            ))}
          </div>
          {evolution.photos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma foto enviada ainda.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-4">
              {evolution.photos.map((photo) => (
                <div key={photo.id} className="flex flex-col gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt={EVOLUTION_PHOTO_TYPE_LABELS[photo.type]} className="aspect-square w-full rounded-md border object-cover" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{EVOLUTION_PHOTO_TYPE_LABELS[photo.type]}</span>
                    <button type="button" onClick={() => handleRemovePhoto(photo.id)} className="text-destructive hover:underline">
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {evolution.clinicalNotes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nota clínica</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{evolution.clinicalNotes}</CardContent>
        </Card>
      )}
    </div>
  );
}
