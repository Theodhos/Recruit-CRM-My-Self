'use client';

import { ArrowUpRight } from '@crm/ui/icons';
import { useState } from 'react';

import { CHART_SERIES } from './chart-tokens';
import type { StatusBarDatum } from './status-bar-chart';

/**
 * The pipeline by stage, with every figure in view: one bar split into the stages in proportion (the whole of the
 * pipeline at a glance), and under it a tile for each stage with its count, its share and its own bar. Interactive: the stage
 * under the mouse is bright in the bar and in its tile while the rest fade; a click opens the pipeline.
 */
export function StageBoard({ data, onSelect }: { data: StatusBarDatum[]; onSelect?: (stage: string) => void }) {
  const [active, setActive] = useState<number | null>(null);
  const stages = data.map((d, index) => ({ ...d, label: d.status.replaceAll('_', ' '), fill: CHART_SERIES[index % CHART_SERIES.length] }));
  const total = stages.reduce((sum, stage) => sum + stage.count, 0);
  const biggest = Math.max(1, ...stages.map((stage) => stage.count));

  return (
    <div className="flex flex-col gap-5" onMouseLeave={() => setActive(null)}>
      <div className="flex items-end justify-between gap-3">
        <p className="text-sm text-foreground/60">
          <span className="text-3xl font-bold tabular-nums text-foreground">{total.toLocaleString()}</span> applications in {stages.length} stage{stages.length === 1 ? '' : 's'}
        </p>
        {onSelect ? <p className="text-[11px] text-foreground/40">Click a stage to open the pipeline</p> : null}
      </div>

      {/* the whole pipeline in one bar */}
      <div className="flex h-5 w-full overflow-hidden rounded-full bg-accent" role="img" aria-label="Share of each stage in the pipeline">
        {stages.map((stage, index) =>
          stage.count > 0 ? (
            <button
              key={`${stage.status}-${index}`}
              type="button"
              title={`${stage.label}: ${stage.count} (${stage.percentage}%)`}
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onClick={() => onSelect?.(stage.status)}
              className="h-full border-r-2 border-background last:border-r-0"
              style={{ width: `${(stage.count / total) * 100}%`, backgroundColor: stage.fill, opacity: active === null || active === index ? 1 : 0.3, transition: 'opacity 150ms' }}
              aria-label={`${stage.label}: ${stage.count}`}
            />
          ) : null,
        )}
      </div>

      {/* a tile for each stage, every figure written out */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stages.map((stage, index) => (
          <button
            key={`${stage.status}-${index}`}
            type="button"
            onMouseEnter={() => setActive(index)}
            onFocus={() => setActive(index)}
            onClick={() => onSelect?.(stage.status)}
            className={`group relative flex flex-col gap-2 overflow-hidden rounded-xl border bg-background p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
              active === index ? 'border-foreground/30 shadow-md' : 'border-border'
            } ${active !== null && active !== index ? 'opacity-55' : ''}`}
          >
            <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: stage.fill }} />
            <span className="flex items-center justify-between gap-1 pt-1">
              <span className="truncate text-xs font-semibold uppercase tracking-wide text-foreground/60" title={stage.label}>
                {stage.label}
              </span>
              {onSelect ? <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-foreground/25 group-hover:text-foreground/70" /> : null}
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold leading-none tabular-nums">{stage.count.toLocaleString()}</span>
              <span className="text-xs font-medium tabular-nums text-foreground/50">{stage.percentage}%</span>
            </span>
            <span className="h-1.5 overflow-hidden rounded-full bg-accent">
              <span className="block h-full rounded-full" style={{ width: `${(stage.count / biggest) * 100}%`, backgroundColor: stage.fill, transition: 'width 600ms ease' }} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
