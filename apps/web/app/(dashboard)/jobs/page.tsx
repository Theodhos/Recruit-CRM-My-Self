'use client';

import { Button, Drawer, Input, Label } from '@crm/ui';
import type { JobSchedule } from '@crm/types';
import type { CreateJobInput } from '@crm/validation';
import { ArrowRightLeft, Briefcase, Eye, FileSpreadsheet, Plus, Search, Tags } from '@crm/ui/icons';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Suspense, useEffect, useRef, useState } from 'react';

import { ExcelImportDialog } from '@/components/import/excel-import-dialog';
import { jobImport } from '@/components/import/import-configs';
import { confirmDialog } from '@/components/dialogs/confirm-dialog';
import { DataTable } from '@/components/tables/data-table';
import { PageBanner } from '@/components/tables/page-banner';
import { useRowSelection } from '@/components/tables/row-selection';
import { JobForm, JobTitlesDialog, JobTransferDialog, type JobDraft, JobScheduleTable, JobShiftTable, PersonCalendar, defaultShiftDays, jobColumns } from '@/features/jobs';
import { distanceColumn } from '@/features/distance/distance-column';
import { CandidateOriginSelect } from '@/features/distance/candidate-origin-picker';
import { DistanceRangeFilter, milesToKm, sliderMax, useDebounced } from '@/features/distance/distance-range-filter';
import { AddedByFilter } from '@/features/users';
import { getJobsDistanceRange } from '@/services/jobs.service';
import { useAddedBy } from '@/hooks/use-added-by';
import { useCreateJob, useDeleteJob, useJobs, useUpdateJob } from '@/hooks/use-jobs';
import { usePlacements } from '@/hooks/use-placements';
import { URGENCY_ROW, jobUrgency } from '@/features/jobs/due';
import { toFormDefaults } from '@/lib/form-defaults';
import type { JobWithCompany } from '@/services/jobs.service';

// `useSearchParams()` must sit under a Suspense boundary so the route can still be prerendered.
export default function JobsPage() {
  return (
    <Suspense fallback={null}>
      <JobsPageContent />
    </Suspense>
  );
}

