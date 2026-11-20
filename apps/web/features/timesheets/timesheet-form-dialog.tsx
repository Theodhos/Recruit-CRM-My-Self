'use client';

import { Button, Dialog, Input, Label, SearchSelect, Select, Textarea } from '@crm/ui';
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Paperclip, Search, UserRound, X } from '@crm/ui/icons';
import { useEffect, useMemo, useState } from 'react';

import { useCompanies } from '@/hooks/use-companies';
import { useUploadDocument } from '@/hooks/use-documents';
import { getWorkerProfile } from '@/services/timesheets.service';
import { useAmendTimesheet, useApproveTimesheet, useCreateTimesheet, useSaveWorkerProfile, useWorkers } from '@/hooks/use-timesheets';
import { ApiClientError } from '@/lib/api-client';
import type { RateType, TimesheetDetail, Worker } from '@/services/timesheets.service';

import { addDaysIso, dayLabel, mondayOfIso, money, previewPayroll, todayIso, unitLabel, weekDatesIso, weekLabel } from './shared';

const messageOf = (error: unknown, fallback: string) => (error instanceof ApiClientError ? error.message : error instanceof Error ? error.message : fallback);
const toNumber = (value: string) => (value.trim() === '' || Number.isNaN(Number(value)) ? NaN : Number(value));

interface Props {
  /** `amend` edits an existing timesheet (the worker, client and week stay as they are). */
  timesheet?: TimesheetDetail;
  initialWeek?: string;
  onClose: () => void;
  onSaved: (id: string, info?: { approveError?: string }) => void;
  /** Offer "approve straight away" (for someone who may approve payroll adding a worker by hand). */
  offerApprove?: boolean;
  /** Start with this worker chosen (a worker whose timesheet is pending). */
  prefillWorker?: Worker;
}

/**
 * Add a timesheet (or amend a rejected / pending one): who worked, for which client and week, the days or hours, the
 * rates, who at the client confirmed them and the signed sheet. The pay, CIS, fee, net, client charge and profit are
 * shown as you type; the server works out the real figures when it is saved.
 */
