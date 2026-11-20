'use client';

import { Badge, Button, Input } from '@crm/ui';
import { Building2, Briefcase, CheckCircle2, Search, Settings2, UsersRound } from '@crm/ui/icons';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { TABLE_TONES } from '@/components/tables/data-table';
import { PageBanner } from '@/components/tables/page-banner';
import { ActiveJobPanel } from '@/features/jobs/active-job-panel';
import { usePlacements } from '@/hooks/use-placements';

interface ActiveJob {
  id: string;
  title: string;
  needed?: number | null;
  company: { id: string; name: string };
  people: string[];
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');

/** A figure with a label: the totals above the jobs. */
function Stat({ icon: Icon, label, value, tone }: { icon: typeof Briefcase; label: string; value: string | number; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 shadow-sm">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-semibold leading-none tabular-nums">{value}</p>
        <p className="mt-1 truncate text-xs text-foreground/60">{label}</p>
      </div>
    </div>
  );
}

/**
 * Active Jobs Temporary: the temporary jobs that have people working on them right now — one card per job with the
 * active employees who fill it. Built from the active temporary contracts (the same ones as Active Employees →
 * Temporary), so a job appears the moment someone starts and leaves when its last contract ends.
 */
export default function ActiveJobsTemporaryPage() {
  // the job whose panel is open: its hours and shifts, and the people on it (any of them can be replaced there)
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const { data, isLoading } = usePlacements({ status: 'ACTIVE', employmentType: 'TEMPORARY', pageSize: 100 });

  const jobs: ActiveJob[] = useMemo(
    () => [
      ...(data?.items ?? [])
        .reduce((map, placement) => {
          const entry = map.get(placement.job.id) ?? { id: placement.job.id, title: placement.job.title, needed: placement.job.candidatesNeeded, company: placement.company, people: [] as string[] };
          entry.people.push(`${placement.candidate.firstName} ${placement.candidate.lastName}`.trim());
          return map.set(placement.job.id, entry);
        }, new Map<string, ActiveJob>())
        .values(),
    ],
    [data],
  );

  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = jobs.filter((job) => words.every((word) => `${job.title} ${job.company.name} ${job.people.join(' ')}`.toLowerCase().includes(word)));

  const people = jobs.reduce((sum, job) => sum + job.people.length, 0);
  const places = jobs.reduce((sum, job) => sum + (job.needed ?? 0), 0);
  const full = jobs.filter((job) => job.needed && job.people.length >= job.needed).length;
  const clients = new Set(jobs.map((job) => job.company.id)).size;

  return (
    <div className="flex flex-col gap-6">
      <PageBanner
        tone="orange"
        icon={Briefcase}
        title="Active Jobs Temporary"
        description="Temporary jobs with people working on them right now — a job whose places are all filled stays here as well as on Completed Jobs."
      >
        <div className="relative w-full min-w-64 sm:w-80">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <Input className="bg-background pl-8" placeholder="Search job, client or employee…" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search active jobs" />
        </div>
      </PageBanner>

      {isLoading ? (
        <p className="text-sm text-foreground/50">Loading…</p>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-background px-6 py-20 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
            <Briefcase className="h-6 w-6 text-foreground/50" />
          </span>
          <p className="text-sm font-semibold">No active temporary jobs</p>
          <p className="max-w-sm text-sm text-foreground/50">A job appears here as soon as someone starts working on it, and leaves when its last contract ends.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="active-jobs-stats">
            <Stat icon={Briefcase} label="Active jobs" value={jobs.length} tone="bg-accent text-foreground/70" />
            <Stat icon={UsersRound} label="People working now" value={people} tone="bg-accent text-foreground/70" />
            <Stat icon={CheckCircle2} label={places > 0 ? `Places filled (of ${places})` : 'Jobs fully staffed'} value={places > 0 ? people : full} tone="bg-accent text-foreground/70" />
            <Stat icon={Building2} label="Clients" value={clients} tone="bg-accent text-foreground/70" />
          </div>

          {shown.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-foreground/50">No active job matches “{search}”.</p>
          ) : (
            <div className={`overflow-hidden border bg-background ${TABLE_TONES.orange.box}`} data-testid="active-jobs-table">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[56rem] text-sm">
                  <thead>
                    <tr className={`text-left text-[11px] uppercase tracking-wide ${TABLE_TONES.orange.head}`}>
                      <th className="px-5 py-3">Job title</th>
                      <th className="px-5 py-3">Client</th>
                      <th className="w-56 px-5 py-3">Places filled</th>
                      <th className="px-5 py-3">Employees</th>
                      <th className="w-44 px-5 py-3 text-right">Manage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {shown.map((job) => {
                      const filled = job.people.length;
                      const percent = job.needed ? Math.min(100, Math.round((filled / job.needed) * 100)) : 100;
                      const complete = Boolean(job.needed) && filled >= (job.needed ?? 0);
                      return (
                        <tr key={job.id} className={`transition-colors ${TABLE_TONES.orange.row}`}>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TABLE_TONES.orange.soft}`}>
                                <Briefcase className="h-4 w-4" />
                              </span>
                              <div className="min-w-0">
                                <button type="button" className="block max-w-[16rem] truncate text-left font-semibold hover:underline" title={job.title} onClick={() => setOpenJobId(job.id)}>
                                  {job.title}
                                </button>
                                <Badge variant={complete ? 'success' : 'warning'} className="mt-1 whitespace-nowrap">
                                  {complete ? 'Fully staffed' : 'Hiring'}
                                </Badge>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <Link href={`/companies/${job.company.id}`} className="inline-flex max-w-[14rem] items-center gap-1.5 text-foreground/80 hover:text-foreground hover:underline">
                              <Building2 className="h-3.5 w-3.5 shrink-0 text-foreground/40" />
                              <span className="truncate">{job.company.name}</span>
                            </Link>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-accent" role="progressbar" aria-valuenow={filled} aria-valuemin={0} aria-valuemax={job.needed ?? filled}>
                                <div className={`h-full rounded-full ${complete ? 'bg-emerald-600' : TABLE_TONES.orange.bar}`} style={{ width: `${percent}%` }} />
                              </div>
                              <span className="w-12 shrink-0 text-right text-xs font-medium tabular-nums text-foreground/70">{job.needed ? `${filled}/${job.needed}` : filled}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <ul className="flex flex-wrap gap-1.5">
                              {job.people.map((name, index) => (
                                <li key={`${name}-${index}`} className="inline-flex items-center gap-1.5 rounded-full bg-accent py-0.5 pl-0.5 pr-2.5 text-xs font-medium">
                                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold ${TABLE_TONES.orange.badge}`}>{initials(name) || '?'}</span>
                                  {name}
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <Button type="button" variant="outline" size="sm" title="Edit hours, shifts or replace a candidate" onClick={() => setOpenJobId(job.id)}>
                              <Settings2 className="mr-1.5 h-3.5 w-3.5" /> Hours &amp; team
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className={`border-t border-border bg-accent/30 px-5 py-2.5 text-xs ${TABLE_TONES.orange.foot}`}>
                Showing {shown.length} of {jobs.length} active job{jobs.length === 1 ? '' : 's'}
              </div>
            </div>
          )}
        </>
      )}
      {openJobId ? <ActiveJobPanel jobId={openJobId} onClose={() => setOpenJobId(null)} /> : null}
    </div>
  );
}
