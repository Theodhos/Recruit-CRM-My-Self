'use client';

import {
  Button,
  Input,
  QuickField,
  Select,
  Textarea,
  quickFieldControlClass,
  quickFieldSelectClass,
  SearchSelect,
} from '@crm/ui';
import { createJobSchema, type CreateJobInput } from '@crm/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Briefcase,
  CalendarDays,
  Building2,
  DollarSign,
  Globe,
  FileText,
  Gift,
  MapPin,
  Tag,
  Users,
} from '@crm/ui/icons';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { JobTitlePicker } from './job-title-picker';
import { useJobTitles } from './job-titles';
import { ShiftDetailsFields } from './shift-details';

import { alertDialog } from '@/components/dialogs/confirm-dialog';
import { AddedByField } from '@/features/users';
import { useCompanies } from '@/hooks/use-companies';
import { CURRENCY_CODES, CURRENCY_LABEL, convertAmount, fxNote, useFxRates } from '@/lib/fx';

const STATUS_OPTIONS = [
  ['DRAFT', 'Draft'],
  ['OPEN', 'Published'],
  ['ON_HOLD', 'On hold'],
  ['CLOSED', 'Closed'],
  ['ARCHIVED', 'Archived'],
] as const;
const textareaClass =
  'min-h-[70px] rounded-none border-0 bg-transparent px-0 text-sm shadow-none placeholder:italic placeholder:text-foreground/40 focus-visible:ring-0';

export interface JobFormProps {
  defaultValues?: Partial<CreateJobInput>;
  onSubmit: (values: CreateJobInput) => Promise<void>;
  submitLabel: string;
  /** The type, people, dates of the form as they change — the calendar beside the form follows them. */
  onDraftChange?: (draft: JobDraft) => void;
  /** Days already set on the calendar: they count as the working days of the schedule. */
  calendarDays?: number;
}

export interface JobDraft {
  employmentType?: string;
  candidatesNeeded?: number;
  startDate?: string;
  endDate?: string;
  shiftCount?: number;
}

