'use client';

import { TABLE_TONES } from '@/components/tables/data-table';
import { CalendarClock as BannerIcon } from '@crm/ui/icons';
import { PageBanner } from '@/components/tables/page-banner';
import { Badge, Button, Dialog, Input, Label, Select } from '@crm/ui';
import { AlertTriangle, Banknote, BadgeCheck, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, Download, Eye, FileText, Info, ListChecks, Loader2, Plus, RefreshCw, Search, ShieldAlert, Table2, Undo2, UserPlus, Users, X } from '@crm/ui/icons';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { addDaysIso, mondayOfIso, money, todayIso, unitLabel, weekLabel } from '@/features/timesheets/shared';
import { ExpectedPanel, StageStrip, WeeklySummary } from '@/features/payroll/week-overview';
import { NothingToDo, SectionTabs, TodoGroup, TodoRow, useSection } from '@/features/revenue/todo-list';
import { StageBadge } from '@/features/timesheets/shared';
import { TimesheetFormDialog } from '@/features/timesheets/timesheet-form-dialog';
import { useAuthorisePayments, useIssuePayslips, useMarkPaid, usePayroll, useRecalculate, useUnauthorisePayments } from '@/hooks/use-payroll';
import { useSession } from '@/hooks/use-session';
import { ApiClientError } from '@/lib/api-client';
import { downloadPayslipPdf, type Worker } from '@/services/timesheets.service';
import { downloadPayrollXlsx, downloadPayslips, type RecalculationPreview, type Approval, type CisStatus, type PayrollStage, type PaymentResult, type PaymentState, type PayrollFilters, type PayrollRow } from '@/services/payroll.service';

const messageOf = (error: unknown, fallback: string) => (error instanceof ApiClientError ? error.message : error instanceof Error ? error.message : fallback);

const PAYMENT_META: Record<PaymentState, { label: string; variant: 'slate' | 'warning' | 'sky' | 'success' }> = {
  NOT_READY: { label: 'Not ready', variant: 'slate' },
  UNPAID: { label: 'Awaiting authorisation', variant: 'warning' },
  AUTHORISED: { label: 'Authorised', variant: 'sky' },
  PAID: { label: 'Paid', variant: 'success' },
};
const APPROVAL_META: Record<Approval, { label: string; variant: 'warning' | 'success' | 'destructive' }> = {
  PENDING_APPROVAL: { label: 'Pending approval', variant: 'warning' },
  APPROVED: { label: 'Approved', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'destructive' },
};
const CIS_META: Record<CisStatus, { label: string; short: string }> = {
  VERIFIED: { label: 'Verified (20%)', short: 'Verified 20%' },
  UNVERIFIED: { label: 'Unverified (30%)', short: 'Unverified 30%' },
  GROSS: { label: 'Gross payment (0%)', short: 'Gross 0%' },
  OTHER: { label: 'Other rate', short: 'Other' },
};

const EMPTY: Omit<PayrollFilters, 'week'> = { companyId: '', search: '', stage: '', approval: '', payment: '', paid: '', cis: '' };

/** The three sections of the page. The open one is kept in the address (#todo, #lines, #overview). */
const SECTIONS = [
  { key: 'todo', label: 'To do', hint: 'What is waiting for you this week, in the order to do it', icon: ListChecks },
  { key: 'lines', label: 'Payroll lines', hint: 'Every worker of the week, with filters', icon: Table2 },
  { key: 'overview', label: 'Week overview', hint: 'The week in figures, by stage', icon: Eye },
] as const;
type SectionKey = (typeof SECTIONS)[number]['key'];

/** A payable row can be authorised (awaiting authorisation) or paid / taken back (authorised). Everything else is fixed. */
const selectable = (row: PayrollRow) => Boolean(row.payslipId) && row.payment !== 'PAID' && row.payment !== 'NOT_READY';

/**
 * Weekly payroll: all temporary workers of a payroll week in one place. Choose the week, check the complete payroll
 * (pay, CIS, fees, net, client charge, profit), see what is still waiting for approval, authorise the payments and
 * then record them as paid. The same view downloads as Excel for the accountant.
 */
