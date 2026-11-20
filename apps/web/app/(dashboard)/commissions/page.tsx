'use client';

import { TABLE_TONES } from '@/components/tables/data-table';
import { Percent as BannerIcon } from '@crm/ui/icons';
import { PageBanner } from '@/components/tables/page-banner';
import { Badge, Button, Dialog, Input, Label, Select } from '@crm/ui';
import { AlertTriangle, Banknote, CalendarDays, ChevronLeft, ChevronRight, Download, Eye, FileText, ListChecks, Loader2, Plus, Settings2, Trash2, UserCog } from '@crm/ui/icons';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { NothingToDo, SectionTabs, TodoGroup, TodoRow, useSection } from '@/features/revenue/todo-list';

import { useAddPayment, useMonth, useRemovePayment, useResourcers, useSetDefaultBasis, useSetPermanentTrigger, useSetRate, useStatement } from '@/hooks/use-commissions';
import { ApiClientError } from '@/lib/api-client';
import { downloadCommissionXlsx, downloadStatementPdf, type CommissionBasis, type MonthRow } from '@/services/commissions.service';

const money = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
const BASIS_LABEL: Record<CommissionBasis, string> = { PROFIT: 'Agency profit', BILLING: 'Client billing' };
const currentMonth = () => new Date().toISOString().slice(0, 7);
const shift = (month: string, by: number) => {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + by);
  return d.toISOString().slice(0, 7);
};
const monthLabel = (month: string) => new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const messageOf = (e: unknown, fallback: string) => (e instanceof ApiClientError ? e.message : e instanceof Error ? e.message : fallback);

