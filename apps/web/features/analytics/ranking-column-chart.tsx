'use client';

import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { CHART_GRID, CHART_MUTED, CHART_SERIES } from './chart-tokens';
import { ChartTooltip } from './chart-tooltip';

export interface RankingColumnDatum {
  label: string;
  value: number;
}

const short = (text: string, max = 13) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/**
 * One series ranked by size as vertical columns: every column has its figure written on top, and its name under it (the whole
 * name is in the tooltip). Interactive: the column under the mouse stays bright while the others fade. A strip under the chart
 * lists every name with its figure, so no figure is hidden behind a short label.
 */
export function RankingColumnChart({
  data,
  valueLabel,
  emptyMessage,
  valueFormatter = (value) => String(value),
}: {
  data: RankingColumnDatum[];
  valueLabel: string;
  emptyMessage: string;
  valueFormatter?: (value: number) => string;
}) {
  const [active, setActive] = useState<number | null>(null);
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-foreground/50">{emptyMessage}</p>;
  }
  const rows = data.map((d, index) => ({ ...d, short: short(d.label), fill: CHART_SERIES[index % CHART_SERIES.length] }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={rows} margin={{ top: 24, right: 8, bottom: 4, left: -20 }} onMouseLeave={() => setActive(null)}>
          <defs>
            {rows.map((row, index) => (
              <linearGradient key={`${row.label}-${index}`} id={`col-fill-${valueLabel}-${index}`} x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={row.fill} stopOpacity={0.4} />
                <stop offset="100%" stopColor={row.fill} stopOpacity={1} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey="short" interval={0} tickLine={false} axisLine={{ stroke: CHART_GRID }} tick={{ fill: CHART_MUTED, fontSize: 12 }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: CHART_MUTED, fontSize: 12 }} width={44} />
          <Tooltip
            cursor={{ fill: CHART_GRID, opacity: 0.3, radius: 6 }}
            content={({ active: on, payload }) => (
              <ChartTooltip active={on} label={payload?.[0]?.payload?.label} payload={payload?.map((p) => ({ name: valueLabel, value: valueFormatter(p.value as number), color: p.payload.fill }))} />
            )}
          />
          <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={56} animationDuration={700} onMouseEnter={(_, index) => setActive(index)}>
            {rows.map((row, index) => (
              <Cell key={`${row.label}-${index}`} fill={`url(#col-fill-${valueLabel}-${index})`} fillOpacity={active === null || active === index ? 1 : 0.35} style={{ transition: 'fill-opacity 150ms' }} />
            ))}
            <LabelList dataKey="value" position="top" formatter={(value: unknown) => valueFormatter(value as number)} style={{ fill: 'var(--foreground)', fontSize: 13, fontWeight: 700 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
        {rows.map((row, index) => (
          <li
            key={`${row.label}-${index}`}
            onMouseEnter={() => setActive(index)}
            onMouseLeave={() => setActive(null)}
            className={`flex items-center justify-between gap-3 rounded-md px-2 py-1 text-sm transition-colors ${active === index ? 'bg-accent' : ''}`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.fill }} />
              <span className="truncate text-foreground/80" title={row.label}>
                {row.label}
              </span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums">{valueFormatter(row.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
