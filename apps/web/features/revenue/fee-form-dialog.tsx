'use client';

import { Button, Dialog, Input, Label, Select, SearchSelect } from '@crm/ui';
import { Users } from '@crm/ui/icons';
import { useState, type FormEvent } from 'react';

import { AllocationDialog } from '@/features/commission/allocation-dialog';
import { useAllocation, useResourcers } from '@/hooks/use-commissions';
import { usePlacements } from '@/hooks/use-placements';
import { useSession } from '@/hooks/use-session';
import { ApiClientError } from '@/lib/api-client';
import type { Fee, FeeInput, FeeStatus, FeeSuggestion } from '@/services/fees.service';

import { convertText, fxNote, useFxRates } from '@/lib/fx';

import { CURRENCIES, dateInputValue, formatMoney } from './money';

/** The invoice of a permanent placement: Draft → Sent → Paid (Overdue is worked out from the due date). */
export const FEE_STATUS_LABEL: Record<FeeStatus, string> = {
  PENDING: 'Draft',
  INVOICED: 'Sent',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled',
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * The record of one permanent placement: the terms agreed with the client (a percentage of the annual salary, or a
 * fixed fee — chosen per placement), the total client fee (always worked out), the invoice, and who is responsible for
 * the placement with the commission each would earn. One placement, one record: a vacancy with several hires has several.
 */
export function FeeFormDialog({
  fee,
  suggestion,
  defaults,
  onSubmit,
  onClose,
}: {
  fee?: Fee;
  suggestion?: FeeSuggestion;
  defaults: { currency: string; paymentTermDays: number };
  onSubmit: (input: FeeInput) => Promise<unknown>;
  onClose: () => void;
}) {
  const { data: placements } = usePlacements({ page: 1, pageSize: 100, employmentType: 'PERMANENT' });
  const { data: session } = useSession();
  const canAllocate = Boolean(session?.permissions?.includes('commission:manage'));
  const [placementId, setPlacementId] = useState(fee?.placementId ?? suggestion?.placementId ?? '');
  const [feeType, setFeeType] = useState<'PERCENTAGE' | 'FIXED'>(fee?.feeType ?? 'PERCENTAGE');
  const [salary, setSalary] = useState(fee?.annualSalary != null ? String(fee.annualSalary) : '');
  const [percent, setPercent] = useState(fee?.feePercent != null ? String(fee.feePercent) : '');
  const [fixed, setFixed] = useState(fee?.fixedFee != null ? String(fee.fixedFee) : '');
  const [legacyAmount, setLegacyAmount] = useState(fee && !fee.feeType ? String(fee.amount) : '');
  const [currency, setCurrency] = useState(fee?.currency ?? defaults.currency);
  // the currency the typed amounts were last in: changing the currency converts them at the market rate
  const [previousCurrency, setPreviousCurrency] = useState(currency);
  const { data: fx } = useFxRates();
  function changeCurrency(next: string) {
    setSalary((v) => convertText(v, currency, next, fx));
    setFixed((v) => convertText(v, currency, next, fx));
    setLegacyAmount((v) => convertText(v, currency, next, fx));
    setPreviousCurrency(currency);
    setCurrency(next);
  }
  const [placementDate, setPlacementDate] = useState(fee?.placementDate?.slice(0, 10) ?? dateInputValue(0));
  const [invoiceNumber, setInvoiceNumber] = useState(fee?.invoiceNumber ?? '');
  const [invoiceDate, setInvoiceDate] = useState(fee?.invoiceDate?.slice(0, 10) ?? '');
  const [dueDate, setDueDate] = useState(fee ? (fee.dueDate?.slice(0, 10) ?? '') : dateInputValue(defaults.paymentTermDays));
  // the due date follows the invoice date (+ the payment terms) until it is typed by hand
  const [dueTouched, setDueTouched] = useState(Boolean(fee?.dueDate));
  function changeInvoiceDate(value: string) {
    setInvoiceDate(value);
    if (!dueTouched && value) {
      const date = new Date(`${value}T00:00:00`);
      date.setDate(date.getDate() + defaults.paymentTermDays);
      setDueDate(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
    }
  }
  // "Overdue" is worked out from the due date, it is never chosen
  const [status, setStatus] = useState<FeeStatus>(fee && fee.status !== 'OVERDUE' ? fee.status : fee ? 'INVOICED' : 'PENDING');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [allocating, setAllocating] = useState(false);
  const { data: allocation } = useAllocation(placementId || null);
  const { data: people } = useResourcers();

  const legacy = Boolean(fee && !fee.feeType);
  const salaryN = Number(salary);
  const percentN = Number(percent);
  const fixedN = Number(fixed);
  const total =
    legacy && !percent && !fixed
      ? Number(legacyAmount)
      : feeType === 'PERCENTAGE'
        ? salary !== '' && percent !== '' && !Number.isNaN(salaryN) && !Number.isNaN(percentN)
          ? round2((salaryN * percentN) / 100)
          : NaN
        : fixed !== '' && !Number.isNaN(fixedN)
          ? round2(fixedN)
          : NaN;
  const currencies = CURRENCIES.includes(currency as (typeof CURRENCIES)[number]) ? CURRENCIES : [...CURRENCIES, currency];
  const known = fee?.placement ?? suggestion;
  const shares = (allocation?.resourcers ?? []).map((r, i, all) => {
    const part = i === all.length - 1 ? round2(total - all.slice(0, i).reduce((t, x) => t + round2((total * x.splitPercent) / 100), 0)) : round2((total * r.splitPercent) / 100);
    const rate = people?.resourcers.find((p) => p.userId === r.userId)?.commissionRate ?? r.commissionRate;
    return { name: r.name, split: r.splitPercent, rate, part: Number.isNaN(part) ? 0 : part, commission: Number.isNaN(part) ? 0 : round2((part * rate) / 100) };
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!placementId) return setError('Choose the permanent placement this fee is for.');
    if (Number.isNaN(total) || total < 0) return setError(feeType === 'PERCENTAGE' ? 'Enter the annual salary and the agreed percentage.' : 'Enter the agreed fixed fee.');
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        placementId,
        ...(legacy && !percent && !fixed ? { amount: total } : { feeType, annualSalary: salary === '' ? undefined : salaryN, ...(feeType === 'PERCENTAGE' ? { feePercent: percentN } : { fixedFee: fixedN }) }),
        currency,
        status,
        dueDate: dueDate || null,
        placementDate,
        invoiceNumber: invoiceNumber.trim() || undefined,
        invoiceDate: invoiceDate || undefined,
      });
      onClose();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'The fee was not saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => !open && onClose()}
        title={fee ? 'Permanent placement fee' : 'Add a permanent placement fee'}
        description={known ? `${known.candidate.firstName} ${known.candidate.lastName} · ${known.job.title} · ${known.company.name}` : 'The terms agreed with the client, the invoice and who is responsible.'}
        className="max-w-2xl"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="fee-form" disabled={saving} data-testid="fee-save">
              {saving ? 'Saving…' : fee ? 'Save changes' : 'Create fee'}
            </Button>
          </>
        }
      >
        <form id="fee-form" className="flex flex-col gap-4" onSubmit={submit}>
          {!known ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fee-placement">Placement</Label>
              <SearchSelect id="fee-placement" value={placementId} onChange={(event) => setPlacementId(event.target.value)} searchPlaceholder="Search the candidate, job or client…" data-testid="fee-placement">
                <option value="">Choose the permanent placement…</option>
                {(placements?.items ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.candidate.firstName} {p.candidate.lastName} — {p.job.title} · {p.company.name}
                  </option>
                ))}
              </SearchSelect>
            </div>
          ) : null}

          <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-3">
            <legend className="px-1 text-sm font-semibold">1 · What was agreed with the client</legend>
            <div className="inline-flex self-start rounded-lg border border-border p-0.5" role="group" aria-label="Fee type">
              {(
                [
                  ['PERCENTAGE', 'Percentage of salary'],
                  ['FIXED', 'Fixed fee'],
                ] as const
              ).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={feeType === value} onClick={() => setFeeType(value)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${feeType === value ? 'bg-primary text-primary-foreground' : 'text-foreground/70 hover:bg-accent'}`} data-testid={`fee-type-${value.toLowerCase()}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fee-salary">Annual salary of the person</Label>
                <Input id="fee-salary" type="number" min={0} step={0.01} value={salary} onChange={(event) => setSalary(event.target.value)} data-testid="fee-salary" />
              </div>
              {feeType === 'PERCENTAGE' ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fee-percent">Agreed fee (%)</Label>
                  <Input id="fee-percent" type="number" min={0} max={100} step={0.01} value={percent} onChange={(event) => setPercent(event.target.value)} data-testid="fee-percent" />
                  <div className="flex gap-1">
                    {[10, 15, 20, 25].map((value) => (
                      <button key={value} type="button" onClick={() => setPercent(String(value))} className={`rounded-full border px-2 py-0.5 text-xs font-medium ${Number(percent) === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-accent'}`}>
                        {value}%
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fee-fixed">Agreed fixed fee</Label>
                  <Input id="fee-fixed" type="number" min={0} step={0.01} value={fixed} onChange={(event) => setFixed(event.target.value)} data-testid="fee-fixed" />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fee-currency">Currency</Label>
                <Select id="fee-currency" value={currency} onChange={(event) => changeCurrency(event.target.value)}>
                  {currencies.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            {fxNote(previousCurrency, currency, fx) ? <p className="text-xs text-foreground/60" data-testid="fx-note">{fxNote(previousCurrency, currency, fx)}</p> : null}
            <p className="rounded-md bg-accent/40 px-3 py-2 text-sm" data-testid="fee-total" aria-live="polite">
              What the client pays: <strong>{Number.isNaN(total) ? '—' : formatMoney(total, currency)}</strong>
              <span className="text-foreground/60">{feeType === 'PERCENTAGE' ? ` = ${salary || '…'} × ${percent || '…'}%` : ' (fixed, whatever the salary is)'}</span>
            </p>
          </fieldset>

          <fieldset className="grid grid-cols-1 gap-3 rounded-lg border border-border p-3 sm:grid-cols-3">
            <legend className="px-1 text-sm font-semibold">2 · The invoice</legend>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fee-placed">Placement date</Label>
              <Input id="fee-placed" type="date" value={placementDate} onChange={(event) => setPlacementDate(event.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fee-invno">Invoice number</Label>
              <Input id="fee-invno" value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} data-testid="fee-invoice-number" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fee-invdate">Invoice date</Label>
              <Input id="fee-invdate" type="date" value={invoiceDate} onChange={(event) => changeInvoiceDate(event.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fee-status">Where is the invoice?</Label>
              <Select id="fee-status" value={status} onChange={(event) => setStatus(event.target.value as FeeStatus)} data-testid="fee-status-select">
                <option value="PENDING">Draft — not sent to the client yet</option>
                <option value="INVOICED">Sent — waiting for payment</option>
                <option value="PAID">Paid</option>
                <option value="CANCELLED">Cancelled</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fee-due">Due date</Label>
              <Input id="fee-due" type="date" value={dueDate} onChange={(event) => { setDueTouched(true); setDueDate(event.target.value); }} />
              <p className="text-xs text-foreground/50">Set from the invoice date + {defaults.paymentTermDays} days, change it if the client agreed otherwise.</p>
            </div>
          </fieldset>

          {canAllocate && placementId ? (
            <fieldset className="rounded-lg border border-border p-3" data-testid="fee-resourcers">
              <legend className="px-1 text-sm font-semibold">3 · Who earns commission</legend>
              {shares.length === 0 ? (
                <p className="text-sm text-foreground/60">Nobody is responsible for this placement yet, so no commission is earned on it.</p>
              ) : (
                <ul className="mb-2 divide-y divide-border text-sm">
                  {shares.map((s) => (
                    <li key={s.name} className="flex items-center justify-between gap-3 py-1.5">
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-foreground/40" /> {s.name} <span className="text-xs text-foreground/55">{s.split}%</span>
                      </span>
                      <span className="tabular-nums text-foreground/75">
                        {formatMoney(s.part, currency)} × {s.rate}% = <strong className="text-foreground">{formatMoney(s.commission, currency)}</strong>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Button type="button" size="sm" variant="outline" onClick={() => setAllocating(true)} data-testid="fee-set-resourcers">
                <Users className="mr-1.5 h-4 w-4" /> {shares.length === 0 ? 'Choose resourcers' : 'Change resourcers or the split'}
              </Button>
            </fieldset>
          ) : null}

          {error ? (
            <p className="text-sm text-destructive" role="alert" data-testid="fee-error">
              {error}
            </p>
          ) : null}
        </form>
      </Dialog>
      {allocating && placementId ? <AllocationDialog placementId={placementId} onClose={() => setAllocating(false)} /> : null}
    </>
  );
}
