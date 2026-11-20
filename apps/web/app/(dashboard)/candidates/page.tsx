'use client';

import { Button, Dialog, Drawer, Input, Label, Select, SearchSelect } from '@crm/ui';
import type { CreateCandidateInput } from '@crm/validation';
import { Download, FileSpreadsheet, GitBranch, MessageSquare, Plus, Search, ShieldCheck, SlidersHorizontal, Users, X } from '@crm/ui/icons';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { alertDialog, confirmDialog } from '@/components/dialogs/confirm-dialog';
import { ExcelImportDialog } from '@/components/import/excel-import-dialog';
import { candidateImport } from '@/components/import/import-configs';
import { isAdminSession } from '@/components/navigation';
import { DataTable } from '@/components/tables/data-table';
import { PageBanner } from '@/components/tables/page-banner';
import { applyManualStatus, CandidateConsentDialog, CandidateStatusFilter, type CandidateStatusFilterValue, CandidateExportDialog, CandidateForm, candidateFormDefaults, unassignedCandidateColumns } from '@/features/candidates';
import type { StatusChoice } from '@/features/candidates/columns';
import { AddedByFilter } from '@/features/users';
import { useAddedBy } from '@/hooks/use-added-by';
import { useApplications, useCreateApplication } from '@/hooks/use-applications';
import { useCandidates, useCreateCandidate, useDeleteCandidate, useUpdateCandidate } from '@/hooks/use-candidates';
import { useUploadDocument } from '@/hooks/use-documents';
import { distanceColumn } from '@/features/distance/distance-column';
import { DistanceRangeFilter, milesToKm, sliderMax, useDebounced } from '@/features/distance/distance-range-filter';
import { useAllJobs } from '@/hooks/use-jobs';
import { usePipelines } from '@/hooks/use-pipelines';
import { BulkSmsDialog } from '@/features/communications';
import { useSession } from '@/hooks/use-session';
import { filtersOf, getCandidate, getCandidatesDistanceRange, type CandidateSelection, type CandidateWithCompany, type ListCandidatesParams, type ReviewStatus, type SuggestedJob } from '@/services/candidates.service';

/**
 * The Candidates directory: everyone who applied — through the website form or added by hand. A new arrival is only
 * recorded (the API notifies the team); someone then picks a job and ticks candidates to put them on its Pipeline
 * Jobs at Sent CV, many at once. The status here is simply read off that pipeline: Pending (not on a pipeline), Active (on a pipeline,
 * with the stage) or Rejected. Ranked highest-potential-first.
 */