/** /jobs shows both kinds together; the sidebar's Jobs Permanent / Jobs Temporary open it as /jobs?type=PERMANENT|TEMPORARY. */
function JobsPageContent() {
  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type');
  const employmentGroup = typeParam === 'PERMANENT' || typeParam === 'TEMPORARY' ? typeParam : undefined;
  const heading = employmentGroup === 'PERMANENT' ? 'Jobs Permanent' : employmentGroup === 'TEMPORARY' ? 'Jobs Temporary' : 'Jobs';

  const [importOpen, setImportOpen] = useState(false);
  const [titlesOpen, setTitlesOpen] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [page, setPage] = useState(1);
  // another category picked in the sidebar: back to the first page
  useEffect(() => setPage(1), [employmentGroup]);
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  // "within x km of a place": a typed street / city / post code, or a candidate's place, and the distance
  const [nearPlace, setNearPlace] = useState('');
  const nearApplied = useDebounced(nearPlace.trim());
  const [nearCandidateId, setNearCandidateId] = useState('');
  const [sliderKm, setSliderKm] = useState(0);
  const radius = useDebounced(sliderKm > 0 ? sliderKm : undefined, 300);
  const near = radius && (nearCandidateId || nearApplied) ? { nearCandidateId: nearCandidateId || undefined, nearLocation: nearCandidateId ? undefined : nearApplied, radiusKm: milesToKm(radius) } : {};
  useEffect(() => setPage(1), [nearApplied, radius, nearCandidateId]);
  // the slider ends a few miles past the farthest job from the start point
  const startChosen = Boolean(nearCandidateId || nearApplied);
  // choosing a start point filters at once: the distance starts at 25 miles instead of waiting for the slider
  useEffect(() => {
    if (startChosen) setSliderKm((current) => (current === 0 ? 25 : current));
  }, [startChosen]);
  const { data: range } = useQuery({
    queryKey: ['jobs', 'distance-range', nearCandidateId, nearApplied, employmentGroup],
    enabled: startChosen,
    staleTime: 60_000,
    retry: false,
    queryFn: () => getJobsDistanceRange({ nearCandidateId: nearCandidateId || undefined, nearLocation: nearCandidateId ? undefined : nearApplied, employmentGroup }),
  });
  const sliderEnd = sliderMax(startChosen ? range?.maxKm : undefined);
  const [ownerId, setOwnerId] = useState('');
  const [dialogState, setDialogState] = useState<{ mode: 'create' | 'edit'; job?: JobWithCompany } | null>(
    null,
  );

  // the working days of each person, edited on the calendar beside the edit panel of a Temporary job
  const [people, setPeople] = useState<NonNullable<JobSchedule['people']>>({});
  // which shift each candidate of the job works
  const [assignments, setAssignments] = useState<NonNullable<JobSchedule['assignments']>>({});
  // what the form says now (type, people, dates): the calendar beside it follows
  const [draft, setDraft] = useState<JobDraft>({});
  // the calendar starts with the default shift (Monday to Friday, 08:00-17:00) for the chosen dates, until someone changes it
  const calendarTouched = useRef(false);
  const calendarAuto = useRef(false);
  const openEdit = (job: JobWithCompany) => {
    calendarTouched.current = false;
    calendarAuto.current = false;
    setPeople(job.schedule?.people ?? {});
    setAssignments(job.schedule?.assignments ?? {});
    setDraft({ employmentType: job.employmentType, candidatesNeeded: job.candidatesNeeded ?? undefined, startDate: job.schedule?.startDate, endDate: job.schedule?.endDate, shiftCount: job.schedule?.shiftCount });
    setDialogState({ mode: 'edit', job });
  };
  const openCreate = () => {
    calendarTouched.current = false;
    calendarAuto.current = false;
    setPeople({});
    setAssignments({});
    setDraft({});
    setDialogState({ mode: 'create' });
  };
  // the candidates working on the job being edited: the calendar shows all of them
  const editedJobId = dialogState?.mode === 'edit' ? dialogState.job?.id : undefined;
  const { data: jobPlacements } = usePlacements({ jobId: editedJobId, pageSize: 100 }, { enabled: Boolean(editedJobId) });
  const calendarCandidates = [
    ...new Map(
      (jobPlacements?.items ?? [])
        .filter((placement) => placement.status !== 'CANCELLED')
        .map((placement) => [placement.candidate.id, { id: placement.candidate.id, name: `${placement.candidate.firstName} ${placement.candidate.lastName}`.trim() }]),
    ).values(),
  ];
  const showCalendar = draft.employmentType === 'TEMPORARY';
  useEffect(() => {
    if (!showCalendar || !draft.startDate || !draft.endDate || !dialogState || calendarTouched.current) return;
    // an existing job keeps the days it already has
    if (dialogState.mode === 'edit' && !calendarAuto.current && Object.keys(people).length > 0) return;
    calendarAuto.current = true;
    setPeople({ '1': defaultShiftDays(draft.startDate, draft.endDate) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCalendar, draft.startDate, draft.endDate, dialogState?.mode]);
  const calendarDays = Object.values(people).reduce((sum, days) => sum + Object.keys(days).length, 0);
  const { data, isLoading, error } = useJobs({ page, pageSize: 25, search: search || undefined, title: title || undefined, company: company || undefined, location: location || undefined, ...near, ownerId: ownerId || undefined, employmentGroup, completion: 'OPEN' });
  const selection = useRowSelection(data?.items ?? []);
  const addedBy = useAddedBy();
  const createJob = useCreateJob();
  const updateJob = useUpdateJob();
  const deleteJob = useDeleteJob();

  // the weekdays (mon…sun) the calendar's dates fall on: the working days when none were ticked
  const weekdaysOf = () => {
    const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const found = new Set<string>();
    for (const days of Object.values(people)) for (const date of Object.keys(days)) found.add(keys[new Date(`${date}T00:00:00`).getDay()]!);
    return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].filter((key) => found.has(key));
  };

  async function handleSubmit(values: CreateJobInput) {
    // the calendar's days travel with the rest of the schedule
    const input =
      values.employmentType === 'TEMPORARY'
        ? { ...values, schedule: { ...values.schedule, people, assignments, workDays: values.schedule?.workDays?.length ? values.schedule.workDays : weekdaysOf() } }
        : values;
    if (dialogState?.mode === 'edit' && dialogState.job) {
      await updateJob.mutateAsync({ id: dialogState.job.id, input });
    } else {
      await createJob.mutateAsync(input);
    }
    setDialogState(null);
  }

  // Save calendar: the days are stored straight away, the panel stays open
  async function saveCalendar() {
    const job = dialogState?.job;
    if (!job) return;
    const schedule = { ...job.schedule, people, assignments };
    await updateJob.mutateAsync({ id: job.id, input: { schedule } });
    setDialogState({ mode: 'edit', job: { ...job, schedule } });
  }

  async function handleDelete(job: JobWithCompany) {
    if (await confirmDialog(`Close and delete ${job.title}? The cards of the people who applied to it leave the pipeline too.`)) {
      deleteJob.mutate(job.id);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageBanner tone="sky" icon={Briefcase} title={heading} description="Post and manage open recruitment vacancies.">
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="outline" className="whitespace-nowrap" onClick={() => setImportOpen(true)}>
          <FileSpreadsheet className="mr-1.5 h-4 w-4" />
          Import Excel
        </Button>
        <Button type="button" variant="outline" className="whitespace-nowrap" onClick={() => setTitlesOpen(true)}>
          <Tags className="mr-1.5 h-4 w-4" />
          Add job title
        </Button>
        <Button type="button" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Job
        </Button>
      </div>
      </PageBanner>

      <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-72 flex-[2]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <Input
            placeholder="Search job title, client, location, type, status…"
            className="pl-8"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        {(
          [
            ['Job title', title, setTitle],
            ['Client', company, setCompany],
            ['Location', location, setLocation],
          ] as const
        ).map(([label, value, set]) => (
          <div key={label} className="flex min-w-44 flex-1 flex-col gap-1.5">
            <Label htmlFor={`job-${label}`}>{label}</Label>
            <Input
              id={`job-${label}`}
              className="w-full"
              placeholder={label}
              value={value}
              onChange={(event) => {
                set(event.target.value);
                setPage(1);
              }}
            />
          </div>
        ))}
        <AddedByFilter
          value={ownerId}
          onChange={(next) => {
            setOwnerId(next);
            setPage(1);
          }}
        />
      </div>
      <DistanceRangeFilter fill subject="jobs" max={sliderEnd} place={nearPlace} onPlace={setNearPlace} km={sliderKm} onKm={setSliderKm} pickerActive={Boolean(nearCandidateId)} hasStart={startChosen} unlocated={range?.unlocated} onClear={() => { setNearPlace(''); setNearCandidateId(''); setSliderKm(0); }}>
        <CandidateOriginSelect value={nearCandidateId} onChange={setNearCandidateId} />
      </DistanceRangeFilter>
      </div>

      {error && near.radiusKm ? <p className="text-sm text-destructive">{error instanceof Error ? error.message : 'The place was not found.'}</p> : null}

      {data ? (
        <div className="rounded-lg border border-border px-4 py-2.5" data-testid="results-bar">
          <p className="text-sm" aria-live="polite">
            <strong>{data.totalItems.toLocaleString('en-GB')}</strong> job{data.totalItems === 1 ? '' : 's'}{' '}
            {search || title || company || location || near.radiusKm || ownerId ? 'match your filters' : 'in total'}.
          </p>
        </div>
      ) : null}

      {data && data.totalItems === 0 && !search && !title && !company && !location && !near.radiusKm && !ownerId ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background px-6 py-24 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
            <Briefcase className="h-6 w-6 text-foreground/50" />
          </div>
          <h3 className="mt-4 text-sm font-semibold">No jobs yet</h3>
          <p className="mt-1 max-w-sm text-sm text-foreground/50">
            Post your first job — pick an existing company, type a new one, or leave it unlinked
            for now.
          </p>
        </div>
      ) : (
        <DataTable
          tone="sky"
          columns={[...jobColumns({
            selection,
            addedBy,
            onEdit: openEdit,
            onDelete: handleDelete,          }), ...(near.radiusKm ? [distanceColumn<JobWithCompany>()] : [])]}
          data={data?.items ?? []}
          // a job whose "find candidates by" date is close is red — the closer, the deeper
          rowClassName={(job) => URGENCY_ROW[jobUrgency(job)] || undefined}
          isLoading={isLoading}
          page={data?.page ?? page}
          pageSize={data?.pageSize ?? 25}
          totalItems={data?.totalItems ?? 0}
          totalPages={data?.totalPages ?? 1}
          onPageChange={setPage}
        />
      )}

      {/* always at the bottom: with jobs ticked it opens on them, with none the jobs are chosen in the pop-up */}
      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background/95 px-4 py-3 shadow-sm backdrop-blur" data-testid="transfer-bar">
        <p className="text-sm" data-testid="selection-count">
          {selection.count > 0 ? (
            <span className="font-semibold">{selection.count.toLocaleString('en-GB')} {selection.count === 1 ? 'job' : 'jobs'} selected</span>
          ) : (
            <span className="text-foreground/60">Tick jobs in the table, or press Transfer and choose them in the list.</span>
          )}
        </p>
        <div className="flex items-center gap-2">
          {selection.count > 0 ? (
            <Button type="button" variant="ghost" onClick={selection.clear}>
              Clear selection
            </Button>
          ) : null}
          <Button type="button" onClick={() => setTransferring(true)} data-testid="transfer-jobs">
            <ArrowRightLeft className="mr-1.5 h-4 w-4" />
            Transfer to another recruiter
          </Button>
        </div>
      </div>

      {transferring ? (
        <JobTransferDialog
          group={employmentGroup}
          selectedIds={[...selection.selectedIds]}
          onClose={() => setTransferring(false)}
          onDone={() => {
            setTransferring(false);
            selection.clear();
          }}
        />
      ) : null}

      {titlesOpen ? <JobTitlesDialog onClose={() => setTitlesOpen(false)} /> : null}

      {importOpen ? <ExcelImportDialog config={jobImport} onClose={() => setImportOpen(false)} /> : null}

      {dialogState ? (
        <Drawer
          open
          onOpenChange={(open) => !open && setDialogState(null)}
          title={dialogState.mode === 'edit' ? 'Edit Job' : 'Quick Add Job'}
          // the edit panel is wider than the quick-add one; with the calendar beside it, wider still
          className={showCalendar ? 'max-w-[90rem]' : dialogState.mode === 'edit' ? 'max-w-3xl' : undefined}
          // a Temporary job: a calendar on the left to set each person's working days and hours
          side={
            showCalendar ? (
              <PersonCalendar
                people={people}
                count={Math.max(draft.shiftCount ?? 1, 1)}
                shifts={[]}
                startDate={draft.startDate}
                endDate={draft.endDate}
                saving={updateJob.isPending}
                onChange={(next) => {
                  calendarTouched.current = true;
                  setPeople(next);
                }}
                candidates={calendarCandidates}
                assignments={assignments}
                onAssignmentsChange={setAssignments}
                onSave={dialogState.mode === 'edit' && dialogState.job ? () => void saveCalendar() : undefined}
              />
            ) : undefined
          }
        >
          {dialogState.mode === 'edit' && dialogState.job?.employmentType === 'TEMPORARY' ? (
            <>
              <JobShiftTable schedule={dialogState.job.schedule} />
              <JobScheduleTable job={dialogState.job} />
            </>
          ) : null}
          <JobForm
            defaultValues={
              dialogState.job
                ? {
                    ...toFormDefaults(dialogState.job),
                    salaryMin: dialogState.job.salaryMin ? Number(dialogState.job.salaryMin) : undefined,
                    salaryMax: dialogState.job.salaryMax ? Number(dialogState.job.salaryMax) : undefined,
                    recruitStartDate: dialogState.job.recruitStartDate?.slice(0, 10) ?? undefined,
                    recruitEndDate: dialogState.job.recruitEndDate?.slice(0, 10) ?? undefined,
                    expiresAt: dialogState.job.expiresAt?.slice(0, 10) ?? undefined,
                  }
                : // a job added from Jobs Permanent / Jobs Temporary starts as that kind
                  employmentGroup
                  ? { employmentType: employmentGroup }
                  : undefined
            }
            submitLabel={dialogState.mode === 'edit' ? 'Save changes' : 'Create job'}
            onDraftChange={setDraft}
            calendarDays={calendarDays}
            onSubmit={handleSubmit}
          />
        </Drawer>
      ) : null}
    </div>
  );
}
