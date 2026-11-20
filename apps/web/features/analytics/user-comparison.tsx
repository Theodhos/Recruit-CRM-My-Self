'use client';

import { Briefcase, Building2, ChevronRight, Trophy, UserCheck, Users, type AppIcon } from '@crm/ui/icons';
import Link from 'next/link';
import { useMemo, useState } from 'react';

export interface UserComparisonRow {
  userId: string;
  name: string;
  companies: number;
  jobs: number;
  candidates: number;
  activeEmployees: number;
}

type Measure = 'companies' | 'jobs' | 'candidates' | 'activeEmployees';

/** Each measure has the colour of the page it counts: Companies indigo, Jobs sky, Candidates teal, Active Employees violet. */
const MEASURES: { key: Measure; label: string; icon: AppIcon; color: string }[] = [
  { key: 'companies', label: 'Companies', icon: Building2, color: '#2d5a73' },
  { key: 'jobs', label: 'Jobs', icon: Briefcase, color: '#3f7b88' },
  { key: 'candidates', label: 'Candidates', icon: Users, color: '#336658' },
  { key: 'activeEmployees', label: 'Active employees', icon: UserCheck, color: '#7a3b6e' },
];

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');

const totalOf = (row: UserComparisonRow) => row.companies + row.jobs + row.candidates + row.activeEmployees;

/** The medal of the first three places: the only gold, silver and bronze on the page. */
const MEDAL = ['bg-amber-100 text-amber-800 ring-amber-300', 'bg-slate-100 text-slate-700 ring-slate-300', 'bg-orange-100 text-orange-800 ring-orange-300'];

/**
 * The users compared on what each one has added, as a leaderboard: the team's totals on top, then one card for each user
 * — their place, their name, one bar split into the four kinds of record (all the bars on one scale, so a longer bar is
 * more work) and the four figures written out. The user with the most of a kind has the trophy beside that figure. The
 * order can be changed (by the total, or by one kind), and a card opens that user's page.
 */
