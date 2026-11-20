'use client';

import { Badge, Button, Dialog, Input, Label, Select, Textarea } from '@crm/ui';
import { Download, ExternalLink, FileText, Loader2, Lock, Pencil, Plus, RotateCcw, SlidersHorizontal, Trash2 } from '@crm/ui/icons';
import { useState } from 'react';

import { useIssuePayslips } from '@/hooks/use-payroll';
import { useAddAdjustment, useClearOverrides, useRemoveAdjustment, useSetOverrides, useSetPayslipNotes } from '@/hooks/use-timesheets';
import { ApiClientError } from '@/lib/api-client';
import { ADJUSTMENT_KINDS, downloadPayslipPdf, openPayslipPdf, type AdjustmentKind, type OverrideFigures, type TimesheetDetail } from '@/services/timesheets.service';

import { money } from './shared';

const messageOf = (error: unknown, fallback: string) => (error instanceof ApiClientError ? error.message : error instanceof Error ? error.message : fallback);
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const kindLabel = (kind: AdjustmentKind) => ADJUSTMENT_KINDS.find((k) => k.kind === kind)?.label ?? kind;

const OVERRIDE_FIELDS: { key: keyof OverrideFigures; label: string; help: string }[] = [
  { key: 'gross', label: 'Gross pay', help: 'CIS and the net follow it unless you set them too' },
  { key: 'cisDeduction', label: 'CIS deduction', help: 'The tax taken off the gross' },
  { key: 'payrollFee', label: 'Payroll fee', help: 'The fee taken from the worker' },
  { key: 'netPay', label: 'Net payment', help: 'What the worker is paid' },
  { key: 'chargeTotal', label: 'Client charge', help: 'What the client is charged' },
];

/** Why the figures cannot be changed any more (null while they can). */
export function lockReason(sheet: TimesheetDetail): string | null {
  if (sheet.paymentStatus === 'PAID') return 'This worker has been paid, so the figures can no longer be changed.';
  if (sheet.paymentStatus === 'AUTHORISED') return 'The payment is authorised. Take the authorisation back on the Weekly payroll screen to change the figures.';
  if (sheet.status === 'REJECTED') return 'This timesheet was rejected. Amend and resubmit it first.';
  return null;
}

