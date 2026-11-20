'use client';

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { CHART_GRID, CHART_MUTED, CHART_SERIES, CHART_SURFACE } from './chart-tokens';
import { ChartTooltip } from './chart-tooltip';

export interface TrendDatum {
  month: string;
  count: number;
}

/**
 * Single series over time -> an area under one line (one hue, no legend: the card title says what is plotted). Interactive: the
 * point under the mouse grows and a tooltip names the month; above the chart the total, the best month and the average are
 * written, and the average is drawn as a dashed line to read each month against.
 */
export function TrendLineChart({ data }: { data: TrendDatum[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const best = data.reduce<TrendDatum | null>((top, d) => (!top || d.count > top.count ? d : top), null);
  const average = data.length > 0 ? total / data.length : 0;

  return (
    <div>
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        {[
          ['Total', total.toLocaleString()],
          ['Best month', best && best.count > 0 ? `${best.month} · ${best.count}` : '—'],
          ['Average', average ? average.toFixed(1) : '—'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-accent/40 px-2 py-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-foreground/50">{label}</p>
            <p className="text-sm font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_SERIES[0]} stopOpacity={0.35} />
              <stop offset="100%" stopColor={CHART_SERIES[0]} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: CHART_GRID }} tick={{ fill: CHART_MUTED, fontSize: 12 }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: CHART_MUTED, fontSize: 12 }} width={32} />
          {average > 0 ? <ReferenceLine y={average} stroke={CHART_MUTED} strokeDasharray="5 5" strokeOpacity={0.6} /> : null}
          <Tooltip
            cursor={{ stroke: CHART_SERIES[0], strokeOpacity: 0.35, strokeDasharray: '4 4' }}
            content={({ active, label, payload }) => <ChartTooltip active={active} label={label} payload={payload?.map((p) => ({ name: 'Placements', value: p.value as number, color: CHART_SERIES[0] }))} />}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke={CHART_SERIES[0]}
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="url(#trend-fill)"
            animationDuration={800}
            dot={{ r: 3.5, fill: CHART_SERIES[0], stroke: CHART_SURFACE, strokeWidth: 2 }}
            activeDot={{ r: 7, fill: CHART_SERIES[0], stroke: CHART_SURFACE, strokeWidth: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
