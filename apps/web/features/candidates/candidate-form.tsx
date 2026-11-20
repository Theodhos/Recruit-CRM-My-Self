'use client';

import { Button, Input, quickFieldControlClass, quickFieldSelectClass, QuickField, SearchSelect } from '@crm/ui';
import { createCandidateSchema, type CreateCandidateInput } from '@crm/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Briefcase, Hammer, Loader2, Mail, MapPin, Phone, Tag, User } from '@crm/ui/icons';
import type { ChangeEvent, DragEvent, MutableRefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { alertDialog } from '@/components/dialogs/confirm-dialog';
import { AddedByField } from '@/features/users';
import { parseResume } from '@/services/candidates.service';

import { normalizeSource, SOURCE_OPTIONS } from './sources';
import { TradesInput } from './trades-input';
import { formatUkPhone, phoneProblem, typedUkPhone } from './uk-phone';

/** What a document can fill in: exactly the fields of this form. */
const RESUME_FIELDS = ['firstName', 'lastName', 'phone', 'email', 'location', 'jobTitle', 'trade'] as const;

export interface CandidateFormProps {
  defaultValues?: Partial<CreateCandidateInput>;
  /** `resume`: the file dropped into the form, to keep with the candidate as their CV. */
  onSubmit: (values: CreateCandidateInput, resume?: File) => Promise<void>;
  submitLabel: string;
  /** Add Candidate: filled with a function that saves whatever has been typed so far, for when the drawer is closed with the X. */
  saveOnCloseRef?: MutableRefObject<(() => Promise<void>) | null>;
}

/** Add Candidate: these must all be filled in, and a CV attached. */
const REQUIRED_FIELDS = [
  ['firstName', 'First name'],
  ['lastName', 'Last name'],
  ['phone', 'Phone'],
  ['location', 'Location'],
  ['source', 'Source'],
  ['trade', 'Trade'],
  ['jobTitle', 'Job title'],
] as const;

export function CandidateForm({ defaultValues, onSubmit, submitLabel, saveOnCloseRef }: CandidateFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<CreateCandidateInput>({
    resolver: zodResolver(createCandidateSchema),
    // candidates that came through the website form before the list was fixed carry the old name "Website"
    defaultValues: defaultValues ? { ...defaultValues, source: normalizeSource(defaultValues.source) ?? undefined } : defaultValues,
  });
  // a refusal (a value that is not valid, or the server saying no) is shown above Save instead of nothing happening
  const [formError, setFormError] = useState<string | null>(null);
  // Add Candidate (the form that saves on close) asks for everything; editing keeps the fields free
  const isAdd = Boolean(saveOnCloseRef);
  const [missing, setMissing] = useState<string[]>([]);
  const required = (name: string) => (missing.includes(name) ? 'Required' : undefined);
  const mark = (label: string) => (isAdd ? `${label} *` : label);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // after a refused Create, the first red field is brought into view
  useEffect(() => {
    if (submitCount > 0) document.querySelector('[data-field-error]')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [submitCount]);
  // kept even when scanning finds nothing: the file is still the candidate's CV
  const resumeFile = useRef<File | undefined>(undefined);

  if (saveOnCloseRef) {
    // closing with the X is cancelling: a candidate is only saved through Create candidate, with every required field and a CV
    saveOnCloseRef.current = async () => {};
  }
  const [isDragActive, setIsDragActive] = useState(false);
  const [resumeState, setResumeState] = useState<
    { status: 'idle' } | { status: 'scanning'; fileName: string } | { status: 'done'; fileName: string; filledCount: number } | { status: 'error'; message: string }
  >({ status: 'idle' });

  const isScanning = resumeState.status === 'scanning';

  async function handleResumeFile(file: File) {
    resumeFile.current = file;
    setResumeState({ status: 'scanning', fileName: file.name });
    try {
      const parsed = await parseResume(file);
      let filledCount = 0;
      for (const field of RESUME_FIELDS) {
        const value = parsed[field];
        if (value) {
          setValue(field, field === 'phone' ? formatUkPhone(value) : value, { shouldDirty: true, shouldValidate: true });
          filledCount += 1;
        }
      }
      setResumeState({ status: 'done', fileName: file.name, filledCount });
    } catch (error) {
      setResumeState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to read the document.',
      });
    }
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void handleResumeFile(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);
    if (isScanning) return;
    const file = event.dataTransfer.files?.[0];
    if (file) void handleResumeFile(file);
  }

  return (
    <form className="flex flex-col" onSubmit={handleSubmit(
        async (values) => {
          setFormError(null);
          if (isAdd) {
            const empty: string[] = REQUIRED_FIELDS.filter(([name]) => !String(values[name] ?? '').trim()).map(([name]) => name);
            if (!resumeFile.current) empty.push('cv');
            setMissing(empty);
            if (empty.length > 0) {
              const labels = empty.map((name) => (name === 'cv' ? 'CV' : REQUIRED_FIELDS.find(([key]) => key === name)![1]));
              setFormError(`Required: ${labels.join(', ')}`);
              return;
            }
          }
          const phoneError = phoneProblem(values.phone, true);
          if (phoneError) {
            setFormError(`Phone: ${phoneError}`);
            return;
          }
          try {
            await onSubmit(values, resumeFile.current);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not save the candidate.';
            setFormError(message);
            if (/already in the system/i.test(message)) void alertDialog(message, { title: 'Already in the system' });
            else if (/needs at least/i.test(message)) void alertDialog(message, { title: 'Nothing to save yet' });
          }
        },
        (invalid) => setFormError(`Please check: ${Object.entries(invalid).map(([name, issue]) => `${name}${issue?.message ? ' (' + String(issue.message) + ')' : ''}`).join(', ')}`),
      )}
      noValidate
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => !isScanning && fileInputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!isScanning) setIsDragActive(true);
        }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center gap-1 rounded-md border-2 border-dashed px-4 py-6 text-center transition-colors ${
          isDragActive ? 'border-primary bg-accent' : 'border-input'
        } ${isScanning ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileInputChange}
        />
        {isScanning ? (
          <Loader2 className="mb-1 h-5 w-5 animate-spin text-foreground/40" />
        ) : null}
        <p className="text-xs font-bold uppercase tracking-wide">Drag and drop a document here</p>
        <p className="text-xs text-foreground/60">or click to upload</p>
        <p className="mt-1 text-[11px] text-foreground/40">(Any document: PDF, Word, Excel, text… the fields below are filled from it)</p>
      </div>
      {resumeState.status === 'done' ? (
        <p className="mt-1.5 text-xs text-foreground/60">
          {resumeState.filledCount > 0
            ? `Filled ${resumeState.filledCount} field(s) from ${resumeState.fileName}. Review before saving.`
            : `Couldn't find recognizable fields in ${resumeState.fileName} — fill them in manually.`}
        </p>
      ) : null}
      {isAdd ? (
        <p className={`mt-1.5 text-xs ${missing.includes('cv') && !resumeFile.current ? 'font-medium text-destructive' : 'text-foreground/60'}`}>
          {resumeFile.current ? `CV attached: ${resumeFile.current.name}` : 'CV * — required: attach the candidate’s CV above.'}
        </p>
      ) : null}
      {resumeState.status === 'error' ? (
        <p className="mt-1.5 text-xs text-destructive">{resumeState.message}</p>
      ) : null}

      <div className="mt-2 flex flex-col">
        <QuickField icon={User} label={mark("First name")} htmlFor="firstName" error={errors.firstName?.message ?? required("firstName")}>
          <Input id="firstName" className={quickFieldControlClass} {...register('firstName')} />
        </QuickField>

        <QuickField icon={User} label={mark("Last name")} htmlFor="lastName" error={errors.lastName?.message ?? required("lastName")}>
          <Input id="lastName" className={quickFieldControlClass} {...register('lastName')} />
        </QuickField>

        <QuickField icon={Phone} label={mark("Phone")} htmlFor="phone" error={phoneProblem(watch('phone')) ?? required("phone")}>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            placeholder="07123 456789 — UK mobile, 11 digits, starts with 07 (no +44)"
            className={quickFieldControlClass}
            {...register('phone', { onChange: (event) => setValue('phone', typedUkPhone(event.target.value)) })}
          />
        </QuickField>

        <QuickField icon={Mail} label="Email (optional)" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="off" placeholder="name@example.com" className={quickFieldControlClass} {...register('email')} />
        </QuickField>

        <QuickField icon={MapPin} label={mark("Location")} htmlFor="location" error={required("location")}>
          <Input id="location" className={quickFieldControlClass} {...register('location')} />
        </QuickField>

        {/* Location, Street and Post code: the three places the distance filter looks at */}
        <QuickField icon={MapPin} label="Street (optional)" htmlFor="street">
          <Input id="street" className={quickFieldControlClass} {...register('street')} />
        </QuickField>
        <QuickField icon={MapPin} label="Post code (optional)" htmlFor="postalCode">
          <Input id="postalCode" className={quickFieldControlClass} {...register('postalCode')} />
        </QuickField>

        <QuickField icon={Briefcase} label={mark("Job title")} htmlFor="jobTitle" error={required("jobTitle")}>
          <Input id="jobTitle" className={quickFieldControlClass} {...register('jobTitle')} />
        </QuickField>

        <QuickField icon={Hammer} label={mark("Trades")} htmlFor="trade" error={required("trade")}>
          <input type="hidden" {...register('trade')} />
          <TradesInput id="trade" value={watch('trade')} onChange={(next) => setValue('trade', next, { shouldDirty: true })} />
        </QuickField>

        <QuickField icon={Tag} label={mark("Source")} htmlFor="source" error={required("source")}>
          <SearchSelect id="source" className={quickFieldSelectClass} {...register('source')}>
            <option value="">Where did they come from?</option>
            {SOURCE_OPTIONS.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </SearchSelect>
        </QuickField>

        <AddedByField registration={register('ownerId')} />
      </div>

      {formError ? <p className="mt-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert" data-testid="candidate-save-error">{formError}</p> : null}

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