/** A dialog that asks for a reason and runs an action; the reason is kept in the history. */
function ReasonDialog({ title, description, confirmLabel, destructive, onClose, onConfirm, children, disabled }: { title: string; description: string; confirmLabel: string; destructive?: boolean; onClose: () => void; onConfirm: (reason: string) => Promise<void>; children?: React.ReactNode; disabled?: boolean }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (e) {
      setError(messageOf(e, 'That did not work. Nothing was changed.'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={title}
      description={description}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant={destructive ? 'outline' : 'default'} disabled={busy || disabled || reason.trim().length < 3} onClick={() => void run()} data-testid="reason-confirm">
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {children}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reason-text">Reason (kept in the history)</Label>
          <Textarea id="reason-text" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} data-testid="reason-input" autoFocus />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

function AddAdjustmentDialog({ sheet, onClose }: { sheet: TimesheetDetail; onClose: () => void }) {
  const add = useAddAdjustment();
  const [kind, setKind] = useState<AdjustmentKind>('BONUS');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const meta = ADJUSTMENT_KINDS.find((k) => k.kind === kind)!;
  const value = Number(amount);
  const valid = label.trim().length >= 2 && amount !== '' && !Number.isNaN(value) && value !== 0 && (kind === 'ADJUSTMENT' || value > 0);
  return (
    <ReasonDialog
      title="Add a payment or deduction"
      description={`${sheet.candidateName} · the pay, CIS and net are worked out again.`}
      confirmLabel="Add line"
      disabled={!valid}
      onClose={onClose}
      onConfirm={async (reason) => {
        await add.mutateAsync({ id: sheet.id, input: { kind, label: label.trim(), amount: value, reason } });
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="adj-kind">Type</Label>
        <Select
          id="adj-kind"
          value={kind}
          onChange={(event) => {
            setKind(event.target.value as AdjustmentKind);
            if (!label) setLabel('');
          }}
          data-testid="adjustment-kind"
        >
          {ADJUSTMENT_KINDS.map((k) => (
            <option key={k.kind} value={k.kind}>
              {k.label}
            </option>
          ))}
        </Select>
        <p className="text-xs text-foreground/60">{meta.help}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="adj-label">Name on the payslip</Label>
          <Input id="adj-label" placeholder={kind === 'BONUS' ? 'e.g. Completion bonus' : kind === 'DEDUCTION' ? 'e.g. Advance repaid' : kind === 'ADMIN_FEE' ? 'e.g. Administration fee' : 'e.g. Travel time'} value={label} onChange={(event) => setLabel(event.target.value)} data-testid="adjustment-label" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="adj-amount">Amount (£){kind === 'ADJUSTMENT' ? ' — minus to reduce' : ''}</Label>
          <Input id="adj-amount" type="number" step={0.01} value={amount} onChange={(event) => setAmount(event.target.value)} data-testid="adjustment-amount" />
        </div>
      </div>
    </ReasonDialog>
  );
}

function OverrideDialog({ sheet, onClose }: { sheet: TimesheetDetail; onClose: () => void }) {
  const set = useSetOverrides();
  const calculated = sheet.overrides?.calculated ?? { gross: sheet.gross, cisDeduction: sheet.cisDeduction, payrollFee: sheet.payrollFee, netPay: sheet.netPay, chargeTotal: sheet.chargeTotal, profit: sheet.profit };
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(OVERRIDE_FIELDS.map(({ key }) => [key, sheet.overrides?.fields[key] !== undefined ? String(sheet.overrides.fields[key]) : ''])));
  const chosen = OVERRIDE_FIELDS.filter(({ key }) => values[key] !== '' && !Number.isNaN(Number(values[key])));
  return (
    <ReasonDialog
      title="Override the calculation"
      description="Replace a calculated figure with your own. The calculated value is kept next to it, and the reason is recorded."
      confirmLabel="Override"
      disabled={chosen.length === 0}
      onClose={onClose}
      onConfirm={async (reason) => {
        const input: OverrideFigures & { reason: string } = { reason };
        for (const { key } of chosen) input[key] = Number(values[key]);
        await set.mutateAsync({ id: sheet.id, input });
      }}
    >
      <p className="text-xs text-foreground/60">Fill in only the figures you want to change; leave the rest empty to keep the calculation.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {OVERRIDE_FIELDS.map(({ key, label, help }) => (
          <div key={key} className="flex flex-col gap-1.5">
            <Label htmlFor={`ov-${key}`}>{label}</Label>
            <Input id={`ov-${key}`} type="number" step={0.01} placeholder={`Calculated ${money(calculated[key])}`} value={values[key]} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} data-testid={`override-${key}`} />
            <p className="text-[11px] text-foreground/50">{help}</p>
          </div>
        ))}
      </div>
    </ReasonDialog>
  );
}

/**
 * Payroll control for one timesheet: bonuses and additional payments, deductions and fees, and overriding a
 * calculated figure. Everything needs a reason and is written to the approval history.
 */
export function PayrollControl({ sheet }: { sheet: TimesheetDetail }) {
  const remove = useRemoveAdjustment();
  const clear = useClearOverrides();
  const [dialog, setDialog] = useState<'add' | 'override' | 'clear' | { removeId: string } | null>(null);
  const locked = lockReason(sheet);
  const removing = typeof dialog === 'object' && dialog !== null ? sheet.adjustments.find((a) => a.id === dialog.removeId) : null;

  return (
    <section className="rounded-xl border border-border p-4" aria-label="Payroll control" data-testid="payroll-control">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal className="h-4 w-4 text-foreground/50" /> Payroll control
        </h3>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" disabled={Boolean(locked)} title={locked ?? undefined} onClick={() => setDialog('add')} data-testid="add-adjustment">
            <Plus className="mr-1.5 h-4 w-4" /> Add payment / deduction
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={Boolean(locked)} title={locked ?? undefined} onClick={() => setDialog('override')} data-testid="override-figures">
            <Pencil className="mr-1.5 h-4 w-4" /> Override figures
          </Button>
        </div>
      </div>

      {locked ? (
        <p className="mb-3 flex items-start gap-2 rounded-lg border border-border bg-accent/30 px-3 py-2 text-sm text-foreground/70" data-testid="payroll-locked">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" /> {locked}
        </p>
      ) : null}

      {sheet.overrides ? (
        <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-900 dark:text-amber-200" data-testid="override-notice">
          <p className="font-semibold">Some figures were set by hand</p>
          <ul className="mt-1 text-xs">
            {OVERRIDE_FIELDS.filter(({ key }) => sheet.overrides!.fields[key] !== undefined).map(({ key, label }) => (
              <li key={key}>
                {label}: <strong>{money(sheet.overrides!.fields[key]!)}</strong> <span className="opacity-80">(calculated {money(sheet.overrides!.calculated[key])})</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs">“{sheet.overrides.reason}” · {when(sheet.overrides.at)}</p>
          {!locked ? (
            <button type="button" className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold underline" onClick={() => setDialog('clear')} data-testid="clear-override">
              <RotateCcw className="h-3 w-3" /> Go back to the calculation
            </button>
          ) : null}
        </div>
      ) : null}

      {sheet.adjustments.length === 0 ? (
        <p className="text-sm text-foreground/60">No bonuses, extra payments, deductions or fees on this timesheet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border" data-testid="adjustment-list">
          {sheet.adjustments.map((a) => {
            const adds = a.kind === 'BONUS' || a.kind === 'ADDITIONAL_PAYMENT' || (a.kind === 'ADJUSTMENT' && a.amount > 0);
            return (
              <li key={a.id} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm" data-testid="adjustment-row">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {a.label} <Badge variant="outline">{kindLabel(a.kind)}</Badge>
                  </p>
                  <p className="mt-0.5 text-xs text-foreground/60">
                    {a.reason} · {when(a.addedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`font-semibold tabular-nums ${adds ? '' : 'text-destructive'}`}>
                    {adds ? '+' : '−'}
                    {money(Math.abs(a.amount))}
                  </span>
                  {!locked ? (
                    <button type="button" aria-label={`Remove ${a.label}`} className="rounded p-1 text-foreground/50 hover:bg-accent hover:text-destructive" onClick={() => setDialog({ removeId: a.id })}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {dialog === 'add' ? <AddAdjustmentDialog sheet={sheet} onClose={() => setDialog(null)} /> : null}
      {dialog === 'override' ? <OverrideDialog sheet={sheet} onClose={() => setDialog(null)} /> : null}
      {dialog === 'clear' ? (
        <ReasonDialog title="Go back to the calculation?" description="The figures you set by hand are removed and the calculated ones are used again." confirmLabel="Restore the calculation" onClose={() => setDialog(null)} onConfirm={async (reason) => void (await clear.mutateAsync({ id: sheet.id, reason }))} />
      ) : null}
      {removing ? (
        <ReasonDialog
          title={`Remove “${removing.label}”?`}
          description={`${money(Math.abs(removing.amount))} (${kindLabel(removing.kind)}) comes off this timesheet and the figures are worked out again.`}
          confirmLabel="Remove line"
          destructive
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => void (await remove.mutateAsync({ id: sheet.id, adjustmentId: removing.id, reason }))}
        />
      ) : null}
    </section>
  );
}

/** The PDF payslip of an approved timesheet: look at it, download it, and write the note printed on it. */
export function PayslipPanel({ sheet, canEdit }: { sheet: TimesheetDetail; canEdit: boolean }) {
  const saveNotes = useSetPayslipNotes();
  const issue = useIssuePayslips();
  const [notes, setNotes] = useState(sheet.payslipNotes ?? '');
  const [busy, setBusy] = useState<'view' | 'download' | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const dirty = (sheet.payslipNotes ?? '') !== notes.trim();
  const locked = sheet.paymentStatus === 'PAID';

  async function act(kind: 'view' | 'download') {
    setBusy(kind);
    setMessage(null);
    try {
      if (kind === 'view') await openPayslipPdf(sheet.id);
      else await downloadPayslipPdf(sheet.id, `Payslip - ${sheet.candidateName} - week ${sheet.weekStart.slice(0, 10)}.pdf`);
    } catch (e) {
      setMessage({ tone: 'error', text: messageOf(e, 'The payslip could not be opened.') });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-xl border border-border p-4" aria-label="Payslip" data-testid="payslip-panel">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <FileText className="h-4 w-4 text-foreground/50" /> Payslip
      </h3>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => void act('download')} disabled={busy !== null} data-testid="panel-download-payslip">
          {busy === 'download' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
          Download PDF
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void act('view')} disabled={busy !== null} data-testid="view-payslip">
          {busy === 'view' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-1.5 h-4 w-4" />}
          View
        </Button>
      </div>
      <p className="mt-2 text-xs text-foreground/55">DC Solutions branded, ready to send to the worker. It is rewritten if the figures change before payment.</p>
      {canEdit ? (
        sheet.issuedAt ? (
          <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300" data-testid="issued-note">Issued to the worker on {new Date(sheet.issuedAt).toLocaleDateString('en-GB')}.</p>
        ) : (
          <button
            type="button"
            className="mt-2 text-xs font-semibold underline"
            disabled={issue.isPending}
            onClick={async () => {
              setMessage(null);
              try {
                if (sheet.payslipId) await issue.mutateAsync([sheet.payslipId]);
                setMessage({ tone: 'ok', text: 'Marked as issued to the worker.' });
              } catch (e) {
                setMessage({ tone: 'error', text: messageOf(e, 'That did not work.') });
              }
            }}
            data-testid="mark-issued"
          >
            Mark the payslip as issued to the worker
          </button>
        )
      ) : null}
      {sheet.paymentStatus === 'PAID' && sheet.paidAt ? (
        <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
          Paid on {new Date(sheet.paidAt).toLocaleDateString('en-GB')}
          {sheet.paymentReference ? ` · ${sheet.paymentReference}` : ''}: this is printed on the payslip.
        </p>
      ) : null}
      {canEdit ? (
        <div className="mt-3 flex flex-col gap-1.5">
          <Label htmlFor="payslip-notes">Note for the worker (printed under “Notes”)</Label>
          <Textarea id="payslip-notes" rows={2} maxLength={1000} placeholder="e.g. Paid by BACS to the account we hold." value={notes} onChange={(event) => setNotes(event.target.value)} data-testid="payslip-notes" />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!dirty || saveNotes.isPending}
              onClick={async () => {
                setMessage(null);
                try {
                  await saveNotes.mutateAsync({ id: sheet.id, notes: notes.trim() || null });
                  setMessage({ tone: 'ok', text: 'Note saved on the payslip.' });
                } catch (e) {
                  setMessage({ tone: 'error', text: messageOf(e, 'The note was not saved.') });
                }
              }}
              data-testid="save-payslip-notes"
            >
              {saveNotes.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Save note
            </Button>
            {locked ? <span className="text-xs text-foreground/50">The figures are locked, the note can still change.</span> : null}
          </div>
        </div>
      ) : sheet.payslipNotes ? (
        <p className="mt-3 whitespace-pre-wrap text-sm text-foreground/80">{sheet.payslipNotes}</p>
      ) : null}
      {message ? (
        <p role={message.tone === 'error' ? 'alert' : 'status'} className={`mt-2 text-sm ${message.tone === 'ok' ? 'text-emerald-700 dark:text-emerald-300' : 'text-destructive'}`}>
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