export function TimesheetFormDialog({ timesheet, initialWeek, onClose, onSaved, offerApprove, prefillWorker }: Props) {
  const amending = Boolean(timesheet);
  const create = useCreateTimesheet();
  const amend = useAmendTimesheet();
  const saveProfile = useSaveWorkerProfile();
  const approve = useApproveTimesheet();
  const [approveNow, setApproveNow] = useState(false);
  const upload = useUploadDocument();

  // ---- who and where
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  useEffect(() => {
    const t = window.setTimeout(() => setTerm(search.trim()), 250);
    return () => window.clearTimeout(t);
  }, [search]);
  const { data: workers, isFetching: searching } = useWorkers(term);
  const [worker, setWorker] = useState<Worker | null>(null);
  const [companyId, setCompanyId] = useState(timesheet?.companyId ?? '');
  const { data: companies } = useCompanies({ pageSize: 100 });
  const [weekStart, setWeekStart] = useState(timesheet ? timesheet.weekStart.slice(0, 10) : mondayOfIso(initialWeek ?? todayIso()));

  // ---- hours and money
  const [rateType, setRateType] = useState<RateType>(timesheet?.rateType ?? 'DAY');
  const [payRate, setPayRate] = useState(timesheet ? String(timesheet.payRate) : '');
  const [chargeRate, setChargeRate] = useState(timesheet ? String(timesheet.chargeRate) : '');
  const dates = useMemo(() => weekDatesIso(weekStart), [weekStart]);
  const [units, setUnits] = useState<Record<string, string>>(() => Object.fromEntries((timesheet?.days ?? []).map((d) => [d.date, String(d.units)])));

  // ---- worker payroll details (the CIS rate and the fee feed the calculation)
  const [showPayroll, setShowPayroll] = useState(false);
  const [nino, setNino] = useState('');
  const [utr, setUtr] = useState('');
  const [cisRate, setCisRate] = useState(timesheet ? String(timesheet.cisRate) : '20');
  const [payrollFee, setPayrollFee] = useState(timesheet ? String(timesheet.payrollFee) : '15');
  const [profileTouched, setProfileTouched] = useState(false);

  // ---- confirmation and file
  const [confirmedBy, setConfirmedBy] = useState(timesheet?.clientConfirmedBy ?? '');
  const [confirmedEmail, setConfirmedEmail] = useState(timesheet?.clientConfirmedEmail ?? '');
  const [notes, setNotes] = useState(timesheet?.notes ?? '');
  const [amendmentNote, setAmendmentNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function pickWorker(next: Worker) {
    setWorker(next);
    const p = next.profile;
    if (p) {
      setRateType(p.rateType);
      if (p.payRate !== null) setPayRate(String(p.payRate));
      if (p.chargeRate !== null) setChargeRate(String(p.chargeRate));
      setNino(p.nino ?? '');
      setUtr(p.utr ?? '');
      setCisRate(String(p.cisRate));
      setPayrollFee(String(p.payrollFee));
    }
    const placement = next.placements[0];
    if (placement) setCompanyId(placement.companyId);
  }

  // a worker given by the payroll screen: pick them (with their usual rates) as soon as the form opens
  useEffect(() => {
    if (!prefillWorker) return;
    let current = true;
    getWorkerProfile(prefillWorker.id)
      .then((profile) => current && pickWorker({ ...prefillWorker, profile }))
      .catch(() => current && pickWorker(prefillWorker));
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setDay = (date: string, value: string) => setUnits((current) => ({ ...current, [date]: value }));
  const days = dates.map((date) => ({ date, units: toNumber(units[date] ?? '') })).filter((d) => d.units > 0);
  const total = Math.round(days.reduce((sum, d) => sum + d.units, 0) * 100) / 100;
  const pay = toNumber(payRate);
  const charge = toNumber(chargeRate);
  const figures = !Number.isNaN(pay) && !Number.isNaN(charge) ? previewPayroll({ payRate: pay, chargeRate: charge, units: total, cisRate: toNumber(cisRate) || 0, payrollFee: toNumber(payrollFee) || 0 }) : null;

  function fillWorkingWeek() {
    setUnits(Object.fromEntries(dates.slice(0, 5).map((d) => [d, rateType === 'DAY' ? '1' : '8'])));
  }

  const candidateId = timesheet?.candidateId ?? worker?.id ?? '';
  const missing = !candidateId ? 'Choose the worker.' : !companyId ? 'Choose the client.' : total <= 0 ? `Enter the ${unitLabel(rateType)} worked.` : Number.isNaN(pay) || Number.isNaN(charge) ? 'Enter the pay rate and the charge rate.' : null;

  async function submit() {
    setError(null);
    if (missing) return setError(missing);
    setSaving(true);
    try {
      let attachmentDocumentId = timesheet?.attachment?.id;
      if (file) {
        try {
          attachmentDocumentId = (await upload.mutateAsync({ file, type: 'OTHER', candidateId, name: `Timesheet ${weekStart} - ${file.name}` })).id;
        } catch (e) {
          setError(`The signed timesheet could not be saved (${messageOf(e, 'upload failed')}). Remove the file to submit without it, or try again.`);
          return;
        }
      }
      if (profileTouched) {
        await saveProfile.mutateAsync({ candidateId, input: { nino: nino || null, utr: utr || null, cisRate: toNumber(cisRate) || 0, payrollFee: toNumber(payrollFee) || 0 } });
      }
      const dayList = days.map((d) => ({ date: d.date, units: d.units }));
      if (timesheet) {
        const saved = await amend.mutateAsync({
          id: timesheet.id,
          input: { rateType, payRate: pay, chargeRate: charge, days: dayList, clientConfirmedBy: confirmedBy, clientConfirmedEmail: confirmedEmail, notes, attachmentDocumentId, amendmentNote: amendmentNote || undefined },
        });
        onSaved(saved.id);
      } else {
        const placement = worker?.placements.find((p) => p.companyId === companyId);
        const saved = await create.mutateAsync({
          candidateId,
          companyId,
          placementId: placement?.id,
          jobId: placement?.jobId,
          weekStart,
          rateType,
          payRate: pay,
          chargeRate: charge,
          days: dayList,
          clientConfirmedBy: confirmedBy || undefined,
          clientConfirmedEmail: confirmedEmail || undefined,
          attachmentDocumentId,
          notes: notes || undefined,
        });
        let approveError: string | undefined;
        if (approveNow) {
          try {
            await approve.mutateAsync({ id: saved.id, note: 'Added by hand and approved straight away' });
          } catch (e) {
            approveError = messageOf(e, 'It could not be approved.');
          }
        }
        onSaved(saved.id, { approveError });
      }
    } catch (e) {
      setError(messageOf(e, 'The timesheet was not saved.'));
    } finally {
      setSaving(false);
    }
  }

  const wasRejected = timesheet?.status === 'REJECTED';
  const wasApproved = timesheet?.status === 'APPROVED';
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={amending ? (wasRejected ? 'Amend and resubmit timesheet' : wasApproved ? 'Correct an approved timesheet' : 'Amend timesheet') : 'Add timesheet'}
      description={amending ? `${timesheet!.candidateName} · ${timesheet!.company.name} · ${weekLabel(weekStart)}` : 'One worker, one client, one working week. Hours confirmed by the client.'}
      className="max-w-3xl"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={saving || (wasApproved && amendmentNote.trim().length < 3)} onClick={() => void submit()} data-testid="timesheet-save">
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {saving ? 'Saving…' : wasRejected ? 'Resubmit for approval' : amending ? 'Save changes' : 'Submit for approval'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {wasApproved ? (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200" role="status">
            This timesheet is approved. Saving recalculates the payroll and rewrites its payslip; the change and your reason go into the history.
          </p>
        ) : null}

        {wasRejected && timesheet?.rejectionReason ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="status">
            <span className="font-semibold">Rejected: </span>
            {timesheet.rejectionReason}
          </p>
        ) : null}

        {!amending ? (
          <section className="flex flex-col gap-3" aria-label="Worker and client">
            <h3 className="text-sm font-semibold">1. Worker and client</h3>
            {worker ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-accent/20 px-3 py-2">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <UserRound className="h-4 w-4 text-foreground/50" />
                  {worker.name}
                  {worker.placements.length > 0 ? <span className="text-xs font-normal text-foreground/55">· on {worker.placements.map((p) => p.companyName).join(', ')}</span> : null}
                </span>
                <button type="button" className="text-xs underline" onClick={() => setWorker(null)}>
                  Change
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
                  <Input className="pl-8" placeholder="Search a worker by name… (empty: people on a temporary placement)" value={search} onChange={(event) => setSearch(event.target.value)} autoFocus data-testid="worker-search" />
                </div>
                <ul className="max-h-44 overflow-y-auto rounded-lg border border-border divide-y divide-border" aria-busy={searching}>
                  {(workers ?? []).length === 0 ? (
                    <li className="px-3 py-3 text-sm text-foreground/55">{searching ? 'Searching…' : term ? 'Nobody found. Try another name.' : 'No one is on a temporary placement yet. Search by name to find anyone.'}</li>
                  ) : (
                    (workers ?? []).map((w) => (
                      <li key={w.id}>
                        <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent/40" onClick={() => pickWorker(w)} data-testid="worker-option">
                          <span className="font-medium">{w.name}</span>
                          <span className="text-xs text-foreground/55">{w.placements.length > 0 ? w.placements.map((p) => `${p.companyName} · ${p.jobTitle}`).join(', ') : 'no active placement'}</span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ts-client">Client</Label>
                <SearchSelect id="ts-client" value={companyId} onChange={(event) => setCompanyId(event.target.value)} searchPlaceholder="Search clients…" data-testid="timesheet-client">
                  <option value="">Choose the client…</option>
                  {(companies?.items ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </SearchSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ts-week">Working week</Label>
                <div className="flex items-center gap-1.5">
                  <Button type="button" variant="outline" size="sm" aria-label="Previous week" onClick={() => setWeekStart(addDaysIso(weekStart, -7))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Input id="ts-week" type="date" value={weekStart} onChange={(event) => event.target.value && setWeekStart(mondayOfIso(event.target.value))} data-testid="timesheet-week" />
                  <Button type="button" variant="outline" size="sm" aria-label="Next week" onClick={() => setWeekStart(addDaysIso(weekStart, 7))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <p className="flex items-center gap-1 text-xs text-foreground/55">
                  <CalendarDays className="h-3 w-3" /> Monday to Sunday: {weekLabel(weekStart)}
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="flex flex-col gap-3" aria-label="Days worked and rates">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{amending ? '1' : '2'}. Days or hours worked</h3>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-lg border border-border p-0.5" role="group" aria-label="Paid per">
                {(['DAY', 'HOUR'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setRateType(type)}
                    aria-pressed={rateType === type}
                    className={`rounded-md px-3 py-1 text-xs font-medium ${rateType === type ? 'bg-primary text-primary-foreground' : 'text-foreground/70 hover:bg-accent'}`}
                  >
                    Per {type === 'DAY' ? 'day' : 'hour'}
                  </button>
                ))}
              </div>
              <button type="button" className="text-xs underline" onClick={fillWorkingWeek}>
                Mon–Fri
              </button>
              <button type="button" className="text-xs underline" onClick={() => setUnits({})}>
                Clear
              </button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7" data-testid="timesheet-days">
            {dates.map((date) => (
              <div key={date} className={`flex flex-col gap-1 rounded-lg border p-2 ${['Sat', 'Sun'].includes(dayLabel(date).slice(0, 3)) ? 'border-border bg-accent/30' : 'border-border'}`}>
                <label htmlFor={`day-${date}`} className="text-xs font-medium text-foreground/70">
                  {dayLabel(date)}
                </label>
                {rateType === 'DAY' ? (
                  <Select id={`day-${date}`} value={units[date] ?? ''} onChange={(event) => setDay(date, event.target.value)}>
                    <option value="">—</option>
                    <option value="0.5">½</option>
                    <option value="1">1</option>
                  </Select>
                ) : (
                  <Input id={`day-${date}`} type="number" min={0} max={24} step={0.25} placeholder="0" value={units[date] ?? ''} onChange={(event) => setDay(date, event.target.value)} />
                )}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ts-pay">Worker pay rate (£ per {unitLabel(rateType, false)})</Label>
              <Input id="ts-pay" type="number" min={0} step={0.01} value={payRate} onChange={(event) => setPayRate(event.target.value)} data-testid="timesheet-pay-rate" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ts-charge">Client charge rate (£ per {unitLabel(rateType, false)})</Label>
              <Input id="ts-charge" type="number" min={0} step={0.01} value={chargeRate} onChange={(event) => setChargeRate(event.target.value)} data-testid="timesheet-charge-rate" />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-accent/20 p-3" data-testid="timesheet-preview" aria-live="polite">
            <p className="mb-2 text-xs font-medium text-foreground/60">
              Calculation · {total} {unitLabel(rateType)} · CIS {toNumber(cisRate) || 0}% · payroll fee {money(toNumber(payrollFee) || 0)}
            </p>
            {figures ? (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                {[
                  ['Gross pay', figures.gross],
                  ['CIS deduction', -figures.cisDeduction],
                  ['Payroll fee', -figures.payrollFee],
                  ['Net payment', figures.netPay],
                  ['Client charge', figures.chargeTotal],
                  ['Profit', figures.profit],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between gap-2">
                    <dt className="text-foreground/65">{label as string}</dt>
                    <dd className={`font-medium tabular-nums ${label === 'Profit' && (value as number) < 0 ? 'text-destructive' : ''} ${label === 'Net payment' || label === 'Profit' ? 'font-semibold' : ''}`}>{money(value as number)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-foreground/55">Enter both rates to see the pay, the client charge and the profit.</p>
            )}
          </div>

          <button type="button" className="self-start text-xs underline" onClick={() => setShowPayroll((now) => !now)} aria-expanded={showPayroll}>
            {showPayroll ? 'Hide' : 'Show'} payroll details of this worker (NINO, UTR, CIS rate, fee)
          </button>
          {showPayroll ? (
            <div className="grid grid-cols-1 gap-3 rounded-lg border border-border p-3 sm:grid-cols-4">
              {([
                ['NINO', nino, setNino, 'text'],
                ['UTR', utr, setUtr, 'text'],
                ['CIS deduction %', cisRate, setCisRate, 'number'],
                ['Payroll fee (£)', payrollFee, setPayrollFee, 'number'],
              ] as const).map(([label, value, set, type]) => (
                <div key={label} className="flex flex-col gap-1.5">
                  <Label>{label}</Label>
                  <Input
                    type={type}
                    step={type === 'number' ? 0.01 : undefined}
                    min={type === 'number' ? 0 : undefined}
                    value={value}
                    onChange={(event) => {
                      set(event.target.value);
                      setProfileTouched(true);
                    }}
                  />
                </div>
              ))}
              <p className="text-xs text-foreground/55 sm:col-span-4">CIS is 20% for a verified subcontractor, 30% unverified, 0% with gross payment status. Saved for this worker; the next timesheet starts with these.</p>
            </div>
          ) : null}
        </section>

        <section className="flex flex-col gap-3" aria-label="Client confirmation and file">
          <h3 className="text-sm font-semibold">{amending ? '2' : '3'}. Client confirmation</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ts-by">Who at the client confirmed the hours</Label>
              <Input id="ts-by" placeholder="Name" value={confirmedBy} onChange={(event) => setConfirmedBy(event.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ts-email">Their email (optional)</Label>
              <Input id="ts-email" type="email" value={confirmedEmail} onChange={(event) => setConfirmedEmail(event.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ts-file">Signed timesheet (PDF or image, optional)</Label>
            {file ? (
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-foreground/50" />
                  {file.name}
                </span>
                <button type="button" aria-label="Remove the file" onClick={() => setFile(null)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                {timesheet?.attachment ? (
                  <p className="flex items-center gap-2 text-xs text-foreground/60">
                    <Paperclip className="h-3.5 w-3.5" /> Already attached: {timesheet.attachment.name}. Choose a file to replace it.
                  </p>
                ) : null}
                <Input id="ts-file" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
              </>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ts-notes">Notes (optional)</Label>
            <Textarea id="ts-notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
          {amending ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ts-amend">{wasApproved ? 'Why are you changing an approved timesheet? (required, shown in the history)' : 'What did you change, and why? (shown in the history)'}</Label>
              <Input id="ts-amend" placeholder="e.g. Client corrected Friday to a half day" value={amendmentNote} onChange={(event) => setAmendmentNote(event.target.value)} />
            </div>
          ) : null}
        </section>

        {offerApprove && !amending ? (
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border px-3 py-2 text-sm">
            <input type="checkbox" className="mt-1" checked={approveNow} onChange={(event) => setApproveNow(event.target.checked)} data-testid="approve-now" />
            <span>
              <span className="font-medium">Approve straight away</span>
              <span className="block text-xs text-foreground/60">I have checked the hours and rates. The payslip is generated and the line is ready to authorise.</span>
            </span>
          </label>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" data-testid="timesheet-error">
            {error}
          </p>
        ) : missing ? (
          <p className="text-xs text-foreground/55">{missing}</p>
        ) : null}
      </div>
    </Dialog>
  );
}
