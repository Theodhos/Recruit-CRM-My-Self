import type { AppIcon } from '@crm/ui/icons';
import type { ReactNode } from 'react';

import type { TableTone } from './data-table';

/** The accent of a page: a bar on the left of its banner (see TABLE_TONES for which page has which). */
const EDGE: Record<TableTone, string> = {
  indigo: 'border-l-indigo-500',
  sky: 'border-l-sky-500',
  teal: 'border-l-teal-500',
  orange: 'border-l-orange-500',
  emerald: 'border-l-emerald-500',
  violet: 'border-l-violet-500',
  rose: 'border-l-rose-500',
  amber: 'border-l-amber-500',
  cyan: 'border-l-cyan-500',
  slate: 'border-l-slate-500',
  blue: 'border-l-blue-500',
  fuchsia: 'border-l-fuchsia-500',
  lime: 'border-l-lime-500',
  yellow: 'border-l-yellow-500',
  purple: 'border-l-purple-500',
  pink: 'border-l-pink-500',
  stone: 'border-l-stone-500',
  red: 'border-l-red-500',
  green: 'border-l-green-500',
};

/**
 * The banner of a page: white like the rest of the CRM, the icon in the CRM's own navy, and the page's accent as a thin bar on
 * the left — the only colour on it.
 */
export function PageBanner({ tone, icon: Icon, title, description, children, singleRow }: { tone: TableTone; icon: AppIcon; title: ReactNode; description: ReactNode; children?: ReactNode; /** On a wide screen the title and what is on its right stay on one line, the banner full width (Dashboard). */ singleRow?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-4 ${singleRow ? 'lg:flex-nowrap' : ''} rounded-xl border border-border border-l-4 bg-background px-5 py-4 shadow-sm ${EDGE[tone]}`} data-testid="page-banner">
      <div className={`flex min-w-0 items-center gap-4 ${singleRow ? 'lg:shrink-0' : ''}`}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">{title}</h2>
          <div className="mt-0.5 max-w-3xl text-sm text-foreground/60">{description}</div>
        </div>
      </div>
      {children}
    </div>
  );
}
