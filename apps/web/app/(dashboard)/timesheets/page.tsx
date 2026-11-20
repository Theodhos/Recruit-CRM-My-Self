'use client';

import { TABLE_TONES } from '@/components/tables/data-table';
import { ClipboardCheck as BannerIcon } from '@crm/ui/icons';
import { PageBanner } from '@/components/tables/page-banner';
import { Button, Input } from '@crm/ui';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, FileText, ListChecks, Pencil, Plus, Search, Table2, TrendingUp, XCircle } from '@crm/ui/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { NothingToDo, SectionTabs, TodoGroup, TodoRow, useSection } from '@/features/revenue/todo-list';
import { TimesheetFormDialog } from '@/features/timesheets/timesheet-form-dialog';
import { StageBadge, addDaysIso, mondayOfIso, money, todayIso, unitLabel, weekLabel } from '@/features/timesheets/shared';
import { useTimesheets } from '@/hooks/use-timesheets';
import type { TimesheetStatus } from '@/services/timesheets.service';

const TABS: { value: TimesheetStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'PENDING_APPROVAL', label: 'Pending approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

/** The two sections of the page: what is waiting for you, and every timesheet. The open one is kept in the address (#todo, #all). */
const SECTIONS = [
  { key: 'todo', label: 'To do', hint: 'What is waiting for you, in the order to do it', icon: ListChecks },
  { key: 'all', label: 'All timesheets', hint: 'Every timesheet, by week, with filters', icon: Table2 },
] as const;
type SectionKey = (typeof SECTIONS)[number]['key'];

/**
 * Weekly timesheets of the temporary workers. Pick the week, see what is waiting for approval and what has been paid,
 * add a timesheet, open one to check, approve or reject it. Approved timesheets become payslips.
 */
export default function TimesheetsPage() {
  const router = useRouter();
  const [week, setWeek] = useState<string | null>(mondayOfIso(todayIso()));
  const [status, setStatus] = useState<TimesheetStatus | ''>('');
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const { section, chosen, open: openSection } = useSection<SectionKey>(['todo', 'all'], 'todo');

  useEffect(() => {
    const t = window.setTimeout(() => {
      setTerm(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const { data, isLoading, isError, error, refetch } = useTimesheets({ page, pageSize: 25, week: week ?? undefined, status: status || undefined, search: term || undefined });
  // the To do queues, whatever week is shown below: the ones to approve and the ones sent back
  const { data: waiting } = useTimesheets({ page: 1, pageSize: 50, status: 'PENDING_APPROVAL' });
  const { data: sentBack } = useTimesheets({ page: 1, pageSize: 50, status: 'REJECTED' });
  const toApprove = waiting?.items ?? [];
  const toAmend = sentBack?.items ?? [];
  const todoCount = (waiting?.totalItems ?? 0) + (sentBack?.totalItems ?? 0);
  // nothing was chosen yet: open To do when there is something to do, otherwise the list
  const shown: SectionKey = chosen ? section : waiting && sentBack && todoCount === 0 ? 'all' : section;
  const counts = data?.summary.counts ?? { PENDING_APPROVAL: 0, APPROVED: 0, REJECTED: 0 };
  const total = counts.PENDING_APPROVAL + counts.APPROVED + counts.REJECTED;
  const approved = data?.summary.approved;
  const pending = data?.summary.pending;
  const thisWeek = mondayOfIso(todayIso());

  const tiles = [
    { key: 'PENDING_APPROVAL' as const, label: 'Waiting for approval', value: String(counts.PENDING_APPROVAL), note: pending ? `${money(pending.gross)} gross pay · ${money(pending.chargeTotal)} to charge` : '', icon: Clock, tone: 'text-amber-600 bg-amber-500/10' },
    { key: 'APPROVED' as const, label: 'Approved', value: String(counts.APPROVED), note: approved ? `${money(approved.netPay)} net pay to workers` : '', icon: CheckCircle2, tone: 'text-emerald-600 bg-emerald-500/10' },
    { key: null, label: 'Charged to clients', value: approved ? money(approved.chargeTotal) : '—', note: 'approved timesheets', icon: FileText, tone: 'text-sky-600 bg-sky-500/10' },
    { key: null, label: 'Profit', value: approved ? money(approved.profit) : '—', note: 'charge − gross pay + payroll fee', icon: TrendingUp, tone: 'text-violet-600 bg-violet-500/10' },
    { key: 'REJECTED' as const, label: 'Rejected', value: String(counts.REJECTED), note: counts.REJECTED > 0 ? 'to amend and resubmit' : 'none', icon: XCircle, tone: 'text-rose-600 bg-rose-500/10' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageBanner tone="purple" icon={BannerIcon} title="Timesheets" description={<>The weekly hours of temporary workers. <b>Add</b> what the client confirmed → <b>check and approve</b> it → the CRM works out the pay, CIS, payroll fee, client charge and profit, and writes the payslip. Then pay it from{' '}<Link href="/payroll" className="text-primary hover:underline">Weekly payroll</Link>.</>}>
        <Button type="button" className="shrink-0 whitespace-nowrap" onClick={() => setAdding(true)} data-testid="add-timesheet">
          <Plus className="mr-1.5 h-4 w-4" />
          Add timesheet
        </Button>
      </PageBanner>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5" data-testid="timesheet-summary">
        {tiles.map(({ key, label, value, note, icon: Icon, tone }) => {
          const clickable = key !== null;
          const active = clickable && status === key && shown === 'all';
          return (
            <button
              key={label}
              type="button"
              disabled={!clickable}
              onClick={() => {
                if (!clickable) return;
                setStatus(active && shown === 'all' ? '' : key);
                setPage(1);
                openSection('all');
              }}
              className={`flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-colors ${active ? 'border-primary ring-1 ring-primary' : 'border-border'} ${clickable ? 'hover:bg-accent/40' : 'cursor-default'}`}
              aria-pressed={clickable ? active : undefined}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs text-foreground/60">{label}</span>
                <span className="block truncate text-lg font-semibold tabular-nums">{value}</span>
                <span className="block truncate text-[11px] text-foreground/50">{note}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* the two sections of the page */}
      <SectionTabs sections={SECTIONS} value={shown} onChange={openSection} label="Sections of Timesheets" counts={{ todo: todoCount, all: total }} />

      {/* TO DO: approve what was added, amend what was sent back */}
      {shown === 'todo' ? (
        <div className="flex flex-col gap-5" data-testid="timesheets-todo">
          {waiting && sentBack && todoCount === 0 ? (
            <NothingToDo
              text="Every timesheet is approved. Pay the week from Weekly payroll, or add a new timesheet."
              action={
                <div className="mt-1 flex flex-wrap justify-center gap-2">
                  <Button type="button" size="sm" onClick={() => setAdding(true)}>
                    <Plus className="mr-1.5 h-4 w-4" /> Add timesheet
                  </Button>
                  <Link href="/payroll" className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-accent">
                    Weekly payroll
                  </Link>
                </div>
              }
            />
          ) : null}

          {toApprove.length > 0 ? (
            <TodoGroup
              testId="timesheets-to-approve"
              step={1}
              icon={Clock}
              title={`Check and approve ${waiting!.totalItems} timesheet${waiting!.totalItems === 1 ? '' : 's'}`}
              help="Open one, compare it with what the client confirmed, then approve it. Approving works out the payroll and writes the payslip."
            >
              {toApprove.map((row) => (
                <TodoRow
                  key={row.id}
                  title={
                    <Link href={`/timesheets/${row.id}`} className="font-medium hover:underline">
                      {row.candidateName}
                    </Link>
                  }
                  detail={`${row.company.name} · ${weekLabel(row.weekStart.slice(0, 10))} · ${row.totalUnits} ${unitLabel(row.rateType)}`}
                  aside={
                    <span className="text-right">
                      <span className="block text-sm font-semibold tabular-nums">{money(row.gross, row.currency)}</span>
                      <span className="block text-xs text-foreground/50">gross pay</span>
                    </span>
                  }
                  action={
                    <Button type="button" size="sm" onClick={() => router.push(`/timesheets/${row.id}`)}>
                      Check &amp; approve
                    </Button>
                  }
                />
              ))}
            </TodoGroup>
          ) : null}

          {toAmend.length > 0 ? (
            <TodoGroup
              testId="timesheets-to-amend"
              step={2}
              icon={Pencil}
              title={`Amend ${sentBack!.totalItems} rejected timesheet${sentBack!.totalItems === 1 ? '' : 's'}`}
              help="These were sent back. Open one, fix what was wrong and send it for approval again."
            >
              {toAmend.map((row) => (
                <TodoRow
                  key={row.id}
                  title={
                    <Link href={`/timesheets/${row.id}`} className="font-medium hover:underline">
                      {row.candidateName}
                    </Link>
                  }
                  detail={`${row.company.name} · ${weekLabel(row.weekStart.slice(0, 10))}${row.rejectionReason ? ` · “${row.rejectionReason}”` : ''}`}
                  action={
                    <Button type="button" size="sm" variant="outline" onClick={() => router.push(`/timesheets/${row.id}`)}>
                      Open &amp; amend
                    </Button>
                  }
                />
              ))}
            </TodoGroup>
          ) : null}
        </div>
      ) : null}

      {/* ALL TIMESHEETS: the week, the search, the status tabs and the table */}
      {shown === 'all' ? (
        <div className="flex flex-col gap-4" data-testid="timesheets-all">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-1 rounded-lg border border-border p-1" data-testid="week-nav">
          <Button type="button" variant="ghost" size="sm" aria-label="Previous week" disabled={!week} onClick={() => week && (setWeek(addDaysIso(week, -7)), setPage(1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="flex min-w-[210px] items-center justify-center gap-1.5 px-2 text-sm font-medium" aria-live="polite">
            <CalendarDays className="h-4 w-4 text-foreground/50" />
            {week ? weekLabel(week) : 'All weeks'}
          </span>
          <Button type="button" variant="ghost" size="sm" aria-label="Next week" disabled={!week} onClick={() => week && (setWeek(addDaysIso(week, 7)), setPage(1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={week === thisWeek} onClick={() => (setWeek(thisWeek), setPage(1))}>
          This week
        </Button>
        <Button type="button" variant={week ? 'outline' : 'default'} size="sm" onClick={() => (setWeek(week ? null : thisWeek), setPage(1))}>
          {week ? 'Show all weeks' : 'Back to one week'}
        </Button>
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <Input className="pl-8" placeholder="Search worker or client…" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search timesheets" />
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border" role="tablist" aria-label="Status">
        {TABS.map((tab) => {
          const count = tab.value === '' ? total : counts[tab.value];
          const active = status === tab.value;
          return (
            <button
              key={tab.label}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => (setStatus(tab.value), setPage(1))}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${active ? 'border-primary text-foreground' : 'border-transparent text-foreground/60 hover:text-foreground'}`}
            >
              {tab.label} <span className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-xs">{count}</span>
            </button>
          );
        })}
      </div>

      {isError ? (
        <div role="alert" className="flex flex-col items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          The timesheets could not be loaded{error instanceof Error ? `: ${error.message}` : ''}.
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : isLoading ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-accent/50" />
          ))}
        </div>
      ) : (data?.items ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-16 text-center" data-testid="timesheets-empty">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
            <Clock className="h-6 w-6 text-foreground/50" />
          </span>
          <h3 className="mt-4 text-sm font-semibold">{term || status ? 'No timesheet matches' : week ? 'No timesheets for this week yet' : 'No timesheets yet'}</h3>
          <p className="mt-1 max-w-sm text-sm text-foreground/55">
            {term || status ? 'Try another search or clear the status.' : 'Add the days or hours a worker did for a client. It then waits for your approval.'}
          </p>
          <Button type="button" className="mt-4" onClick={() => setAdding(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Add timesheet
          </Button>
        </div>
      ) : (
        <div className={`max-h-[65vh] overflow-auto border ${TABLE_TONES.purple.box}`}>
          <table className="w-full min-w-[900px] text-sm" data-testid="timesheets-table">
            <thead className="sticky top-0 z-10 bg-accent text-left text-xs uppercase tracking-wide text-foreground/70">
              <tr>
                <th className="px-4 py-2.5 font-medium">Worker</th>
                <th className="px-4 py-2.5 font-medium">Client</th>
                {!week ? <th className="px-4 py-2.5 font-medium">Week</th> : null}
                <th className="px-4 py-2.5 text-right font-medium">Days / hours</th>
                <th className="px-4 py-2.5 text-right font-medium">Gross</th>
                <th className="px-4 py-2.5 text-right font-medium">Net pay</th>
                <th className="px-4 py-2.5 text-right font-medium">Client charge</th>
                <th className="px-4 py-2.5 text-right font-medium">Profit</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data!.items.map((row) => (
                <tr
                  key={row.id}
                  tabIndex={0}
                  className={`cursor-pointer hover:bg-accent/40 focus:bg-accent/40 focus:outline-none ${row.status === 'PENDING_APPROVAL' ? 'bg-amber-500/5' : ''}`}
                  onClick={() => router.push(`/timesheets/${row.id}`)}
                  onKeyDown={(event) => event.key === 'Enter' && router.push(`/timesheets/${row.id}`)}
                  data-testid="timesheet-row"
                >
                  <td className="px-4 py-3 font-medium">{row.candidateName}</td>
                  <td className="px-4 py-3 text-foreground/75">{row.company.name}</td>
                  {!week ? <td className="whitespace-nowrap px-4 py-3 text-foreground/65">{weekLabel(row.weekStart.slice(0, 10))}</td> : null}
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                    {row.totalUnits} {unitLabel(row.rateType)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(row.gross, row.currency)}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{money(row.netPay, row.currency)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(row.chargeTotal, row.currency)}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${row.profit < 0 ? 'text-destructive' : ''}`}>{money(row.profit, row.currency)}</td>
                  <td className="px-4 py-3">
                    <StageBadge stage={row.stage} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-foreground/65">
          <span>
            Page {data.page} of {data.totalPages} · {data.totalItems} timesheets
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      ) : null}

        </div>
      ) : null}

      {adding ? <TimesheetFormDialog initialWeek={week ?? undefined} onClose={() => setAdding(false)} onSaved={(id) => router.push(`/timesheets/${id}`)} /> : null}
    </div>
  );
}
