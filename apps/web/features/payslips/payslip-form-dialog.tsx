'use client';

import { Button, Dialog, Input, Label, Select } from '@crm/ui';
import { useMemo, useState, type FormEvent } from 'react';

import { CURRENCIES, dateInputValue, formatMoney } from '@/features/revenue';
import { convertText, fxNote, useFxRates } from '@/lib/fx';
import { ApiClientError } from '@/lib/api-client';
import type { Payslip, PayslipInput, PayslipRateType } from '@/services/payslips.service';

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Monday and Sunday of the week that contains `date` (as date-input values). */
function weekOf(date: Date) {
  const day = (date.getDay() + 6) % 7;
  const toValue = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const start = new Date(date);
  start.setDate(date.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: toValue(start), end: toValue(end) };
}

/**
 * Add or edit a payslip. Gross, CIS deduction and net pay are shown as you type, worked out the same way the server
 * does it, so what you see is what is saved.
 */
export function PayslipFormDialog({ payslip, onSubmit, onClose }: { payslip?: Payslip; onSubmit: (input: PayslipInput) => Promise<unknown>; onClose: () => void }) {
  const lastWeek = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return weekOf(date);
  }, []);
  const [employeeName, setEmployeeName] = useState(payslip?.employeeName ?? '');
  const [nino, setNino] = useState(payslip?.nino ?? '');
  const [utr, setUtr] = useState(payslip?.utr ?? '');
  const [weekStart, setWeekStart] = useState(payslip?.weekStart.slice(0, 10) ?? lastWeek.start);
  const [weekEnd, setWeekEnd] = useState(payslip?.weekEnd.slice(0, 10) ?? lastWeek.end);
  const [paymentDate, setPaymentDate] = useState(payslip?.paymentDate.slice(0, 10) ?? dateInputValue());
  const [rateType, setRateType] = useState<PayslipRateType>(payslip?.rateType ?? 'DAY');
  const [rate, setRate] = useState(payslip ? String(payslip.rate) : '');
  const [quantity, setQuantity] = useState(payslip ? String(payslip.quantity) : '');
  const [cisRate, setCisRate] = useState(payslip ? String(payslip.cisRate) : '20');
  const [payrollFee, setPayrollFee] = useState(payslip ? String(payslip.payrollFee) : '15');
  const [currency, setCurrency] = useState(payslip?.currency ?? 'GBP');
  const [previousCurrency, setPreviousCurrency] = useState(currency);
  const { data: fx } = useFxRates();
  function changeCurrency(next: string) {
    setRate((v) => convertText(v, currency, next, fx));
    setPayrollFee((v) => convertText(v, currency, next, fx));
    setPreviousCurrency(currency);
    setCurrency(next);
  }
  const [notes, setNotes] = useState(payslip?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const amounts = useMemo(() => {
    const gross = round((Number(rate) || 0) * (Number(quantity) || 0));
    const cis = round((gross * (Number(cisRate) || 0)) / 100);
    const fee = Number(payrollFee) || 0;
    return { gross, cis, fee, net: round(gross - cis - fee) };
  }, [rate, quantity, cisRate, payrollFee]);
  const currencies = CURRENCIES.includes(currency as (typeof CURRENCIES)[number]) ? CURRENCIES : [...CURRENCIES, currency];
  const unit = rateType === 'DAY' ? 'days' : 'hours';

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!employeeName.trim()) return setError('Type the full name of the employee.');
    if (!weekStart || !weekEnd) return setError('Choose the week covered.');
    if (weekEnd < weekStart) return setError('The end of the week is before its start.');
    if (!paymentDate) return setError('Choose the date of payment.');
    if (rate.trim() === '' || Number.isNaN(Number(rate)) || Number(rate) < 0) return setError(`Type the rate per ${rateType === 'DAY' ? 'day' : 'hour'}.`);
    if (quantity.trim() === '' || Number.isNaN(Number(quantity)) || Number(quantity) < 0) return setError(`Type the number of ${unit} worked.`);
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        employeeName: employeeName.trim(),
        nino: nino.trim() || null,
        utr: utr.trim() || null,
        weekStart,
        weekEnd,
        paymentDate,
        rateType,
        rate: round(Number(rate)),
        quantity: round(Number(quantity)),
        cisRate: Number(cisRate) || 0,
        payrollFee: Number(payrollFee) || 0,
        currency,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not save the payslip.');
    } finally {
      setSaving(false);
    }
  }

  const money = (value: number) => formatMoney(value, currency);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={payslip ? 'Edit payslip' : 'New payslip'} description="The weekly CIS payslip of a worker." className="max-w-2xl">
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-5" data-testid="payslip-form">
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground/50">Employee details</legend>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payslip-name">Full name</Label>
            <Input id="payslip-name" value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payslip-nino">National Insurance Number (NINO)</Label>
              <Input id="payslip-nino" value={nino} onChange={(e) => setNino(e.target.value)} placeholder="QQ 12 34 56 C" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payslip-utr">Unique Taxpayer Reference (UTR)</Label>
              <Input id="payslip-utr" value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="1234567890" />
            </div>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground/50">Payment details</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payslip-week-start">Week from</Label>
              <Input id="payslip-week-start" type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payslip-week-end">Week to</Label>
              <Input id="payslip-week-end" type="date" value={weekEnd} onChange={(e) => setWeekEnd(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payslip-date">Date of payment</Label>
              <Input id="payslip-date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground/50">Pay</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payslip-rate-type">Paid by</Label>
              <Select id="payslip-rate-type" value={rateType} onChange={(e) => setRateType(e.target.value as PayslipRateType)}>
                <option value="DAY">Day rate</option>
                <option value="HOUR">Hour rate</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payslip-rate">Rate</Label>
              <Input id="payslip-rate" type="number" inputMode="decimal" min={0} step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payslip-quantity">Total {unit}</Label>
              <Input id="payslip-quantity" type="number" inputMode="decimal" min={0} step="0.25" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payslip-currency">Currency</Label>
              <Select id="payslip-currency" value={currency} onChange={(e) => changeCurrency(e.target.value)}>
                {currencies.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </Select>
              {fxNote(previousCurrency, currency, fx) ? <p className="text-xs text-foreground/60" data-testid="fx-note">{fxNote(previousCurrency, currency, fx)}</p> : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payslip-cis">CIS deduction (%)</Label>
              <Input id="payslip-cis" type="number" inputMode="decimal" min={0} max={100} step="0.01" value={cisRate} onChange={(e) => setCisRate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payslip-fee">Payroll fee</Label>
              <Input id="payslip-fee" type="number" inputMode="decimal" min={0} step="0.01" value={payrollFee} onChange={(e) => setPayrollFee(e.target.value)} />
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-border bg-accent/40 p-3 text-sm sm:grid-cols-4" data-testid="payslip-totals">
            <div>
              <dt className="text-xs text-foreground/50">Gross</dt>
              <dd className="font-semibold tabular-nums">{money(amounts.gross)}</dd>
            </div>
            <div>
              <dt className="text-xs text-foreground/50">CIS deduction</dt>
              <dd className="font-semibold tabular-nums text-destructive">−{money(amounts.cis)}</dd>
            </div>
            <div>
              <dt className="text-xs text-foreground/50">Payroll fee</dt>
              <dd className="font-semibold tabular-nums text-destructive">−{money(amounts.fee)}</dd>
            </div>
            <div>
              <dt className="text-xs text-foreground/50">Net pay</dt>
              <dd className="text-base font-bold tabular-nums text-emerald-700">{money(amounts.net)}</dd>
            </div>
          </dl>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="payslip-notes">Extra note (optional, printed under the standard notes)</Label>
          <Input id="payslip-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : payslip ? 'Save changes' : 'Create payslip'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
