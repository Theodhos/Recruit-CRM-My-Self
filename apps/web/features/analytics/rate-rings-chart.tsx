'use client';

import { useState } from 'react';
import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer, Tooltip } from 'recharts';

import { CHART_GRID, CHART_SERIES } from './chart-tokens';
import { ChartTooltip } from './chart-tooltip';

export interface RateDatum {
  label: string;
  /** A share from 0 to 100. */
  value: number;
}

/**
 * Shares out of 100 (a rate) as concentric rings: the first name on the outside, each ring as full as its rate. Next to
 * the rings every name is listed with its figure, so all the data is readable at once. Interactive: the ring (or the name)
 * under the mouse stays bright, the others fade, and its figure is written in the middle.
 */
export function RateRingsChart({ data, valueLabel, emptyMessage }: { data: RateDatum[]; valueLabel: string; emptyMessage: string }) {
  const [active, setActive] = useState<number | null>(null);
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-foreground/50">{emptyMessage}</p>;
  }
  const rows = data.map((d, index) => ({ ...d, fill: CHART_SERIES[index % CHART_SERIES.length], name: d.label }));
  const average = rows.reduce((sum, row) => sum + row.value, 0) / rows.length;
  const shown = active !== null ? rows[active] : null;

  return (
    <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[minmax(0,260px)_1fr]">
      <div className="relative mx-auto h-[250px] w-full max-w-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart data={rows} innerRadius="30%" outerRadius="100%" startAngle={90} endAngle={-270} barSize={14} onMouseLeave={() => setActive(null)}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <Tooltip content={({ active: on, payload }) => <ChartTooltip active={on} label={payload?.[0]?.payload?.label} payload={payload?.map((p) => ({ name: valueLabel, value: `${p.value}%`, color: p.payload.fill }))} />} />
            <RadialBar dataKey="value" cornerRadius={8} background={{ fill: CHART_GRID, opacity: 0.35 }} animationDuration={800} onMouseEnter={(_, index) => setActive(index)} />
          </RadialBarChart>
        </ResponsiveContainer>
        {/* the middle: the ring under the mouse, or the average */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold tabular-nums">{Math.round(shown ? shown.value : average)}%</span>
          <span className="max-w-[90px] truncate text-[11px] text-foreground/50">{shown ? shown.label : 'average'}</span>
        </div>
      </div>

      <ul className="flex flex-col gap-1">
        {rows.map((row, index) => (
          <li
            key={`${row.label}-${index}`}
            onMouseEnter={() => setActive(index)}
            onMouseLeave={() => setActive(null)}
            className={`rounded-lg px-3 py-2 transition-colors ${active === index ? 'bg-accent' : ''} ${active !== null && active !== index ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.fill }} />
                <span className="truncate font-medium" title={row.label}>
                  {index + 1}. {row.label}
                </span>
              </span>
              <span className="shrink-0 font-bold tabular-nums">{row.value}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-accent">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, row.value)}%`, backgroundColor: row.fill, transition: 'width 600ms ease' }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
