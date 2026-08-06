'use client';

import { useMemo, useState } from 'react';
import { BodySegmentMap, BODY_SEGMENT_LABELS, type BodySegmentId, type BodySilhouette } from './body-segment-map';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { cn } from '@/lib/utils';
import { compareSegmentalMeasurements, type MetricDirection } from '@/lib/evolution-metrics';
import type { PatientEvolution, SegmentalMetricTypeEnum } from '@/lib/types';

const METRIC_TABS: { value: SegmentalMetricTypeEnum; label: string }[] = [
  { value: 'FAT_MASS_KG', label: 'Gordura Segmentar' },
  { value: 'LEAN_MASS_KG', label: 'Massa Magra Segmentar' },
];

const SEGMENTS: BodySegmentId[] = ['RIGHT_ARM', 'LEFT_ARM', 'TRUNK', 'RIGHT_LEG', 'LEFT_LEG'];
const LIMB_SEGMENTS: BodySegmentId[] = ['RIGHT_ARM', 'LEFT_ARM', 'RIGHT_LEG', 'LEFT_LEG'];

interface SegmentDisplay {
  value: number | null;
  isEstimated: boolean;
  absoluteDiff: number | null;
  direction: MetricDirection;
}

function buildDisplay(
  current: PatientEvolution,
  previous: PatientEvolution | null,
  metricType: SegmentalMetricTypeEnum,
): Record<BodySegmentId, SegmentDisplay> {
  const diffs = previous ? compareSegmentalMeasurements(previous, current) : [];
  const result = {} as Record<BodySegmentId, SegmentDisplay>;
  for (const segment of SEGMENTS) {
    const row = current.segmentalMeasurements.find((r) => r.segment === segment && r.metricType === metricType);
    const diff = diffs.find((d) => d.segment === segment && d.metricType === metricType);
    result[segment] = {
      value: row ? Number.parseFloat(row.valueKg) : null,
      isEstimated: row?.isEstimated ?? false,
      absoluteDiff: diff?.absoluteDiff ?? null,
      direction: diff?.direction ?? 'unknown',
    };
  }
  return result;
}

function directionSymbol(direction: MetricDirection): string | null {
  if (direction === 'up') return '▲';
  if (direction === 'down') return '▼';
  if (direction === 'stable') return '—';
  return null;
}

function directionWord(direction: MetricDirection): string | null {
  if (direction === 'up') return 'aumentou';
  if (direction === 'down') return 'diminuiu';
  if (direction === 'stable') return 'manteve-se estável em';
  return null;
}

function SegmentInfoCard({
  segment,
  data,
  align,
  hovered,
  onHover,
  className,
}: {
  segment: BodySegmentId;
  data: SegmentDisplay;
  align: 'left' | 'right' | 'center';
  hovered: boolean;
  onHover: (segment: BodySegmentId | null) => void;
  className?: string;
}) {
  const label = BODY_SEGMENT_LABELS[segment];
  const word = data.absoluteDiff !== null ? directionWord(data.direction) : null;
  const ariaLabel = `${label}: ${
    data.value !== null ? `${data.value.toFixed(2)} quilogramas${data.isEstimated ? ', estimado pelo equipamento' : ''}` : 'sem dado registrado'
  }${word && data.absoluteDiff !== null ? `, ${word} ${Math.abs(data.absoluteDiff).toFixed(2)} quilogramas desde a avaliação anterior` : ''}`;
  const justify = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';

  return (
    <div
      tabIndex={0}
      aria-label={ariaLabel}
      onMouseEnter={() => onHover(segment)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(segment)}
      onBlur={() => onHover(null)}
      className={cn(
        'min-w-0 rounded-lg border px-3 py-2 outline-none transition-colors duration-200 print:transition-none',
        'focus-visible:ring-[3px] focus-visible:ring-ring/50',
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
        hovered ? 'border-primary bg-primary/5' : 'border-border bg-card',
        className,
      )}
    >
      <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
      {data.value !== null ? (
        <p className={cn('flex items-baseline gap-1', justify)}>
          <span className="text-base font-semibold tabular-nums">{data.value.toFixed(2)}</span>
          <span className="text-xs text-muted-foreground">kg{data.isEstimated ? ' · estimado' : ''}</span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Sem dado</p>
      )}
      {data.absoluteDiff !== null && (
        <p className={cn('flex items-center gap-1 text-xs text-foreground/70', justify)}>
          <span aria-hidden>{directionSymbol(data.direction)}</span>
          <span className="tabular-nums">
            {data.absoluteDiff > 0 ? '+' : ''}
            {data.absoluteDiff.toFixed(2)} kg
          </span>
        </p>
      )}
    </div>
  );
}

/** Linha discreta ligando um cartão ao segmento correspondente — nunca sobre o corpo, só no espaço ao redor. */
function Connector({ orientation, hovered }: { orientation: 'horizontal' | 'vertical'; hovered: boolean }) {
  return (
    <span aria-hidden className={cn('flex shrink-0 items-center justify-center', orientation === 'vertical' && 'flex-col')}>
      <span
        className={cn(
          'transition-colors duration-200',
          orientation === 'horizontal' ? 'h-px w-6 border-t border-dashed' : 'h-6 w-px border-l border-dashed',
          hovered ? 'border-primary' : 'border-border',
        )}
      />
      <span className={cn('size-1.5 shrink-0 rounded-full transition-colors duration-200', hovered ? 'bg-primary' : 'bg-border')} />
    </span>
  );
}