export default function PayrollPage() {
  const { data: session } = useSession();
  const canAuthorise = Boolean(session?.permissions?.includes('payroll:approve'));
  const [week, setWeek] = useState(mondayOfIso(todayIso()));
  const [filters, setFilters] = useState(EMPTY);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<'authorise' | 'paid' | 'undo' | null>(null);
  const [paidDate, setPaidDate] = useState(todayIso());
  const [reference, setReference] = useState('');
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addFor, setAddFor] = useState<Worker | null>(null);
  const [justDownloaded, setJustDownloaded] = useState<string[] | null>(null);
  const issue = useIssuePayslips();
  const [menuOpen, setMenuOpen] = useState(false);
  const [recalc, setRecalc] = useState<RecalculationPreview | null>(null);
  const recalculate = useRecalculate();

  const { section, chosen, open: openSection } = useSection<SectionKey>(['todo', 'lines', 'overview'], 'todo');

  const query: PayrollFilters = { week, ...filters };
  const { data, isLoading, isError, error, refetch, isFetching } = usePayroll(query);
  // the To do section looks at the whole week, whatever the filters of the lines are
  const { data: whole } = usePayroll({ week, ...EMPTY });
  const authorise = useAuthorisePayments();
  const unauthorise = useUnauthorisePayments();
  const paid = useMarkPaid();

  const rows = data?.rows ?? [];
  const s = data?.summary;
  const filtersOn = Object.values(filters).some(Boolean);
  const set = <K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setSelected(new Set());
  };
  const goWeek = (next: string) => {
    setWeek(next);
    setSelected(new Set());
    setNotice(null);
  };

  const picked = useMemo(() => rows.filter((row) => row.payslipId && selected.has(row.payslipId)), [rows, selected]);
  const pickedUnpaid = picked.filter((r) => r.payment === 'UNPAID');
  const pickedAuthorised = picked.filter((r) => r.payment === 'AUTHORISED');
  const sum = (list: PayrollRow[], key: 'gross' | 'cisDeduction' | 'payrollFee' | 'netPay') => Math.round(list.reduce((t, r) => t + r[key] * 100, 0)) / 100;
  const selectableRows = rows.filter(selectable);
  const allTicked = selectableRows.length > 0 && selectableRows.every((r) => selected.has(r.payslipId!));
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectAwaiting = () => setSelected(new Set(rows.filter((r) => r.payment === 'UNPAID' && r.payslipId).map((r) => r.payslipId!)));

  // ---- the To do section: what the week still needs, step by step
  const wholeRows = whole?.rows ?? [];
  const toAuthorise = wholeRows.filter((r) => r.payment === 'UNPAID' && r.payslipId);
  const toPay = wholeRows.filter((r) => r.payment === 'AUTHORISED' && r.payslipId);
  const toIssue = wholeRows.filter((r) => r.payslipId && !r.issuedAt && r.payment !== 'NOT_READY');
  const missing = whole?.expected ?? [];
  const waitingApproval = whole?.summary.waitingApproval.count ?? 0;
  const todoCount = (canAuthorise ? missing.length : 0) + (waitingApproval > 0 ? 1 : 0) + toAuthorise.length + toPay.length + toIssue.length;
  // nothing was chosen yet: open To do when the week has something to do, otherwise the lines
  const shown: SectionKey = chosen ? section : whole && todoCount === 0 && wholeRows.length > 0 ? 'lines' : section;
  const netOf = (list: PayrollRow[]) => Math.round(list.reduce((t, r) => t + r.netPay * 100, 0)) / 100;

  /** Ticks these lines (and clears the filters, so the dialog sees all of them) and opens the dialog for the step. */
  function startStep(kind: 'authorise' | 'paid' | 'undo', list: PayrollRow[]) {
    setFilters(EMPTY);
    setSelected(new Set(list.map((r) => r.payslipId!)));
    setDialog(kind);
  }

  async function downloadFor(list: PayrollRow[]) {
    setNotice(null);
    const ids = list.map((r) => r.payslipId!);
    try {
      await downloadPayslips({ week, ...EMPTY }, 'zip', ids);
      setNotice({ tone: 'ok', text: `${ids.length} payslip${ids.length === 1 ? '' : 's'} downloaded as a ZIP of PDFs.` });
      setJustDownloaded(ids);
    } catch (e) {
      setNotice({ tone: 'error', text: messageOf(e, 'The payslips could not be generated.') });
    }
  }

  async function run(kind: 'authorise' | 'paid' | 'undo') {
    setBusy(true);
    setNotice(null);
    try {
      const ids = (kind === 'authorise' ? pickedUnpaid : pickedAuthorised).map((r) => r.payslipId!);
      const result: PaymentResult =
        kind === 'authorise' ? await authorise.mutateAsync(ids) : kind === 'undo' ? await unauthorise.mutateAsync(ids) : await paid.mutateAsync({ payslipIds: ids, paidDate, reference: reference.trim() || undefined });
      const verb = kind === 'authorise' ? 'authorised' : kind === 'undo' ? 'taken back to awaiting authorisation' : 'marked as paid';
      setNotice({
        tone: result.skipped.length > 0 ? 'error' : 'ok',
        text: `${result.updated} payment${result.updated === 1 ? '' : 's'} ${verb} (${money(result.netPay)} net).${result.skipped.length ? ` ${result.skipped.length} skipped: ${result.skipped[0]!.reason}` : ''}`,
      });
      setSelected(new Set());
      setDialog(null);
      setReference('');
    } catch (e) {
      setNotice({ tone: 'error', text: messageOf(e, 'That did not work. Nothing was changed.') });
      setDialog(null);
    } finally {
      setBusy(false);
    }
  }

  /** The payslips of the ticked lines, or of every line shown when none is ticked. */
  async function payslips(format: 'zip' | 'pdf') {
    setMenuOpen(false);
    setNotice(null);
    const ids = picked.filter((r) => r.payslipId).map((r) => r.payslipId!);
    try {
      await downloadPayslips(query, format, ids);
      const given = ids.length > 0 ? ids : rows.filter((r) => r.payslipId).map((r) => r.payslipId!);
      setNotice({ tone: 'ok', text: `${given.length} payslip(s) downloaded as ${format === 'zip' ? 'a ZIP of PDFs' : 'one PDF'}.` });
      setJustDownloaded(rows.filter((r) => given.includes(r.payslipId ?? '') && !r.issuedAt).map((r) => r.payslipId!));
    } catch (e) {
      setNotice({ tone: 'error', text: messageOf(e, 'The payslips could not be generated.') });
    }
  }

  async function markIssued(ids: string[]) {
    setNotice(null);
    try {
      const result = await issue.mutateAsync(ids);
      setNotice({ tone: result.skipped.length > 0 && result.updated === 0 ? 'error' : 'ok', text: `${result.updated} payslip${result.updated === 1 ? '' : 's'} marked as issued.${result.skipped.length ? ` ${result.skipped.length} skipped: ${result.skipped[0]!.reason}` : ''}` });
      setJustDownloaded(null);
      setSelected(new Set());
    } catch (e) {
      setNotice({ tone: 'error', text: messageOf(e, 'That did not work.') });
    }
  }

  async function previewRecalculation() {
    setNotice(null);
    try {
      setRecalc(await recalculate.mutateAsync({ week, dryRun: true }));
    } catch (e) {
      setNotice({ tone: 'error', text: messageOf(e, 'The recalculation could not be checked.') });
    }
  }

  async function applyRecalculation() {
    try {
      const done = await recalculate.mutateAsync({ week, dryRun: false });
      setNotice({ tone: 'ok', text: `Payroll recalculated: ${done.changed} timesheet${done.changed === 1 ? '' : 's'} updated (net ${done.netDelta >= 0 ? '+' : '−'}${money(Math.abs(done.netDelta))})${done.skipped ? `, ${done.skipped} left alone (authorised or paid)` : ''}.` });
    } catch (e) {
      setNotice({ tone: 'error', text: messageOf(e, 'The recalculation failed. Nothing was changed.') });
    }
    setRecalc(null);
  }

  async function exportExcel() {
    setNotice(null);
    try {
      await downloadPayrollXlsx(query, `Payroll week ${week}.xlsx`);
    } catch (e) {
      setNotice({ tone: 'error', text: messageOf(e, 'The Excel file could not be downloaded.') });
    }
  }

  const totalNet = s ? s.awaitingAuthorisation.netPay + s.authorised.netPay + s.paid.netPay : 0;
  const pct = (part: number) => (totalNet > 0 ? Math.round((part / totalNet) * 100) : 0);

  return (
    <div className="flex flex-col gap-6">
      <PageBanner tone="pink" icon={BannerIcon} title="Weekly payroll" description={<>Everyone due to be paid for the week. <b>Approve</b> the timesheets → <b>authorise</b> the payments → record them as <b>paid</b> → send the payslips. <b>To do</b> shows what is left.</>}>
        <div className="flex flex-wrap items-center gap-2">
          {canAuthorise ? (
            <Button type="button" onClick={() => setAdding(true)} data-testid="add-worker">
              <UserPlus className="mr-1.5 h-4 w-4" /> Add worker
            </Button>
          ) : null}
          {canAuthorise ? (
            <Button type="button" variant="outline" onClick={() => void previewRecalculation()} disabled={recalculate.isPending || rows.length === 0} data-testid="recalculate" title="Work the whole week out again">
              {recalculate.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />} Recalculate
            </Button>
          ) : null}
          {canAuthorise ? (
            <div className="relative">
              <Button type="button" variant="outline" onClick={() => setMenuOpen((now) => !now)} aria-expanded={menuOpen} aria-haspopup="menu" disabled={!rows.some((r) => r.payslipId)} data-testid="payslips-menu">
                <FileText className="mr-1.5 h-4 w-4" /> Payslips <ChevronDown className="ml-1 h-3.5 w-3.5" />
              </Button>
              {menuOpen ? (
                <div role="menu" className="absolute right-0 z-20 mt-1 w-72 rounded-lg border border-border bg-card p-1 shadow-lg">
                  <p className="px-3 py-1.5 text-xs text-foreground/55">{picked.filter((r) => r.payslipId).length > 0 ? `The ${picked.filter((r) => r.payslipId).length} ticked payslips` : `All ${rows.filter((r) => r.payslipId).length} payslips shown for this week`}</p>
                  <button type="button" role="menuitem" className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => void payslips('zip')} data-testid="payslips-zip">
                    <span className="font-medium">ZIP of PDFs</span>
                    <span className="block text-xs text-foreground/55">One file per worker, ready to send</span>
                  </button>
                  <button type="button" role="menuitem" className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => void payslips('pdf')} data-testid="payslips-pdf">
                    <span className="font-medium">One PDF</span>
                    <span className="block text-xs text-foreground/55">Every payslip, a page each, to print</span>
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          <Button type="button" variant="outline" onClick={() => void exportExcel()} disabled={!canAuthorise || rows.length === 0} title={canAuthorise ? 'Download this view as Excel' : 'Needs permission to approve payroll'} data-testid="export-payroll">
            <Download className="mr-1.5 h-4 w-4" /> Excel
          </Button>
          <Link href="/timesheets" className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-accent">
            Timesheets
          </Link>
        </div>
      </PageBanner>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-1 rounded-lg border border-border p-1" data-testid="payroll-week-nav">
          <Button type="button" variant="ghost" size="sm" aria-label="Previous week" onClick={() => goWeek(addDaysIso(week, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="flex min-w-[220px] items-center justify-center gap-1.5 px-2 text-sm font-semibold" aria-live="polite">
            <CalendarDays className="h-4 w-4 text-foreground/50" />
            {weekLabel(week)}
          </span>
          <Button type="button" variant="ghost" size="sm" aria-label="Next week" onClick={() => goWeek(addDaysIso(week, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Input type="date" className="w-44" aria-label="Pick any date in the payroll week" value={week} onChange={(event) => event.target.value && goWeek(mondayOfIso(event.target.value))} />
        <Button type="button" variant="outline" size="sm" disabled={week === mondayOfIso(todayIso())} onClick={() => goWeek(mondayOfIso(todayIso()))}>
          This week
        </Button>
        {isFetching ? <Loader2 className="h-4 w-4 animate-spin text-foreground/40" aria-label="Refreshing" /> : null}
      </div>

      {s ? (
        <>
<div className="rounded-xl border border-border p-4" data-testid="payment-progress">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-semibold">Payment progress</span>
              <span className="text-foreground/60">
                {s.waitingApproval.count > 0 ? `${s.waitingApproval.count} timesheet${s.waitingApproval.count === 1 ? '' : 's'} not yet approved · ` : ''}
                {money(s.paid.netPay)} of {money(totalNet)} paid
              </span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-accent" role="img" aria-label={`Paid ${pct(s.paid.netPay)}%, authorised ${pct(s.authorised.netPay)}%, awaiting authorisation ${pct(s.awaitingAuthorisation.netPay)}%`}>
              <div className="bg-emerald-500" style={{ width: `${pct(s.paid.netPay)}%` }} />
              <div className="bg-sky-500" style={{ width: `${pct(s.authorised.netPay)}%` }} />
              <div className="bg-amber-400" style={{ width: `${pct(s.awaitingAuthorisation.netPay)}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-foreground/70">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Awaiting authorisation: {s.awaitingAuthorisation.count} · {money(s.awaitingAuthorisation.netPay)}</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sky-500" /> Authorised: {s.authorised.count} · {money(s.authorised.netPay)}</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Paid: {s.paid.count} · {money(s.paid.netPay)}</span>
            </div>
          </div>
{data!.warnings.length > 0 ? (
            <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto" data-testid="payroll-warnings">
              {data!.warnings.map((w) => (
                <li key={w.code} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${w.severity === 'warning' ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300' : 'border-border bg-accent/30 text-foreground/70'}`}>
                  {w.severity === 'warning' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <Info className="mt-0.5 h-4 w-4 shrink-0" />}
                  {w.message}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}

      {notice ? (
        <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-3 py-2 text-sm ${notice.tone === 'ok' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300' : 'border-destructive/40 bg-destructive/10 text-destructive'}`} data-testid="payroll-notice">
          {notice.text}
          {notice.tone === 'ok' && justDownloaded && justDownloaded.length > 0 ? (
            <button type="button" className="ml-2 font-semibold underline" onClick={() => void markIssued(justDownloaded)} data-testid="mark-issued-after-download">
              Mark these {justDownloaded.length} as issued
            </button>
          ) : null}
        </p>
      ) : null}

      {/* the three sections of the page */}
      <SectionTabs sections={SECTIONS} value={shown} onChange={openSection} label="Sections of Weekly payroll" counts={{ todo: todoCount, lines: wholeRows.length }} />

      {shown === 'todo' ? (
        <div className="flex flex-col gap-5" data-testid="payroll-todo">
          {whole && todoCount === 0 ? (
            <NothingToDo
              text={wholeRows.length === 0 ? 'There are no timesheets for this week yet. Add them first; approved ones come here ready to pay.' : 'Everything for this week is authorised, paid and issued.'}
              action={
                <div className="mt-1 flex flex-wrap justify-center gap-2">
                  <Link href="/timesheets" className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
                    Go to Timesheets
                  </Link>
                  {wholeRows.length > 0 ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => openSection('lines')}>
                      See the payroll lines
                    </Button>
                  ) : null}
                </div>
              }
            />
          ) : null}

          {canAuthorise && missing.length > 0 ? (
            <TodoGroup testId="payroll-todo-missing" step={1} icon={UserPlus} title={`Add ${missing.length} missing timesheet${missing.length === 1 ? '' : 's'}`} help="These workers are expected this week but no timesheet has been added for them yet.">
              {missing.map((item) => (
                <TodoRow
                  key={`${item.candidateId}-${item.placementId}`}
                  title={<span className="font-medium">{item.workerName}</span>}
                  detail={`${item.companyName} · ${item.jobTitle}`}
                  action={
                    <Button type="button" size="sm" onClick={() => setAddFor({ id: item.candidateId, name: item.workerName, placements: [{ id: item.placementId, companyId: item.companyId, companyName: item.companyName, jobId: '', jobTitle: item.jobTitle }], profile: null })}>
                      Add timesheet
                    </Button>
                  }
                />
              ))}
            </TodoGroup>
          ) : null}

          {waitingApproval > 0 ? (
            <TodoGroup testId="payroll-todo-approve" step={2} icon={Clock} title="Approve the timesheets" help="A timesheet goes into the payroll only after it is approved.">
              <TodoRow
                title={<span className="font-medium">{waitingApproval} timesheet{waitingApproval === 1 ? ' is' : 's are'} waiting for approval</span>}
                detail={`${weekLabel(week)} · ${money(whole!.summary.waitingApproval.netPay)} net`}
                action={
                  <Link href="/timesheets#todo" className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
                    Check &amp; approve
                  </Link>
                }
              />
            </TodoGroup>
          ) : null}

          {toAuthorise.length > 0 ? (
            <TodoGroup
              testId="payroll-todo-authorise"
              step={3}
              icon={BadgeCheck}
              title={`Authorise ${toAuthorise.length} payment${toAuthorise.length === 1 ? '' : 's'}`}
              help="Check the payroll, then authorise it: it approves the money to be sent. You record it as paid afterwards."
              actions={
                canAuthorise ? (
                  <Button type="button" onClick={() => startStep('authorise', toAuthorise)}>
                    <BadgeCheck className="mr-1.5 h-4 w-4" /> Authorise all {toAuthorise.length} · {money(netOf(toAuthorise))}
                  </Button>
                ) : (
                  <span className="text-xs text-foreground/55">Needs permission to approve payroll</span>
                )
              }
            >
              {toAuthorise.map((row) => (
                <TodoRow
                  key={row.timesheetId}
                  title={
                    <Link href={`/timesheets/${row.timesheetId}`} className="font-medium hover:underline">
                      {row.workerName}
                    </Link>
                  }
                  detail={`${row.companyName} · ${row.units} ${unitLabel(row.rateType)} · gross ${money(row.gross)}`}
                  aside={<span className="text-sm font-semibold tabular-nums">{money(row.netPay)}</span>}
                  action={
                    !row.hasNino || !row.hasUtr ? (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-700" title="NINO or UTR missing">
                        <AlertTriangle className="h-3.5 w-3.5" /> NINO/UTR missing
                      </span>
                    ) : (
                      <span className="text-xs text-foreground/40">ready</span>
                    )
                  }
                />
              ))}
            </TodoGroup>
          ) : null}

          {toPay.length > 0 ? (
            <TodoGroup
              testId="payroll-todo-pay"
              step={4}
              icon={Banknote}
              title={`Record ${toPay.length} payment${toPay.length === 1 ? '' : 's'} as paid`}
              help="These are authorised. Once the money has actually been sent, record it as paid."
              actions={
                canAuthorise ? (
                  <>
                    <Button type="button" onClick={() => startStep('paid', toPay)}>
                      <Banknote className="mr-1.5 h-4 w-4" /> Mark all {toPay.length} as paid · {money(netOf(toPay))}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => startStep('undo', toPay)} data-testid="todo-undo-authorise" title="Put them back to awaiting authorisation">
                      <Undo2 className="mr-1.5 h-4 w-4" /> Take back
                    </Button>
                  </>
                ) : null
              }
            >
              {toPay.map((row) => (
                <TodoRow
                  key={row.timesheetId}
                  title={
                    <Link href={`/timesheets/${row.timesheetId}`} className="font-medium hover:underline">
                      {row.workerName}
                    </Link>
                  }
                  detail={`${row.companyName} · ${row.units} ${unitLabel(row.rateType)}`}
                  aside={<span className="text-sm font-semibold tabular-nums">{money(row.netPay)}</span>}
                  action={<span className="text-xs text-sky-700">authorised</span>}
                />
              ))}
            </TodoGroup>
          ) : null}

          {toIssue.length > 0 ? (
            <TodoGroup
              testId="payroll-todo-payslips"
              step={5}
              icon={FileText}
              title={`Send ${toIssue.length} payslip${toIssue.length === 1 ? '' : 's'} to the workers`}
              help="Download the payslips as PDFs (one file per worker), send them, then mark them as issued."
              actions={
                canAuthorise ? (
                  <>
                    <Button type="button" onClick={() => void downloadFor(toIssue)}>
                      <Download className="mr-1.5 h-4 w-4" /> Download {toIssue.length} as ZIP
                    </Button>
                    <Button type="button" variant="outline" disabled={issue.isPending} onClick={() => void markIssued(toIssue.map((r) => r.payslipId!))}>
                      <FileText className="mr-1.5 h-4 w-4" /> Mark as issued
                    </Button>
                  </>
                ) : null
              }
            >
              {toIssue.map((row) => (
                <TodoRow
                  key={row.timesheetId}
                  title={<span className="font-medium">{row.workerName}</span>}
                  detail={`${row.companyName} · net ${money(row.netPay)}`}
                  action={
                    <button type="button" aria-label={`Download the payslip of ${row.workerName}`} title="Payslip PDF" className="rounded p-1 text-foreground/50 hover:bg-accent hover:text-foreground" onClick={() => void downloadPayslipPdf(row.timesheetId, `Payslip - ${row.workerName} - week ${week}.pdf`)}>
                      <FileText className="h-4 w-4" />
                    </button>
                  }
                />
              ))}
            </TodoGroup>
          ) : null}
        </div>
      ) : null}

      {shown === 'lines' ? (
        <div className="flex flex-col gap-4" data-testid="payroll-lines">
      <div className="flex flex-wrap items-end gap-3" role="search" aria-label="Payroll filters">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pf-worker">Worker or client</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
            <Input id="pf-worker" className="w-52 pl-8" placeholder="Search…" value={filters.search} onChange={(event) => set('search', event.target.value)} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pf-client">Client</Label>
          <Select id="pf-client" className="w-48" value={filters.companyId} onChange={(event) => set('companyId', event.target.value)}>
            <option value="">All clients</option>
            {(data?.clients ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pf-stage">Stage</Label>
          <Select id="pf-stage" className="w-48" value={filters.stage} onChange={(event) => set('stage', event.target.value as PayrollStage | '')}>
            <option value="">Any stage</option>
            <option value="TIMESHEET_RECEIVED">Timesheet received</option>
            <option value="AWAITING_APPROVAL">Awaiting approval</option>
            <option value="APPROVED_FOR_PAYROLL">Approved for payroll</option>
            <option value="PAYROLL_GENERATED">Payroll generated</option>
            <option value="PAYSLIP_ISSUED">Payslip issued</option>
            <option value="PAYMENT_AUTHORISED">Payment authorised</option>
            <option value="PAID">Paid</option>
            <option value="REJECTED">Rejected</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pf-approval">Approval</Label>
          <Select id="pf-approval" className="w-44" value={filters.approval} onChange={(event) => set('approval', event.target.value as Approval | '')}>
            <option value="">Approved / pending</option>
            <option value="APPROVED">Approved</option>
            <option value="PENDING_APPROVAL">Pending approval</option>
            <option value="REJECTED">Rejected</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pf-payment">Payment status</Label>
          <Select id="pf-payment" className="w-52" value={filters.payment} onChange={(event) => set('payment', event.target.value as PaymentState | '')}>
            <option value="">Any status</option>
            <option value="NOT_READY">Not ready (not approved)</option>
            <option value="UNPAID">Awaiting authorisation</option>
            <option value="AUTHORISED">Authorised</option>
            <option value="PAID">Paid</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pf-paid">Paid / unpaid</Label>
          <Select id="pf-paid" className="w-36" value={filters.paid} onChange={(event) => set('paid', event.target.value as 'PAID' | 'UNPAID' | '')}>
            <option value="">Paid and unpaid</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PAID">Paid</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pf-cis">CIS status</Label>
          <Select id="pf-cis" className="w-48" value={filters.cis} onChange={(event) => set('cis', event.target.value as CisStatus | '')}>
            <option value="">Any CIS status</option>
            {(Object.keys(CIS_META) as CisStatus[]).map((key) => (
              <option key={key} value={key}>
                {CIS_META[key].label}
              </option>
            ))}
          </Select>
        </div>
        {filtersOn ? (
          <Button type="button" variant="ghost" onClick={() => (setFilters(EMPTY), setSelected(new Set()))} data-testid="clear-payroll-filters">
            <X className="mr-1.5 h-4 w-4" /> Clear filters
          </Button>
        ) : null}
      </div>

      {canAuthorise && picked.length > 0 ? (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-primary/40 bg-card px-4 py-3 shadow-md" data-testid="payroll-action-bar">
          <p className="text-sm font-semibold">
            {picked.length} selected · net {money(sum(picked, 'netPay'))}
          </p>
          {picked.filter((r) => !r.issuedAt).length > 0 ? (
            <Button type="button" variant="outline" disabled={issue.isPending} onClick={() => void markIssued(picked.filter((r) => !r.issuedAt).map((r) => r.payslipId!))} data-testid="issue-payslips">
              <FileText className="mr-1.5 h-4 w-4" /> Mark {picked.filter((r) => !r.issuedAt).length} payslip{picked.filter((r) => !r.issuedAt).length === 1 ? '' : 's'} as issued
            </Button>
          ) : null}
          {pickedUnpaid.length > 0 ? (
            <Button type="button" onClick={() => setDialog('authorise')} data-testid="authorise">
              <BadgeCheck className="mr-1.5 h-4 w-4" /> Authorise {pickedUnpaid.length} payment{pickedUnpaid.length === 1 ? '' : 's'}
            </Button>
          ) : null}
          {pickedAuthorised.length > 0 ? (
            <>
              <Button type="button" onClick={() => setDialog('paid')} data-testid="mark-paid">
                <Banknote className="mr-1.5 h-4 w-4" /> Mark {pickedAuthorised.length} as paid
              </Button>
              <Button type="button" variant="outline" onClick={() => setDialog('undo')} data-testid="undo-authorise">
                <Undo2 className="mr-1.5 h-4 w-4" /> Take authorisation back
              </Button>
            </>
          ) : null}
          <Button type="button" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
        </div>
      ) : null}

      {isError ? (
        <div role="alert" className="flex flex-col items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          The payroll could not be loaded{error instanceof Error ? `: ${error.message}` : ''}.
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : isLoading ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-accent/50" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-16 text-center" data-testid="payroll-empty">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
            <Clock className="h-6 w-6 text-foreground/50" />
          </span>
          <h3 className="mt-4 text-sm font-semibold">{filtersOn && (data?.totalInWeek ?? 0) > 0 ? 'No payroll line matches these filters' : 'No timesheets for this week'}</h3>
          <p className="mt-1 max-w-sm text-sm text-foreground/55">{filtersOn && (data?.totalInWeek ?? 0) > 0 ? `${data!.totalInWeek} line(s) exist this week. Clear the filters to see them.` : 'Add the week’s timesheets first; approved ones appear here ready to pay.'}</p>
          <Link href="/timesheets" className="mt-4 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
            Go to Timesheets
          </Link>
        </div>
      ) : (
        <div className={`max-h-[65vh] overflow-auto border ${TABLE_TONES.pink.box}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-accent/20 px-4 py-2 text-xs text-foreground/65">
            <span>
              {rows.length} line{rows.length === 1 ? '' : 's'}
              {data!.totalInWeek !== rows.length ? ` of ${data!.totalInWeek} this week` : ''}
            </span>
            {canAuthorise && s && s.awaitingAuthorisation.count > 0 ? (
              <button type="button" className="font-semibold text-primary underline" onClick={selectAwaiting} data-testid="select-awaiting">
                Select all {s.awaitingAuthorisation.count} awaiting authorisation ({money(s.awaitingAuthorisation.netPay)})
              </button>
            ) : null}
          </div>
          <table className="w-full min-w-[1100px] text-sm" data-testid="payroll-table">
            <thead className="sticky top-0 z-10 bg-accent text-left text-xs uppercase tracking-wide text-foreground/70">
              <tr>
                {canAuthorise ? (
                  <th className="w-10 px-3 py-2.5">
                    <input type="checkbox" aria-label="Select every payable line" checked={allTicked} disabled={selectableRows.length === 0} onChange={(event) => setSelected(event.target.checked ? new Set(selectableRows.map((r) => r.payslipId!)) : new Set())} />
                  </th>
                ) : null}
                <th className="px-3 py-2.5 font-medium">Worker</th>
                <th className="px-3 py-2.5 font-medium">Client</th>
                <th className="px-3 py-2.5 font-medium">CIS</th>
                <th className="px-3 py-2.5 text-right font-medium">Days / hours</th>
                <th className="px-3 py-2.5 text-right font-medium">Gross</th>
                <th className="px-3 py-2.5 text-right font-medium">CIS</th>
                <th className="px-3 py-2.5 text-right font-medium">Fee</th>
                <th className="px-3 py-2.5 text-right font-medium">Net pay</th>
                <th className="px-3 py-2.5 text-right font-medium">Charge</th>
                <th className="px-3 py-2.5 text-right font-medium">Profit</th>
                <th className="px-3 py-2.5 font-medium">Stage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                const dim = row.approval === 'REJECTED';
                return (
                  <tr key={row.timesheetId} className={`${dim ? 'opacity-60' : ''} ${row.payslipId && selected.has(row.payslipId) ? 'bg-primary/5' : ''}`} data-testid="payroll-row" data-payment={row.payment}>
                    {canAuthorise ? (
                      <td className="px-3 py-3">
                        <input type="checkbox" aria-label={`Select ${row.workerName}`} disabled={!selectable(row)} checked={Boolean(row.payslipId && selected.has(row.payslipId))} onChange={() => row.payslipId && toggle(row.payslipId)} />
                      </td>
                    ) : null}
                    <td className="px-3 py-3 font-medium">
                      <Link href={`/timesheets/${row.timesheetId}`} className="hover:underline">
                        {row.workerName}
                      </Link>
                      {!row.hasNino || !row.hasUtr ? (
                        <span className="ml-1.5 text-amber-600" title="NINO or UTR missing">
                          <AlertTriangle className="inline h-3.5 w-3.5" />
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-foreground/75">{row.companyName}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-foreground/70">{CIS_META[row.cisStatus].short}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                      {row.units} {unitLabel(row.rateType)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{money(row.gross)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground/70">{money(row.cisDeduction)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground/70">{money(row.payrollFee)}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{money(row.netPay)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{money(row.chargeTotal)}</td>
                    <td className={`px-3 py-3 text-right tabular-nums ${row.profit < 0 ? 'text-destructive' : ''}`}>{money(row.profit)}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {row.payslipId ? (
                        <button type="button" aria-label={`Download the payslip of ${row.workerName}`} title="Payslip PDF" className="mr-2 rounded p-1 align-middle text-foreground/50 hover:bg-accent hover:text-foreground" onClick={() => void downloadPayslipPdf(row.timesheetId, `Payslip - ${row.workerName} - week ${week}.pdf`).catch((e) => setNotice({ tone: 'error', text: messageOf(e, 'The payslip could not be downloaded.') }))} data-testid="row-payslip">
                          <FileText className="h-4 w-4" />
                        </button>
                      ) : null}
                      <span title={row.paidAt ? `Paid ${new Date(row.paidAt).toLocaleDateString('en-GB')}${row.paymentReference ? ` · ${row.paymentReference}` : ''}` : undefined}>
                        <StageBadge stage={row.stage} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-border bg-accent/30 text-sm font-semibold">
              <tr>
                <td className="px-3 py-3" colSpan={canAuthorise ? 5 : 4}>
                  Total of the {rows.length} line{rows.length === 1 ? '' : 's'} shown
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{money(sum(rows, 'gross'))}</td>
                <td className="px-3 py-3 text-right tabular-nums">{money(sum(rows, 'cisDeduction'))}</td>
                <td className="px-3 py-3 text-right tabular-nums">{money(sum(rows, 'payrollFee'))}</td>
                <td className="px-3 py-3 text-right tabular-nums" data-testid="total-net">
                  {money(sum(rows, 'netPay'))}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{money(Math.round(rows.reduce((t, r) => t + r.chargeTotal * 100, 0)) / 100)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{money(Math.round(rows.reduce((t, r) => t + r.profit * 100, 0)) / 100)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

        </div>
      ) : null}

      {shown === 'overview' && s ? (
        <div className="flex flex-col gap-6" data-testid="payroll-overview">
<StageStrip counts={data!.stageCounts} active={filters.stage ?? ''} onPick={(stage) => set('stage', stage)} />

          <WeeklySummary data={data!} />
<ExpectedPanel
            items={data!.expected}
            canAdd={canAuthorise}
            onAdd={(item) => setAddFor({ id: item.candidateId, name: item.workerName, placements: [{ id: item.placementId, companyId: item.companyId, companyName: item.companyName, jobId: '', jobTitle: item.jobTitle }], profile: null })}
          />
        </div>
      ) : null}
      {adding ? (
        <TimesheetFormDialog
          initialWeek={week}
          offerApprove
          onClose={() => setAdding(false)}
          onSaved={(id, info) => {
            setAdding(false);
            setNotice(info?.approveError ? { tone: 'error', text: `Added to the week, but it could not be approved: ${info.approveError} Open it to fix it.` } : { tone: 'ok', text: 'Worker added to this payroll week.' });
          }}
        />
      ) : null}

      {addFor ? (
        <TimesheetFormDialog
          initialWeek={week}
          offerApprove
          prefillWorker={addFor}
          onClose={() => setAddFor(null)}
          onSaved={(id, info) => {
            setAddFor(null);
            setNotice(info?.approveError ? { tone: 'error', text: `Timesheet added, but it could not be approved: ${info.approveError} Open it to fix it.` } : { tone: 'ok', text: 'Timesheet added for this worker.' });
          }}
        />
      ) : null}

      {recalc ? (
        <Dialog
          open
          onOpenChange={(open) => !open && setRecalc(null)}
          title="Recalculate the whole week?"
          description={`Days, rates, the workers' current CIS rate and fee, bonuses, deductions and overrides are worked out again for ${weekLabel(week)}.`}
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setRecalc(null)}>
                Cancel
              </Button>
              <Button type="button" disabled={recalculate.isPending || recalc.changed === 0} onClick={() => void applyRecalculation()} data-testid="recalculate-confirm">
                {recalculate.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
                {recalc.changed === 0 ? 'Nothing to change' : `Apply to ${recalc.changed} timesheet${recalc.changed === 1 ? '' : 's'}`}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3 text-sm" data-testid="recalculate-preview">
            <p>
              <strong>{recalc.changed}</strong> of {recalc.total} would change · {recalc.unchanged} already correct{recalc.skipped ? ` · ${recalc.skipped} left alone (authorised or paid)` : ''}.
              {recalc.changed > 0 ? <span> Net payments change by <strong>{recalc.netDelta >= 0 ? '+' : '−'}{money(Math.abs(recalc.netDelta))}</strong>.</span> : null}
            </p>
            {recalc.lines.length > 0 ? (
              <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {recalc.lines.map((line) => (
                  <li key={line.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span>
                      {line.worker}
                      <span className="block text-xs text-foreground/55">{line.state === 'skipped' ? line.reason : Object.keys(line.changes).join(', ')}</span>
                    </span>
                    {line.state === 'changed' ? <span className="tabular-nums">{money(line.netFrom ?? 0)} → <strong>{money(line.netTo ?? 0)}</strong></span> : <span className="text-xs text-foreground/50">skipped</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-foreground/60">Everything for this week is already worked out correctly.</p>
            )}
            <p className="text-xs text-foreground/55">Each changed timesheet gets an entry in its history. Nothing is changed until you apply.</p>
          </div>
        </Dialog>
      ) : null}

      {dialog === 'authorise' ? (
        <Dialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title={`Authorise ${pickedUnpaid.length} payment${pickedUnpaid.length === 1 ? '' : 's'}?`}
          description="Check the complete payroll below. Authorising approves the money to be sent; you record it as paid afterwards."
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button type="button" disabled={busy || pickedUnpaid.length === 0} onClick={() => void run('authorise')} data-testid="authorise-confirm">
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <BadgeCheck className="mr-1.5 h-4 w-4" />}
                Authorise {money(sum(pickedUnpaid, 'netPay'))}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3 text-sm" data-testid="authorise-summary">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg border border-border bg-accent/20 px-4 py-3">
              <dt className="text-foreground/65">Week</dt>
              <dd className="text-right font-medium">{weekLabel(week)}</dd>
              <dt className="text-foreground/65">Workers</dt>
              <dd className="text-right font-medium">{new Set(pickedUnpaid.map((r) => r.candidateId)).size}</dd>
              <dt className="text-foreground/65">Gross pay</dt>
              <dd className="text-right tabular-nums">{money(sum(pickedUnpaid, 'gross'))}</dd>
              <dt className="text-foreground/65">CIS deducted (to HMRC)</dt>
              <dd className="text-right tabular-nums">−{money(sum(pickedUnpaid, 'cisDeduction'))}</dd>
              <dt className="text-foreground/65">Payroll fees</dt>
              <dd className="text-right tabular-nums">−{money(sum(pickedUnpaid, 'payrollFee'))}</dd>
              <dt className="border-t border-border pt-1.5 font-semibold">Net to pay the workers</dt>
              <dd className="border-t border-border pt-1.5 text-right text-base font-semibold tabular-nums">{money(sum(pickedUnpaid, 'netPay'))}</dd>
            </dl>
            <ul className="max-h-40 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {pickedUnpaid.map((r) => (
                <li key={r.timesheetId} className="flex items-center justify-between gap-3 px-3 py-1.5">
                  <span>
                    {r.workerName} <span className="text-foreground/50">· {r.companyName}</span>
                  </span>
                  <span className="tabular-nums">{money(r.netPay)}</span>
                </li>
              ))}
            </ul>
            {pickedUnpaid.some((r) => !r.hasNino || !r.hasUtr) ? (
              <p className="flex items-start gap-2 text-amber-800 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {pickedUnpaid.filter((r) => !r.hasNino || !r.hasUtr).length} of these have no NINO or UTR recorded.
              </p>
            ) : null}
            {s && s.waitingApproval.count > 0 ? (
              <p className="flex items-start gap-2 text-foreground/70">
                <Info className="mt-0.5 h-4 w-4 shrink-0" /> {s.waitingApproval.count} other timesheet(s) this week are still waiting for approval and are not included.
              </p>
            ) : null}
          </div>
        </Dialog>
      ) : null}

      {dialog === 'paid' ? (
        <Dialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title={`Mark ${pickedAuthorised.length} payment${pickedAuthorised.length === 1 ? '' : 's'} as paid`}
          description={`Net ${money(sum(pickedAuthorised, 'netPay'))}. Record it once the money has actually been sent.`}
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button type="button" disabled={busy || !paidDate || pickedAuthorised.length === 0} onClick={() => void run('paid')} data-testid="paid-confirm">
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Banknote className="mr-1.5 h-4 w-4" />}
                Mark as paid
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="paid-date">Date paid</Label>
              <Input id="paid-date" type="date" max={todayIso()} value={paidDate} onChange={(event) => setPaidDate(event.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="paid-ref">Bank reference (optional)</Label>
              <Input id="paid-ref" placeholder="e.g. BACS batch 112" value={reference} onChange={(event) => setReference(event.target.value)} />
            </div>
          </div>
        </Dialog>
      ) : null}

      {dialog === 'undo' ? (
        <Dialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title="Take the authorisation back?"
          description={`${pickedAuthorised.length} payment${pickedAuthorised.length === 1 ? '' : 's'} go back to awaiting authorisation. Only possible before they are paid.`}
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button type="button" disabled={busy || pickedAuthorised.length === 0} onClick={() => void run('undo')}>
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Undo2 className="mr-1.5 h-4 w-4" />}
                Take back
              </Button>
            </>
          }
        >
          <p className="text-sm text-foreground/70">This is written in the history of each timesheet.</p>
        </Dialog>
      ) : null}
    </div>
  );
}
