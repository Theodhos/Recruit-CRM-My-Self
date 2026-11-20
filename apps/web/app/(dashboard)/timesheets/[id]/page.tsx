'use client';

import { Button, Dialog, Label, Textarea } from '@crm/ui';
import { ArrowLeft, CheckCircle2, Download, FileText, Loader2, Pencil, Paperclip, ShieldAlert, XCircle } from '@crm/ui/icons';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { PayrollControl, PayslipPanel, lockReason } from '@/features/timesheets/payroll-control';
import { DiscrepancyList, EVENT_LABEL, StageBadge, StageStepper, dayLabel, money, unitLabel, weekDatesIso, weekLabel } from '@/features/timesheets/shared';
import { TimesheetFormDialog } from '@/features/timesheets/timesheet-form-dialog';
import { useApproveTimesheet, useMarkChecked, useRejectTimesheet, useTimesheet } from '@/hooks/use-timesheets';
import { useSession } from '@/hooks/use-session';
import { ApiClientError } from '@/lib/api-client';
import { downloadPayslipPdf, type TimesheetDay, type TimesheetEvent } from '@/services/timesheets.service';

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const messageOf = (error: unknown, fallback: string) => (error instanceof ApiClientError ? error.message : error instanceof Error ? error.message : fallback);

const FIELD_LABEL: Record<string, string> = {
  rateType: 'Paid per',
  payRate: 'Pay rate',
  chargeRate: 'Charge rate',
  days: 'Days worked',
  totalUnits: 'Total',
  clientConfirmedBy: 'Confirmed by',
  clientConfirmedEmail: 'Client email',
  attachmentDocumentId: 'Attached file',
  notes: 'Notes',
};

const daysText = (value: unknown) =>
  Array.isArray(value) && value.length > 0 ? (value as TimesheetDay[]).map((d) => `${dayLabel(d.date)} ${d.units}`).join(', ') : 'none';

function changeText(key: string, value: unknown) {
  if (key === 'days') return daysText(value);
  if (key === 'payRate' || key === 'chargeRate') return money(Number(value));
  if (key === 'attachmentDocumentId') return value ? 'a file' : 'no file';
  if (value === null || value === undefined || value === '') return 'empty';
  return String(value);
}

