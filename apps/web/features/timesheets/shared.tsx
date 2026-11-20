import { Badge } from '@crm/ui';
import { AlertTriangle, CheckCircle2, Clock, Info, XCircle } from '@crm/ui/icons';

import type { Discrepancy, EventAction, PayrollStage, RateType, TimesheetStatus } from '@/services/timesheets.service';

export const money = (value: number, currency = 'GBP') => new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);

export const STATUS_META: Record<TimesheetStatus, { label: string; variant: 'warning' | 'success' | 'destructive'; hint: string }> = {
  PENDING_APPROVAL: { label: 'Pending approval', variant: 'warning', hint: 'Waiting for the administrator' },
  APPROVED: { label: 'Approved', variant: 'success', hint: 'Payroll and payslip generated' },
  REJECTED: { label: 'Rejected', variant: 'destructive', hint: 'Needs amending and resubmitting' },
};

export function StatusBadge({ status }: { status: TimesheetStatus }) {
  const meta = STATUS_META[status];
  const Icon = status === 'APPROVED' ? CheckCircle2 : status === 'REJECTED' ? XCircle : Clock;
  return (
    <Badge variant={meta.variant} title={meta.hint} className="gap-1">
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}

export const EVENT_LABEL: Record<EventAction, string> = {
  SUBMITTED: 'Submitted',
  AMENDED: 'Amended',
  RESUBMITTED: 'Resubmitted for approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  PAYSLIP_GENERATED: 'Payslip generated',
  PAYMENT_AUTHORISED: 'Payment authorised',
  PAYMENT_REVERSED: 'Payment authorisation taken back',
  PAID: 'Marked as paid',
  ADJUSTMENT_ADDED: 'Adjustment added',
  ADJUSTMENT_REMOVED: 'Adjustment removed',
  OVERRIDDEN: 'Figure overridden by hand',
  OVERRIDE_CLEARED: 'Override cleared',
  RECALCULATED: 'Payroll recalculated',
  CHECKED: 'Checked',
  PAYSLIP_ISSUED: 'Payslip issued',
};

const DAY_MS = 86_400_000;
export const toIso = (date: Date) => date.toISOString().slice(0, 10);
const fromIso = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** The Monday of the week an ISO date falls in. */
export function mondayOfIso(iso: string): string {
  const date = fromIso(iso);
  return toIso(new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * DAY_MS));
}
export const addDaysIso = (iso: string, days: number) => toIso(new Date(fromIso(iso).getTime() + days * DAY_MS));
export const weekDatesIso = (monday: string) => Array.from({ length: 7 }, (_, i) => addDaysIso(monday, i));
export const todayIso = () => toIso(new Date());

const SHORT = { day: 'numeric', month: 'short', timeZone: 'UTC' } as const;
export function weekLabel(monday: string) {
  const start = fromIso(monday);
  const end = fromIso(addDaysIso(monday, 6));
  return `${start.toLocaleDateString('en-GB', SHORT)} – ${end.toLocaleDateString('en-GB', { ...SHORT, year: 'numeric' })}`;
}
export const dayLabel = (iso: string) => fromIso(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });

export const unitLabel = (rateType: RateType, plural = true) => (rateType === 'DAY' ? (plural ? 'days' : 'day') : plural ? 'hours' : 'hour');

/**
 * The same arithmetic as the server (whole pence), so the figure shown while typing is the figure that is saved.
 * The server still works out the real figures; this only previews them.
 */
export function previewPayroll(input: { payRate: number; chargeRate: number; units: number; cisRate: number; payrollFee: number }) {
  const p = (n: number) => Math.round((n + Number.EPSILON) * 100);
  const times = (ratePence: number, unitsHundredths: number) => Math.round((ratePence * unitsHundredths) / 100);
  const units = Math.round(input.units * 100);
  const gross = times(p(input.payRate), units);
  const cis = Math.round((gross * Math.round(input.cisRate * 100)) / 10_000);
  const fee = p(input.payrollFee);
  const charge = times(p(input.chargeRate), units);
  return { gross: gross / 100, cisDeduction: cis / 100, payrollFee: fee / 100, netPay: (gross - cis - fee) / 100, chargeTotal: charge / 100, profit: (charge - gross + fee) / 100 };
}

