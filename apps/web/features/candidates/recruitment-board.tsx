'use client';

import { Button, cn, Dialog, Input, Label, Select } from '@crm/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, FileText, GripVertical, Video } from '@crm/ui/icons';
import { useState } from 'react';

import { fillForTone, TONES, type StageTone } from '@/features/pipelines/stage-colors';
import { LocationMap } from '@/features/pipelines/location-map';
import { confirmDialog } from '@/components/dialogs/confirm-dialog';
import { useCandidates, useSaveCandidateStage } from '@/hooks/use-candidates';
import type {
  CandidateWithCompany,
  ListCandidatesParams,
  RecruitmentStage,
  SaveCandidateStageInput,
} from '@/services/candidates.service';

import { CandidateCv } from './candidate-cv';
import { SOURCE_OPTIONS } from './sources';
import { CandidateZoom } from './candidate-zoom';

/** The recruiting stages that complete a candidate's data, in order. */
// the colours are the ones of Pipeline Candidates: New deep blue, then violet, sky blue and green for the placement
export const RECRUITMENT_STAGES: { key: RecruitmentStage; label: string; hint: string; tone: StageTone }[] = [
  { key: 'NEW', label: 'New', hint: 'Complete the candidate’s basic details', tone: 'navy' },
  { key: 'CV_SENT', label: 'CV Sent', hint: 'The CV and where it was sent', tone: 'violet' },
  { key: 'INTERVIEW_1', label: 'Interview', hint: 'The interview and its Zoom link', tone: 'sky' },
  { key: 'PLACEMENT', label: 'Placement', hint: 'Where and when they start', tone: 'green' },
];

type Field = { key: string; label: string; type?: 'text' | 'date' | 'email' | 'select' | 'textarea' | 'number'; options?: string[] };

/**
 * The data the New stage is for — what is left to fill in after Add Candidate. These are columns of the Candidates
 * table, so filling them here fills the table. (`name` is the first and the last name together.)
 */