export function UserComparison({ rows }: { rows: UserComparisonRow[] }) {
  const [sortBy, setSortBy] = useState<'total' | Measure>('total');
  const [hovered, setHovered] = useState<Measure | null>(null);

  const ordered = useMemo(
    () => [...rows].sort((a, b) => (sortBy === 'total' ? totalOf(b) - totalOf(a) : b[sortBy] - a[sortBy]) || a.name.localeCompare(b.name)),
    [rows, sortBy],
  );
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-foreground/50">No users to compare yet.</p>;
  }

  const team = Object.fromEntries(MEASURES.map((m) => [m.key, rows.reduce((sum, row) => sum + row[m.key], 0)])) as Record<Measure, number>;
  const best = Object.fromEntries(MEASURES.map((m) => [m.key, Math.max(...rows.map((row) => row[m.key]))])) as Record<Measure, number>;
  const leader = (key: Measure) => (best[key] > 0 ? rows.find((row) => row[key] === best[key])?.name : undefined);
  const biggest = Math.max(1, ...rows.map(totalOf));

  return (
    <div className="flex flex-col gap-5" data-testid="user-comparison">
      {/* the team together, and who leads each kind */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {MEASURES.map(({ key, label, icon: Icon, color }) => {
          const name = leader(key);
          return (
            <button
              key={key}
              type="button"
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => setSortBy(key)}
              title={`Order the users by ${label.toLowerCase()}`}
              className={`relative overflow-hidden rounded-xl border bg-background p-3.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${sortBy === key ? 'border-foreground/30 shadow-sm' : 'border-border'}`}
            >
              <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
              <span className="flex items-center justify-between pt-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">{label}</span>
                <Icon className="h-4 w-4 text-foreground/40" />
              </span>
              <span className="mt-1 block text-3xl font-bold leading-none tabular-nums">{team[key].toLocaleString()}</span>
              <span className="mt-1.5 flex items-center gap-1 truncate text-xs text-foreground/55">
                {name ? (
                  <>
                    <Trophy className="h-3 w-3 shrink-0 text-amber-500" /> {name} · {best[key]}
                  </>
                ) : (
                  'nothing added yet'
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* the order */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Leaderboard</p>
        <div className="inline-flex flex-wrap rounded-lg border border-border bg-accent/30 p-0.5" role="group" aria-label="Order the users by">
          {([['total', 'Total'], ...MEASURES.map((m) => [m.key, m.label] as const)] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={sortBy === key}
              onClick={() => setSortBy(key as 'total' | Measure)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${sortBy === key ? 'bg-background shadow-sm' : 'text-foreground/60 hover:text-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <ol className="flex flex-col gap-2">
        {ordered.map((row, index) => {
          const total = totalOf(row);
          return (
            <li key={row.userId} data-user={row.name}>
              <Link
                href={`/users/${row.userId}`}
                className={`group grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-background px-3 py-2.5 transition-all hover:border-foreground/25 hover:shadow-sm lg:grid-cols-[auto_200px_minmax(0,1fr)_auto_auto] lg:gap-x-4 ${total === 0 ? 'opacity-60' : ''}`}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ring-1 ${index < 3 && total > 0 ? MEDAL[index] : 'bg-accent text-foreground/50 ring-transparent'}`}>{index + 1}</span>

                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{initialsOf(row.name)}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{row.name}</span>
                    <span className="block text-xs text-foreground/50">{total.toLocaleString()} record{total === 1 ? '' : 's'}</span>
                  </span>
                </span>

                {/* one bar, split into the four kinds, all users on the same scale */}
                <span className="col-span-2 flex h-3.5 overflow-hidden rounded-full bg-accent lg:col-span-1" role="img" aria-label={`${row.name}: ${MEASURES.map((m) => `${row[m.key]} ${m.label.toLowerCase()}`).join(', ')}`}>
                  <span className="flex h-full overflow-hidden rounded-full" style={{ width: `${(total / biggest) * 100}%`, transition: 'width 600ms ease' }}>
                    {MEASURES.map((m) =>
                      row[m.key] > 0 ? (
                        <span key={m.key} className="h-full" style={{ width: `${(row[m.key] / total) * 100}%`, backgroundColor: m.color, opacity: hovered === null || hovered === m.key ? 1 : 0.25, transition: 'opacity 150ms' }} />
                      ) : null,
                    )}
                  </span>
                </span>

                <span className="col-span-2 flex items-center gap-1.5 lg:col-span-1">
                  {MEASURES.map(({ key, label, icon: Icon, color }) => {
                    const value = row[key];
                    const leads = best[key] > 0 && value === best[key];
                    return (
                      <span
                        key={key}
                        data-measure={key}
                        title={`${label}: ${value}`}
                        onMouseEnter={() => setHovered(key)}
                        onMouseLeave={() => setHovered(null)}
                        className={`flex min-w-[3.6rem] items-center justify-center gap-1 rounded-md border px-1.5 py-1 text-xs tabular-nums ${value > 0 ? 'border-border bg-background font-semibold' : 'border-transparent bg-accent/50 text-foreground/40'}`}
                      >
                        <Icon className="h-3.5 w-3.5" style={{ color: value > 0 ? color : undefined }} />
                        {value}
                        {leads ? <Trophy className="h-3 w-3 text-amber-500" aria-label="Highest" /> : null}
                      </span>
                    );
                  })}
                </span>

                <ChevronRight className="hidden h-4 w-4 text-foreground/25 transition-colors group-hover:text-foreground/70 lg:block" />
              </Link>
            </li>
          );
        })}
      </ol>

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-foreground/50">
        {MEASURES.map((m) => (
          <span key={m.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: m.color }} /> {m.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-amber-500" /> the most of that kind
        </span>
      </p>
    </div>
  );
}
