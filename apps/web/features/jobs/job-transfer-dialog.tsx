'use client';

import { Badge, Button, Dialog, Input } from '@crm/ui';
import { ArrowRight, Search, Users } from '@crm/ui/icons';
import { useMemo, useState } from 'react';

import { useAllJobs, useUpdateJob } from '@/hooks/use-jobs';
import { useActiveUsers } from '@/hooks/use-users';

const initials = (first: string, last: string) => `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();

/**
 * Transfer jobs from one recruiter to another, Permanent and Temporary alike. Opens with the jobs that were selected
 * in the table already ticked (or with none ticked: they are chosen here, from the list, with a search). Under it,
 * the recruiters, one or many, for one job or for many:
 *   - one job, several recruiters: they all work the job together;
 *   - several jobs, one recruiter: every job goes to that recruiter;
 *   - several jobs, several recruiters: either every recruiter works every job, or the jobs are shared out between
 *     them one after the other (the choice is shown under the lists).
 * The first recruiter chosen is the one the job is "Added by"; the others are listed beside. Its pipeline, candidates and
 * history stay with the job.
 */
export function JobTransferDialog({ selectedIds, group, onClose, onDone }: { selectedIds: string[]; /** Opened from Jobs Permanent / Jobs Temporary: only the jobs of that kind are listed. From Jobs: all of them, with buttons to tell the two apart. */ group?: 'PERMANENT' | 'TEMPORARY'; onClose: () => void; onDone: () => void }) {
  // only the jobs the Jobs pages list (the open ones): completed jobs are not there to be transferred
  const { data: jobsData, isLoading } = useAllJobs({ completion: 'OPEN' });
  const { data: users } = useActiveUsers();
  const updateJob = useUpdateJob();

  const [jobIds, setJobIds] = useState<string[]>(selectedIds);
  const [toIds, setToIds] = useState<string[]>([]);
  // with several jobs and several recruiters: everyone works every job, or the jobs are shared out one after the other
  const [mode, setMode] = useState<'TOGETHER' | 'SHARE'>('TOGETHER');
  const [jobSearch, setJobSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const everyJob = jobsData?.items ?? [];
  const [kind, setKind] = useState<'ALL' | 'TEMPORARY' | 'PERMANENT'>(group ?? 'ALL');
  const isKind = (job: { employmentType?: string | null }, wanted: 'TEMPORARY' | 'PERMANENT') => (wanted === 'PERMANENT' ? job.employmentType === 'PERMANENT' : job.employmentType !== 'PERMANENT');
  const jobs = kind === 'ALL' ? everyJob : everyJob.filter((job) => isKind(job, kind));
  const userName = (id: string | null | undefined) => {
    const user = users?.find((item) => item.id === id);
    return user ? `${user.firstName} ${user.lastName}` : '—';
  };

  const shownJobs = useMemo(() => {
    const words = jobSearch.toLowerCase().split(/\s+/).filter(Boolean);
    return jobs.filter((job) => words.every((word) => `${job.title} ${job.company?.name ?? ''} ${job.location ?? ''}`.toLowerCase().includes(word)));
  }, [jobs, jobSearch]);
  const shownUsers = useMemo(() => {
    const words = userSearch.toLowerCase().split(/\s+/).filter(Boolean);
    return (users ?? []).filter((user) => words.every((word) => `${user.firstName} ${user.lastName}`.toLowerCase().includes(word)));
  }, [users, userSearch]);

  const toggleJob = (id: string) => {
    setJobIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };
  const toggleAllShown = (on: boolean) => {
    const shown = shownJobs.map((job) => job.id);
    setJobIds((current) => (on ? [...new Set([...current, ...shown])] : current.filter((id) => !shown.includes(id))));
  };
  const toggleUser = (id: string) => setToIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  const allShownTicked = shownJobs.length > 0 && shownJobs.every((job) => jobIds.includes(job.id));
  const ready = jobIds.length > 0 && toIds.length > 0;
  // one job with several recruiters can only be worked by them together; the choice exists for several jobs
  const together = toIds.length > 1 && (jobIds.length === 1 || mode === 'TOGETHER');
  const names = (ids: string[]) => ids.map(userName).join(', ');

  async function transfer() {
    if (!ready) return setError(jobIds.length === 0 ? 'Choose at least one job.' : 'Choose at least one recruiter.');
    setError(null);
    setPending(true);
    try {
      // a failure names the job and leaves the rest as they were
      for (const [index, id] of jobIds.entries()) {
        const job = everyJob.find((item) => item.id === id);
        // together: the first recruiter chosen owns the job, the others work it with them; shared out: one recruiter for each job
        const team = together ? toIds : [toIds[index % toIds.length]!];
        const [owner, ...others] = team as [string, ...string[]];
        const sameTeam = job?.ownerId === owner && [...(job.coRecruiterIds ?? [])].sort().join() === [...others].sort().join();
        if (sameTeam) continue;
        await updateJob.mutateAsync({ id, input: { ownerId: owner, coRecruiterIds: others } });
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not transfer the jobs.');
    } finally {
      setPending(false);
    }
  }

  const summary = !ready
    ? null
    : toIds.length === 1
      ? jobIds.length === 1
        ? `1 job → ${userName(toIds[0])}`
        : `${jobIds.length} jobs → ${userName(toIds[0])}`
      : together
        ? `${jobIds.length === 1 ? '1 job' : `Each of the ${jobIds.length} jobs`} → ${names(toIds)}, working it together (${userName(toIds[0])} is "Added by")`
        : `${jobIds.length} jobs shared out between ${names(toIds)}, one after the other`;

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()} title="Transfer jobs to another recruiter" className="max-h-[92vh] max-w-4xl overflow-y-auto" data-testid="job-transfer">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          {/* 1. the jobs */}
          <section className="flex flex-col gap-2" aria-label="Jobs">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">1 · Jobs <span className="font-normal text-foreground/50">({jobIds.length} selected)</span></h3>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-foreground/70">
                <input type="checkbox" className="h-3.5 w-3.5 accent-primary" checked={allShownTicked} onChange={(event) => toggleAllShown(event.target.checked)} /> Select all shown
              </label>
            </div>
            {group ? null : (
              <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-accent/30 p-1" role="tablist" aria-label="Kind of job" data-testid="transfer-kind">
                {([
                  ['ALL', 'All jobs', everyJob.length],
                  ['TEMPORARY', 'Temporary', everyJob.filter((job) => isKind(job, 'TEMPORARY')).length],
                  ['PERMANENT', 'Permanent', everyJob.filter((job) => isKind(job, 'PERMANENT')).length],
                ] as const).map(([value, label, count]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={kind === value}
                    onClick={() => setKind(value)}
                    className={`rounded-md px-2 py-1.5 text-sm font-medium ${kind === value ? 'bg-primary text-primary-foreground' : 'text-foreground/70 hover:bg-accent'}`}
                  >
                    {label} <span className="opacity-70">({count})</span>
                  </button>
                ))}
              </div>
            )}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
              <Input className="pl-8" placeholder="Search jobs by title, client or location…" value={jobSearch} onChange={(event) => setJobSearch(event.target.value)} autoFocus={selectedIds.length === 0} />
            </div>
            <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border" data-testid="transfer-jobs-list">
              {isLoading ? <li className="px-3 py-6 text-center text-sm text-foreground/50">Loading…</li> : null}
              {!isLoading && shownJobs.length === 0 ? <li className="px-3 py-6 text-center text-sm text-foreground/50">No job matches.</li> : null}
              {shownJobs.map((job) => {
                const ticked = jobIds.includes(job.id);
                return (
                  <li key={job.id}>
                    <label className={`flex cursor-pointer items-start gap-2.5 px-3 py-2 text-sm hover:bg-accent/40 ${ticked ? 'bg-primary/5' : ''}`}>
                      <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary" checked={ticked} onChange={() => toggleJob(job.id)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{job.title}</span>
                        <span className="block truncate text-xs text-foreground/55">{[job.company?.name, job.location].filter(Boolean).join(' · ') || 'No client yet'} · now with {userName(job.ownerId)}</span>
                      </span>
                      <Badge variant="outline" className="shrink-0">
                        {job.employmentType === 'PERMANENT' ? 'Permanent' : 'Temporary'}
                      </Badge>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* 2. the recruiters */}
          <section className="flex flex-col gap-2" aria-label="Recruiters">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Users className="h-4 w-4 text-foreground/50" /> 2 · Transfer to <span className="font-normal text-foreground/50">({toIds.length} chosen)</span>
            </h3>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
              <Input className="pl-8" placeholder="Search recruiters…" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} />
            </div>
            <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border" data-testid="transfer-recruiters">
              {shownUsers.length === 0 ? <li className="px-3 py-6 text-center text-sm text-foreground/50">No recruiter matches.</li> : null}
              {shownUsers.map((user) => {
                const ticked = toIds.includes(user.id);
                return (
                  <li key={user.id}>
                    <label className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent/40 ${ticked ? 'bg-primary/5' : ''}`}>
                      <input type="checkbox" className="h-4 w-4 shrink-0 rounded border-border accent-primary" checked={ticked} onChange={() => toggleUser(user.id)} />
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{initials(user.firstName, user.lastName)}</span>
                      <span className="truncate font-medium">
                        {user.firstName} {user.lastName}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-foreground/55">Choose one or more recruiters. The first one chosen is the one the job is "Added by".</p>
            {jobIds.length > 1 && toIds.length > 1 ? (
              <fieldset className="flex flex-col gap-1.5 rounded-lg border border-border p-2.5 text-sm" data-testid="transfer-mode">
                <label className="flex cursor-pointer items-start gap-2">
                  <input type="radio" name="transfer-mode" className="mt-1 accent-primary" checked={mode === 'TOGETHER'} onChange={() => setMode('TOGETHER')} />
                  <span>
                    <span className="font-medium">All of them work every job</span>
                    <span className="block text-xs text-foreground/55">Each recruiter is on each selected job.</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2">
                  <input type="radio" name="transfer-mode" className="mt-1 accent-primary" checked={mode === 'SHARE'} onChange={() => setMode('SHARE')} />
                  <span>
                    <span className="font-medium">Share the jobs out</span>
                    <span className="block text-xs text-foreground/55">One after the other: each job goes to one recruiter.</span>
                  </span>
                </label>
              </fieldset>
            ) : null}
          </section>
        </div>

        {summary ? (
          <p className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-medium">
            <ArrowRight className="h-4 w-4 text-primary" /> {summary}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void transfer()} disabled={pending || !ready} data-testid="transfer-confirm">
            {pending ? 'Transferring…' : jobIds.length > 1 ? `Transfer ${jobIds.length} jobs` : 'Transfer'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
