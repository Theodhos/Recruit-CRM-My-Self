'use client';

import { Badge, Button, Dialog, Drawer, Input, Select } from '@crm/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { CheckCircle2, Pencil } from '@crm/ui/icons';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { DataTable } from '@/components/tables/data-table';
import { useAddedBy, type AddedBy } from '@/hooks/use-added-by';
import { useCandidates } from '@/hooks/use-candidates';
import { useCreateApplication, useUpdateApplication, useDeleteApplication } from '@/hooks/use-applications';
import { usePipelines } from '@/hooks/use-pipelines';
import { listApplications } from '@/services/applications.service';
import { useJobCandidateHistory, useJobs, useReleaseJobPlaces, useReplaceJobCandidate, useUpdateJob } from '@/hooks/use-jobs';
import { confirmDialog } from '@/components/dialogs/confirm-dialog';
import { useCompanies } from '@/hooks/use-companies';
import { useDeletePlacement, usePlacements } from '@/hooks/use-placements';
import { employmentTypeColour } from '@/lib/status-colors';
import type { JobWithCompany } from '@/services/jobs.service';



const PAGE_SIZE = 10;
const date = (value?: string | null) => (value ? new Date(value).toLocaleDateString() : '—');
const money = (value: string | null, currency: string) => (value ? `${Number(value).toLocaleString()} ${currency}` : null);
const salary = (job: JobWithCompany) => [money(job.salaryMin, job.currency), money(job.salaryMax, job.currency)].filter(Boolean).join(' – ') || '—';
const places = (job: JobWithCompany) => `${job._count?.filled ?? 0}/${job.candidatesNeeded ?? '—'}`;

function columns(addedBy: AddedBy | undefined, onOpen: (job: JobWithCompany) => void): ColumnDef<JobWithCompany, unknown>[] {
  return [
    {
      header: 'Job title',
      accessorKey: 'title',
      cell: ({ row }) => (
        <button type="button" className="text-left font-medium hover:underline" onClick={() => onOpen(row.original)}>
          {row.original.title}
        </button>
      ),
    },
    { header: 'Client', id: 'client', cell: ({ row }) => row.original.company?.name ?? <span className="text-foreground/40">—</span> },
    { header: 'Location', accessorKey: 'location', cell: ({ row }) => row.original.location ?? '—' },
    {
      header: 'Type',
      accessorKey: 'employmentType',
      cell: ({ row }) => <Badge variant={employmentTypeColour(row.original.employmentType)}>{row.original.employmentType.replaceAll('_', ' ')}</Badge>,
    },
    { header: 'Places filled', id: 'places', cell: ({ row }) => <span className="font-semibold text-emerald-700">{places(row.original)}</span> },
    { header: 'Salary', id: 'salary', cell: ({ row }) => salary(row.original) },
    { header: 'Opened', id: 'opened', cell: ({ row }) => date(row.original.openedAt) },
    { header: 'Completed on', id: 'completedOn', cell: ({ row }) => date(row.original.completedOn) },
    ...(addedBy
      ? [{ id: 'addedBy', header: 'Added by', cell: ({ row }: { row: { original: JobWithCompany } }) => addedBy(row.original.ownerId) }]
      : []),
  ];
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-foreground/50">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{children}</dd>
    </div>
  );
}