const SEVERITY = {
  error: { icon: XCircle, box: 'border-destructive/40 bg-destructive/10 text-destructive', label: 'Must fix' },
  warning: { icon: AlertTriangle, box: 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300', label: 'Check' },
  info: { icon: Info, box: 'border-border bg-accent/30 text-foreground/70', label: 'Note' },
} as const;

/** What to look at before approving: errors block approval, warnings are the administrator's call. */
export function DiscrepancyList({ items }: { items: Discrepancy[] }) {
  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300" data-testid="discrepancies-none">
        <CheckCircle2 className="h-4 w-4" /> Nothing to flag: hours, rates and details look consistent.
      </p>
    );
  }
  const order = { error: 0, warning: 1, info: 2 } as const;
  return (
    <ul className="flex flex-col gap-2" data-testid="discrepancies">
      {[...items].sort((a, b) => order[a.severity] - order[b.severity]).map((item) => {
        const meta = SEVERITY[item.severity];
        const Icon = meta.icon;
        return (
          <li key={item.code + item.message} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${meta.box}`} data-severity={item.severity}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <span className="font-semibold">{meta.label}: </span>
              {item.message}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** The eight stages of a worker's week, in order. */
export const STAGE_ORDER = ['PENDING_TIMESHEET', 'TIMESHEET_RECEIVED', 'AWAITING_APPROVAL', 'APPROVED_FOR_PAYROLL', 'PAYROLL_GENERATED', 'PAYSLIP_ISSUED', 'PAYMENT_AUTHORISED', 'PAID'] as const satisfies readonly PayrollStage[];

export const STAGE_META: Record<PayrollStage, { label: string; short: string; variant: 'slate' | 'sky' | 'warning' | 'success' | 'destructive'; hint: string }> = {
  PENDING_TIMESHEET: { label: 'Pending timesheet', short: 'Pending timesheet', variant: 'slate', hint: 'On a placement this week, no timesheet yet' },
  TIMESHEET_RECEIVED: { label: 'Timesheet received', short: 'Received', variant: 'sky', hint: 'Arrived; nobody has checked it yet' },
  AWAITING_APPROVAL: { label: 'Awaiting approval', short: 'Awaiting approval', variant: 'warning', hint: 'Checked; waits for an authorised person to approve' },
  APPROVED_FOR_PAYROLL: { label: 'Approved for payroll', short: 'Approved', variant: 'success', hint: 'Approved; payroll not generated yet' },
  PAYROLL_GENERATED: { label: 'Payroll generated', short: 'Payroll generated', variant: 'success', hint: 'Pay, CIS, fee and net are worked out; the payslip exists' },
  PAYSLIP_ISSUED: { label: 'Payslip issued', short: 'Payslip issued', variant: 'sky', hint: 'The payslip was given to the worker' },
  PAYMENT_AUTHORISED: { label: 'Payment authorised', short: 'Authorised', variant: 'sky', hint: 'The payment is authorised' },
  PAID: { label: 'Paid', short: 'Paid', variant: 'success', hint: 'The worker has been paid' },
  REJECTED: { label: 'Rejected', short: 'Rejected', variant: 'destructive', hint: 'Sent back to be amended' },
};

export function StageBadge({ stage }: { stage: PayrollStage }) {
  const meta = STAGE_META[stage];
  return (
    <Badge variant={meta.variant} title={meta.hint} data-stage={stage}>
      {meta.label}
    </Badge>
  );
}

/** The path of one timesheet: done steps ticked, the current one marked. A rejected one stops at the approval step. */
export function StageStepper({ stage }: { stage: PayrollStage }) {
  const rejected = stage === 'REJECTED';
  const current = rejected ? STAGE_ORDER.indexOf('AWAITING_APPROVAL') : STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]);
  return (
    <ol className="flex flex-wrap items-center gap-y-2" aria-label="Payroll stages" data-testid="stage-stepper" data-stage={stage}>
      {STAGE_ORDER.map((step, index) => {
        const done = index < current || (!rejected && index === current && step === 'PAID');
        const here = index === current;
        const color = rejected && here ? 'bg-destructive text-white' : done ? 'bg-emerald-500 text-white' : here ? 'bg-primary text-primary-foreground' : 'bg-accent text-foreground/50';
        return (
          <li key={step} className="flex items-center" aria-current={here ? 'step' : undefined}>
            {index > 0 ? <span className={`mx-1.5 h-px w-4 sm:w-6 ${index <= current ? 'bg-emerald-500' : 'bg-border'}`} /> : null}
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${color}`}>{done ? '✓' : index + 1}</span>
            <span className={`ml-1.5 text-xs ${here ? 'font-semibold text-foreground' : 'text-foreground/55'}`}>{STAGE_META[step].short}</span>
          </li>
        );
      })}
    </ol>
  );
}
