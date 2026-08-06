'use client';

import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { compareEvolutions } from '@/lib/evolution-metrics';
import { formatCalendarDate } from '@/lib/masks';
import type { PatientEvolution } from '@/lib/types';

function formatDate(iso: string): string {
  return formatCalendarDate(iso);
}

function DirectionIcon({ direction }: { direction: 'up' | 'down' | 'stable' | 'unknown' }) {
  // Cor sempre neutra — subir ou descer não é "bom" ou "ruim" por padrão (contexto clínico decide).
  if (direction === 'up') return <ArrowUp className="size-4 text-muted-foreground" />;
  if (direction === 'down') return <ArrowDown className="size-4 text-muted-foreground" />;
  if (direction === 'stable') return <Minus className="size-4 text-muted-foreground" />;
  return null;
}

interface EvolutionComparisonProps {
  previous: PatientEvolution;
  current: PatientEvolution;
}

export function EvolutionComparison({ previous, current }: EvolutionComparisonProps) {
  const diffs = compareEvolutions(previous, current);

  if (diffs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Nenhuma métrica em comum entre essas duas avaliações para comparar.
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Comparação: {formatDate(previous.assessmentDate)} → {formatDate(current.assessmentDate)}
        </CardTitle>
        <CardDescription>Métricas ausentes em uma das avaliações não entram na comparação.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Métrica</TableHead>
                <TableHead>Anterior</TableHead>
                <TableHead>Atual</TableHead>
                <TableHead>Diferença</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {diffs.map((diff) => (
                <TableRow key={diff.metric.key}>
                  <TableCell className="font-medium">{diff.metric.label}</TableCell>
                  <TableCell>{diff.previous !== null ? `${diff.previous} ${diff.metric.unit}`.trim() : '—'}</TableCell>
                  <TableCell>{diff.current !== null ? `${diff.current} ${diff.metric.unit}`.trim() : '—'}</TableCell>
                  <TableCell>
                    {diff.absoluteDiff === null ? (
                      <span className="text-muted-foreground">Sem dado em uma das avaliações</span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <DirectionIcon direction={diff.direction} />
                        {diff.absoluteDiff > 0 ? '+' : ''}
                        {diff.absoluteDiff}
                        {diff.metric.isPercentageMetric ? ' pontos percentuais' : ` ${diff.metric.unit}`.trimEnd()}
                        {diff.percentDiff !== null && (
                          <span className="text-muted-foreground">
                            ({diff.percentDiff > 0 ? '+' : ''}
                            {diff.percentDiff}%)
                          </span>
                        )}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