function Tile({ label, value, note, strong }: { label: string; value: string; note?: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl border bg-card px-4 py-3 ${strong ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border'}`}>
      <p className="text-xs text-foreground/60">{label}</p>
      <p className="mt-1 truncate text-xl font-semibold tabular-nums">{value}</p>
      {note ? <p className="truncate text-[11px] text-foreground/50">{note}</p> : null}
    </div>
  );
}

/** One employee's statement for the month: the placements, the share, the commission, the payments and what is left to pay. */
function StatementDialog({ month, userId, onClose }: { month: string; userId: string; onClose: () => void }) {
  const { data: s, isLoading } = useStatement(month, userId);
  const addPayment = useAddPayment();
  const removePayment = useRemovePayment();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setError(null);
    try {
      await addPayment.mutateAsync({ userId, month, amount: Number(amount), paidDate: date, reference: reference.trim() || undefined });
      setAmount('');
      setReference('');
    } catch (e) {
      setError(messageOf(e, 'The payment was not recorded.'));
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={s ? `Commission statement · ${s.employee.name}` : 'Commission statement'} description={`${monthLabel(month)}${s ? ` · ${s.employee.commissionRate}% of ${BASIS_LABEL[s.employee.basis].toLowerCase()}` : ''}`} className="max-w-4xl">
      {isLoading || !s ? (
        <div className="h-48 animate-pulse rounded-lg bg-accent/50" aria-busy="true" />
      ) : (
        <div className="flex flex-col gap-4" data-testid="statement">
          <div className="max-h-[50vh] overflow-auto rounded-lg border border-border">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="sticky top-0 z-10 bg-accent text-left text-xs uppercase tracking-wide text-foreground/60">
                <tr>
                  <th className="px-3 py-2 font-medium">Worker</th>
                  <th className="px-3 py-2 font-medium">Client</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 text-right font-medium">Placement billing</th>
                  <th className="px-3 py-2 text-right font-medium">Placement profit</th>
                  <th className="px-3 py-2 text-right font-medium">Share</th>
                  <th className="px-3 py-2 text-right font-medium">Attributed billing</th>
                  <th className="px-3 py-2 text-right font-medium">Attributed profit</th>
                  <th className="px-3 py-2 text-right font-medium">Commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {s.lines.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-foreground/55">
                      No approved temporary placements are allocated to this person this month.
                    </td>
                  </tr>
                ) : (
                  s.lines.map((l) => (
                    <tr key={l.placementId}>
                      <td className="px-3 py-2 font-medium">
                        {l.worker}
                        {l.sharedWith.length ? <span className="block text-xs font-normal text-foreground/55">shared with {l.sharedWith.join(', ')}</span> : null}
                      </td>
                      <td className="px-3 py-2 text-foreground/75">{l.client}</td>
                      <td className="px-3 py-2 text-xs">
                        {l.kind === 'PERMANENT' ? (
                          <>
                            Permanent<span className="block text-foreground/55">{l.feeType === 'FIXED' ? 'fixed fee' : l.feeType === 'PERCENTAGE' ? 'percentage fee' : ''}{l.invoiceNumber ? ` · ${l.invoiceNumber}` : ''}</span>
                          </>
                        ) : (
                          'Temporary'
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(l.billingTotal)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(l.profitTotal)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{l.splitPercent}%</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(l.attributedBilling)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(l.attributedProfit)}</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">{money(l.commission)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Attributed client billing" value={money(s.totals.billings)} />
            <Tile label="Attributed agency profit" value={money(s.totals.profit)} />
            <Tile label={`Commission earned (${s.employee.commissionRate}%)`} value={money(s.totals.earned)} note={`on ${money(s.totals.commissionable)}`} strong />
            <Tile label="Outstanding" value={money(s.totals.outstanding)} note={`${money(s.totals.paid)} already paid`} strong />
          </div>

          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 text-sm font-semibold">Commission paid</p>
            {s.payments.length === 0 ? <p className="text-sm text-foreground/55">Nothing paid for {monthLabel(month)} yet.</p> : null}
            <ul className="max-h-60 divide-y divide-border overflow-y-auto">
              {s.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-1.5 text-sm" data-testid="commission-payment">
                  <span>
                    {new Date(p.paidAt).toLocaleDateString('en-GB')} {p.reference ? <span className="text-foreground/55">· {p.reference}</span> : null}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{money(p.amount)}</span>
                    <button type="button" aria-label="Remove this payment" className="rounded p-1 text-foreground/50 hover:bg-accent hover:text-destructive" onClick={() => void removePayment.mutateAsync(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
              <div className="flex flex-col gap-1">
                <Label htmlFor="pay-amount">Amount paid (£)</Label>
                <Input id="pay-amount" type="number" min={0.01} step={0.01} placeholder={s.totals.outstanding > 0 ? String(s.totals.outstanding) : ''} value={amount} onChange={(event) => setAmount(event.target.value)} data-testid="payment-amount" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="pay-date">Date</Label>
                <Input id="pay-date" type="date" max={new Date().toISOString().slice(0, 10)} value={date} onChange={(event) => setDate(event.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="pay-ref">Reference (optional)</Label>
                <Input id="pay-ref" value={reference} onChange={(event) => setReference(event.target.value)} />
              </div>
              <Button type="button" disabled={!amount || Number(amount) <= 0 || addPayment.isPending} onClick={() => void pay()} data-testid="record-payment">
                {addPayment.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />} Record
              </Button>
            </div>
            {error ? (
              <p className="mt-2 text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => void downloadStatementPdf(month, userId, s.employee.name)} data-testid="statement-pdf">
              <FileText className="mr-1.5 h-4 w-4" /> Statement PDF
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

/** Each person's commission percentage and basis, and the default basis of the organisation. */
function RatesPanel() {
  const { data } = useResourcers();
  const setRate = useSetRate();
  const setBasis = useSetDefaultBasis();
  const setTrigger = useSetPermanentTrigger();
  const [edits, setEdits] = useState<Record<string, { rate?: string; basis?: CommissionBasis | '' }>>({});
  const [saved, setSaved] = useState<string | null>(null);
  if (!data) return <div className="h-24 animate-pulse rounded-xl bg-accent/50" />;
  return (
    <section className="rounded-xl border border-border p-4" aria-label="Commission rates" data-testid="rates-panel">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Settings2 className="h-4 w-4 text-foreground/50" /> Commission percentages and basis
          </h3>
          <p className="mt-0.5 text-xs text-foreground/55">Commission is a percentage of the figure you choose here. Nothing is fixed: change a percentage or the basis whenever you decide.</p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="default-basis" className="text-xs">
            Default basis
          </Label>
          <Select id="default-basis" className="w-44" value={data.defaultBasis} onChange={(event) => void setBasis.mutateAsync(event.target.value as CommissionBasis)} data-testid="default-basis">
            <option value="PROFIT">Agency profit</option>
            <option value="BILLING">Client billing</option>
          </Select>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Label htmlFor="perm-trigger" className="text-xs">
          Commission on a permanent placement is earned
        </Label>
        <Select id="perm-trigger" className="w-64" value={data.permanentTrigger} onChange={(event) => void setTrigger.mutateAsync(event.target.value as 'PLACEMENT' | 'PAID')} data-testid="permanent-trigger">
          <option value="PLACEMENT">in the month it is placed</option>
          <option value="PAID">in the month the client pays the invoice</option>
        </Select>
      </div>
      <div className="max-h-80 overflow-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="sticky top-0 z-10 bg-background text-left text-xs uppercase tracking-wide text-foreground/55">
            <tr>
              <th className="py-1.5 font-medium">Employee</th>
              <th className="py-1.5 font-medium">Commission %</th>
              <th className="py-1.5 font-medium">Basis</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.resourcers.map((r) => {
              const e = edits[r.userId] ?? {};
              const rate = e.rate ?? String(r.commissionRate);
              const basis = e.basis ?? (r.commissionBasis ?? '');
              const dirty = e.rate !== undefined || e.basis !== undefined;
              return (
                <tr key={r.userId} data-testid="rate-row">
                  <td className="py-2 font-medium">{r.name}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-1.5">
                      <Input type="number" min={0} max={100} step={0.01} className="w-24" aria-label={`Commission percentage of ${r.name}`} value={rate} onChange={(event) => setEdits((c) => ({ ...c, [r.userId]: { ...c[r.userId], rate: event.target.value } }))} />
                      <span className="text-foreground/55">%</span>
                    </div>
                  </td>
                  <td className="py-2">
                    <Select className="w-52" aria-label={`Basis of ${r.name}`} value={basis} onChange={(event) => setEdits((c) => ({ ...c, [r.userId]: { ...c[r.userId], basis: event.target.value as CommissionBasis | '' } }))}>
                      <option value="">Default ({BASIS_LABEL[data.defaultBasis].toLowerCase()})</option>
                      <option value="PROFIT">Agency profit</option>
                      <option value="BILLING">Client billing</option>
                    </Select>
                  </td>
                  <td className="py-2 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant={dirty ? 'default' : 'outline'}
                      disabled={!dirty || setRate.isPending || Number.isNaN(Number(rate)) || rate === ''}
                      onClick={async () => {
                        await setRate.mutateAsync({ userId: r.userId, commissionRate: Number(rate), commissionBasis: (basis || null) as CommissionBasis | null });
                        setEdits((c) => {
                          const next = { ...c };
                          delete next[r.userId];
                          return next;
                        });
                        setSaved(r.name);
                      }}
                      data-testid="save-rate"
                    >
                      Save
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {saved ? (
        <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300" role="status">
          Saved for {saved}.
        </p>
      ) : null}
    </section>
  );
}

/** The three sections of the page. The open one is kept in the address (#todo, #month, #rates); the month stays in ?month=. */
const SECTIONS = [
  { key: 'todo', label: 'To do', hint: 'What is waiting for you this month: placements without a resourcer, commission to pay', icon: ListChecks },
  { key: 'month', label: 'Month overview', hint: 'The month in figures, with a statement per person', icon: Eye },
  { key: 'rates', label: 'Rates & settings', hint: 'Each person’s percentage and the basis of the commission', icon: Settings2 },
] as const;
type SectionKey = (typeof SECTIONS)[number]['key'];

/**
 * Commission: who is responsible for each temporary placement (set on Active Employees), each person's percentage,
 * and for every month the billings, profit, shared placements, commission earned, paid and outstanding — with a
 * statement per employee. Both the client billing and the agency profit stay visible; the basis is a setting.
 */
export default function CommissionsPage() {
  const [month, setMonth] = useState(currentMonth());
  // a link can open a given month: /commissions?month=2026-11
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('month');
    if (wanted && /^\d{4}-(0[1-9]|1[0-2])$/.test(wanted)) setMonth(wanted);
  }, []);
  const [statementOf, setStatementOf] = useState<string | null>(null);
  const { section, chosen, open: openSection } = useSection<SectionKey>(['todo', 'month', 'rates'], 'todo');
  const [exporting, setExporting] = useState(false);
  const { data, isLoading, isError, refetch } = useMonth(month);
  // the To do figures: who still has to be paid, and the placements nobody is responsible for
  const toPay = (data?.resourcers ?? []).filter((person) => person.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding);
  const unallocated = data?.unallocated.placements ?? [];
  const todoCount = toPay.length + unallocated.length;
  // nothing was chosen yet: open To do when the month has something to do, otherwise the overview
  const shown: SectionKey = chosen ? section : data && todoCount === 0 ? 'month' : section;

  return (
    <div className="flex flex-col gap-6">
      <PageBanner tone="red" icon={BannerIcon} title="Commission" description={<>Each month’s commission of the resourcers, from the approved timesheets of their temporary placements and the fees of the permanent ones. <b>1</b> choose the resourcer of each placement on{' '}<Link href="/applications" className="text-primary hover:underline">Active Employees</Link> → <b>2</b> set each person’s percentage → <b>3</b> pay the commission each month.</>}>
        <Button type="button" variant="outline" disabled={exporting} onClick={async () => (setExporting(true), await downloadCommissionXlsx(month).finally(() => setExporting(false)))} data-testid="export-commission">
          <Download className="mr-1.5 h-4 w-4" /> Excel
        </Button>
      </PageBanner>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-1 rounded-lg border border-border p-1" data-testid="month-nav">
          <Button type="button" variant="ghost" size="sm" aria-label="Previous month" onClick={() => setMonth(shift(month, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="flex min-w-[170px] items-center justify-center gap-1.5 px-2 text-sm font-semibold" aria-live="polite">
            <CalendarDays className="h-4 w-4 text-foreground/50" />
            {monthLabel(month)}
          </span>
          <Button type="button" variant="ghost" size="sm" aria-label="Next month" onClick={() => setMonth(shift(month, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Input type="month" className="w-44" aria-label="Pick the month" value={month} onChange={(event) => event.target.value && setMonth(event.target.value)} />
        <Button type="button" variant="outline" size="sm" disabled={month === currentMonth()} onClick={() => setMonth(currentMonth())}>
          This month
        </Button>
      </div>

      {/* the three sections of the page */}
      <SectionTabs sections={SECTIONS} value={shown} onChange={openSection} label="Sections of Commission" counts={{ todo: data ? todoCount : undefined }} />

      {isError ? (
        <div role="alert" className="flex flex-col items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          The commission could not be loaded.
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : isLoading || !data ? (
        <div className="h-48 animate-pulse rounded-xl bg-accent/50" aria-busy="true" />
      ) : (
        <>
          {shown === 'todo' ? (
            <div className="flex flex-col gap-5" data-testid="commission-todo">
              {todoCount === 0 ? (
                <NothingToDo
                  text={`Every placement of ${monthLabel(month)} has a resourcer and all the commission is paid.`}
                  action={
                    <Button type="button" size="sm" variant="outline" onClick={() => openSection('month')}>
                      See the month
                    </Button>
                  }
                />
              ) : null}

              {unallocated.length > 0 ? (
                <TodoGroup
                  testId="commission-unallocated"
                  step={1}
                  icon={UserCog}
                  title={`Choose a resourcer for ${unallocated.length} placement${unallocated.length === 1 ? '' : 's'}`}
                  help={`${money(data.unallocated.billing)} of client billing and ${money(data.unallocated.profit)} of profit belong to placements with nobody responsible, so no commission is earned on them.`}
                  actions={
                    <Link href="/applications" className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
                      Open Active Employees
                    </Link>
                  }
                >
                  {unallocated.map((placement) => (
                    <TodoRow
                      key={`${placement.worker}-${placement.client}`}
                      title={<span className="font-medium">{placement.worker}</span>}
                      detail={`${placement.client} · ${placement.timesheets} timesheet${placement.timesheets === 1 ? '' : 's'}`}
                      aside={<span className="text-sm font-semibold tabular-nums">{money(placement.billing)}</span>}
                      action={<span className="text-xs text-amber-700">no resourcer</span>}
                    />
                  ))}
                </TodoGroup>
              ) : null}

              {toPay.length > 0 ? (
                <TodoGroup
                  testId="commission-to-pay"
                  step={2}
                  icon={Banknote}
                  title={`Pay the commission of ${toPay.length} ${toPay.length === 1 ? 'person' : 'people'}`}
                  help={`${money(data.totals.outstanding)} is still to pay for ${monthLabel(month)}. Open a person, check the statement, pay, and record the payment there.`}
                >
                  {toPay.map((person) => (
                    <TodoRow
                      key={person.userId}
                      title={<span className="font-medium">{person.name}</span>}
                      detail={`${person.commissionRate}% · earned ${money(person.earned)} · paid ${money(person.paid)}`}
                      aside={
                        <span className="text-right">
                          <span className="block text-sm font-semibold tabular-nums text-amber-700">{money(person.outstanding)}</span>
                          <span className="block text-xs text-foreground/50">to pay</span>
                        </span>
                      }
                      action={
                        <Button type="button" size="sm" onClick={() => setStatementOf(person.userId)}>
                          Statement &amp; pay
                        </Button>
                      }
                    />
                  ))}
                </TodoGroup>
              ) : null}
            </div>
          ) : null}

          {shown === 'month' ? (
            <div className="flex flex-col gap-6" data-testid="commission-month">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="billings-split">
            <section className="rounded-xl border border-border p-4" aria-label="Temporary recruitment" data-testid="temporary-block">
              <h3 className="mb-2 text-sm font-semibold">Temporary recruitment</h3>
              <div className="grid grid-cols-3 gap-3">
                <Tile label="Client billing" value={money(data.temporary.billing)} note={`${data.temporary.timesheets} approved timesheet${data.temporary.timesheets === 1 ? '' : 's'}`} />
                <Tile label="Agency profit" value={money(data.temporary.profit)} note="actually made" />
                <Tile label="Commission earned" value={money(data.totals.earnedTemporary)} />
              </div>
            </section>
            <section className="rounded-xl border border-border p-4" aria-label="Permanent recruitment" data-testid="permanent-block">
              <h3 className="mb-2 text-sm font-semibold">Permanent recruitment</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Tile label="Placements" value={String(data.permanent.placements)} note={`${data.permanent.fixedFee} fixed · ${data.permanent.percentageFee} percentage`} />
                <Tile label="Recruitment revenue" value={money(data.permanent.revenue)} note={`profit ${money(data.permanent.profit)}`} />
                <Tile label="Outstanding invoices" value={money(data.permanent.outstandingInvoices.amount)} note={`${data.permanent.outstandingInvoices.count} sent${data.permanent.outstandingInvoices.overdueCount ? ` · ${data.permanent.outstandingInvoices.overdueCount} overdue` : ''}`} />
                <Tile label="Commission earned" value={money(data.totals.earnedPermanent)} note={data.permanentTrigger === 'PAID' ? 'when the invoice is paid' : 'when placed'} />
              </div>
            </section>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6" data-testid="commission-summary">
            <Tile label="Client billing (all)" value={money(data.clientBilling)} note="temporary + permanent" />
            <Tile label="Agency profit (all)" value={money(data.agencyProfit)} note="actually made" />
            <Tile label="Commissionable" value={money(data.totals.commissionable)} note={`basis: ${BASIS_LABEL[data.defaultBasis].toLowerCase()} (default)`} />
            <Tile label="Total commission payable" value={money(data.totals.earned)} note="temporary + permanent" strong />
            <Tile label="Already paid" value={money(data.totals.paid)} />
            <Tile label="Outstanding" value={money(data.totals.outstanding)} strong />
          </div>

          {data.unallocated.timesheets > 0 ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200" data-testid="unallocated">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {money(data.unallocated.billing)} of client billing and {money(data.unallocated.profit)} of profit belong to placements with no resourcer ({data.unallocated.placements.map((p) => p.worker).slice(0, 4).join(', ')}
                {data.unallocated.placements.length > 4 ? '…' : ''}). Choose a resourcer on Active Employees, or no commission is earned on them.
              </span>
            </div>
          ) : null}

          {data.resourcers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center" data-testid="commission-empty">
              <p className="text-sm font-semibold">No commission for {monthLabel(month)}</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-foreground/55">Nobody has an approved temporary timesheet allocated this month. Set the resourcer of a placement on Active Employees and give each person a percentage below.</p>
            </div>
          ) : (
            <div className={`max-h-[65vh] overflow-auto border ${TABLE_TONES.red.box}`}>
              <table className="w-full min-w-[980px] text-sm" data-testid="commission-table">
                <thead className={`sticky top-0 z-10 bg-accent text-left text-xs uppercase tracking-wide text-foreground/70`}>
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Resourcer</th>
                    <th className="px-4 py-2.5 text-right font-medium">%</th>
                    <th className="px-4 py-2.5 font-medium">Basis</th>
                    <th className="px-4 py-2.5 text-right font-medium">Placements</th>
                    <th className="px-4 py-2.5 text-right font-medium">Billings</th>
                    <th className="px-4 py-2.5 text-right font-medium">Profit</th>
                    <th className="px-4 py-2.5 text-right font-medium">Commissionable</th>
                    <th className="px-4 py-2.5 text-right font-medium">Earned</th>
                    <th className="px-4 py-2.5 text-right font-medium">Paid</th>
                    <th className="px-4 py-2.5 text-right font-medium">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.resourcers.map((r: MonthRow) => (
                    <tr key={r.userId} tabIndex={0} className="cursor-pointer hover:bg-accent/40 focus:bg-accent/40 focus:outline-none" onClick={() => setStatementOf(r.userId)} onKeyDown={(event) => event.key === 'Enter' && setStatementOf(r.userId)} data-testid="commission-row">
                      <td className="px-4 py-3 font-medium">{r.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.commissionRate}%</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{BASIS_LABEL[r.basis]}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {r.placements}
                        {r.sharedPlacements ? <span className="text-xs text-foreground/55"> ({r.sharedPlacements} shared)</span> : null}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{money(r.billings)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{money(r.profit)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{money(r.commissionable)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {money(r.earned)}
                        {r.earnedPermanent > 0 ? <span className="block text-[11px] font-normal text-foreground/55">perm. {money(r.earnedPermanent)} · temp. {money(r.earnedTemporary)}</span> : null}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{money(r.paid)}</td>
                      <td className={`px-4 py-3 text-right font-semibold tabular-nums ${r.outstanding > 0 ? 'text-amber-700 dark:text-amber-300' : ''}`}>{money(r.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-border bg-accent/30 font-semibold">
                  <tr>
                    <td className="px-4 py-3" colSpan={4}>
                      Total
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(data.totals.attributedBilling)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(data.totals.attributedProfit)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(data.totals.commissionable)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(data.totals.earned)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(data.totals.paid)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(data.totals.outstanding)}</td>
                  </tr>
                </tfoot>
              </table>
              <p className="border-t border-border px-4 py-2 text-xs text-foreground/55">Click a name for the statement of the month. A shared placement is split by the percentages chosen on Active Employees; each person is paid on their own basis.</p>
            </div>
          )}
            </div>
          ) : null}

          {shown === 'rates' ? <RatesPanel /> : null}
        </>
      )}
      {statementOf ? <StatementDialog month={month} userId={statementOf} onClose={() => setStatementOf(null)} /> : null}
    </div>
  );
}