interface SegmentalBodyAnalysisCardProps {
  silhouette: BodySilhouette;
  current: PatientEvolution;
  previous?: PatientEvolution | null;
  className?: string;
}

/**
 * Componente próprio de análise corporal segmentar — silhueta SVG original, cartões de valor
 * posicionados ao redor do corpo (nunca sobre) e ligados por linhas discretas, com indicadores
 * neutros (▲▼—) sem qualquer semântica automática de "bom/ruim". A interpretação é sempre da
 * nutricionista.
 */
export function SegmentalBodyAnalysisCard({ silhouette, current, previous = null, className }: SegmentalBodyAnalysisCardProps) {
  const [metricType, setMetricType] = useState<SegmentalMetricTypeEnum>('FAT_MASS_KG');
  const [hoveredSegment, setHoveredSegment] = useState<BodySegmentId | null>(null);

  const display = useMemo(() => buildDisplay(current, previous, metricType), [current, previous, metricType]);
  const hasAnyData = current.segmentalMeasurements.length > 0;
  const activeLabel = METRIC_TABS.find((t) => t.value === metricType)?.label ?? '';

  const segmentColors = {
    RIGHT_ARM: display.RIGHT_ARM.value !== null ? 'var(--secondary)' : undefined,
    LEFT_ARM: display.LEFT_ARM.value !== null ? 'var(--secondary)' : undefined,
    TRUNK: display.TRUNK.value !== null ? 'var(--secondary)' : undefined,
    RIGHT_LEG: display.RIGHT_LEG.value !== null ? 'var(--secondary)' : undefined,
    LEFT_LEG: display.LEFT_LEG.value !== null ? 'var(--secondary)' : undefined,
  };

  function horizontalCard(segment: BodySegmentId, side: 'left' | 'right') {
    return (
      <div key={segment} className={cn('flex items-center gap-2', side === 'right' && 'flex-row-reverse')}>
        <SegmentInfoCard
          segment={segment}
          data={display[segment]}
          align={side}
          hovered={hoveredSegment === segment}
          onHover={setHoveredSegment}
          className="flex-1"
        />
        <Connector orientation="horizontal" hovered={hoveredSegment === segment} />
      </div>
    );
  }

  return (
    <Card className={cn('print:break-inside-avoid', className)}>
      <CardHeader className="gap-3">
        <CardTitle className="text-base">Análise Corporal Segmentar</CardTitle>
        {hasAnyData && (
          <>
            <Tabs value={metricType} onValueChange={(value) => setMetricType(value as SegmentalMetricTypeEnum)} className="print:hidden">
              <TabsList aria-label="Métrica segmentar">
                {METRIC_TABS.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <p className="hidden text-sm font-medium text-muted-foreground print:block">{activeLabel}</p>
          </>
        )}
      </CardHeader>
      <CardContent>
        {!hasAnyData ? (
          <p className="text-sm text-muted-foreground">Nenhuma medida segmentar registrada nesta avaliação.</p>
        ) : (
          // Reorganização por largura do próprio card (container query), não do viewport — o mesmo
          // componente também roda dentro do relatório de impressão, que é mais estreito que a tela.
          <div className="@container">
            <div className="hidden @2xl:flex @2xl:items-stretch @2xl:justify-center @2xl:gap-4">
              <div className="flex w-44 flex-col justify-between gap-6">
                {horizontalCard('RIGHT_ARM', 'left')}
                {horizontalCard('RIGHT_LEG', 'left')}
              </div>

              <div className="flex flex-col items-center justify-between gap-3">
                <BodySegmentMap silhouette={silhouette} size={120} hoveredSegment={hoveredSegment} segmentColors={segmentColors} />
                <div className="flex flex-col items-center gap-2">
                  <Connector orientation="vertical" hovered={hoveredSegment === 'TRUNK'} />
                  <SegmentInfoCard
                    segment="TRUNK"
                    data={display.TRUNK}
                    align="center"
                    hovered={hoveredSegment === 'TRUNK'}
                    onHover={setHoveredSegment}
                    className="w-44"
                  />
                </div>
              </div>

              <div className="flex w-44 flex-col justify-between gap-6">
                {horizontalCard('LEFT_ARM', 'right')}
                {horizontalCard('LEFT_LEG', 'right')}
              </div>
            </div>

            {/* Container estreito — silhueta acima, cartões reorganizados em grade abaixo, sem conectores */}
            <div className="flex flex-col items-center gap-4 @2xl:hidden">
              <BodySegmentMap silhouette={silhouette} size={130} hoveredSegment={hoveredSegment} segmentColors={segmentColors} />
              <SegmentInfoCard
                segment="TRUNK"
                data={display.TRUNK}
                align="center"
                hovered={hoveredSegment === 'TRUNK'}
                onHover={setHoveredSegment}
                className="w-full max-w-64"
              />
              <div className="grid w-full grid-cols-2 gap-3">
                {LIMB_SEGMENTS.map((segment) => (
                  <SegmentInfoCard
                    key={segment}
                    segment={segment}
                    data={display[segment]}
                    align="left"
                    hovered={hoveredSegment === segment}
                    onHover={setHoveredSegment}
                  />
                ))}
              </div>
            </div>

            <p className="mt-4 text-center text-xs text-muted-foreground @2xl:text-left">
              Os valores de gordura segmentar geralmente são estimados pelo equipamento.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
