'use client';

import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { BodySilhouette } from '@/components/body-segment-map';
import { SegmentalBodyAnalysisCard } from '@/components/segmental-body-analysis-card';
import { getEvolution } from '@/lib/api/evolutions';
import { getPatient } from '@/lib/api/patients';
import { getProfessionalProfile } from '@/lib/api/professional-profile';
import { useAuth } from '@/lib/auth-context';
import {
  ANTHROPOMETRY_FIELDS,
  BIOIMPEDANCE_COMPOSITION_FIELDS,
  BIOIMPEDANCE_INDICATOR_FIELDS,
} from '@/lib/evolution-form-fields';
import { formatAge, formatCalendarDate } from '@/lib/masks';

function filledFields<T extends object>(fields: { key: string; label: string; unit: string }[], source: T | null) {
  if (!source) return [];
  const record = source as Record<string, unknown>;
  return fields.filter((f) => record[f.key] !== null && record[f.key] !== undefined);
}

function suggestSilhouette(gender: string | null): BodySilhouette {
  if (gender === 'MALE') return 'MALE';
  if (gender === 'FEMALE') return 'FEMALE';
  return 'NEUTRAL';
}

export default function ImprimirAvaliacaoPage({ params }: { params: Promise<{ id: string; evolutionId: string }> }) {
  const { id, evolutionId } = use(params);
  const { accessToken } = useAuth();
  const [includeImpedance, setIncludeImpedance] = useState(false);

  const evolutionQuery = useQuery({
    queryKey: ['evolution', evolutionId],
    queryFn: () => getEvolution(accessToken!, evolutionId),
    enabled: !!accessToken,
  });
  const patientQuery = useQuery({
    queryKey: ['patient', id],
    queryFn: () => getPatient(accessToken!, id),
    enabled: !!accessToken,
  });
  const profileQuery = useQuery({
    queryKey: ['professional-profile'],
    queryFn: () => getProfessionalProfile(accessToken!),
    enabled: !!accessToken,
  });

  if (evolutionQuery.isLoading || patientQuery.isLoading || profileQuery.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (!evolutionQuery.data || !patientQuery.data || !profileQuery.data) {
    return <p className="text-muted-foreground">Não foi possível carregar o relatório.</p>;
  }

  const evolution = evolutionQuery.data;
  const patient = patientQuery.data;
  const profile = profileQuery.data;

  const anthropometryFields = filledFields(ANTHROPOMETRY_FIELDS, evolution.anthropometry);
  const compositionFields = filledFields(BIOIMPEDANCE_COMPOSITION_FIELDS, evolution.bioimpedance);
  const indicatorFields = filledFields(BIOIMPEDANCE_INDICATOR_FIELDS, evolution.bioimpedance);
  const age = formatAge(patient.birthDate);
  const silhouette =
    patient.bodySilhouettePreference === 'NOT_INFORMED' ? suggestSilhouette(patient.gender) : patient.bodySilhouettePreference;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 print:max-w-none">
      <div className="flex items-center justify-between gap-4 print:hidden">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" className="size-4" checked={includeImpedance} onChange={(e) => setIncludeImpedance(e.target.checked)} />
          Incluir impedância avançada no relatório
        </label>
        <Button onClick={() => window.print()}>
          <Printer className="size-4" />
          Imprimir
        </Button>
      </div>

      <header className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-semibold">{profile.displayName}</h1>
          {profile.professionalTitle && <p className="text-sm text-muted-foreground">{profile.professionalTitle}</p>}
          {profile.crnNumber && (
            <p className="text-sm text-muted-foreground">
              CRN {profile.crnNumber}
              {profile.crnState ? `/${profile.crnState}` : ''}
            </p>
          )}
        </div>
        {profile.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.logoUrl} alt="Logo" className="h-16 w-auto object-contain" />
        )}
      </header>

      <section>
        <h2 className="text-lg font-semibold">Avaliação de {patient.fullName}</h2>
        <p className="text-sm text-muted-foreground">
          {age !== null && `${age} anos · `}
          {evolution.anthropometry?.heightCm && `${evolution.anthropometry.heightCm} cm · `}
          {formatCalendarDate(evolution.assessmentDate)}
          {evolution.title && ` — ${evolution.title}`}
        </p>
      </section>

      {evolution.objective && (
        <section>
          <h3 className="mb-1 text-sm font-semibold">Objetivo</h3>
          <p className="text-sm">{evolution.objective}</p>
        </section>
      )}

      {anthropometryFields.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Antropometria</h3>
          <table className="w-full border-collapse text-sm">
            <tbody>
              {anthropometryFields.map((field) => (
                <tr key={field.key} className="border-b">
                  <td className="py-1.5 text-muted-foreground">{field.label}</td>
                  <td className="py-1.5 text-right font-medium">
                    {String((evolution.anthropometry as unknown as Record<string, unknown>)[field.key])} {field.unit}
                  </td>
                </tr>
              ))}
              {evolution.anthropometry?.bmiClassification && (
                <tr>
                  <td className="py-1.5 text-muted-foreground">Classificação de IMC</td>
                  <td className="py-1.5 text-right font-medium">{evolution.anthropometry.bmiClassification}</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {compositionFields.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Composição corporal</h3>
          <table className="w-full border-collapse text-sm">
            <tbody>
              {compositionFields.map((field) => (
                <tr key={field.key} className="border-b">
                  <td className="py-1.5 text-muted-foreground">{field.label}</td>
                  <td className="py-1.5 text-right font-medium">
                    {String((evolution.bioimpedance as unknown as Record<string, unknown>)[field.key])} {field.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {indicatorFields.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Indicadores adicionais</h3>
          <table className="w-full border-collapse text-sm">
            <tbody>
              {indicatorFields.map((field) => (
                <tr key={field.key} className="border-b">
                  <td className="py-1.5 text-muted-foreground">{field.label}</td>
                  <td className="py-1.5 text-right font-medium">
                    {String((evolution.bioimpedance as unknown as Record<string, unknown>)[field.key])} {field.unit}
                  </td>
                </tr>
              ))}
              {evolution.bioimpedance?.bodyCompositionScoreLabel && (
                <tr>
                  <td className="py-1.5 text-muted-foreground">{evolution.bioimpedance.bodyCompositionScoreLabel}</td>
                  <td className="py-1.5 text-right font-medium">
                    {evolution.bioimpedance.bodyCompositionScore}
                    {evolution.bioimpedance.bodyCompositionScoreMaximum && ` de ${evolution.bioimpedance.bodyCompositionScoreMaximum}`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {(evolution.bioimpedance?.referenceWeightKg ||
        evolution.bioimpedance?.recommendedWeightChangeKg ||
        evolution.bioimpedance?.recommendedFatChangeKg ||
        evolution.bioimpedance?.recommendedMuscleChangeKg) && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Controle e metas</h3>
          <table className="w-full border-collapse text-sm">
            <tbody>
              {evolution.bioimpedance?.referenceWeightKg && (
                <tr className="border-b">
                  <td className="py-1.5 text-muted-foreground">Peso de referência</td>
                  <td className="py-1.5 text-right font-medium">{evolution.bioimpedance.referenceWeightKg} kg</td>
                </tr>
              )}
              {evolution.bioimpedance?.recommendedWeightChangeKg && (
                <tr className="border-b">
                  <td className="py-1.5 text-muted-foreground">Ajuste de peso</td>
                  <td className="py-1.5 text-right font-medium">{evolution.bioimpedance.recommendedWeightChangeKg} kg</td>
                </tr>
              )}
              {evolution.bioimpedance?.recommendedFatChangeKg && (
                <tr className="border-b">
                  <td className="py-1.5 text-muted-foreground">Ajuste de gordura</td>
                  <td className="py-1.5 text-right font-medium">{evolution.bioimpedance.recommendedFatChangeKg} kg</td>
                </tr>
              )}
              {evolution.bioimpedance?.recommendedMuscleChangeKg && (
                <tr>
                  <td className="py-1.5 text-muted-foreground">Ajuste muscular</td>
                  <td className="py-1.5 text-right font-medium">{evolution.bioimpedance.recommendedMuscleChangeKg} kg</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {evolution.segmentalMeasurements.length > 0 && (
        <section className="print:break-inside-avoid">
          <SegmentalBodyAnalysisCard silhouette={silhouette} current={evolution} />
        </section>
      )}

      {includeImpedance && (evolution.bioimpedance?.segmentalImpedanceMeasurements.length ?? 0) > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Impedância por frequência</h3>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1.5">Frequência</th>
                <th className="py-1.5 text-right">BD</th>
                <th className="py-1.5 text-right">BE</th>
                <th className="py-1.5 text-right">TR</th>
                <th className="py-1.5 text-right">PD</th>
                <th className="py-1.5 text-right">PE</th>
              </tr>
            </thead>
            <tbody>
              {evolution.bioimpedance?.segmentalImpedanceMeasurements.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="py-1.5">
                    {row.frequencyValue} {row.frequencyUnit}
                  </td>
                  <td className="py-1.5 text-right">{row.rightArmOhms ?? '—'}</td>
                  <td className="py-1.5 text-right">{row.leftArmOhms ?? '—'}</td>
                  <td className="py-1.5 text-right">{row.trunkOhms ?? '—'}</td>
                  <td className="py-1.5 text-right">{row.rightLegOhms ?? '—'}</td>
                  <td className="py-1.5 text-right">{row.leftLegOhms ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {evolution.referenceRanges.length > 0 && (
        <section>
          <h3 className="mb-1 text-sm font-semibold">Referências informadas</h3>
          <p className="text-sm whitespace-pre-wrap">
            {evolution.referenceRanges
              .map((r) => `${r.fieldKey}: ${r.minValue ?? '?'} a ${r.maxValue ?? '?'} ${r.unit ?? ''}`.trimEnd())
              .join(' · ')}
          </p>
        </section>
      )}

      {evolution.patientVisibleNotes && (
        <section>
          <h3 className="mb-1 text-sm font-semibold">Mensagem ao paciente</h3>
          <p className="text-sm whitespace-pre-wrap">{evolution.patientVisibleNotes}</p>
        </section>
      )}

      <footer className="border-t pt-4 text-xs text-muted-foreground">
        Relatório gerado via SmartNutri em {new Date().toLocaleDateString('pt-BR')}.
      </footer>
    </div>
  );
}
