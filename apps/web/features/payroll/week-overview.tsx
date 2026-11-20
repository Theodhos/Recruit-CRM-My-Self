'use client';

import { Button } from '@crm/ui';
import { Banknote, Building2, ChevronDown, Clock, Percent, Receipt, ShieldAlert, TrendingUp, UserPlus, Users, Wallet } from '@crm/ui/icons';
import { useState } from 'react';

import { STAGE_ORDER, StageBadge, STAGE_META, money, unitLabel } from '@/features/timesheets/shared';
import type { PayrollOverview, PayrollStage } from '@/services/payroll.service';

/** A figure with its label; `strong` marks the ones that matter most. */
function Figure({ label, value, note, icon: Icon, strong, testId }: { label: string; value: string; note?: string; icon: React.ElementType; strong?: boolean; testId?: string }) {
  return (
    <div className={`rounded-xl border bg-card px-4 py-3 ${strong ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border'}`} data-testid={testId}>
      <p className="flex items-center gap-1.5 text-xs text-foreground/60">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className="mt-1 truncate text-xl font-semibold tabular-nums">{value}</p>
      {note ? <p className="truncate text-[11px] text-foreground/50">{note}</p> : null}
    </div>
  );
}

/**
 * The weekly summary: total workers, days / hours, gross worker payments, CIS deductions, net payments, client
 * charges, the CIS the clients deduct, invoices, VAT and the agency's profit — for the approved timesheets shown.
 */
