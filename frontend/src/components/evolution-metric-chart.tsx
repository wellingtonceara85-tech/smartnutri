'use client';

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MetricDefinition, MetricPoint } from '@/lib/evolution-metrics';
import { formatCalendarDate } from '@/lib/masks';

function formatDate(iso: string): string {
  return formatCalendarDate(iso, '2-digit');
}

interface EvolutionMetricChartProps {
  metric: MetricDefinition;
  points: MetricPoint[];
}

/**
 * Gráfico de linha reutilizável para qualquer métrica do catálogo — pontos
 * sem valor registrado ficam ausentes da linha (null), nunca viram zero.
 */
export function EvolutionMetricChart({ metric, points }: EvolutionMetricChartProps) {
  const hasAnyValue = points.some((p) => p.value !== null);
  const chartData = points.map((p) => ({ date: p.assessmentDate, value: p.value }));

  if (!hasAnyValue) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Sem registros de {metric.label.toLowerCase()} ainda
      </div>
    );
  }

  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
          />
          <YAxis
            width={40}
            domain={['auto', 'auto']}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value) => [`${value} ${metric.unit}`.trim(), metric.label]}
            labelFormatter={(label) => formatDate(String(label))}
            contentStyle={{
              backgroundColor: 'var(--popover)',
              color: 'var(--popover-foreground)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
