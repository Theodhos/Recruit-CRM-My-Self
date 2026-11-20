'use client';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@crm/ui';
import { CalendarDays, Pencil, Printer, Trash2, User } from '@crm/ui/icons';
import { useRef, type ReactNode } from 'react';

import { formatDate, formatMoney } from '@/features/revenue';
import type { Payslip } from '@/services/payslips.service';

import { PAYSLIP_COMPANY, PAYSLIP_NOTES, PayslipDocument, printPayslip } from './payslip-document';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-foreground/50">{label}</dt>
      <dd className="text-sm font-medium">{children || <span className="text-foreground/40">—</span>}</dd>
    </div>
  );
}

function Line({ label, hint, value, tone }: { label: string; hint?: string; value: string; tone?: 'minus' }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint ? <p className="text-xs text-foreground/50">{hint}</p> : null}
      </div>
      <p className={`text-sm font-semibold tabular-nums ${tone === 'minus' ? 'text-destructive' : ''}`}>{value}</p>
    </div>
  );
}

/**
 * One payslip, laid out for reading on screen: who it is for, the week and the payment, and how the net pay is
 * reached. The paper layout (the printable document) is kept out of sight and is what “Print / Save PDF” sends.
 */
export function PayslipDetail({ payslip, onEdit, onDelete }: { payslip: Payslip; onEdit: () => void; onDelete: () => void }) {
  const printable = useRef<HTMLDivElement>(null);
  const money = (value: number) => formatMoney(value, payslip.currency);
  const day = payslip.rateType === 'DAY';

  return (
    <Card data-testid="payslip-detail">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">{payslip.employeeName}</CardTitle>
            <Badge variant="outline">{day ? 'Day rate' : 'Hour rate'}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-foreground/50">
            {PAYSLIP_COMPANY.name} · Company No. {PAYSLIP_COMPANY.registration}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => printPayslip(printable.current?.querySelector<HTMLElement>('.ps') ?? null, `Payslip - ${payslip.employeeName}`)}>
            <Printer className="mr-1.5 h-4 w-4" />
            Print / Save PDF
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="mr-1.5 h-4 w-4" />
            Edit
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onDelete} aria-label="Delete payslip">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <section className="rounded-lg border border-border p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <User className="h-4 w-4 text-foreground/50" />
              Employee details
            </h3>
            <dl className="grid grid-cols-1 gap-3">
              <Field label="Full name">{payslip.employeeName}</Field>
              <Field label="National Insurance Number (NINO)">{payslip.nino}</Field>
              <Field label="Unique Taxpayer Reference (UTR)">{payslip.utr}</Field>
            </dl>
          </section>
          <section className="rounded-lg border border-border p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="h-4 w-4 text-foreground/50" />
              Payment details
            </h3>
            <dl className="grid grid-cols-1 gap-3">
              <Field label="Week covered">
                {formatDate(payslip.weekStart)} – {formatDate(payslip.weekEnd)}
              </Field>
              <Field label="Date of payment">{formatDate(payslip.paymentDate)}</Field>
            </dl>
          </section>
        </div>

        <section className="rounded-lg border border-border" data-testid="payslip-breakdown">
          <h3 className="border-b border-border px-4 py-3 text-sm font-semibold">Pay breakdown</h3>
          <div className="divide-y divide-border px-4">
            <Line label={day ? 'Day rate' : 'Hour rate'} hint={`${money(payslip.rate)} × ${payslip.quantity} ${day ? 'days' : 'hours'}`} value={money(payslip.gross)} />
            <Line label={`CIS deduction (${payslip.cisRate}%)`} hint="Withheld under the Construction Industry Scheme" value={`−${money(payslip.cisDeduction)}`} tone="minus" />
            <Line label="Payroll fee" value={`−${money(payslip.payrollFee)}`} tone="minus" />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-b-lg bg-emerald-50 px-4 py-3.5 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            <p className="text-sm font-semibold">Net pay</p>
            <p className="text-xl font-bold tabular-nums">{money(payslip.netPay)}</p>
          </div>
        </section>

        <div className="rounded-lg bg-accent/40 p-4 text-xs text-foreground/60">
          <p className="mb-1.5 font-semibold text-foreground/80">Notes</p>
          <ul className="list-disc space-y-1 pl-4">
            {PAYSLIP_NOTES.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          {payslip.notes ? <p className="mt-2 italic">{payslip.notes}</p> : null}
        </div>
      </CardContent>

      {/* the paper version, only for printing */}
      <div ref={printable} className="hidden" aria-hidden>
        <PayslipDocument payslip={payslip} />
      </div>
    </Card>
  );
}