export function WeeklySummary({ data }: { data: PayrollOverview }) {
  const w = data.weekly;
  const [open, setOpen] = useState(false);
  const worked = [w.days > 0 ? `${w.days} ${unitLabel('DAY', w.days !== 1)}` : null, w.hours > 0 ? `${w.hours} ${unitLabel('HOUR', w.hours !== 1)}` : null].filter(Boolean).join(' · ') || '0';
  return (
    <section className="flex flex-col gap-3" aria-label="Weekly summary" data-testid="payroll-summary">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Weekly summary</h3>
        <p className="text-xs text-foreground/55">Approved timesheets of the lines shown{data.summary.waitingApproval.count > 0 ? ` · ${data.summary.waitingApproval.count} not yet approved are left out` : ''}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Figure label="Total workers" value={String(w.workers)} note={w.workersInWeek !== w.workers ? `of ${w.workersInWeek} with a timesheet this week` : `${w.timesheets} timesheet${w.timesheets === 1 ? '' : 's'}`} icon={Users} testId="sum-workers" />
        <Figure label="Total days / hours" value={worked} note="worked this week" icon={Clock} testId="sum-units" />
        <Figure label="Gross worker payments" value={money(w.grossPay)} note="before CIS and fees" icon={Banknote} testId="sum-gross" />
        <Figure label="CIS deducted from workers" value={money(w.cisDeductions)} note={`plus ${money(w.payrollFees)} payroll fees`} icon={ShieldAlert} testId="sum-cis" />
        <Figure label="Total net payments" value={money(w.netPay)} note={`${money(data.summary.outstandingNet)} still to pay`} icon={Wallet} strong testId="sum-net" />
        <Figure label="Total client charges" value={money(w.clientCharges)} note="before VAT" icon={Building2} testId="sum-charges" />
        <Figure label="Client CIS deductions" value={money(w.clientCisDeductions)} note="deducted by the clients" icon={Percent} testId="sum-client-cis" />
        <Figure label="Total invoices" value={money(w.invoiceTotal)} note={`${w.invoiceCount} invoice${w.invoiceCount === 1 ? '' : 's'} · ${money(w.invoiceNet)} before VAT`} icon={Receipt} testId="sum-invoices" />
        <Figure label="Total VAT" value={money(w.vat)} note="on the invoices" icon={Percent} testId="sum-vat" />
        <Figure label="Total agency profit" value={money(w.profit)} note="charge − gross + fees" icon={TrendingUp} strong testId="sum-profit" />
        <Figure label="To receive from clients" value={money(w.toReceive)} note="invoices − client CIS" icon={Wallet} testId="sum-receivable" />
      </div>

      {data.invoices.length > 0 ? (
        <div className="rounded-xl border border-border">
          <button type="button" className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-medium hover:bg-accent/40" onClick={() => setOpen((now) => !now)} aria-expanded={open} data-testid="invoices-toggle">
            <span>Client invoices for the week ({data.invoices.length})</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open ? (
            <div className="max-h-80 overflow-auto border-t border-border" data-testid="invoices-table">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="sticky top-0 z-10 bg-accent text-left text-xs uppercase tracking-wide text-foreground/60">
                  <tr>
                    <th className="px-4 py-2 font-medium">Client</th>
                    <th className="px-4 py-2 text-right font-medium">Workers</th>
                    <th className="px-4 py-2 text-right font-medium">Net</th>
                    <th className="px-4 py-2 text-right font-medium">VAT</th>
                    <th className="px-4 py-2 text-right font-medium">Invoice total</th>
                    <th className="px-4 py-2 text-right font-medium">Client CIS</th>
                    <th className="px-4 py-2 text-right font-medium">To receive</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.invoices.map((i) => (
                    <tr key={i.companyId}>
                      <td className="px-4 py-2.5 font-medium">{i.client}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{i.workers}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{money(i.net)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {money(i.vat)} <span className="text-xs text-foreground/50">{i.reverseCharge ? '(reverse charge)' : `(${i.vatRate}%)`}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{money(i.total)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {money(i.clientCis)} <span className="text-xs text-foreground/50">({i.cisRate}%)</span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{money(i.receivable)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-border px-4 py-2 text-xs text-foreground/55">CIS and VAT follow each client’s own settings (Companies → edit → Invoicing). The figures are for the invoice; the invoice itself is made in your accounts.</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** Where every worker of the week stands, from "pending timesheet" to "paid". Click a stage to see only those lines. */
export function StageStrip({ counts, active, onPick }: { counts: Record<PayrollStage, number>; active: PayrollStage | ''; onPick: (stage: PayrollStage | '') => void }) {
  return (
    <section aria-label="Payroll stages" data-testid="stage-strip">
      <div className="flex flex-wrap items-stretch gap-1.5">
        {STAGE_ORDER.map((stage, index) => {
          const count = counts[stage] ?? 0;
          const on = active === stage;
          return (
            <button
              key={stage}
              type="button"
              onClick={() => onPick(on ? '' : stage)}
              aria-pressed={on}
              data-stage={stage}
              className={`flex min-w-[118px] flex-1 flex-col rounded-lg border px-3 py-2 text-left transition-colors ${on ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-accent/40'} ${count === 0 ? 'opacity-60' : ''}`}
            >
              <span className="flex items-center gap-1.5 text-[11px] text-foreground/55">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-semibold">{index + 1}</span>
                {STAGE_META[stage].short}
              </span>
              <span className="mt-0.5 text-lg font-semibold tabular-nums">{count}</span>
            </button>
          );
        })}
        {(counts.REJECTED ?? 0) > 0 ? (
          <button type="button" onClick={() => onPick(active === 'REJECTED' ? '' : 'REJECTED')} aria-pressed={active === 'REJECTED'} data-stage="REJECTED" className={`flex min-w-[118px] flex-col rounded-lg border px-3 py-2 text-left ${active === 'REJECTED' ? 'border-destructive ring-1 ring-destructive' : 'border-destructive/40 hover:bg-destructive/5'}`}>
            <span className="text-[11px] text-destructive">Rejected</span>
            <span className="mt-0.5 text-lg font-semibold tabular-nums text-destructive">{counts.REJECTED}</span>
          </button>
        ) : null}
      </div>
    </section>
  );
}

/** Workers on a placement this week whose timesheet has not arrived: stage "pending timesheet". */
export function ExpectedPanel({ items, onAdd, canAdd }: { items: PayrollOverview['expected']; onAdd: (item: PayrollOverview['expected'][number]) => void; canAdd: boolean }) {
  if (items.length === 0) return null;
  return (
    <section className="rounded-xl border border-border" aria-label="Pending timesheets" data-testid="expected-panel">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <StageBadge stage="PENDING_TIMESHEET" /> {items.length} worker{items.length === 1 ? '' : 's'} on a placement this week, no timesheet yet
        </p>
      </div>
      <ul className="max-h-64 divide-y divide-border overflow-y-auto">
        {items.map((item) => (
          <li key={item.placementId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm" data-testid="expected-row">
            <span>
              <span className="font-medium">{item.workerName}</span>
              <span className="text-foreground/60">
                {' '}
                · {item.companyName} · {item.jobTitle}
              </span>
            </span>
            {canAdd ? (
              <Button type="button" size="sm" variant="outline" onClick={() => onAdd(item)} data-testid="expected-add">
                <UserPlus className="mr-1.5 h-4 w-4" /> Add timesheet
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