/** The history of the people on the job in a table of its own: who joined, completed, was terminated, replaced or taken off. */
function CandidateHistoryTable({ job }: { job: JobWithCompany }) {
  const { data, isLoading } = useJobCandidateHistory(job.id);
  const items = data?.items ?? [];
  return (
    <>
      <h3 className="mb-2 mt-6 text-sm font-semibold">Candidate history</h3>
      <div className="mb-4 overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-max border-collapse text-sm" data-testid="candidate-history">
          <thead>
            <tr className="bg-accent/40 text-left">
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Candidate</th>
              <th className="px-3 py-2 font-medium">What happened</th>
              <th className="px-3 py-2 font-medium">By</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-3 py-3 text-xs text-foreground/50">Loading…</td>
              </tr>
            ) : null}
            {!isLoading && items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-3 text-xs text-foreground/50">Nothing has happened to the candidates of this job yet.</td>
              </tr>
            ) : null}
            {items.map((item, index) => (
              <tr key={`${item.at}-${index}`} className="border-t border-border">
                <td className="whitespace-nowrap px-3 py-2 text-foreground/70">{date(item.at)}</td>
                <td className="whitespace-nowrap px-3 py-2 font-medium">{item.candidate}</td>
                <td className="px-3 py-2">{item.event}</td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground/70">{item.by ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** The people who fill the places of a job: every contract that is not terminated, as many as the job needs. */
export function PeopleWhoFilledIt({ job, replaceable = false, removable = false, addable = false }: { job: JobWithCompany; replaceable?: boolean; removable?: boolean; addable?: boolean }) {
  const { data, isLoading } = usePlacements({ jobId: job.id, pageSize: 100 });
  const people = (data?.items ?? []).filter((placement) => placement.status !== 'CANCELLED').slice(0, job.candidatesNeeded ?? undefined);
  const replace = useReplaceJobCandidate();
  const removePlacement = useDeletePlacement();
  // the person being replaced, and who is being looked for in their place
  const [leaving, setLeaving] = useState<{ id: string; name: string } | null>(null);
  // adding someone: they go onto the Temporary pipeline in its Active stage, which gives them the contract
  const [adding, setAdding] = useState(false);
  const createApplication = useCreateApplication();
  const updateApplication = useUpdateApplication();
  const deleteApplication = useDeleteApplication();
  const { data: pipelines } = usePipelines();
  const temporaryPipeline = pipelines?.find((pipeline) => pipeline.employmentType === 'TEMPORARY');
  const activeStage = temporaryPipeline?.stages.find((stage) => /^active$/i.test(stage.name.trim()));
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { data: found } = useCandidates({ search: search || undefined, pageSize: 8, page: 1 });
  const onJob = new Set(people.map((placement) => placement.candidate.id));

  async function addCandidate(candidateId: string, name: string) {
    if (!temporaryPipeline || !activeStage) return setError('The Temporary pipeline has no Active stage.');
    if (!(await confirmDialog(`${name} is added to ${job.title} and starts as an Active Employee.`))) return;
    setError(null);
    try {
      // someone already on the job's pipeline (e.g. in Screening) is moved to Active instead of added twice
      const existing = (await listApplications({ jobId: job.id, candidateId, pageSize: 5 })).items[0];
      if (existing) await updateApplication.mutateAsync({ id: existing.id, input: { pipelineStageId: activeStage.id, status: 'ACTIVE' } });
      else await createApplication.mutateAsync({ candidateId, jobId: job.id, source: 'OTHER', pipelineId: temporaryPipeline.id, pipelineStageId: activeStage.id });
      setAdding(false);
      setSearch('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add the candidate.');
    }
  }

  async function removeCandidate(placementId: string, candidateId: string, name: string) {
    if (!(await confirmDialog(`Take ${name} off ${job.title}? Their contract is removed, their card leaves the pipeline and the place is free again.`))) return;
    setError(null);
    try {
      await removePlacement.mutateAsync(placementId);
      const card = (await listApplications({ jobId: job.id, candidateId, pageSize: 5 })).items[0];
      if (card) await deleteApplication.mutateAsync(card.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove the candidate.');
    }
  }

  async function confirmReplace(toId: string, toName: string) {
    if (!leaving) return;
    if (!(await confirmDialog(`${toName} takes the place of ${leaving.name} on ${job.title}. ${leaving.name} leaves this job (their contract is removed) and ${toName} gets the same contract, stage and shift.`))) return;
    setError(null);
    try {
      await replace.mutateAsync({ id: job.id, fromCandidateId: leaving.id, toCandidateId: toId });
      setLeaving(null);
      setSearch('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not replace the candidate.');
    }
  }

  return (
    <>
      <div className="mb-2 mt-6 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{addable ? 'People on this job' : 'People who filled it'}</h3>
        {addable ? (
          <Button type="button" className="h-7 px-2 text-xs" onClick={() => { setError(null); setAdding(true); }}>
            Add candidate
          </Button>
        ) : null}
      </div>
      {error && !leaving && !adding ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
      <ul className="mb-4 flex flex-col divide-y divide-border rounded-md border border-border">
        {isLoading ? <li className="px-3 py-3 text-xs text-foreground/50">Loading…</li> : null}
        {!isLoading && people.length === 0 ? <li className="px-3 py-3 text-xs text-foreground/50">No contracts listed for this job.</li> : null}
        {people.map((placement) => (
          <li key={placement.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <Link href={`/candidates/${placement.candidate.id}`} className="font-medium hover:underline">
              {placement.candidate.firstName} {placement.candidate.lastName}
            </Link>
            <span className="flex items-center gap-2">
              <span className="text-xs text-foreground/60">
                {date(placement.startDate)} – {date(placement.endDate)}
              </span>
              {replaceable ? (
                <Button type="button" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setLeaving({ id: placement.candidate.id, name: `${placement.candidate.firstName} ${placement.candidate.lastName}`.trim() })}>
                  Replace
                </Button>
              ) : null}
              {removable ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-red-600"
                  disabled={removePlacement.isPending}
                  onClick={() => void removeCandidate(placement.id, placement.candidate.id, `${placement.candidate.firstName} ${placement.candidate.lastName}`.trim())}
                >
                  Remove
                </Button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      {adding ? (
        <Dialog
          open
          onOpenChange={(open) => !open && setAdding(false)}
          title={`Add a candidate to ${job.title}`}
          description="They go onto the Temporary pipeline in the Active stage and start on this job."
          footer={
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          }
        >
          <Input autoFocus placeholder="Search a candidate by name…" value={search} onChange={(event) => setSearch(event.target.value)} />
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
          <ul className="mt-3 flex max-h-72 flex-col divide-y divide-border overflow-y-auto rounded-md border border-border">
            {(found?.items ?? []).map((candidate) => {
              const name = `${candidate.firstName} ${candidate.lastName}`.trim();
              const already = onJob.has(candidate.id);
              return (
                <li key={candidate.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate font-medium">{name}</span>
                  <Button type="button" className="h-7 shrink-0 px-2 text-xs" disabled={already || createApplication.isPending || updateApplication.isPending} onClick={() => void addCandidate(candidate.id, name)}>
                    {already ? 'Already on this job' : 'Add'}
                  </Button>
                </li>
              );
            })}
            {found && found.items.length === 0 ? <li className="px-3 py-3 text-xs text-foreground/50">No candidate matches.</li> : null}
          </ul>
        </Dialog>
      ) : null}

      {leaving ? (
        <Dialog
          open
          onOpenChange={(open) => !open && setLeaving(null)}
          title={`Replace ${leaving.name}`}
          description="Choose the candidate who takes their place on this job. They get the same contract, the same stage on the pipeline and the same shift."
          footer={
            <Button type="button" variant="ghost" onClick={() => setLeaving(null)}>
              Cancel
            </Button>
          }
        >
          <Input autoFocus placeholder="Search a candidate by name…" value={search} onChange={(event) => setSearch(event.target.value)} />
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
          <ul className="mt-3 flex max-h-72 flex-col divide-y divide-border overflow-y-auto rounded-md border border-border">
            {(found?.items ?? []).filter((candidate) => candidate.id !== leaving.id).map((candidate) => {
              const name = `${candidate.firstName} ${candidate.lastName}`.trim();
              const already = onJob.has(candidate.id);
              return (
                <li key={candidate.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{name}</span>
                    {candidate.jobTitle ? <span className="text-foreground/50"> · {candidate.jobTitle}</span> : null}
                  </span>
                  <Button type="button" className="h-7 shrink-0 px-2 text-xs" disabled={already || replace.isPending} onClick={() => void confirmReplace(candidate.id, name)}>
                    {already ? 'Already on this job' : 'Choose'}
                  </Button>
                </li>
              );
            })}
            {found && found.items.length === 0 ? <li className="px-3 py-3 text-xs text-foreground/50">No candidate matches.</li> : null}
          </ul>
        </Dialog>
      ) : null}
    </>
  );
}

/**
 * One completed job opened: the same table of details for every job. On a Temporary job the fields of that table are
 * inputs — change them and press Save changes; a Permanent job is only read.
 */
function CompletedJobPanel({ job, addedBy, onClose }: { job: JobWithCompany; addedBy: AddedBy | undefined; onClose: () => void }) {
  // a Temporary job opens as a table to read; the Edit button at the top turns its fields into inputs
  const canEdit = job.employmentType === 'TEMPORARY';
  const [editing, setEditing] = useState(false);
  const editable = canEdit && editing;
  const updateJob = useUpdateJob();
  const releasePlaces = useReleaseJobPlaces();
  const filledNow = job._count?.filled ?? 0;
  const { data: companies } = useCompanies({ pageSize: 100 }, { enabled: editable });
  const [form, setForm] = useState({
    title: job.title,
    companyId: job.companyId ?? '',
    location: job.location ?? '',
    filled: String(filledNow),
    salaryMin: job.salaryMin ? String(Number(job.salaryMin)) : '',
    salaryMax: job.salaryMax ? String(Number(job.salaryMax)) : '',
    currency: job.currency,
  });
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

  // Cancel: the fields go back to what the job has
  function cancelEditing() {
    setForm({
      title: job.title,
      companyId: job.companyId ?? '',
      location: job.location ?? '',
      filled: String(filledNow),
      salaryMin: job.salaryMin ? String(Number(job.salaryMin)) : '',
      salaryMax: job.salaryMax ? String(Number(job.salaryMax)) : '',
      currency: job.currency,
    });
    setError(null);
    setEditing(false);
  }

  async function save() {
    const filled = Number(form.filled);
    if (!form.title.trim()) return setError('Enter the job title.');
    if (!Number.isInteger(filled) || filled < 0) return setError('Enter how many places are filled.');
    if (filled > filledNow) return setError(`Only ${filledNow} place${filledNow === 1 ? ' is' : 's are'} filled. More people fill a job from the pipeline (Active Employees), not here.`);
    if (form.salaryMin && form.salaryMax && Number(form.salaryMax) < Number(form.salaryMin)) return setError('The maximum salary cannot be below the minimum.');
    setError(null);
    try {
      // a lower first number frees places: the people who filled the job last lose theirs — asked about first
      const freeing = filledNow - filled;
      if (freeing > 0) {
        const { released } = await releasePlaces.mutateAsync({ id: job.id, count: freeing, dryRun: true });
        const names = released.map((person) => person.name).join(', ');
        if (!(await confirmDialog(`Going from ${filledNow}/${job.candidatesNeeded} to ${filled}/${job.candidatesNeeded} takes ${names} off this job (their contract is removed). The job goes back to Jobs. Continue?`))) return;
      }
      await updateJob.mutateAsync({
        id: job.id,
        input: {
          title: form.title.trim(),
          ...(form.companyId ? { companyId: form.companyId } : {}),
          location: form.location.trim(),
          // back on Jobs it is an open job again
          ...(freeing > 0 ? { status: 'OPEN' as const } : {}),
          ...(form.salaryMin ? { salaryMin: Number(form.salaryMin) } : {}),
          ...(form.salaryMax ? { salaryMax: Number(form.salaryMax) } : {}),
          ...(form.currency.trim().length === 3 ? { currency: form.currency.trim().toUpperCase() } : {}),
        },
      });
      if (freeing > 0) await releasePlaces.mutateAsync({ id: job.id, count: freeing });
      // with a place free again the job is no longer complete: it goes back to Jobs
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the changes.');
    }
  }

  return (
    <Drawer
      open
      onOpenChange={(open) => !open && onClose()}
      title={editable ? 'Edit completed job' : job.title}
      description={`${job.company?.name ?? 'No client'} · ${places(job)} places filled`}
      actions={
        canEdit ? (
          editable ? (
            <Button type="button" variant="ghost" onClick={cancelEditing}>
              Cancel
            </Button>
          ) : (
            <Button type="button" onClick={() => setEditing(true)}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit
            </Button>
          )
        ) : undefined
      }
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {editable ? (
          <>
            <div className="col-span-2">
              <dt className="text-xs text-foreground/50">Job title</dt>
              <dd className="mt-0.5">
                <Input aria-label="Job title" value={form.title} onChange={(event) => set({ title: event.target.value })} />
              </dd>
            </div>
            <Fact label="Client">
              <Select aria-label="Client" value={form.companyId} onChange={(event) => set({ companyId: event.target.value })}>
                <option value="">{job.company ? job.company.name : 'No client'}</option>
                {companies?.items
                  .filter((company) => company.id !== job.companyId)
                  .map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
              </Select>
            </Fact>
            <Fact label="Location">
              <Input aria-label="Location" value={form.location} onChange={(event) => set({ location: event.target.value })} />
            </Fact>
            <Fact label="Type">{job.employmentType.replaceAll('_', ' ')}</Fact>
            <Fact label="Candidates needed">
              <div className="flex items-center gap-2">
                <Input aria-label="Places filled" type="number" min={0} max={filledNow} className="w-20" value={form.filled} onChange={(event) => set({ filled: event.target.value })} />
                <span className="shrink-0 font-semibold text-emerald-700">/ {job.candidatesNeeded ?? '—'}</span>
              </div>
            </Fact>
            <Fact label="Salary">
              <div className="flex items-center gap-1.5">
                <Input aria-label="Salary min" type="number" min={0} placeholder="Min" value={form.salaryMin} onChange={(event) => set({ salaryMin: event.target.value })} />
                <span className="text-foreground/30">–</span>
                <Input aria-label="Salary max" type="number" min={0} placeholder="Max" value={form.salaryMax} onChange={(event) => set({ salaryMax: event.target.value })} />
                <Input aria-label="Currency" maxLength={3} className="w-16 shrink-0" value={form.currency} onChange={(event) => set({ currency: event.target.value })} />
              </div>
            </Fact>
          </>
        ) : (
          <>
            <Fact label="Client">{job.company?.name ?? '—'}</Fact>
            <Fact label="Location">{job.location ?? '—'}</Fact>
            <Fact label="Type">{job.employmentType.replaceAll('_', ' ')}</Fact>
            <Fact label="Candidates needed">{places(job)}</Fact>
            <Fact label="Salary">{salary(job)}</Fact>
          </>
        )}
        <Fact label="Added by">{addedBy ? addedBy(job.ownerId) : '—'}</Fact>
        <Fact label="Opened">{date(job.openedAt)}</Fact>
        <Fact label="Completed on">{date(job.completedOn)}</Fact>
      </dl>

      {editable ? (
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-xs text-foreground/50">Lower the first number (places filled) and the job leaves Completed Jobs and goes back to Jobs, with the data it has.</p>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="button" disabled={updateJob.isPending || releasePlaces.isPending} onClick={() => void save()}>
            {updateJob.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      ) : null}

      <PeopleWhoFilledIt job={job} replaceable={editable} />
      {editable ? <CandidateHistoryTable job={job} /> : null}
    </Drawer>
  );
}

/**
 * Completed Jobs: the jobs whose every place is filled — they leave Jobs when the last one is taken. A compact,
 * paged table (10 to a page, so the page never grows into a scroll however many jobs pile up) with the job's
 * details in its columns; opening a row shows everything about the job and the people who filled it.
 */
export function CompletedJobsView({ search }: { search: string }) {
  const [page, setPage] = useState(1);
  const [opened, setOpened] = useState<JobWithCompany | null>(null);
  const addedBy = useAddedBy();
  // another search: back to the first page
  const [lastSearch, setLastSearch] = useState(search);
  if (search !== lastSearch) {
    setLastSearch(search);
    setPage(1);
  }
  const { data, isLoading } = useJobs({ page, pageSize: PAGE_SIZE, completion: 'COMPLETED', search: search || undefined });
  const tableColumns = useMemo(() => columns(addedBy, setOpened), [addedBy]);

  return (
    <>
      {data && data.totalItems === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background px-6 py-24 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
            <CheckCircle2 className="h-6 w-6 text-foreground/50" />
          </div>
          <h3 className="mt-4 text-sm font-semibold">No completed jobs</h3>
          <p className="mt-1 max-w-sm text-sm text-foreground/50">
            A job lands here when every place it needs is filled — Candidates needed, e.g. 5/5 — by pressing Completed on its employees.
          </p>
        </div>
      ) : (
        <DataTable
          columns={tableColumns}
          data={data?.items ?? []}
          isLoading={isLoading}
          page={data?.page ?? page}
          pageSize={data?.pageSize ?? PAGE_SIZE}
          totalItems={data?.totalItems ?? 0}
          totalPages={data?.totalPages ?? 1}
          onPageChange={setPage}
          onRowClick={setOpened}
          tone="emerald"
        />
      )}
      {opened ? <CompletedJobPanel job={opened} addedBy={addedBy} onClose={() => setOpened(null)} /> : null}
    </>
  );
}