export default function CandidatesPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  // the per-column filters above the table
  const [filters, setFilters] = useState({ jobTitle: '', trade: '' });
  const setFilter = (key: keyof typeof filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const [ownerId, setOwnerId] = useState('');
  const [availability, setAvailability] = useState<CandidateStatusFilterValue | ''>('');
  const [origin, setOrigin] = useState<'' | 'WEBSITE' | 'MANUAL'>('');
  // opened from the dashboard card ("View all"): /candidates?origin=WEBSITE starts on the website applicants
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('origin');
    if (wanted === 'WEBSITE' || wanted === 'MANUAL') setOrigin(wanted);
  }, []);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const saveOnClose = useRef<(() => Promise<void>) | null>(null);

  // the advanced filters (all of them work together with the ones above)
  const EMPTY_ADVANCED = { postcode: '', experience: '', grade: [] as string[], employmentStatus: '', experienceMin: '', skills: '', qualifications: '', notContactedSince: '', contactedFrom: '', contactedTo: '' };
  const [advanced, setAdvanced] = useState(EMPTY_ADVANCED);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const setAdv = <K extends keyof typeof EMPTY_ADVANCED>(key: K, value: (typeof EMPTY_ADVANCED)[K]) => {
    setAdvanced((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const advancedCount = Object.values(advanced).filter((value) => (Array.isArray(value) ? value.length > 0 : value !== '')).length;

  // "within x km": a typed street / city / post code, or the place of a job, and the distance
  const [nearPlace, setNearPlace] = useState('');
  const nearApplied = useDebounced(nearPlace.trim());
  const [nearJobId, setNearJobId] = useState('');
  const [sliderKm, setSliderKm] = useState(0);
  const radius = useDebounced(sliderKm > 0 ? sliderKm : undefined, 300);
  const near: Pick<ListCandidatesParams, 'nearLocation' | 'nearJobId' | 'radiusKm'> =
    radius && (nearJobId || nearApplied) ? { nearJobId: nearJobId || undefined, nearLocation: nearJobId ? undefined : nearApplied, radiusKm: milesToKm(radius) } : {};
  useEffect(() => setPage(1), [nearApplied, radius, nearJobId]);
  // the slider ends a few miles past the farthest candidate from the start point
  const startChosen = Boolean(nearJobId || nearApplied);
  // choosing a start point filters at once: the distance starts at 25 miles instead of waiting for the slider
  useEffect(() => {
    if (startChosen) setSliderKm((current) => (current === 0 ? 25 : current));
  }, [startChosen]);
  const { data: range } = useQuery({
    queryKey: ['candidates', 'distance-range', nearJobId, nearApplied],
    enabled: startChosen,
    staleTime: 60_000,
    retry: false,
    queryFn: () => getCandidatesDistanceRange({ nearJobId: nearJobId || undefined, nearLocation: nearJobId ? undefined : nearApplied }),
  });
  const sliderEnd = sliderMax(startChosen ? range?.maxKm : undefined);

  const listParams: ListCandidatesParams = {
    ...near,
    jobTitle: filters.jobTitle || undefined,
    search: search || undefined,
    ownerId: ownerId || undefined,
    availability: availability || undefined,
    origin: origin || undefined,
    postcode: advanced.postcode || undefined,
    trade: filters.trade || undefined,
    experience: advanced.experience || undefined,
    grade: advanced.grade.length ? advanced.grade.join(',') : undefined,
    employmentStatus: (advanced.employmentStatus || undefined) as ListCandidatesParams['employmentStatus'],
    experienceMin: advanced.experienceMin === '' ? undefined : Number(advanced.experienceMin),
    skills: advanced.skills || undefined,
    qualifications: advanced.qualifications || undefined,
    notContactedSince: advanced.notContactedSince || undefined,
    contactedFrom: advanced.contactedFrom || undefined,
    contactedTo: advanced.contactedTo || undefined,
  };
  const filtersAreActive = Object.keys(filtersOf(listParams)).length > 0;
  function clearFilters() {
    setFilters({ jobTitle: '', trade: '' });
    setSearch('');
    setOwnerId('');
    setAvailability('');
    setOrigin('');
    setAdvanced(EMPTY_ADVANCED);
    setNearPlace('');
    setNearJobId('');
    setSliderKm(0);
    setPage(1);
  }

  const { data, isLoading, isError, error: listError } = useCandidates({ ...listParams, page, pageSize: 25 });
  const { data: session } = useSession();
  const canExport = Boolean(session?.permissions?.includes('candidate:export'));
  const canBulkText = Boolean(session?.permissions?.includes('communication:bulk'));
  const isAdmin = isAdminSession(session);

  const addedBy = useAddedBy();
  const createCandidate = useCreateCandidate();
  const updateCandidate = useUpdateCandidate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<CandidateWithCompany | null>(null);
  const deleteCandidate = useDeleteCandidate();

  /** A status chosen by hand does at once, with no questions, what that status does on Pipeline Jobs (see applyManualStatus). */
  async function handleStatusChange(candidate: CandidateWithCompany, status: StatusChoice | null) {
    try {
      await applyManualStatus(candidate, status);
    } catch (error) {
      void alertDialog(error instanceof Error ? error.message : 'Could not change the status.', { title: 'Status not changed' });
    }
    await Promise.all(['candidates', 'applications', 'placements'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
  }

  async function handleDeleteCandidate(candidate: CandidateWithCompany) {
    const name = `${candidate.firstName} ${candidate.lastName}`.trim() || 'this candidate';
    if (!await confirmDialog(`Delete ${name}? Their applications leave the pipeline too.`)) return;
    try {
      await deleteCandidate.mutateAsync(candidate.id);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not delete the candidate.');
    }
  }
  const uploadDocument = useUploadDocument();
  const createApplication = useCreateApplication();
  const [applyingKey, setApplyingKey] = useState<string | null>(null);

  // Manual entry (typed in, or pre-filled by scanning a CV in the form). The API puts them on the pipeline of the
  // job chosen in the form and raises the "new candidate" notification.
  async function handleCreateCandidate(values: CreateCandidateInput, resume?: File) {
    const candidate = await createCandidate.mutateAsync(values);
    // the scanned file stays with the person as their CV (previewed on their page); the candidate exists either way
    if (resume) {
      await uploadDocument
        .mutateAsync({ file: resume, type: 'CV', candidateId: candidate.id })
        .catch(() => window.alert('The candidate was created, but the CV could not be saved — upload it from their page.'));
    }
    setCreateOpen(false);
  }

  // "Suggested for open jobs": one click puts a previously rejected person on the similar opening's pipeline.
  async function handleApplySuggestion(candidate: CandidateWithCompany, job: SuggestedJob) {
    setApplyingKey(`${candidate.id}:${job.id}`);
    try {
      await createApplication.mutateAsync({ candidateId: candidate.id, jobId: job.id });
    } finally {
      setApplyingKey(null);
    }
  }

  // The checkbox before a name: puts the candidate on Pipeline Jobs at the first stage (Sent CV), by hand —
  // nobody goes there automatically.
  const [puttingOnPipelineId, setPuttingOnPipelineId] = useState<string | null>(null);
  // The checkboxes only select. Ticked candidates are given a job together: the same job for all of them, or a job for
  // each (several different jobs at once). The ticks survive paging and filtering. Adding to Sent CV is done
  // by the "Add to pipeline" button of a row, or by the bar below for everyone ticked.
  const { data: openJobs } = useAllJobs({ completion: "OPEN" });
  // A Temporary job's pipeline has one stage in play: the candidate goes straight to Active (there is no Screening any more).
  const { data: pipelines } = usePipelines();
  const temporaryPipeline = pipelines?.find((pipeline) => pipeline.employmentType === "TEMPORARY") ?? null;
  const temporaryStages = (temporaryPipeline?.stages ?? []).filter((stage) => /^active$/i.test(stage.name.trim()));
  // The stage chosen for each candidate on each Temporary job ("candidateId:jobId"); Screening (the first) unless changed.
  const [stageChoices, setStageChoices] = useState<Record<string, string>>({});
  // the "go" callback of the stage dialog was made before the choices were picked, so it reads them from a ref
  const stageChoicesRef = useRef(stageChoices);
  stageChoicesRef.current = stageChoices;
  const isTemporaryJob = (jobId: string) => {
    const job = openJobs?.items.find((item) => item.id === jobId);
    return Boolean(job) && job?.employmentType !== "PERMANENT";
  };
  const stageFields = (candidateId: string, jobId: string) => {
    if (!isTemporaryJob(jobId) || !temporaryPipeline || temporaryStages.length === 0) return {};
    const stage = temporaryStages.find((item) => item.id === stageChoicesRef.current[`${candidateId}:${jobId}`]) ?? temporaryStages[0]!;
    return { pipelineId: temporaryPipeline.id, pipelineStageId: stage.id };
  };
  // Before anyone goes onto a Temporary job, a dialog asks for each of them: Screening or Active.
  const [stageAsk, setStageAsk] = useState<{ pairs: { candidate: CandidateWithCompany; jobId: string }[]; go: () => void } | null>(null);
  function askStages(pairs: { candidate: CandidateWithCompany; jobId: string }[], go: () => void) {
    const temporaryPairs = pairs.filter(({ jobId }) => isTemporaryJob(jobId));
    // one stage only (Active): nothing to ask
    if (temporaryPairs.length === 0 || temporaryStages.length <= 1) {
      go();
      return;
    }
    setStageAsk({ pairs: temporaryPairs, go });
  }
  const [selected, setSelected] = useState<Map<string, CandidateWithCompany>>(new Map());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkJobIds, setBulkJobIds] = useState<Set<string>>(new Set());
  // the list of jobs in the dialog: a search box on top and a "select all" for whatever the search shows
  const [jobSearch, setJobSearch] = useState("");
  // the three groups under the search box: all jobs, Temporary, Permanent
  const [jobKind, setJobKind] = useState<"ALL" | "TEMPORARY" | "PERMANENT">("ALL");
  const jobsOfKind = (kind: "ALL" | "TEMPORARY" | "PERMANENT") =>
    (openJobs?.items ?? []).filter((job) => kind === "ALL" || (kind === "PERMANENT" ? job.employmentType === "PERMANENT" : job.employmentType !== "PERMANENT"));
  const shownJobs = jobsOfKind(jobKind).filter((job) => {
    const text = `${job.title} ${job.company?.name ?? ""} ${job.location ?? ""}`.toLowerCase();
    return jobSearch.toLowerCase().split(/\s+/).filter(Boolean).every((word) => text.includes(word));
  });
  const allShownTicked = shownJobs.length > 0 && shownJobs.every((job) => bulkJobIds.has(job.id));
  function toggleAllShown(on: boolean) {
    setBulkJobIds((current) => {
      const next = new Set(current);
      for (const job of shownJobs) {
        if (on) next.add(job.id);
        else next.delete(job.id);
      }
      return next;
    });
  }
  const [bulkPutting, setBulkPutting] = useState(false);
  // "Select all N that match": the people are not loaded, the filters are remembered and the server resolves them.
  // People un-ticked afterwards are kept in `excluded`.
  const [allMatching, setAllMatching] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [exportOpen, setExportOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const filterKey = JSON.stringify(filtersOf(listParams));
  // a different search means a different group of people: the "all matching" choice does not carry over
  const lastFilterKey = useRef(filterKey);
  if (lastFilterKey.current !== filterKey) {
    lastFilterKey.current = filterKey;
    if (allMatching) {
      setAllMatching(false);
      setExcluded(new Set());
    }
  }
  const pageIds = (data?.items ?? []).map((candidate) => candidate.id);
  const totalMatching = data?.totalItems ?? 0;
  const selectedCount = allMatching ? Math.max(0, totalMatching - excluded.size) : selected.size;
  const hasSelection = selectedCount > 0;
  const pageFullyTicked = !allMatching && pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const selection: CandidateSelection = allMatching
    ? { mode: 'FILTER', filters: filtersOf(listParams), excludeIds: [...excluded] }
    : { mode: 'IDS', ids: [...selected.keys()] };
  function selectAllMatching() {
    setAllMatching(true);
    setExcluded(new Set());
  }

  function clearSelection() {
    setAllMatching(false);
    setExcluded(new Set());
    setSelected(new Map());
    setBulkJobIds(new Set());
    setJobSearch("");
    setJobKind("ALL");
    setBulkOpen(false);
  }
  function toggleSelected(candidate: CandidateWithCompany) {
    if (allMatching) {
      setExcluded((current) => {
        const next = new Set(current);
        if (next.has(candidate.id)) next.delete(candidate.id);
        else next.add(candidate.id);
        return next;
      });
      return;
    }
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(candidate.id)) next.delete(candidate.id);
      else next.set(candidate.id, candidate);
      return next;
    });
  }
  function togglePage(on: boolean) {
    if (allMatching) {
      setExcluded((current) => {
        const next = new Set(current);
        for (const id of pageIds) {
          if (on) next.delete(id);
          else next.add(id);
        }
        return next;
      });
      return;
    }
    setSelected((current) => {
      const next = new Map(current);
      for (const candidate of data?.items ?? []) {
        if (on) next.set(candidate.id, candidate);
        else next.delete(candidate.id);
      }
      return next;
    });
  }
  // every ticked candidate on the pipeline of every chosen job
  const bulkPairs = () => [...selected.values()].flatMap((candidate) => [...bulkJobIds].map((jobId) => ({ candidate, jobId })));
  async function handlePutSelectedOnPipeline() {
    if (bulkJobIds.size === 0) return;
    setBulkPutting(true);
    const pairs = bulkPairs();
    const results = await Promise.allSettled(
      pairs.map(({ candidate, jobId }) => createApplication.mutateAsync({ candidateId: candidate.id, jobId, source: "OTHER", ...stageFields(candidate.id, jobId) })),
    );
    const failed = pairs.filter((_, index) => results[index]!.status === "rejected");
    setBulkPutting(false);
    if (failed.length === 0) {
      clearSelection();
      return;
    }
    // what did not go (already on that job's pipeline, ...) is told; the people stay ticked
    const jobTitle = (id: string) => openJobs?.items.find((job) => job.id === id)?.title ?? "a job";
    const reason = (results.find((r): r is PromiseRejectedResult => r.status === "rejected")?.reason as Error | undefined)?.message;
    window.alert(
      `${pairs.length - failed.length} added, ${failed.length} not: ${failed.map(({ candidate, jobId }) => `${candidate.firstName} ${candidate.lastName} → ${jobTitle(jobId)}`).join("; ")}. ${reason ?? ""}`,
    );
  }

  // One person can go on the pipeline of as many jobs as wanted, so the box never locks. The first time, with a job
  // they asked for, it goes straight there; every other time (or with no job asked for) a job is chosen first.
  const [pickFor, setPickFor] = useState<CandidateWithCompany | null>(null);
  const [pickJobId, setPickJobId] = useState("");
  // the jobs this person is already on the pipeline for: those cannot be chosen again (a card without a job counts as the empty one)
  const { data: pickedCards } = useApplications({ candidateId: pickFor?.id, pageSize: 100 }, { enabled: Boolean(pickFor) });
  const alreadyOn = new Set((pickedCards?.items ?? []).map((card) => card.job.id));
  function handlePutOnPipeline(candidate: CandidateWithCompany) {
    // a Temporary job asks first: Screening or Active
    if (!candidate.currentApplication && candidate.interestedJobId && !isTemporaryJob(candidate.interestedJobId)) {
      void addToPipeline(candidate, candidate.interestedJobId);
      return;
    }
    setPickFor(candidate);
    setPickJobId(candidate.interestedJobId ?? "");
  }
  async function addToPipeline(candidate: CandidateWithCompany, jobId: string) {
    setPuttingOnPipelineId(candidate.id);
    try {
      await createApplication.mutateAsync({ candidateId: candidate.id, ...(jobId ? { jobId } : {}), source: "OTHER", ...(jobId ? stageFields(candidate.id, jobId) : {}) });
      setPickFor(null);
    } catch (error) {
      window.alert(`${candidate.firstName} ${candidate.lastName} could not be put on Pipeline Jobs: ${error instanceof Error ? error.message : "please try again"}`);
    } finally {
      setPuttingOnPipelineId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageBanner tone="teal" icon={Users} title="Candidates" description="Everyone who applied — from your website or added by hand. Nobody goes onto Pipeline Jobs by themselves: press Add to pipeline on a row, or tick several candidates, press Add to pipeline and choose the job (or jobs) for them. They land at Sent CV (Permanent jobs) or Active (Temporary jobs). The Status column says Available (everyone who is not one of the next three), On hold (at the Interview stage), Not available (an Active Employee on a job right now) or Do not use (only when terminated from Pipeline Jobs). Click a candidate to see all of their details.">
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="outline" className="whitespace-nowrap" onClick={() => setImportOpen(true)}>
          <FileSpreadsheet className="mr-1.5 h-4 w-4" />
          Import Excel
        </Button>
        <Button type="button" className="whitespace-nowrap" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Candidate
        </Button>
      </div>
      </PageBanner>

      <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-72 flex-[2]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <Input
            placeholder="Search name, job title, trade, location, source…"
            className="pl-8"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        {([
          ['jobTitle', 'Job title'],
          ['trade', 'Trade'],
        ] as const).map(([key, label]) => (
          <div key={key} className="flex min-w-44 flex-1 flex-col gap-1.5">
            <Label htmlFor={`filter-${key}`}>{label}</Label>
            <Input id={`filter-${key}`} className="w-full" placeholder={label} value={filters[key]} onChange={(event) => setFilter(key, event.target.value)} />
          </div>
        ))}
        <CandidateStatusFilter
          value={availability}
          onChange={(next) => {
            setAvailability(next);
            setPage(1);
          }}
        />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-origin">Added</Label>
          <Select
            id="filter-origin"
            className="w-44"
            value={origin}
            onChange={(event) => {
              setOrigin(event.target.value as '' | 'WEBSITE' | 'MANUAL');
              setPage(1);
            }}
          >
            <option value="">All candidates</option>
            <option value="WEBSITE">From the website</option>
            <option value="MANUAL">Added manually</option>
          </Select>
        </div>
        <AddedByFilter
          value={ownerId}
          onChange={(next) => {
            setOwnerId(next);
            setPage(1);
          }}
        />
        <Button type="button" variant="outline" onClick={() => setShowAdvanced((now) => !now)} aria-expanded={showAdvanced} data-testid="advanced-toggle">
          <SlidersHorizontal className="mr-1.5 h-4 w-4" />
          More filters{advancedCount > 0 ? ` (${advancedCount})` : ''}
        </Button>
        {filtersAreActive ? (
          <Button type="button" variant="ghost" onClick={clearFilters} data-testid="clear-filters">
            <X className="mr-1.5 h-4 w-4" />
            Clear filters
          </Button>
        ) : null}
      </div>
      <DistanceRangeFilter fill subject="candidates" max={sliderEnd} place={nearPlace} onPlace={setNearPlace} km={sliderKm} onKm={setSliderKm} pickerActive={Boolean(nearJobId)} hasStart={startChosen} unlocated={range?.unlocated} onClear={() => { setNearPlace(''); setNearJobId(''); setSliderKm(0); }}>
        <SearchSelect aria-label="Start from a job" className="w-56 bg-background" searchPlaceholder="Search jobs…" value={nearJobId} onChange={(event) => setNearJobId(event.target.value)}>
          <option value="">…or start from a job</option>
          {(openJobs?.items ?? []).map((job) => (
            <option key={job.id} value={job.id}>
              {job.title}
              {job.company?.name ? ` — ${job.company.name}` : ''}
            </option>
          ))}
        </SearchSelect>
        </DistanceRangeFilter>
      </div>

      {showAdvanced ? (
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-border p-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="advanced-filters">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adv-postcode">Post code starts with</Label>
            <Input id="adv-postcode" placeholder="e.g. SW1" value={advanced.postcode} onChange={(event) => setAdv('postcode', event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adv-exp">Years of experience (at least)</Label>
            <Input id="adv-exp" type="number" min={0} max={70} value={advanced.experienceMin} onChange={(event) => setAdv('experienceMin', event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adv-experience">Previous experience (words)</Label>
            <Input id="adv-experience" placeholder="e.g. scaffolding, rail" value={advanced.experience} onChange={(event) => setAdv('experience', event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adv-employment">Employment status</Label>
            <Select id="adv-employment" value={advanced.employmentStatus} onChange={(event) => setAdv('employmentStatus', event.target.value)}>
              <option value="">Any</option>
              <option value="EMPLOYED">Employed</option>
              <option value="SELF_EMPLOYED">Self-employed</option>
              <option value="UNEMPLOYED">Unemployed</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adv-skills">Skills (has all)</Label>
            <Input id="adv-skills" placeholder="conduit bending, fault finding" value={advanced.skills} onChange={(event) => setAdv('skills', event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adv-qualifications">Qualifications (has all)</Label>
            <Input id="adv-qualifications" placeholder="NVQ level 3, CSCS card" value={advanced.qualifications} onChange={(event) => setAdv('qualifications', event.target.value)} />
          </div>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-sm font-medium">Grade</legend>
            <div className="flex gap-4 pt-1.5">
              {['A', 'B', 'C'].map((grade) => (
                <label key={grade} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={advanced.grade.includes(grade)}
                    onChange={(event) => setAdv('grade', event.target.checked ? [...advanced.grade, grade].sort() : advanced.grade.filter((g) => g !== grade))}
                  />
                  {grade}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adv-not-contacted">Not contacted since</Label>
            <Input id="adv-not-contacted" type="date" value={advanced.notContactedSince} onChange={(event) => setAdv('notContactedSince', event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adv-contacted-from">Last contacted from</Label>
            <Input id="adv-contacted-from" type="date" value={advanced.contactedFrom} onChange={(event) => setAdv('contactedFrom', event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adv-contacted-to">Last contacted until</Label>
            <Input id="adv-contacted-to" type="date" value={advanced.contactedTo} onChange={(event) => setAdv('contactedTo', event.target.value)} />
          </div>
        </div>
      ) : null}

      {!hasSelection && data ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-2.5" data-testid="results-bar">
          <p className="text-sm" aria-live="polite">
            <strong>{totalMatching.toLocaleString('en-GB')}</strong> candidate{totalMatching === 1 ? '' : 's'} {filtersAreActive ? 'match your filters' : 'in total'}.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={!canExport || totalMatching === 0}
            title={canExport ? undefined : 'Your account does not have permission to export candidates. Ask an administrator.'}
            onClick={() => setExportOpen(true)}
            data-testid="export-results"
          >
            <Download className="mr-1.5 h-4 w-4" />
            Export {totalMatching.toLocaleString('en-GB')} result{totalMatching === 1 ? '' : 's'}
          </Button>
        </div>
      ) : null}

      {pageFullyTicked && totalMatching > pageIds.length ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-accent/10 px-4 py-2.5 text-sm" data-testid="select-all-banner">
          <span>All {pageIds.length} candidates on this page are selected.</span>
          <button type="button" className="font-semibold underline" onClick={selectAllMatching} data-testid="select-all-matching">
            Select all {totalMatching.toLocaleString('en-GB')} candidates that match
          </button>
        </div>
      ) : null}

      {hasSelection ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-accent/20 px-4 py-3" data-testid="bulk-selection">
          <p className="text-sm font-semibold" data-testid="selected-count">
            {allMatching ? `All ${selectedCount.toLocaleString('en-GB')} matching selected${excluded.size ? ` (${excluded.size} taken out)` : ''}` : `${selected.size.toLocaleString('en-GB')} ticked`}
          </p>
          {!allMatching ? (
            <Button type="button" onClick={() => setBulkOpen(true)}>
              <GitBranch className="mr-1.5 h-4 w-4" />
              Add to pipeline
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={!canExport}
            title={canExport ? undefined : 'Your account does not have permission to export candidates. Ask an administrator.'}
            onClick={() => setExportOpen(true)}
            data-testid="open-export"
          >
            <Download className="mr-1.5 h-4 w-4" />
            Export
          </Button>
          {canBulkText ? (
            <Button type="button" variant="outline" onClick={() => setTextOpen(true)} data-testid="open-bulk-sms">
              <MessageSquare className="mr-1.5 h-4 w-4" />
              Text via Dialpad
            </Button>
          ) : null}
          {!canExport ? <span className="text-xs text-foreground/60">Export needs the “export candidates” permission — sign out and in again after it is granted.</span> : null}
          {isAdmin ? (
            <Button type="button" variant="outline" onClick={() => setConsentOpen(true)}>
              <ShieldCheck className="mr-1.5 h-4 w-4" />
              Record consent
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={clearSelection}>
            Clear selection
          </Button>
        </div>
      ) : null}

      {textOpen ? (
        <BulkSmsDialog
          selection={selection}
          count={selectedCount}
          onClose={() => setTextOpen(false)}
          onRecordConsent={isAdmin ? () => { setTextOpen(false); setConsentOpen(true); } : undefined}
        />
      ) : null}
      {exportOpen ? (
        <CandidateExportDialog
          // nobody ticked: the export is everyone the current filters list
          selection={hasSelection ? selection : { mode: 'FILTER', filters: filtersOf(listParams), excludeIds: [] }}
          count={hasSelection ? selectedCount : totalMatching}
          onClose={() => setExportOpen(false)}
        />
      ) : null}
      {consentOpen ? <CandidateConsentDialog selection={selection} count={selectedCount} onClose={() => setConsentOpen(false)} /> : null}

      {bulkOpen ? (
        <Dialog
          open
          onOpenChange={(open) => !open && setBulkOpen(false)}
          title={`Add ${selected.size} candidate${selected.size === 1 ? "" : "s"} to Pipeline Jobs`}
          description="Choose the job — or several jobs. Everyone ticked is put on the pipeline of each chosen job: at Sent CV on a Permanent job, straight at Active on a Temporary job."
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setBulkOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={bulkJobIds.size === 0 || bulkPutting} onClick={() => askStages(bulkPairs(), () => void handlePutSelectedOnPipeline().then(() => setBulkOpen(false)))}>
                {bulkPutting ? "Adding…" : bulkJobIds.size > 1 ? `Add to ${bulkJobIds.size} jobs` : "Add to pipeline"}
              </Button>
            </>
          }
        >
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
            <Input className="pl-8" placeholder="Search jobs by title, client or location…" value={jobSearch} onChange={(event) => setJobSearch(event.target.value)} autoFocus />
          </div>
          <div className="mb-3 grid grid-cols-3 gap-1 rounded-lg border border-border bg-accent/30 p-1" role="tablist" aria-label="Job type">
            {([
              ["ALL", "All jobs"],
              ["TEMPORARY", "Temporary"],
              ["PERMANENT", "Permanent"],
            ] as const).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                role="tab"
                aria-selected={jobKind === kind}
                onClick={() => setJobKind(kind)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${jobKind === kind ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground/70 hover:bg-accent"}`}
              >
                {label} <span className="opacity-70">({jobsOfKind(kind).length})</span>
              </button>
            ))}
          </div>
          <ul className="flex max-h-72 flex-col divide-y divide-border overflow-y-auto rounded-md border border-border">
            {shownJobs.length === 0 ? <li className="px-3 py-3 text-sm text-foreground/50">{jobSearch ? "No job matches." : "No open jobs with places left."}</li> : null}
            {shownJobs.length > 0 ? (
              <li className="bg-accent/40">
                <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm font-semibold">
                  <input type="checkbox" className="h-4 w-4 rounded border-border accent-primary" checked={allShownTicked} onChange={(event) => toggleAllShown(event.target.checked)} />
                  Select all jobs{jobSearch ? " shown" : ""} ({shownJobs.length})
                </label>
              </li>
            ) : null}
            {shownJobs.map((job) => (
              <li key={job.id}>
                <label className="flex cursor-pointer items-start gap-2.5 px-3 py-2 text-sm hover:bg-accent/40">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                    checked={bulkJobIds.has(job.id)}
                    onChange={() =>
                      setBulkJobIds((current) => {
                        const next = new Set(current);
                        if (next.has(job.id)) next.delete(job.id);
                        else next.add(job.id);
                        return next;
                      })
                    }
                  />
                  <span>
                    <span className="font-medium">{job.title}</span>
                    {job.company ? <span className="text-foreground/60"> · {job.company.name}</span> : null}
                    {job.location ? <span className="text-foreground/40"> · {job.location}</span> : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </Dialog>
      ) : null}

      {isError ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" data-testid="candidates-error">
          The candidates could not be loaded{listError instanceof Error ? `: ${listError.message}` : ""}. Check your filters or try again.
        </p>
      ) : null}

      {data && data.totalItems === 0 && !search && !availability && !origin && !Object.values(filters).some(Boolean) ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background px-6 py-24 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
            <Users className="h-6 w-6 text-foreground/50" />
          </div>
          <h3 className="mt-4 text-sm font-semibold">No candidates yet</h3>
          <p className="mt-1 max-w-sm text-sm text-foreground/50">
            Applications from your website arrive here automatically, and so does everyone you add. Tick a name to put
            that person on Pipeline Jobs.
          </p>
        </div>
      ) : (
        <DataTable
          tone="teal"
          columns={[...unassignedCandidateColumns({
            addedBy,
            onEdit: setEditing,
            onDelete: (candidate) => void handleDeleteCandidate(candidate),
            onStatusChange: (candidate, status) => void handleStatusChange(candidate, status),
            puttingOnPipelineId,
            selection: {
              selectedIds: allMatching ? new Set(pageIds.filter((id) => !excluded.has(id))) : new Set(selected.keys()),
              onToggle: toggleSelected,
              onTogglePage: togglePage,
              pageIds,
            },
          }), ...(near.radiusKm ? [distanceColumn<CandidateWithCompany>()] : [])]}
          data={data?.items ?? []}
          isLoading={isLoading}
          page={data?.page ?? page}
          pageSize={data?.pageSize ?? 25}
          totalItems={data?.totalItems ?? 0}
          totalPages={data?.totalPages ?? 1}
          onPageChange={setPage}
          onRowClick={(candidate) => router.push(`/candidates/${candidate.id}`)}
          onRowHover={(candidate) => {
            router.prefetch(`/candidates/${candidate.id}`);
            void queryClient.prefetchQuery({ queryKey: ['candidates', 'detail', candidate.id], queryFn: () => getCandidate(candidate.id), staleTime: 60_000 });
          }}
        />
      )}

      {pickFor ? (
        <Dialog
          open
          onOpenChange={(open) => !open && setPickFor(null)}
          title={`Put ${pickFor.firstName} ${pickFor.lastName} on Pipeline Jobs`}
          description="Choose the job. The same person can be put on as many jobs as you like."
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setPickFor(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                // a person already on the pipeline is added for another, named job; a first time may stay without one
                disabled={puttingOnPipelineId === pickFor.id || alreadyOn.has(pickJobId) || (Boolean(pickFor.currentApplication) && !pickJobId)}
                onClick={() => askStages([{ candidate: pickFor, jobId: pickJobId }], () => void addToPipeline(pickFor, pickJobId))}
              >
                {puttingOnPipelineId === pickFor.id ? "Adding…" : "Put on Pipeline Jobs"}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pick-job">Job</Label>
            <Select id="pick-job" value={pickJobId} onChange={(event) => setPickJobId(event.target.value)}>
              <option value="" disabled={alreadyOn.has("")}>{pickFor.currentApplication ? "Choose a job…" : "No job yet"}</option>
              {openJobs?.items.map((job) => (
                <option key={job.id} value={job.id} disabled={alreadyOn.has(job.id)}>
                  {job.title}
                  {job.company ? ` · ${job.company.name}` : ""}
                  {alreadyOn.has(job.id) ? " — already on the pipeline" : ""}
                </option>
              ))}
            </Select>
          </div>
        </Dialog>
      ) : null}

      {stageAsk ? (
        <Dialog
          open
          onOpenChange={(open) => !open && setStageAsk(null)}
          title="Which stage on Pipeline Jobs?"
          description="These people are going onto a Temporary job. Choose for each one: Screening, or straight to Active."
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setStageAsk(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  const { go } = stageAsk;
                  setStageAsk(null);
                  go();
                }}
              >
                Confirm
              </Button>
            </>
          }
        >
          <ul className="flex max-h-80 flex-col divide-y divide-border overflow-y-auto rounded-md border border-border">
            {stageAsk.pairs.map(({ candidate, jobId }) => {
              const key = `${candidate.id}:${jobId}`;
              const job = openJobs?.items.find((item) => item.id === jobId);
              return (
                <li key={key} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span>
                    <span className="font-medium">{candidate.firstName} {candidate.lastName}</span>
                    <span className="text-foreground/60"> → {job?.title ?? "job"}</span>
                  </span>
                  <Select
                    aria-label={`Stage for ${candidate.firstName} ${candidate.lastName}`}
                    className="w-36"
                    value={stageChoices[key] ?? temporaryStages[0]?.id ?? ""}
                    onChange={(event) => setStageChoices((current) => ({ ...current, [key]: event.target.value }))}
                  >
                    {temporaryStages.map((stage) => (
                      <option key={stage.id} value={stage.id}>{stage.name}</option>
                    ))}
                  </Select>
                </li>
              );
            })}
          </ul>
        </Dialog>
      ) : null}

      {editing ? (
        <Dialog open onOpenChange={(open) => !open && setEditing(null)} title="Edit candidate">
          <CandidateForm
            // only what the form edits: other fields of the row (status read off the pipeline, owner…) never get in its way
            defaultValues={candidateFormDefaults(editing as never)}
            submitLabel="Save changes"
            onSubmit={async (values, resume) => {
              await updateCandidate.mutateAsync({ id: editing.id, input: values });
              if (resume) {
                await uploadDocument
                  .mutateAsync({ file: resume, type: 'CV', candidateId: editing.id })
                  .catch(() => window.alert('The changes were saved, but the CV could not be saved — upload it from their page.'));
              }
              setEditing(null);
            }}
          />
        </Dialog>
      ) : null}

      {importOpen ? <ExcelImportDialog config={candidateImport} onClose={() => setImportOpen(false)} /> : null}

      {createOpen ? (
        <Drawer
          open
          onOpenChange={(open) => {
            if (open) return;
            // The X always closes the form, at once. What was filled in is still added in the background — unless that
            // person is already in the system (then it is said in a pop-up) or there is nothing to add yet (then nothing happens).
            const saving = Promise.resolve(saveOnClose.current?.());
            setCreateOpen(false);
            void saving.catch((error: unknown) => {
              const message = error instanceof Error ? error.message : '';
              if (/already in the system/i.test(message)) void alertDialog(message, { title: 'Already in the system' });
            });
          }}
          title="Add Candidate"
        >
          <CandidateForm
            submitLabel="Create candidate"
            saveOnCloseRef={saveOnClose}
            onSubmit={handleCreateCandidate}
          />
        </Drawer>
      ) : null}
    </div>
  );
}
