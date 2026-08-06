import type {
  AnthropometricMeasurement,
  BioimpedanceMeasurement,
  BodySegmentEnum,
  PatientEvolution,
  SegmentalMetricTypeEnum,
} from './types';

export type MetricSource = 'anthropometry' | 'bioimpedance';

export interface MetricDefinition {
  key: string;
  source: MetricSource;
  label: string;
  unit: string;
  /** true quando o valor já é um percentual — diferenças viram "pontos percentuais", nunca "%". */
  isPercentageMetric: boolean;
}

export const METRIC_CATALOG: MetricDefinition[] = [
  { key: 'weightKg', source: 'anthropometry', label: 'Peso', unit: 'kg', isPercentageMetric: false },
  { key: 'bmi', source: 'anthropometry', label: 'IMC', unit: 'kg/m²', isPercentageMetric: false },
  { key: 'waistCm', source: 'anthropometry', label: 'Cintura', unit: 'cm', isPercentageMetric: false },
  { key: 'abdomenCm', source: 'anthropometry', label: 'Abdômen', unit: 'cm', isPercentageMetric: false },
  { key: 'hipCm', source: 'anthropometry', label: 'Quadril', unit: 'cm', isPercentageMetric: false },
  { key: 'chestCm', source: 'anthropometry', label: 'Tórax', unit: 'cm', isPercentageMetric: false },
  { key: 'gluteCm', source: 'anthropometry', label: 'Glúteo', unit: 'cm', isPercentageMetric: false },
  { key: 'rightArmCm', source: 'anthropometry', label: 'Braço direito', unit: 'cm', isPercentageMetric: false },
  { key: 'leftArmCm', source: 'anthropometry', label: 'Braço esquerdo', unit: 'cm', isPercentageMetric: false },
  { key: 'rightThighCm', source: 'anthropometry', label: 'Coxa direita', unit: 'cm', isPercentageMetric: false },
  { key: 'leftThighCm', source: 'anthropometry', label: 'Coxa esquerda', unit: 'cm', isPercentageMetric: false },
  { key: 'rightCalfCm', source: 'anthropometry', label: 'Panturrilha direita', unit: 'cm', isPercentageMetric: false },
  { key: 'leftCalfCm', source: 'anthropometry', label: 'Panturrilha esquerda', unit: 'cm', isPercentageMetric: false },
  { key: 'bodyFatPercent', source: 'bioimpedance', label: 'Gordura corporal', unit: '%', isPercentageMetric: true },
  { key: 'fatMassKg', source: 'bioimpedance', label: 'Massa gorda', unit: 'kg', isPercentageMetric: false },
  { key: 'leanMassKg', source: 'bioimpedance', label: 'Massa magra', unit: 'kg', isPercentageMetric: false },
  { key: 'muscleMassKg', source: 'bioimpedance', label: 'Massa muscular', unit: 'kg', isPercentageMetric: false },
  { key: 'skeletalMuscleMassKg', source: 'bioimpedance', label: 'Massa muscular esquelética', unit: 'kg', isPercentageMetric: false },
  { key: 'musclePercent', source: 'bioimpedance', label: 'Percentual muscular', unit: '%', isPercentageMetric: true },
  { key: 'bodyWaterPercent', source: 'bioimpedance', label: 'Água corporal', unit: '%', isPercentageMetric: true },
  { key: 'proteinKg', source: 'bioimpedance', label: 'Proteína', unit: 'kg', isPercentageMetric: false },
  { key: 'mineralMassKg', source: 'bioimpedance', label: 'Minerais', unit: 'kg', isPercentageMetric: false },
  { key: 'visceralFatLevel', source: 'bioimpedance', label: 'Gordura visceral', unit: 'nível', isPercentageMetric: false },
  { key: 'boneMassKg', source: 'bioimpedance', label: 'Massa óssea', unit: 'kg', isPercentageMetric: false },
  { key: 'waistHipRatio', source: 'bioimpedance', label: 'Relação cintura-quadril', unit: '', isPercentageMetric: false },
  { key: 'basalMetabolicRateKcal', source: 'bioimpedance', label: 'Taxa metabólica basal', unit: 'kcal', isPercentageMetric: false },
  { key: 'obesityDegreePercent', source: 'bioimpedance', label: 'Grau de obesidade', unit: '%', isPercentageMetric: true },
];

