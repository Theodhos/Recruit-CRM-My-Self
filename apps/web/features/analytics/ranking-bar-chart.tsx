'use client';

import { useState } from 'react';
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { CHART_GRID, CHART_MUTED, CHART_SERIES } from './chart-tokens';
import { ChartTooltip } from './chart-tooltip';

export interface RankingDatum {
  label: string;
  value: number;
}

/**
 * One series ranked by magnitude -> a single hue, the longest bar on top, each name numbered by its rank. Interactive: the bar
 * under the mouse stays bright while the others fade, and the figures are on the bar and in the tooltip.
 */
export function RankingBarChart({
  data,
  valueLabel,
  emptyMessage,
  valueFormatter = (value) => String(value),
}: {
  data: RankingDatum[];
  valueLabel: string;
  emptyMessage: string;
  /** Formats the bar-end label and tooltip value — e.g. a percentage for a conversion-rate ranking. */
  valueFormatter?: (value: number) => string;
}) {
  const [active, setActive] = useState<number | null>(null);
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-foreground/50">{emptyMessage}</p>;
  }

  const ranked = data.map((d, index) => ({ ...d, name: `${index + 1}. ${d.label}` }));
  const height = Math.max(ranked.length * 42, 140);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={ranked} layout="vertical" margin={{ top: 4, right: 44, bottom: 4, left: 8 }} onMouseLeave={() => setActive(null)}>
        <defs>
          <linearGradient id="rank-fill" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={CHART_SERIES[0]} stopOpacity={0.45} />
            <stop offset="100%" stopColor={CHART_SERIES[0]} stopOpacity={1} />
          </linearGradient>
        </defs>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={150} tickLine={false} axisLine={false} tick={{ fill: CHART_MUTED, fontSize: 12 }} />
        <Tooltip
          cursor={{ fill: CHART_GRID, opacity: 0.35, radius: 6 }}
          content={({ active: on, payload }) => (
            <ChartTooltip active={on} label={payload?.[0]?.payload?.label} payload={payload?.map((p) => ({ name: valueLabel, value: valueFormatter(p.value as number), color: CHART_SERIES[0] }))} />
          )}
        />
        <Bar
          dataKey="value"
          barSize={20}
          radius={[0, 8, 8, 0]}
          background={{ fill: CHART_GRID, opacity: 0.25, radius: 8 } as never}
          animationDuration={700}
          onMouseEnter={(_, index) => setActive(index)}
        >
          {ranked.map((entry, index) => (
            <Cell key={`${entry.label}-${index}`} fill="url(#rank-fill)" fillOpacity={active === null || active === index ? 1 : 0.35} style={{ transition: 'fill-opacity 150ms' }} />
          ))}
          <LabelList dataKey="value" position="right" formatter={(value: unknown) => valueFormatter(value as number)} style={{ fill: 'var(--chart-text-secondary)', fontSize: 12, fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
