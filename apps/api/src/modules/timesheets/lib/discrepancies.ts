export type DiscrepancySeverity = 'error' | 'warning' | 'info';
export interface Discrepancy {
  code: string;
  severity: DiscrepancySeverity;
  message: string;
}

export interface DiscrepancyInput {
  rateType: 'DAY' | 'HOUR';
  payRate: number;
  chargeRate: number;
  days: { date: string; units: number }[];
  totalUnits: number;
  weekDates: string[];
  clientConfirmedBy: string | null;
  hasAttachment: boolean;
  profile: { nino: string | null; utr: string | null; payRate: number | null; chargeRate: number | null; rateType: 'DAY' | 'HOUR' } | null;
  /** Another timesheet for the same worker in the same week but for a different client. */
  otherClientSameWeek: boolean;
}

const money = (n: number) => `£${n.toFixed(2)}`;

/**
 * What the administrator should look at before approving: things that look wrong (errors and warnings) and things
 * that are only worth knowing (info). Approval is still allowed with warnings — it is the administrator's decision —
 * but a timesheet with an error cannot be approved.
 */
export function findDiscrepancies(input: DiscrepancyInput): Discrepancy[] {
  const out: Discrepancy[] = [];
  const add = (severity: DiscrepancySeverity, code: string, message: string) => out.push({ severity, code, message });
  const week = new Set(input.weekDates);
  const perDayMax = input.rateType === 'DAY' ? 1 : 16;
  const unit = input.rateType === 'DAY' ? 'day' : 'hour';

  if (input.totalUnits <= 0) add('error', 'NO_TIME', 'No days or hours were entered.');
  for (const day of input.days) {
    if (!week.has(day.date)) add('error', 'DAY_OUTSIDE_WEEK', `${day.date} is not in the week of this timesheet.`);
    if (day.units > perDayMax) add('error', 'TOO_MUCH_IN_A_DAY', `${day.date}: ${day.units} ${unit}s in one day is more than possible.`);
  }
  if (input.rateType === 'DAY' && input.totalUnits > 6) add('warning', 'SEVEN_DAYS', 'Worked more than six days this week.');
  if (input.rateType === 'HOUR' && input.totalUnits > 60) add('warning', 'LONG_WEEK', `${input.totalUnits} hours is a very long week (over 60).`);
  const weekend = input.days.filter((day) => day.units > 0 && ['Sat', 'Sun'].includes(new Date(`${day.date}T00:00:00Z`).toUTCString().slice(0, 3)));
  if (weekend.length > 0) add('info', 'WEEKEND', `Includes weekend work (${weekend.map((d) => d.date).join(', ')}).`);

  if (input.chargeRate < input.payRate) add('error', 'NEGATIVE_MARGIN', `The client charge (${money(input.chargeRate)}) is lower than the worker's pay (${money(input.payRate)}): this timesheet would make a loss.`);
  else if (input.chargeRate === input.payRate) add('warning', 'NO_MARGIN', 'The client charge equals the worker pay, so there is no margin.');

  if (input.profile) {
    if (input.profile.rateType !== input.rateType) add('warning', 'RATE_TYPE_DIFFERS', `This worker is usually paid per ${input.profile.rateType === 'DAY' ? 'day' : 'hour'}.`);
    else {
      if (input.profile.payRate !== null && Math.abs(input.profile.payRate - input.payRate) > 0.005) add('warning', 'PAY_RATE_DIFFERS', `Pay rate ${money(input.payRate)} differs from the agreed ${money(input.profile.payRate)}.`);
      if (input.profile.chargeRate !== null && Math.abs(input.profile.chargeRate - input.chargeRate) > 0.005) add('warning', 'CHARGE_RATE_DIFFERS', `Charge rate ${money(input.chargeRate)} differs from the agreed ${money(input.profile.chargeRate)}.`);
    }
    if (!input.profile.nino) add('warning', 'NO_NINO', "The worker's National Insurance number is not recorded.");
    if (!input.profile.utr) add('warning', 'NO_UTR', "The worker's UTR is not recorded.");
  } else {
    add('warning', 'NO_PROFILE', 'No payroll details are recorded for this worker (NINO, UTR, CIS rate): the standard 20% CIS and £15 fee were used.');
  }
  if (!input.clientConfirmedBy) add('warning', 'NOT_CONFIRMED', 'Nobody at the client is recorded as having confirmed these hours.');
  if (!input.hasAttachment) add('info', 'NO_ATTACHMENT', 'No signed timesheet file is attached.');
  if (input.otherClientSameWeek) add('warning', 'OTHER_CLIENT_SAME_WEEK', 'This worker also has a timesheet for another client in the same week.');
  return out;
}

export const hasBlockingError = (items: Discrepancy[]) => items.some((item) => item.severity === 'error');
