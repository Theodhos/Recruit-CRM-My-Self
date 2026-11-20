'use client';

import { useState } from 'react';
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { CHART_GRID, CHART_MUTED, CHART_SERIES } from './chart-tokens';
import { ChartTooltip } from './chart-tooltip';

export interface StatusBarDatum {
  status: string;
  count: number;
  percentage: number;
}

/**
 * Part-to-whole across a handful of named categories -> horizontal bar, not a pie — reads at a glance, and long stage names
 * never get squeezed into a slice label. Interactive: the bar under the mouse stays bright while the others fade and its
 * figures are written above the chart; a click on a bar opens `onSelect` (the pipeline). Each bar fades from soft to full colour.
 */
export function StatusBarChart({ data, onSelect }: { data: StatusBarDatum[]; onSelect?: (stage: string) => void }) {
  const [active, setActive] = useState<number | null>(null);
  const chartData = data.map((d, index) => ({ ...d, label: d.status.replaceAll('_', ' '), fill: CHART_SERIES[index % CHART_SERIES.length] }));
  const total = chartData.reduce((sum, d) => sum + d.count, 0);
  const shown = active !== null ? chartData[active] : null;
  const height = Math.max(chartData.length * 44, 140);

  return (
    <div>
      {/* what is under the mouse, or the whole */}
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-accent/40 px-3 py-2" aria-live="polite">
        <p className="flex items-center gap-2 text-sm font-semibold">
          {shown ? (
            <>
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: shown.fill }} />
              {shown.label}
            </>
          ) : (
            'All stages'
          )}
        </p>
        <p className="text-sm text-foreground/70">
          <span className="text-2xl font-bold tabular-nums text-foreground">{(shown ? shown.count : total).toLocaleString()}</span>{' '}
          {shown ? `application${shown.count === 1 ? '' : 's'} · ${shown.percentage}% of all` : 'applications in the pipeline'}
        </p>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 44, bottom: 4, left: 8 }} onMouseLeave={() => setActive(null)}>
          <defs>
            {chartData.map((d, index) => (
              <linearGradient key={`${d.status}-${index}`} id={`stage-fill-${index}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={d.fill} stopOpacity={0.45} />
                <stop offset="100%" stopColor={d.fill} stopOpacity={1} />
              </linearGradient>
            ))}
          </defs>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" width={120} tickLine={false} axisLine={false} tick={{ fill: CHART_MUTED, fontSize: 12 }} />
          <Tooltip
            cursor={{ fill: CHART_GRID, opacity: 0.35, radius: 6 }}
            content={({ active: on, label, payload }) => (
              <ChartTooltip active={on} label={label} payload={payload?.map((p) => ({ name: 'Applications', value: `${p.payload.count} (${p.payload.percentage}%)`, color: p.payload.fill }))} />
            )}
          />
          <Bar
            dataKey="count"
            barSize={22}
            radius={[0, 8, 8, 0]}
            background={{ fill: CHART_GRID, opacity: 0.25, radius: 8 } as never}
            cursor={onSelect ? 'pointer' : 'default'}
            animationDuration={700}
            onMouseEnter={(_, index) => setActive(index)}
            onClick={(entry) => onSelect?.((entry as unknown as { status: string }).status)}
          >
            {chartData.map((entry, index) => (
              // two pipelines can each have a stage with the same name, so the name alone is not a unique key
              <Cell key={`${entry.status}-${index}`} fill={`url(#stage-fill-${index})`} fillOpacity={active === null || active === index ? 1 : 0.35} style={{ transition: 'fill-opacity 150ms' }} />
            ))}
            <LabelList dataKey="count" position="right" style={{ fill: 'var(--chart-text-secondary)', fontSize: 12, fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {onSelect ? <p className="mt-1 text-right text-[11px] text-foreground/40">Click a stage to open the pipeline</p> : null}
    </div>
  );
}