export interface MetricPoint {
  evolutionId: string;
  assessmentDate: string;
  value: number | null;
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

export function metricValue(evolution: PatientEvolution, metric: MetricDefinition): number | null {
  const source: AnthropometricMeasurement | BioimpedanceMeasurement | null =
    metric.source === 'anthropometry' ? evolution.anthropometry : evolution.bioimpedance;
  if (!source) return null;
  return toNumber((source as unknown as Record<string, string | number | null>)[metric.key]);
}

/** Série cronológica (mais antiga → mais recente) de um metric para gráfico — nunca preenche ausência com zero. */
export function buildMetricSeries(evolutions: PatientEvolution[], metric: MetricDefinition): MetricPoint[] {
  return [...evolutions]
    .sort((a, b) => a.assessmentDate.localeCompare(b.assessmentDate))
    .map((evolution) => ({
      evolutionId: evolution.id,
      assessmentDate: evolution.assessmentDate,
      value: metricValue(evolution, metric),
    }));
}

export type MetricDirection = 'up' | 'down' | 'stable' | 'unknown';

export interface MetricDiff {
  metric: MetricDefinition;
  previous: number | null;
  current: number | null;
  absoluteDiff: number | null;
  /** Variação percentual relativa — só calculada para métricas que NÃO são elas mesmas um percentual. */
  percentDiff: number | null;
  direction: MetricDirection;
}

/**
 * Diferença entre duas avaliações. Nunca assume que "subir" ou "descer" é
 * bom ou ruim — quem exibe decide a cor/ícone com base no contexto clínico.
 */
export function compareEvolutions(previous: PatientEvolution, current: PatientEvolution): MetricDiff[] {
  return METRIC_CATALOG.map((metric) => {
    const prevValue = metricValue(previous, metric);
    const currValue = metricValue(current, metric);

    if (prevValue === null || currValue === null) {
      return {
        metric,
        previous: prevValue,
        current: currValue,
        absoluteDiff: null,
        percentDiff: null,
        direction: 'unknown' as MetricDirection,
      };
    }

    const absoluteDiff = Math.round((currValue - prevValue) * 100) / 100;
    const percentDiff =
      !metric.isPercentageMetric && prevValue !== 0
        ? Math.round((absoluteDiff / prevValue) * 1000) / 10
        : null;
    const direction: MetricDirection = absoluteDiff === 0 ? 'stable' : absoluteDiff > 0 ? 'up' : 'down';

    return { metric, previous: prevValue, current: currValue, absoluteDiff, percentDiff, direction };
  }).filter((diff) => diff.previous !== null || diff.current !== null);
}

export interface SegmentalDiff {
  segment: BodySegmentEnum;
  metricType: SegmentalMetricTypeEnum;
  previous: number | null;
  current: number | null;
  absoluteDiff: number | null;
  isEstimated: boolean;
  direction: MetricDirection;
}

/** Mesma lógica de `compareEvolutions`, mas para os valores segmentares (por segmento + tipo de métrica). */
export function compareSegmentalMeasurements(previous: PatientEvolution, current: PatientEvolution): SegmentalDiff[] {
  const segments: BodySegmentEnum[] = ['RIGHT_ARM', 'LEFT_ARM', 'TRUNK', 'RIGHT_LEG', 'LEFT_LEG'];
  const metricTypes: SegmentalMetricTypeEnum[] = ['FAT_MASS_KG', 'LEAN_MASS_KG'];

  const diffs: SegmentalDiff[] = [];
  for (const segment of segments) {
    for (const metricType of metricTypes) {
      const prevRow = previous.segmentalMeasurements.find((m) => m.segment === segment && m.metricType === metricType);
      const currRow = current.segmentalMeasurements.find((m) => m.segment === segment && m.metricType === metricType);
      if (!prevRow && !currRow) continue;

      const prevValue = prevRow ? Number.parseFloat(prevRow.valueKg) : null;
      const currValue = currRow ? Number.parseFloat(currRow.valueKg) : null;
      const absoluteDiff = prevValue !== null && currValue !== null ? Math.round((currValue - prevValue) * 100) / 100 : null;
      const direction: MetricDirection =
        absoluteDiff === null ? 'unknown' : absoluteDiff === 0 ? 'stable' : absoluteDiff > 0 ? 'up' : 'down';

      diffs.push({
        segment,
        metricType,
        previous: prevValue,
        current: currValue,
        absoluteDiff,
        isEstimated: currRow?.isEstimated ?? false,
        direction,
      });
    }
  }
  return diffs;
}

/** Busca a faixa de referência informada para um campo — nunca usada para diagnóstico automático. */
export function findReferenceRange(evolution: PatientEvolution, fieldKey: string) {
  return evolution.referenceRanges.find((r) => r.fieldKey === fieldKey) ?? null;
}