const BASE_FIELDS: Field[] = [
  { key: 'name', label: 'Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'location', label: 'Location' },
  { key: 'jobTitle', label: 'Job title' },
  { key: 'source', label: 'Source', type: 'select', options: [...SOURCE_OPTIONS] },
];

/** What is written in each later stage (kept with the candidate in `stageData`). */
const STAGE_FIELDS: Record<RecruitmentStage, Field[]> = {
  NEW: [{ key: 'notes', label: 'History', type: 'textarea' }],
  CV_SENT: [
    { key: 'sentTo', label: 'Sent to (company)' },
    { key: 'job', label: 'Job' },
    { key: 'sentOn', label: 'Sent on', type: 'date' },
    { key: 'notes', label: 'History', type: 'textarea' },
  ],
  INTERVIEW_1: [
    { key: 'date', label: 'Interview date', type: 'date' },
    { key: 'interviewer', label: 'Interviewer' },
    { key: 'outcome', label: 'Outcome', type: 'select', options: ['Pending', 'Passed', 'Failed'] },
    { key: 'notes', label: 'History', type: 'textarea' },
  ],
  PLACEMENT: [
    { key: 'company', label: 'Company' },
    { key: 'job', label: 'Job' },
    { key: 'startDate', label: 'Start date', type: 'date' },
    { key: 'payPerHour', label: 'Pay / hour', type: 'number' },
    { key: 'notes', label: 'History', type: 'textarea' },
  ],
};

const REQUIRED: Record<RecruitmentStage, string[]> = {
  NEW: BASE_FIELDS.map((f) => f.key),
  CV_SENT: ['sentTo', 'job', 'sentOn'],
  INTERVIEW_1: ['date', 'interviewer', 'outcome'],
  PLACEMENT: ['company', 'job', 'startDate', 'payPerHour'],
};

const stageOf = (candidate: { recruitmentStage?: RecruitmentStage }) => candidate.recruitmentStage ?? 'NEW';

function valueOf(candidate: CandidateWithCompany, stage: RecruitmentStage, key: string): string {
  if (stage === 'NEW' && key === 'name') return `${candidate.firstName} ${candidate.lastName}`.trim();
  if (stage === 'NEW' && BASE_FIELDS.some((f) => f.key === key)) {
    return String((candidate as unknown as Record<string, unknown>)[key] ?? '');
  }
  return candidate.stageData?.[stage]?.[key] ?? '';
}

type Availability = 'AVAILABLE' | 'NOT_AVAILABLE' | 'DO_NOT_USE';

/** The three availability statuses, read off the candidate's status (the same ones the Availability filter uses). */
const availabilityOf = (candidate: { status?: string }): Availability =>
  candidate.status === 'DO_NOT_CONTACT' ? 'DO_NOT_USE' : candidate.status === 'PLACED' || candidate.status === 'ARCHIVED' ? 'NOT_AVAILABLE' : 'AVAILABLE';

const AVAILABILITY: Record<Availability, { label: string; badge: string; status: 'ACTIVE' | 'ARCHIVED' | 'DO_NOT_CONTACT' }> = {
  AVAILABLE: { label: 'Available', badge: 'bg-green-100 text-green-800', status: 'ACTIVE' },
  NOT_AVAILABLE: { label: 'Not available', badge: 'bg-slate-200 text-slate-700', status: 'ARCHIVED' },
  DO_NOT_USE: { label: 'Do not use', badge: 'bg-red-100 text-red-800', status: 'DO_NOT_CONTACT' },
};

/**
 * The availability each stage means — the rule the whole Stages view follows:
 *  - New, CV Sent, Interview: Available (the person can still be offered work);
 *  - Placement: Not available (they have a job; the API sets it when the card enters Placement, and back to Available when it leaves);
 *  - Do not use: set by hand, in any stage, and kept whatever happens to the card. A card marked so asks for a confirmation before it moves on.
 */
const STAGE_AVAILABILITY: Record<RecruitmentStage, Availability> = {
  NEW: 'AVAILABLE',
  CV_SENT: 'AVAILABLE',
  INTERVIEW_1: 'AVAILABLE',
  PLACEMENT: 'NOT_AVAILABLE',
};

/** What the next stage can start with, taken from what is already known — so the form opens filled, not empty. */
function suggest(candidate: CandidateWithCompany, stage: RecruitmentStage, key: string): string {
  const cvSent = candidate.stageData?.CV_SENT ?? {};
  if (key === 'notes') {
    const order = RECRUITMENT_STAGES.map((s) => s.key);
    for (let i = order.indexOf(stage) - 1; i >= 0; i--) {
      const earlier = candidate.stageData?.[order[i]!]?.notes;
      if (earlier?.trim()) return earlier;
    }
    return '';
  }
  if (stage === 'CV_SENT' && key === 'job') return candidate.jobTitle ?? '';
  if (stage === 'CV_SENT' && key === 'sentOn') return new Date().toISOString().slice(0, 10);
  if (stage === 'PLACEMENT' && key === 'company') return cvSent.sentTo ?? '';
  if (stage === 'PLACEMENT' && key === 'job') return cvSent.job ?? candidate.jobTitle ?? '';
  return '';
}

/** Permanent or Temporary, decided in the Placement stage and shown with the candidate in every stage. */
const employmentOf = (candidate: CandidateWithCompany): 'Permanent' | 'Temporary' | null => {
  const type = candidate.stageData?.PLACEMENT?.employmentType;
  return type === 'Permanent' || type === 'Temporary' ? type : null;
};

const shortDate = (value?: string) => (value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '');

/** One line on the card about what the stage holds. */
function summary(candidate: CandidateWithCompany, stage: RecruitmentStage): string {
  const d = candidate.stageData?.[stage] ?? {};
  if (stage === 'CV_SENT') return [d.sentTo && `Sent to ${d.sentTo}`, d.sentOn && shortDate(d.sentOn)].filter(Boolean).join(' · ');
  if (stage === 'INTERVIEW_1') return [d.date && shortDate(d.date), d.interviewer, d.outcome].filter(Boolean).join(' · ');
  if (stage === 'PLACEMENT') return [d.company, d.employmentType, d.startDate && `from ${shortDate(d.startDate)}`, d.payPerHour && `${d.payPerHour}/h`].filter(Boolean).join(' · ');
  return [candidate.email, candidate.phone].filter(Boolean).join(' · ');
}

/** How many of the stage's data fields are filled, e.g. 5 of 7. */
function progress(candidate: CandidateWithCompany, stage: RecruitmentStage) {
  const keys = REQUIRED[stage];
  return { done: keys.filter((k) => valueOf(candidate, stage, k).trim() !== '').length, total: keys.length };
}

/**
 * The Stages view of /candidates: New → CV Sent → Interview → Placement. Each card is a candidate; clicking it
 * opens the form of its stage, where the missing data is filled in (the New stage edits the very same details the
 * table shows). Cards can also be dragged to the next stage.
 */
export function RecruitmentBoard({ filters }: { filters: ListCandidatesParams }) {
  const [openId, setOpenId] = useState<string | null>(null);
  // the stage whose form opens first: the one the card was just moved into
  const [openStage, setOpenStage] = useState<RecruitmentStage | undefined>(undefined);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<RecruitmentStage | null>(null);
  const save = useSaveCandidateStage();
  const queryClient = useQueryClient();

  const columns = RECRUITMENT_STAGES.map((stage) => ({
    stage,
    // eslint-disable-next-line react-hooks/rules-of-hooks -- a fixed list of four stages, always rendered in this order
    query: useCandidates({ ...filters, page: 1, pageSize: 100, recruitmentStage: stage.key }),
  }));
  const open = columns.flatMap((c) => c.query.data?.items ?? []).find((c) => c.id === openId) ?? null;

  /**
   * Moves a card at once: the lists on the screen are changed first (the card is already in its new column), the
   * save runs behind it, and the lists are put back only if the save fails.
   */
  function move(id: string, stage: RecruitmentStage) {
    const card = columns.flatMap((c) => c.query.data?.items ?? []).find((c) => c.id === id);
    if (!card || stageOf(card) === stage) return;
    // Placement makes the candidate Not available; leaving it makes a placed one Available again (the API does the same)
    const status = stage === 'PLACEMENT' && card.status !== 'DO_NOT_CONTACT' ? 'PLACED' : stageOf(card) === 'PLACEMENT' && card.status === 'PLACED' ? 'ACTIVE' : card.status;
    const moved = { ...card, recruitmentStage: stage, status };
    const lists = queryClient.getQueriesData<{ items: CandidateWithCompany[]; totalItems: number }>({ queryKey: ['candidates', 'list'] });
    const before = lists.map(([key, data]) => [key, data] as const);
    for (const [key, data] of lists) {
      const target = (key[2] as ListCandidatesParams | undefined)?.recruitmentStage;
      if (!data?.items || !target) continue;
      const had = data.items.some((c) => c.id === id);
      if (target === stage && !had) {
        queryClient.setQueryData(key, { ...data, items: [moved, ...data.items], totalItems: data.totalItems + 1 });
      } else if (target !== stage && had) {
        queryClient.setQueryData(key, { ...data, items: data.items.filter((c) => c.id !== id), totalItems: Math.max(0, data.totalItems - 1) });
      }
    }
    save.mutate(
      { id, input: { recruitmentStage: stage } },
      { onError: () => before.forEach(([key, data]) => queryClient.setQueryData(key, data)) },
    );
    // moved forward with the stage's data missing: its form opens at once, so the data is filled in right there
    const order = RECRUITMENT_STAGES.map((s) => s.key);
    const p = progress(moved as CandidateWithCompany, stage);
    if (order.indexOf(stage) > order.indexOf(stageOf(card)) && p.done < p.total) {
      setOpenStage(stage);
      setOpenId(id);
    }
  }

  /** A move asked for by a button or a drop: a card marked Do not use is only moved forward after a confirmation. */
  async function request(id: string, stage: RecruitmentStage) {
    const card = columns.flatMap((c) => c.query.data?.items ?? []).find((c) => c.id === id);
    if (!card) return;
    const order = RECRUITMENT_STAGES.map((s) => s.key);
    if (availabilityOf(card) === 'DO_NOT_USE' && order.indexOf(stage) > order.indexOf(stageOf(card))) {
      const name = `${card.firstName} ${card.lastName}`.trim();
      if (!(await confirmDialog(`${name} is marked Do not use. Move them to ${RECRUITMENT_STAGES[order.indexOf(stage)]!.label} anyway?`))) return;
    }
    move(id, stage);
  }

  function drop(stage: RecruitmentStage) {
    setOverStage(null);
    const id = dragId;
    setDragId(null);
    if (id) void request(id, stage);
  }

  return (
    <>
      <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
        <div className="grid min-w-[880px] grid-cols-4 gap-4">
          {columns.map(({ stage, query }, stageIndex) => {
            const cards = query.data?.items ?? [];
            const fill = fillForTone(stage.tone);
            return (
              <div
                key={stage.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverStage(stage.key);
                }}
                onDragLeave={() => setOverStage((current) => (current === stage.key ? null : current))}
                onDrop={() => drop(stage.key)}
                className={cn(
                  'flex flex-col overflow-hidden rounded-lg border shadow-sm',
                  fill.box,
                  overStage === stage.key && 'ring-2 ring-primary/40',
                )}
              >
                <div className={cn('h-1.5 w-full', fill.bar)} />
                <div className={cn('border-b px-3 py-2', fill.header)}>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">{stage.label}</h3>
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', fill.chip)}>{query.data?.totalItems ?? 0}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-foreground/50">{stage.hint}</p>
                  <span className={cn('mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium', AVAILABILITY[STAGE_AVAILABILITY[stage.key]].badge)}>
                    {AVAILABILITY[STAGE_AVAILABILITY[stage.key]].label}
                  </span>
                </div>
                <div className="flex max-h-[65vh] flex-col gap-2 overflow-y-auto p-2">
                  {query.isLoading ? (
                    <p className="px-2 py-6 text-center text-xs text-foreground/40">Loading…</p>
                  ) : cards.length === 0 ? (
                    <p className="px-2 py-6 text-center text-xs text-foreground/40">No candidates here</p>
                  ) : (
                    cards.map((candidate) => {
                      const p = progress(candidate, stage.key);
                      const complete = p.done === p.total;
                      return (
                        <div
                          key={candidate.id}
                          draggable
                          onDragStart={() => setDragId(candidate.id)}
                          onDragEnd={() => {
                            setDragId(null);
                            setOverStage(null);
                          }}
                          onClick={() => {
                            setOpenStage(undefined);
                            setOpenId(candidate.id);
                          }}
                          className={cn('cursor-pointer rounded-md border border-l-4 border-border bg-background p-2.5 shadow-sm transition hover:shadow-md', fill.edge)}
                        >
                          <div className="flex items-start gap-1.5">
                            <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/30" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1.5">
                                <p className="truncate text-sm font-medium">
                                  {candidate.firstName} {candidate.lastName}
                                </p>
                                {employmentOf(candidate) ? (
                                  <span className="shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-800">{employmentOf(candidate)}</span>
                                ) : null}
                                <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium', AVAILABILITY[availabilityOf(candidate)].badge)}>
                                  {AVAILABILITY[availabilityOf(candidate)].label}
                                </span>
                              </div>
                              <p className="truncate text-xs text-foreground/60">
                                {[candidate.jobTitle, candidate.location].filter(Boolean).join(' · ') || 'No job title yet'}
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                            <span className={cn('inline-flex items-center gap-1', complete ? 'text-green-700' : 'text-amber-700')}>
                              {complete ? <Check className="h-3 w-3" /> : null}
                              {p.done}/{p.total} filled
                            </span>
                          </div>
                          {summary(candidate, stage.key) ? (
                            <p className="mt-1 truncate text-xs text-foreground/60">{summary(candidate, stage.key)}</p>
                          ) : null}
                          {stage.key === 'INTERVIEW_1' ? (
                            <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 w-full text-xs"
                                onClick={() => {
                                  setOpenStage('INTERVIEW_1');
                                  setOpenId(candidate.id);
                                }}
                              >
                                <Video className="mr-1 h-3.5 w-3.5" /> Create Zoom link
                              </Button>
                            </div>
                          ) : null}
                          <div className="mt-2 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {RECRUITMENT_STAGES[stageIndex - 1] ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 flex-1 px-1.5 text-xs"
                                title={`Move back to ${RECRUITMENT_STAGES[stageIndex - 1]!.label}`}
                                onClick={() => void request(candidate.id, RECRUITMENT_STAGES[stageIndex - 1]!.key)}
                              >
                                <ChevronLeft className="mr-0.5 h-3.5 w-3.5" />
                                {RECRUITMENT_STAGES[stageIndex - 1]!.label}
                              </Button>
                            ) : null}
                            {RECRUITMENT_STAGES[stageIndex + 1] ? (
                              <Button
                                type="button"
                                size="sm"
                                className={cn('h-7 flex-1 px-1.5 text-xs', fillForTone(RECRUITMENT_STAGES[stageIndex + 1]!.tone).button)}
                                title={`Move to ${RECRUITMENT_STAGES[stageIndex + 1]!.label}`}
                                onClick={() => void request(candidate.id, RECRUITMENT_STAGES[stageIndex + 1]!.key)}
                              >
                                {RECRUITMENT_STAGES[stageIndex + 1]!.label}
                                <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {save.isError ? (
        <p role="alert" className="text-sm text-red-600">
          {save.error instanceof Error ? save.error.message : 'Could not move the candidate.'}
        </p>
      ) : null}
      {open ? <CandidateStageDialog key={`${open.id}:${openStage ?? ''}`} candidate={open} initialStage={openStage} onClose={() => setOpenId(null)} /> : null}
    </>
  );
}

function CandidateStageDialog({ candidate, initialStage, onClose }: { candidate: CandidateWithCompany; initialStage?: RecruitmentStage; onClose: () => void }) {
  const current = stageOf(candidate);
  const [viewing, setViewing] = useState<RecruitmentStage>(initialStage ?? current);
  const [availability, setAvailability] = useState<Availability>(availabilityOf(candidate));
  // what is typed in the form of each stage, over what is already saved
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const save = useSaveCandidateStage();

  const fields = viewing === 'NEW' ? [...BASE_FIELDS, ...STAGE_FIELDS.NEW] : STAGE_FIELDS[viewing];
  const get = (key: string) => draft[`${viewing}.${key}`] ?? (valueOf(candidate, viewing, key) || suggest(candidate, viewing, key));
  const index = RECRUITMENT_STAGES.findIndex((s) => s.key === viewing);
  const next = RECRUITMENT_STAGES[index + 1];

  function buildInput(moveTo?: RecruitmentStage): SaveCandidateStageInput {
    const input: SaveCandidateStageInput = {};
    const stageFields: Record<string, string> = {};
    for (const field of fields) {
      const value = get(field.key);
      if (viewing === 'NEW' && BASE_FIELDS.some((f) => f.key === field.key)) {
        // the candidate's own columns (what the table shows); empty values are left as they are
        if (value.trim() !== valueOf(candidate, viewing, field.key).trim() && value.trim() !== '') {
          if (field.key === 'name') {
            // "Ana Maria Kelmendi": the first word is the first name, the rest the last name
            const [first = '', ...rest] = value.trim().split(/\s+/);
            input.firstName = first;
            input.lastName = rest.join(' ');
          } else {
            (input as Record<string, string>)[field.key] = value.trim();
          }
        }
      } else if (value !== valueOf(candidate, viewing, field.key)) {
        stageFields[field.key] = value;
      }
    }
    if (Object.keys(stageFields).length > 0) input.stageData = { [viewing]: stageFields };
    if (moveTo) input.recruitmentStage = moveTo;
    if (availability !== availabilityOf(candidate)) input.status = AVAILABILITY[availability].status;
    return input;
  }

  async function submit(moveTo?: RecruitmentStage) {
    setError(null);
    try {
      await save.mutateAsync({ id: candidate.id, input: buildInput(moveTo) });
      if (moveTo) setViewing(moveTo);
      setDraft({});
      if (!moveTo) onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`${candidate.firstName} ${candidate.lastName}`}
      className="max-h-[92vh] max-w-2xl overflow-y-auto"
      footer={
        <div className="flex flex-col gap-2">
          {error ? (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="flex-1" disabled={save.isPending} onClick={() => void submit()}>
              Save
            </Button>
            {next ? (
              <Button type="button" variant="outline" className="flex-1" disabled={save.isPending} onClick={() => void submit(next.key)}>
                Save and move to {next.label}
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className={cn('-mt-1 h-1.5 w-full rounded-full', TONES[RECRUITMENT_STAGES[index]?.tone ?? 'navy'].solid)} />
        <div className="flex flex-wrap gap-1.5">
          {RECRUITMENT_STAGES.map((stage) => {
            const p = progress(candidate, stage.key);
            return (
              <Button
                key={stage.key}
                type="button"
                size="sm"
                variant="outline"
                className={viewing === stage.key ? fillForTone(stage.tone).button : undefined}
                onClick={() => setViewing(stage.key)}
              >
                {stage.label}
                <span className="ml-1.5 text-xs opacity-70">
                  {p.done}/{p.total}
                </span>
                {stage.key === current ? <span className="ml-1.5 text-xs">●</span> : null}
              </Button>
            );
          })}
        </div>
        {employmentOf(candidate) && viewing !== 'PLACEMENT' ? (
          <p className="text-xs text-foreground/60">
            Employment: <span className="font-medium text-foreground">{employmentOf(candidate)}</span> — set in the Placement stage.
          </p>
        ) : null}
        <div className="flex items-center gap-3">
          <Label htmlFor="stage-availability" className="shrink-0">
            Availability
          </Label>
          <Select id="stage-availability" className="max-w-48" value={availability} onChange={(e) => setAvailability(e.target.value as Availability)}>
            {(Object.keys(AVAILABILITY) as Availability[]).filter((a) => !(current === 'PLACEMENT' && a === 'AVAILABLE')).map((a) => (
              <option key={a} value={a}>
                {AVAILABILITY[a].label}
              </option>
            ))}
          </Select>
        </div>
        <p className="text-xs text-foreground/50">
          {viewing === 'NEW'
            ? 'These are the details shown in the Candidates table — filling them here updates the table.'
            : viewing === 'PLACEMENT'
              ? 'When this is saved the candidate becomes Not available, and the company and job are written to the Candidates table.'
            : RECRUITMENT_STAGES[index]?.hint}
          {candidate.stageData?.[viewing]?.enteredAt
            ? ` · In this stage since ${new Date(candidate.stageData[viewing]!.enteredAt!).toLocaleDateString()}`
            : ''}
        </p>
        {/* in every stage: where the candidate is on the map, against any other place typed in, with the distance between them */}
        <LocationMap
          storageKey={`recruitment-${candidate.id}`}
          from={{ label: 'Other place', query: candidate.interestedJob?.location }}
          to={{ label: 'Candidate', query: [candidate.location, candidate.postalCode].filter(Boolean).join(', ') }}
        />
        {viewing === 'CV_SENT' ? (
          <div className="rounded-md border border-border p-3">
            <p className="mb-2 flex items-center gap-2 text-sm font-medium">
              <FileText className="h-4 w-4 text-foreground/50" /> CV
            </p>
            <CandidateCv candidateId={candidate.id} />
          </div>
        ) : null}
        {viewing === 'INTERVIEW_1' ? <CandidateZoom candidate={candidate} /> : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fields.map((field) => {
            const id = `stage-${viewing}-${field.key}`;
            const value = get(field.key);
            const set = (v: string) => setDraft((d) => ({ ...d, [`${viewing}.${field.key}`]: v }));
            return (
              <div key={field.key} className={cn('flex flex-col gap-1.5', field.type === 'textarea' && 'sm:col-span-2')}>
                <Label htmlFor={id}>{field.label}</Label>
                {field.type === 'textarea' ? (
                  <textarea
                    id={id}
                    rows={3}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={value}
                    onChange={(e) => set(e.target.value)}
                  />
                ) : field.type === 'select' ? (
                  <Select id={id} value={value} onChange={(e) => set(e.target.value)}>
                    <option value="">—</option>
                    {field.options?.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input id={id} type={field.type ?? 'text'} value={value} onChange={(e) => set(e.target.value)} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Dialog>
  );
}