export function JobForm({ defaultValues, onSubmit, submitLabel, onDraftChange, calendarDays = 0 }: JobFormProps) {
  // Adding a job (no job loaded into the form yet) asks for Company, Job title, Description, Location, Employment type, Candidates needed and Added by
  const isAdd = !defaultValues?.title;
  const mark = (label: string) => (isAdd ? `${label} *` : label);
  const { data: companies } = useCompanies({ pageSize: 100 });
  const { data: jobTitles } = useJobTitles();
  // what the server said when it refused the save (e.g. this job is already in the system) — shown above Save
  const [saveError, setSaveError] = useState<string | null>(null);
  const submit = async (values: CreateJobInput) => {
    setSaveError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The job could not be saved.';
      setSaveError(message);
      if (/already in the system/i.test(message)) void alertDialog(message, { title: 'Already in the system' });
    }
  };
  const {
    register,
    handleSubmit,
    setError,
    watch,
    getValues,
    setValue,
    control,
    clearErrors,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<CreateJobInput>({
    // the shape check first, then — when adding — every required field that is still empty is marked "Required" in the same pass,
    // so each of them shows its red text under it (also the Description) and clears as soon as it is filled
    resolver: async (values, context, options) => {
      const checked = await zodResolver(createJobSchema)(values, context, options);
      if (!isAdd) return checked;
      const v = values as Partial<CreateJobInput>;
      const required: Record<string, { type: string; message: string }> = {};
      const need = (name: string, empty: boolean) => {
        if (empty) required[name] = { type: 'required', message: 'Required' };
      };
      need('companyId', !v.companyId);
      need('ownerId', !v.ownerId);
      need('title', !v.title?.trim());
      need('description', !v.description?.trim());
      need('location', !v.location?.trim());
      need('employmentType', !v.employmentType);
      need('candidatesNeeded', !v.candidatesNeeded);
      need('recruitStartDate', !v.recruitStartDate);
      need('recruitEndDate', !v.recruitEndDate);
      if (Object.keys(required).length === 0) return checked;
      return { values: {}, errors: { ...checked.errors, ...required } } as typeof checked;
    },
    // a new job is Published and on the company website from the start (the careers page shows it at once); both can be changed
    defaultValues: { currency: 'GBP', showSalary: true, ...(isAdd ? { status: 'OPEN' as const, publishedOnWebsite: true } : {}), ...defaultValues },
  });
  // choosing another currency for the salary converts the typed Min / Max at the market rate
  const { data: fx } = useFxRates();
  const salaryCurrency = useRef(defaultValues?.currency ?? 'GBP');
  const [fxMessage, setFxMessage] = useState<string | null>(null);
  const changeSalaryCurrency = (next: string) => {
    const previous = salaryCurrency.current;
    for (const name of ['salaryMin', 'salaryMax'] as const) {
      const typed = getValues(name);
      if (typed === undefined || typed === null || String(typed) === '' || Number.isNaN(Number(typed))) continue;
      const converted = convertAmount(Number(typed), previous, next, fx);
      if (converted !== null) setValue(name, converted as never, { shouldDirty: true });
    }
    setFxMessage(fxNote(previous, next, fx));
    salaryCurrency.current = next;
  };
  // after a refused Create, the first red field is brought into view
  useEffect(() => {
    if (submitCount > 0) document.querySelector('[data-field-error]')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [submitCount]);
  // a Temporary job is added with its schedule: dates, timezone, recurring type and the working days
  const isTemporary = watch('employmentType') === 'TEMPORARY';
  const draftType = watch('employmentType');
  const draftPeople = Number(watch('candidatesNeeded')) || undefined;
  const draftStart = watch('schedule.startDate');
  const draftEnd = watch('schedule.endDate');
  const draftShifts = watch('schedule.shiftCount');
  useEffect(() => {
    onDraftChange?.({ employmentType: draftType, candidatesNeeded: draftPeople, startDate: draftStart, endDate: draftEnd, shiftCount: draftShifts });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftType, draftPeople, draftStart, draftEnd, draftShifts]);

  /** Add Job: every required field that is empty goes red at once, whatever else is wrong. True when something is missing. */
  const markMissing = (values: Partial<CreateJobInput>) => {
    if (!isAdd) return false;
    const empty: [keyof CreateJobInput, string][] = [];
    if (!values.companyId) empty.push(['companyId', 'Required']);
    if (!values.ownerId) empty.push(['ownerId', 'Required']);
    if (!values.title?.trim()) empty.push(['title', 'Required']);
    if (!values.description?.trim()) empty.push(['description', 'Required']);
    if (!values.location?.trim()) empty.push(['location', 'Required']);
    if (!values.employmentType) empty.push(['employmentType', 'Required']);
    if (!values.candidatesNeeded) empty.push(['candidatesNeeded', 'Required']);
    if (!values.recruitStartDate) empty.push(['recruitStartDate', 'Required']);
    if (!values.recruitEndDate) empty.push(['recruitEndDate', 'Required']);
    for (const [name, message] of empty) setError(name, { message });
    return empty.length > 0;
  };

  return (
    <form
      className="flex flex-col"
      onSubmit={handleSubmit((values) => {
        if (markMissing(values)) return;
        if (!values.employmentType) {
          setError('employmentType', { message: 'Choose Permanent or Temporary' });
          return;
        }
        // every job says how many candidates it needs (Completed Jobs is decided by it)
        if (!values.candidatesNeeded) {
          setError('candidatesNeeded', { message: 'Enter how many candidates this job needs' });
          return;
        }
        if (values.recruitStartDate && values.recruitEndDate && values.recruitEndDate < values.recruitStartDate) {
          setError('recruitEndDate', { message: 'The end of the search cannot be before its start' });
          return;
        }
        if (values.employmentType === 'TEMPORARY') {
          const schedule = values.schedule ?? {};
          if (!schedule.startDate || !schedule.endDate) {
            setError('schedule.startDate', { message: 'Enter the start date and the end date' });
            return;
          }
          if (schedule.endDate < schedule.startDate) {
            setError('schedule.startDate', { message: 'The end date cannot be before the start date' });
            return;
          }
          if (!schedule.timezone) {
            setError('schedule.timezone', { message: 'Choose the timezone' });
            return;
          }
          if (!schedule.recurringType) {
            setError('schedule.recurringType', { message: 'Choose Weekly or Pattern' });
            return;
          }
          if (schedule.recurringType === 'PATTERN' && !schedule.patternDays) {
            setError('schedule.recurringType', { message: 'Enter how many days the pattern lasts' });
            return;
          }
          if (!schedule.workDays?.length && calendarDays === 0) {
            setError('schedule.workDays', { message: 'Tick the days each person works' });
            return;
          }
          return submit(values);
        }
        return submit(values);
      }, () => {
        markMissing(getValues());
      })}
      noValidate
    >
      <div className="flex flex-col">
        <QuickField icon={Building2} label={mark("Company")} htmlFor="companyId" error={errors.companyId?.message}>
          <SearchSelect id="companyId" className={quickFieldSelectClass} {...register('companyId')}>
            <option value="">{isAdd ? 'Choose a company' : 'No company (link later)'}</option>
            {companies?.items.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </SearchSelect>
        </QuickField>

        <QuickField icon={Briefcase} label={mark("Job title")} htmlFor="title" error={errors.title?.message}>
          <Controller control={control} name="title" render={({ field }) => <JobTitlePicker id="title" value={field.value} onChange={field.onChange} titles={(jobTitles ?? []).map((item) => item.name)} />} />
        </QuickField>

        <QuickField icon={FileText} label={mark("Job Description")} htmlFor="description" error={errors.description?.message}>
          <Textarea
            id="description"
            rows={5}
            placeholder="The role in plain words: what the work is, where, for whom"
            className={textareaClass}
            {...register('description')}
          />
        </QuickField>

        <QuickField icon={MapPin} label={mark("Location")} htmlFor="location" error={errors.location?.message}>
          <Input id="location" className={quickFieldControlClass} {...register('location')} />
        </QuickField>

        {/* Location, Street and Post code: the three places the distance filter looks at */}
        <QuickField icon={MapPin} label="Street (optional)" htmlFor="street">
          <Input id="street" className={quickFieldControlClass} {...register('street')} />
        </QuickField>
        <QuickField icon={MapPin} label="Post code (optional)" htmlFor="postcode">
          <Input id="postcode" className={quickFieldControlClass} {...register('postcode')} />
        </QuickField>

        {/* chosen by hand when the job is added: Permanent or Temporary, nothing else */}
        <QuickField icon={Tag} label={mark("Employment type")} htmlFor="employmentType" error={errors.employmentType ? 'Required' : undefined}>
          <Select id="employmentType" className={quickFieldSelectClass} {...register('employmentType')}>
            <option value="">Choose Permanent or Temporary</option>
            <option value="PERMANENT">Permanent</option>
            <option value="TEMPORARY">Temporary</option>
          </Select>
        </QuickField>

        <QuickField icon={Users} label="Candidates needed *" htmlFor="candidatesNeeded" error={errors.candidatesNeeded?.message}>
          <Input
            id="candidatesNeeded"
            type="number"
            min={1}
            max={1000}
            placeholder="How many people this job needs, e.g. 2, 5 or 6"
            className={quickFieldControlClass}
            {...register('candidatesNeeded')}
          />
        </QuickField>

        <QuickField icon={CalendarDays} label={mark("Find candidates between")} error={errors.recruitStartDate?.message ?? errors.recruitEndDate?.message}>
          <div className="flex items-center gap-2">
            <Input aria-label="Start finding candidates" type="date" className={quickFieldControlClass} {...register('recruitStartDate')} />
            <span className="text-foreground/30">–</span>
            <Input aria-label="Find candidates by" type="date" className={quickFieldControlClass} {...register('recruitEndDate')} />
          </div>
          <p className="mt-1 text-xs text-foreground/50">When the last day arrives and the job is still open, it moves to the top of the list and turns red.</p>
        </QuickField>

        {isTemporary ? (
          <>
            <Controller
              control={control}
              name="schedule"
              render={({ field }) => (
                <ShiftDetailsFields
                  applyDefaults={isAdd}
                  value={field.value}
                  onChange={(next) => {
                    field.onChange(next);
                    clearErrors('schedule');
                  }}
                  errors={{
                    dates: (errors.schedule as { startDate?: { message?: string } } | undefined)?.startDate?.message,
                    timezone: (errors.schedule as { timezone?: { message?: string } } | undefined)?.timezone?.message,
                    recurring: (errors.schedule as { recurringType?: { message?: string } } | undefined)?.recurringType?.message,
                    workDays: (errors.schedule as { workDays?: { message?: string } } | undefined)?.workDays?.message,
                  }}
                />
              )}
            />
          </>
        ) : null}

        <QuickField icon={DollarSign} label="Salary range">
          <div className="flex items-center gap-2">
            <Input
              aria-label="Salary min"
              type="number"
              placeholder="Min"
              className={quickFieldControlClass}
              {...register('salaryMin')}
            />
            <span className="text-foreground/30">–</span>
            <Input
              aria-label="Salary max"
              type="number"
              placeholder="Max"
              className={quickFieldControlClass}
              {...register('salaryMax')}
            />
            <Select
              aria-label="Currency"
              className={`${quickFieldSelectClass} w-32 shrink-0`}
              {...register('currency', { onChange: (event) => changeSalaryCurrency(event.target.value) })}
            >
              {(CURRENCY_CODES.includes((defaultValues?.currency ?? 'GBP') as (typeof CURRENCY_CODES)[number]) ? CURRENCY_CODES : [...CURRENCY_CODES, defaultValues?.currency ?? 'GBP']).map((code) => (
                <option key={code} value={code}>
                  {CURRENCY_LABEL[code] ?? code}
                </option>
              ))}
            </Select>
          </div>
          {fxMessage ? <p className="mt-1 text-xs text-foreground/60" data-testid="fx-note">{fxMessage}</p> : null}
        </QuickField>

        <QuickField
          icon={Gift}
          label="Pay package"
          htmlFor="compensationPackage"
          error={errors.compensationPackage?.message}
        >
          <Textarea
            id="compensationPackage"
            rows={3}
            placeholder="Bonus, benefits, allowances, paid leave — one per line"
            className={textareaClass}
            {...register('compensationPackage')}
          />
        </QuickField>

        <QuickField icon={Tag} label="Status" htmlFor="status">
          <Select id="status" className={quickFieldSelectClass} {...register('status')}>
            {STATUS_OPTIONS.map(([status, label]) => (
              <option key={status} value={status}>
                {label}
              </option>
            ))}
          </Select>
        </QuickField>

        <QuickField icon={Globe} label="Company website" htmlFor="publishedOnWebsite">
          <p className="text-sm text-foreground/70">Every job added here is shown on the careers website at once, Permanent and Temporary alike, until it is full, closed or its expiry date passes.</p>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" {...register('showSalary')} />
            Show the salary on the website
          </label>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="text-foreground/60">Expires on</span>
            <Input aria-label="Website expiry date" type="date" className={quickFieldControlClass} {...register('expiresAt')} />
          </div>
        </QuickField>
        <AddedByField registration={register('ownerId')} required={isAdd} error={errors.ownerId?.message} />
      </div>

      {saveError ? (
        <p className="mt-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert" data-testid="job-save-error">
          {saveError}
        </p>
      ) : null}

      <div className="sticky bottom-0 -mx-5 mt-2 flex items-center justify-end gap-2 border-t border-border bg-primary px-5 py-3">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-background text-foreground hover:bg-background/90"
        >
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