function History({ events }: { events: TimesheetEvent[] }) {
  return (
    <ol className="relative flex flex-col gap-4 border-l border-border pl-5" data-testid="timesheet-history">
      {events.map((event) => {
        const color = event.action === 'APPROVED' || event.action === 'PAYSLIP_GENERATED' || event.action === 'PAID' ? 'bg-emerald-500' : event.action === 'PAYMENT_AUTHORISED' ? 'bg-violet-500' : event.action === 'REJECTED' ? 'bg-rose-500' : event.action === 'AMENDED' || event.action === 'OVERRIDDEN' ? 'bg-amber-500' : event.action === 'ADJUSTMENT_ADDED' || event.action === 'ADJUSTMENT_REMOVED' ? 'bg-fuchsia-500' : 'bg-sky-500';
        return (
          <li key={event.id} className="relative" data-testid="history-event">
            <span className={`absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-background ${color}`} />
            <p className="text-sm">
              <span className="font-semibold">{EVENT_LABEL[event.action]}</span>
              <span className="text-foreground/60"> · {event.userName ?? 'System'} · {when(event.createdAt)}</span>
            </p>
            {event.note ? <p className="mt-0.5 text-sm text-foreground/80">{event.note}</p> : null}
            {event.changes ? (
              <ul className="mt-1 flex flex-col gap-0.5 text-xs text-foreground/70">
                {Object.entries(event.changes)
                  .filter(([key]) => key !== 'totalUnits' || !event.changes?.days)
                  .map(([key, change]) => (
                    <li key={key}>
                      <span className="font-medium">{FIELD_LABEL[key] ?? key}:</span> {changeText(key, change.from)} <span aria-hidden>→</span> {changeText(key, change.to)}
                    </li>
                  ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export default function TimesheetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const { data: sheet, isLoading, isError, error, refetch } = useTimesheet(id);
  const approve = useApproveTimesheet();
  const reject = useRejectTimesheet();
  const checked = useMarkChecked();
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null);
  const [amending, setAmending] = useState(false);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const canDecide = Boolean(session?.permissions?.includes('payroll:approve'));

  if (isLoading) return <div className="h-64 animate-pulse rounded-xl bg-accent/40" aria-busy="true" />;
  if (isError || !sheet) {
    return (
      <div className="flex flex-col items-start gap-3" role="alert">
        <Link href="/timesheets" className="flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> All timesheets
        </Link>
        <p className="text-sm text-destructive">The timesheet could not be loaded{error instanceof Error ? `: ${error.message}` : ''}.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const monday = sheet.weekStart.slice(0, 10);
  const byDate = new Map(sheet.days.map((d) => [d.date, d.units]));
  const blocked = sheet.status === 'PENDING_APPROVAL' && !sheet.canApprove;
  const unit = unitLabel(sheet.rateType);
  const unitOne = unitLabel(sheet.rateType, false);

  async function run(kind: 'approve' | 'reject') {
    setActionError(null);
    try {
      if (kind === 'approve') await approve.mutateAsync({ id, note: note.trim() || undefined });
      else await reject.mutateAsync({ id, reason: reason.trim() });
      setDialog(null);
      setNote('');
      setReason('');
    } catch (e) {
      setActionError(messageOf(e, 'That did not work. Please try again.'));
    }
  }

  async function pdf() {
    setDownloading(true);
    setActionError(null);
    try {
      await downloadPayslipPdf(sheet!.id, `Payslip - ${sheet!.candidateName} - week ${monday}.pdf`);
    } catch (e) {
      setActionError(messageOf(e, 'The payslip could not be downloaded.'));
    } finally {
      setDownloading(false);
    }
  }

  const hand = (key: 'gross' | 'cisDeduction' | 'payrollFee' | 'netPay' | 'chargeTotal') => sheet.overrides?.fields[key] !== undefined;
  const basePay = Math.round(sheet.totalUnits * sheet.payRate * 100) / 100;
  const adds = sheet.adjustments.filter((a) => a.kind === 'BONUS' || a.kind === 'ADDITIONAL_PAYMENT');
  const takes = sheet.adjustments.filter((a) => !adds.includes(a));
  const rows: { label: string; value: number; hand?: boolean; strong?: boolean }[] = [
    { label: `${sheet.totalUnits} ${unit} × ${money(sheet.payRate)}`, value: basePay },
    ...adds.map((a) => ({ label: a.label, value: a.amount })),
    ...(adds.length > 0 || hand('gross') ? [{ label: 'Gross pay', value: sheet.gross, hand: hand('gross'), strong: true }] : []),
    { label: `CIS deduction (${sheet.cisRate}%)`, value: -sheet.cisDeduction, hand: hand('cisDeduction') },
    { label: 'Payroll fee', value: -sheet.payrollFee, hand: hand('payrollFee') },
    ...takes.map((a) => ({ label: a.label, value: a.kind === 'ADJUSTMENT' ? a.amount : -a.amount })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/timesheets" className="mb-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> All timesheets
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold tracking-tight">{sheet.candidateName}</h2>
              <StageBadge stage={sheet.stage} />
            </div>
            <p className="mt-1 text-sm text-foreground/65">
              {sheet.company.name} · week {weekLabel(monday)}
            </p>
            <p className="mt-0.5 text-xs text-foreground/50">
              Submitted {when(sheet.submittedAt)}
              {sheet.submittedByName ? ` by ${sheet.submittedByName}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {sheet.status !== 'APPROVED' || (canDecide && !lockReason(sheet)) ? (
              <Button type="button" variant="outline" onClick={() => setAmending(true)} data-testid="amend">
                <Pencil className="mr-1.5 h-4 w-4" /> {sheet.status === 'REJECTED' ? 'Amend and resubmit' : 'Amend'}
              </Button>
            ) : null}
            {sheet.status === 'PENDING_APPROVAL' && canDecide && sheet.stage === 'TIMESHEET_RECEIVED' ? (
              <Button type="button" variant="outline" disabled={checked.isPending} onClick={() => void checked.mutateAsync(id).catch((e) => setActionError(messageOf(e, 'That did not work.')))} data-testid="mark-checked">
                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Checked: ready for approval
              </Button>
            ) : null}
            {sheet.status === 'PENDING_APPROVAL' && canDecide ? (
              <>
                <Button type="button" variant="outline" onClick={() => (setActionError(null), setDialog('reject'))} data-testid="reject">
                  <XCircle className="mr-1.5 h-4 w-4" /> Reject
                </Button>
                <Button type="button" disabled={blocked} title={blocked ? 'Fix the errors below first' : undefined} onClick={() => (setActionError(null), setDialog('approve'))} data-testid="approve">
                  <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve
                </Button>
              </>
            ) : null}
            {sheet.status === 'APPROVED' ? (
              <Button type="button" onClick={() => void pdf()} disabled={downloading} data-testid="download-payslip">
                {downloading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
                Payslip PDF
              </Button>
            ) : null}
          </div>
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border px-4 py-3">
          <StageStepper stage={sheet.stage} />
        </div>
        {sheet.status === 'PENDING_APPROVAL' && !canDecide ? (
          <p className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-accent/30 px-3 py-2 text-sm text-foreground/70">
            <ShieldAlert className="h-4 w-4" /> Only an authorised person can approve or reject payroll. Your account may add and amend timesheets.
          </p>
        ) : null}
        {actionError && !dialog ? (
          <p role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {actionError}
          </p>
        ) : null}
      </div>

      {sheet.status === 'REJECTED' && sheet.rejectionReason ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="status" data-testid="rejection-reason">
          <p className="font-semibold">
            Rejected{sheet.decidedByName ? ` by ${sheet.decidedByName}` : ''}
            {sheet.decidedAt ? ` · ${when(sheet.decidedAt)}` : ''}
          </p>
          <p className="mt-0.5">{sheet.rejectionReason}</p>
          <p className="mt-1 text-xs">Amend the timesheet and send it back for approval.</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <section className="rounded-xl border border-border p-4" aria-label="Days worked">
            <h3 className="mb-3 text-sm font-semibold">Days and hours</h3>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7" data-testid="days-view">
              {weekDatesIso(monday).map((date) => {
                const value = byDate.get(date);
                return (
                  <div key={date} className={`rounded-lg border px-2 py-2 text-center ${value ? 'border-primary/40 bg-primary/5' : 'border-border'}`}>
                    <p className="text-xs text-foreground/60">{dayLabel(date)}</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">{value ?? '–'}</p>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-sm">
              <strong>
                {sheet.totalUnits} {unit}
              </strong>{' '}
              at {money(sheet.payRate)} per {unitOne} (client charged {money(sheet.chargeRate)} per {unitOne}).
            </p>
          </section>

          {canDecide ? <PayrollControl sheet={sheet} /> : null}

          <section className="rounded-xl border border-border p-4" aria-label="Checks">
            <h3 className="mb-3 text-sm font-semibold">{sheet.status === 'APPROVED' ? 'Checks at approval' : 'Check before approving'}</h3>
            {sheet.status === 'APPROVED' ? <p className="text-sm text-foreground/65">This timesheet is approved and its payslip has been generated. An authorised person can still correct it until the payment is authorised.</p> : <DiscrepancyList items={sheet.discrepancies} />}
          </section>

          <section className="rounded-xl border border-border p-4" aria-label="Approval history">
            <h3 className="mb-4 text-sm font-semibold">Approval history</h3>
            <History events={sheet.events} />
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="rounded-xl border border-border p-4" aria-label="Payroll calculation" data-testid="calculation">
            <h3 className="mb-3 text-sm font-semibold">Payroll</h3>
            <dl className="flex flex-col gap-2 text-sm">
              {rows.map((row, index) => (
                <div key={`${row.label}-${index}`} className={`flex justify-between gap-3 ${row.strong ? 'border-t border-border pt-2 font-semibold' : ''}`}>
                  <dt className={row.strong ? '' : 'text-foreground/70'}>
                    {row.label}
                    {row.hand ? <span className="ml-1.5 rounded bg-amber-500/15 px-1 text-[10px] font-semibold text-amber-800 dark:text-amber-300">by hand</span> : null}
                  </dt>
                  <dd className="tabular-nums">{money(row.value, sheet.currency)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 border-t border-border pt-2 font-semibold">
                <dt>
                  Net payment to worker
                  {hand('netPay') ? <span className="ml-1.5 rounded bg-amber-500/15 px-1 text-[10px] font-semibold text-amber-800 dark:text-amber-300">by hand</span> : null}
                </dt>
                <dd className="tabular-nums" data-testid="net-pay">
                  {money(sheet.netPay, sheet.currency)}
                </dd>
              </div>
            </dl>
            <h4 className="mb-2 mt-5 text-sm font-semibold">Client and profit</h4>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-foreground/70">
                  Client charge ({sheet.totalUnits} × {money(sheet.chargeRate)})
                </dt>
                <dd className="tabular-nums">{money(sheet.chargeTotal, sheet.currency)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-border pt-2 font-semibold">
                <dt title="Client charge − gross pay + payroll fee">Profit</dt>
                <dd className={`tabular-nums ${sheet.profit < 0 ? 'text-destructive' : ''}`} data-testid="profit">
                  {money(sheet.profit, sheet.currency)}
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-foreground/50">Profit = client charge − gross pay + payroll fee. The CIS deduction is the worker’s tax and is paid to HMRC.</p>
          </section>

          {sheet.status === 'APPROVED' ? <PayslipPanel sheet={sheet} canEdit={canDecide} /> : null}

          <section className="rounded-xl border border-border p-4" aria-label="Client confirmation">
            <h3 className="mb-3 text-sm font-semibold">Client confirmation</h3>
            {sheet.clientConfirmedBy ? (
              <p className="text-sm">
                Confirmed by <strong>{sheet.clientConfirmedBy}</strong>
                {sheet.clientConfirmedEmail ? ` (${sheet.clientConfirmedEmail})` : ''}
                {sheet.clientConfirmedAt ? <span className="text-foreground/55"> · recorded {when(sheet.clientConfirmedAt)}</span> : null}
              </p>
            ) : (
              <p className="text-sm text-foreground/60">Nobody at the client is recorded as having confirmed these hours.</p>
            )}
            <p className="mt-3 flex items-center gap-2 text-sm">
              <Paperclip className="h-4 w-4 text-foreground/50" />
              {sheet.attachment ? (
                <Link href={`/candidates/${sheet.candidateId}`} className="text-primary hover:underline">
                  {sheet.attachment.name}
                </Link>
              ) : (
                <span className="text-foreground/60">No signed timesheet attached.</span>
              )}
            </p>
            {sheet.notes ? <p className="mt-3 whitespace-pre-wrap text-sm text-foreground/80">{sheet.notes}</p> : null}
            <p className="mt-3 text-xs text-foreground/55">
              Worker:{' '}
              <Link href={`/candidates/${sheet.candidateId}`} className="text-primary hover:underline">
                {sheet.candidateName}
              </Link>
              {sheet.profile ? ` · NINO ${sheet.profile.hasNino ? 'recorded' : 'missing'} · UTR ${sheet.profile.hasUtr ? 'recorded' : 'missing'}` : ' · no payroll details yet'}
            </p>
          </section>
        </div>
      </div>

      {dialog === 'approve' ? (
        <Dialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title="Approve this timesheet?"
          description="Payroll is calculated and the payslip is generated. After approval the timesheet is locked."
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button type="button" disabled={approve.isPending} onClick={() => void run('approve')} data-testid="approve-confirm">
                {approve.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                Approve and generate payslip
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <p className="rounded-lg border border-border bg-accent/20 px-3 py-2 text-sm">
              <strong>{sheet.candidateName}</strong> · {sheet.totalUnits} {unit} · net payment <strong>{money(sheet.netPay, sheet.currency)}</strong> · client charge {money(sheet.chargeTotal, sheet.currency)} · profit {money(sheet.profit, sheet.currency)}
            </p>
            {sheet.discrepancies.some((d) => d.severity === 'warning') ? (
              <p className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /> There are {sheet.discrepancies.filter((d) => d.severity === 'warning').length} warning(s) on this timesheet. You can still approve it.
              </p>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="approve-note">Note (optional, shown in the history)</Label>
              <Textarea id="approve-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
            </div>
            {actionError ? (
              <p role="alert" className="text-sm text-destructive">
                {actionError}
              </p>
            ) : null}
          </div>
        </Dialog>
      ) : null}

      {dialog === 'reject' ? (
        <Dialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title="Reject this timesheet"
          description="Say what is wrong, so it can be amended and sent back."
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button type="button" disabled={reason.trim().length < 3 || reject.isPending} onClick={() => void run('reject')} data-testid="reject-confirm">
                {reject.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileText className="mr-1.5 h-4 w-4" />}
                Reject timesheet
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reject-reason">Reason</Label>
              <Textarea id="reject-reason" rows={3} placeholder="e.g. Friday should be a half day according to the client" value={reason} onChange={(event) => setReason(event.target.value)} autoFocus data-testid="reject-reason-input" />
            </div>
            {actionError ? (
              <p role="alert" className="text-sm text-destructive">
                {actionError}
              </p>
            ) : null}
          </div>
        </Dialog>
      ) : null}

      {amending ? <TimesheetFormDialog timesheet={sheet} onClose={() => setAmending(false)} onSaved={() => setAmending(false)} /> : null}
    </div>
  );
}
