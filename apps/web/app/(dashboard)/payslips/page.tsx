'use client';

import { ReceiptText as BannerIcon } from '@crm/ui/icons';
import { PageBanner } from '@/components/tables/page-banner';
import { Button, Input } from '@crm/ui';
import { Banknote, CalendarDays, Landmark, Plus, ReceiptText, X } from '@crm/ui/icons';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { confirmDialog } from '@/components/dialogs/confirm-dialog';
import { PayslipDetail, PayslipFormDialog } from '@/features/payslips';
import { NoticeBar, useNotice } from '@/features/revenue/todo-list';
import { RevenueTile, formatDate, formatMoney, moneyLines } from '@/features/revenue';
import { useCreatePayslip, useDeletePayslip, usePayslips, usePayslipsOverview, useUpdatePayslip } from '@/hooks/use-payslips';
import type { Payslip, PayslipInput } from '@/services/payslips.service';

/**
 * Payslips: the weekly CIS payslips of the workers — who was paid, for which week, how much was taken off
 * (CIS deduction and payroll fee) and what was left to pay. A payslip opens as the printable document.
 */
export default function PayslipsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [form, setForm] = useState<{ payslip?: Payslip } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // one week at a time (a chip above the list), or every week
  const [weekFilter, setWeekFilter] = useState<string>('');
  const [notice, setNotice] = useNotice();

  // wait for a pause in typing before asking the server
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTerm(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data: overview } = usePayslipsOverview();
  const { data, isLoading } = usePayslips({ page, pageSize: 100, search: term || undefined });
  const createPayslip = useCreatePayslip();
  const updatePayslip = useUpdatePayslip();
  const deletePayslip = useDeletePayslip();

  function handleSubmit(input: PayslipInput) {
    return form?.payslip ? updatePayslip.mutateAsync({ id: form.payslip.id, input }) : createPayslip.mutateAsync(input);
  }

  async function handleDelete(payslip: Payslip) {
    if (await confirmDialog(`Delete the payslip of ${payslip.employeeName} for ${formatDate(payslip.weekStart)} – ${formatDate(payslip.weekEnd)}? This can't be undone.`)) {
      deletePayslip.mutate(payslip.id, { onSuccess: () => setNotice({ tone: 'ok', text: `The payslip of ${payslip.employeeName} was deleted.` }) });
    }
  }

  const loaded = data?.items ?? [];
  // the weeks that have payslips, newest first, each with how many payslips and how much was paid
  const weeks = useMemo(() => {
    const byWeek = new Map<string, { start: string; end: string; count: number; net: number; currency: string }>();
    for (const payslip of loaded) {
      const key = payslip.weekStart.slice(0, 10);
      const week = byWeek.get(key) ?? { start: payslip.weekStart, end: payslip.weekEnd, count: 0, net: 0, currency: payslip.currency };
      week.count += 1;
      week.net += payslip.netPay;
      byWeek.set(key, week);
    }
    return [...byWeek.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([key, week]) => ({ key, ...week }));
  }, [loaded]);
  const activeWeek = weeks.some((week) => week.key === weekFilter) ? weekFilter : '';
  const payslips = activeWeek ? loaded.filter((payslip) => payslip.weekStart.slice(0, 10) === activeWeek) : loaded;
  // the payslip shown on the right: the one chosen in the list, otherwise the newest
  const selected = payslips.find((payslip) => payslip.id === selectedId) ?? payslips[0] ?? null;
  // the list is grouped by week: a heading with the week and what was paid, then its payslips
  const groups = weeks.filter((week) => !activeWeek || week.key === activeWeek).map((week) => ({ ...week, items: payslips.filter((payslip) => payslip.weekStart.slice(0, 10) === week.key) }));

  return (
    <div className="flex flex-col gap-6">
      <PageBanner tone="stone" icon={BannerIcon} title="Payslips" description={<>The weekly payslips of the workers (Construction Industry Scheme, CIS). Pick a week, choose a worker, then <b>Print / Save PDF</b>. Payslips are made when a timesheet is approved on{' '}<Link href="/timesheets" className="text-primary hover:underline">Timesheets</Link>; the whole week is paid from{' '}<Link href="/payroll" className="text-primary hover:underline">Weekly payroll</Link>.</>}>
        <Button type="button" className="shrink-0 whitespace-nowrap" onClick={() => setForm({})}>
          <Plus className="mr-1.5 h-4 w-4" />
          New payslip
        </Button>
      </PageBanner>

      <NoticeBar notice={notice} onClose={() => setNotice(null)} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <RevenueTile label="Payslips" icon={ReceiptText} lines={overview ? [overview.total.toLocaleString()] : undefined} note={overview ? `${overview.thisMonth} paid this month` : undefined} tone="var(--chart-series-1)" />
        <RevenueTile label="Gross pay" icon={Banknote} lines={overview ? moneyLines(overview.gross, 'GBP') : undefined} note="before deductions" tone="#2f6b3b" />
        <RevenueTile label="CIS deducted" icon={Landmark} lines={overview ? moneyLines(overview.cis, 'GBP') : undefined} note="withheld for HMRC" tone="#b7791f" />
        <RevenueTile label="Net pay" icon={CalendarDays} lines={overview ? moneyLines(overview.netPay, 'GBP') : undefined} note="paid to the workers" tone="#7a3b6e" />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[340px_1fr]">
        <div className="flex flex-col gap-3">
          <Button type="button" className="w-full" onClick={() => setForm({})} data-testid="payslip-add">
            <Plus className="mr-1.5 h-4 w-4" />
            New payslip
          </Button>
          <Input aria-label="Search payslips" placeholder="Search name, NINO or UTR…" value={search} onChange={(event) => setSearch(event.target.value)} />
          {weeks.length > 1 ? (
            <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Week" data-testid="payslip-weeks">
              <button type="button" role="tab" aria-selected={!activeWeek} onClick={() => setWeekFilter('')} className={`rounded-full border px-3 py-1 text-xs font-medium ${!activeWeek ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-accent'}`}>
                All weeks
              </button>
              {weeks.slice(0, 6).map((week) => (
                <button
                  key={week.key}
                  type="button"
                  role="tab"
                  aria-selected={activeWeek === week.key}
                  onClick={() => setWeekFilter(activeWeek === week.key ? '' : week.key)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${activeWeek === week.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-accent'}`}
                >
                  {formatDate(week.start)}
                </button>
              ))}
              {activeWeek ? (
                <button type="button" aria-label="Show all weeks" onClick={() => setWeekFilter('')} className="rounded-full p-1 text-foreground/50 hover:bg-accent">
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          ) : null}
          <ul className="flex max-h-[min(34rem,calc(100vh-22rem))] min-h-48 flex-col gap-2 overflow-y-scroll pr-1" data-testid="payslips-list">
            {isLoading ? (
              <li className="rounded-lg border border-border px-4 py-8 text-center text-sm text-foreground/50">Loading…</li>
            ) : payslips.length === 0 ? (
              <li className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-foreground/50">
                {term ? 'No payslips match this search.' : 'No payslips yet. Add one with “New payslip”.'}
              </li>
            ) : (
              groups.map((group) => (
                <li key={group.key} className="flex flex-col gap-2">
                  <div className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-foreground/70">
                    <span>
                      {formatDate(group.start)} – {formatDate(group.end)}
                    </span>
                    <span className="tabular-nums">
                      {group.items.length} · {formatMoney(group.net, group.currency)}
                    </span>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {group.items.map((payslip) => {
                      const active = selected?.id === payslip.id;
                      return (
                        <li key={payslip.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(payslip.id)}
                            aria-pressed={active}
                            className={`flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              active ? 'border-primary bg-accent/50' : 'border-border bg-background'
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">{payslip.employeeName}</span>
                              <span className="block text-xs text-foreground/50">paid {formatDate(payslip.paymentDate)}</span>
                            </span>
                            <span className="shrink-0 text-right">
                              <span className="block text-sm font-semibold tabular-nums text-emerald-700">{formatMoney(payslip.netPay, payslip.currency)}</span>
                              <span className="block text-xs text-foreground/50">net</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))
            )}
          </ul>
          {data && data.totalPages > 1 ? (
            <div className="flex items-center justify-between gap-2 text-sm text-foreground/60">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span>
                {data.page} / {data.totalPages}
              </span>
              <Button type="button" variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          ) : null}
        </div>

        {selected ? (
          <PayslipDetail payslip={selected} onEdit={() => setForm({ payslip: selected })} onDelete={() => void handleDelete(selected)} />
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-16 text-center">
            <ReceiptText className="h-8 w-8 text-foreground/30" />
            <p className="text-sm text-foreground/60">Select a payslip to see its details, or create the first one.</p>
            <Button type="button" onClick={() => setForm({})}>
              <Plus className="mr-1.5 h-4 w-4" />
              New payslip
            </Button>
          </div>
        )}
      </div>

      {form ? <PayslipFormDialog payslip={form.payslip} onSubmit={handleSubmit} onClose={() => setForm(null)} /> : null}
    </div>
  );
}
