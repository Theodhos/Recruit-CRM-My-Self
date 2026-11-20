/**
 * The weekly payroll arithmetic, in whole pence and hundredths of a day/hour so no floating-point error can creep in
 * (0.1 + 0.2 style). Every figure on a timesheet and payslip comes from here; nothing is taken from the client.
 *
 *   gross        = pay rate × days (or hours) + bonuses + additional payments
 *   CIS          = gross × CIS rate %            (20% verified, 30% unverified, 0% gross status)
 *   payroll fee  = a fixed amount per worker per week, taken from the worker
 *   net payment  = gross − CIS − payroll fee − deductions − administration fees ± adjustments
 *   client charge= charge rate × days (or hours)
 *   profit       = client charge − gross + payroll fee + administration fees − adjustments paid
 *                  (the CIS deduction is the worker's tax, paid over to HMRC, so it is neither cost nor income;
 *                   a deduction recovers money the worker owes, so it changes the net but not the profit)
 *
 * The administrator can override a figure by hand (with a reason recorded elsewhere). Overrides are applied in the
 * order of the calculation: an overridden gross feeds the CIS and the net, unless those are overridden too.
 */
export type AdjustmentKind = 'BONUS' | 'ADDITIONAL_PAYMENT' | 'DEDUCTION' | 'ADMIN_FEE' | 'ADJUSTMENT';

export const ADJUSTMENT_KINDS: { kind: AdjustmentKind; label: string; help: string }[] = [
  { kind: 'BONUS', label: 'Bonus', help: 'Extra pay on top of the hours. Added to gross pay, so CIS is deducted from it.' },
  { kind: 'ADDITIONAL_PAYMENT', label: 'Additional payment', help: 'Another payment for work done (e.g. travel time). Added to gross pay; CIS applies.' },
  { kind: 'DEDUCTION', label: 'Deduction', help: 'Money taken back from the worker (e.g. an advance, equipment). Reduces the net payment only.' },
  { kind: 'ADMIN_FEE', label: 'Administration fee', help: 'An extra fee charged to the worker. Reduces the net payment and counts as income for the agency.' },
  { kind: 'ADJUSTMENT', label: 'Adjustment (+ or −)', help: 'A correction to the net payment, up or down (use a minus for a reduction).' },
];

export interface AdjustmentInput {
  kind: AdjustmentKind;
  label: string;
  amount: number;
}

export interface Overrides {
  gross?: number;
  cisDeduction?: number;
  payrollFee?: number;
  netPay?: number;
  chargeTotal?: number;
}

export interface PayrollInput {
  payRate: number;
  chargeRate: number;
  units: number;
  cisRate: number;
  payrollFee: number;
  adjustments?: AdjustmentInput[];
  overrides?: Overrides;
}

export interface PayslipLine {
  label: string;
  /** The effect on the net payment (negative = taken off). */
  amount: number;
  /** Shown above the CIS line because it is part of the gross pay. */
  beforeCis: boolean;
}

export interface PayrollFigures {
  gross: number;
  cisDeduction: number;
  payrollFee: number;
  netPay: number;
  chargeTotal: number;
  profit: number;
}

export interface PayrollResult extends PayrollFigures {
  /** Pay for the hours alone (rate × units), before bonuses. */
  basePay: number;
  /** Lines for the payslip, in order. */
  lines: PayslipLine[];
  /** The figures the calculation gives with no override, so an override can show what it replaced. */
  calculated: PayrollFigures;
}

const toPence = (pounds: number) => Math.round((pounds + Number.EPSILON) * 100);
const toPounds = (pence: number) => pence / 100;

/** pence × (hundredths of a unit) / 100, rounded to the nearest penny */
const times = (ratePence: number, unitsHundredths: number) => Math.round((ratePence * unitsHundredths) / 100);

export const OVERRIDE_FIELDS = ['gross', 'cisDeduction', 'payrollFee', 'netPay', 'chargeTotal'] as const;

export function calculatePayroll(input: PayrollInput): PayrollResult {
  const rate = toPence(input.payRate);
  const charge = toPence(input.chargeRate);
  const units = Math.round(input.units * 100);
  const basePay = times(rate, units);

  const lines: PayslipLine[] = [];
  let bonuses = 0;
  let netEffects = 0;
  let adminFees = 0;
  let adjustmentsPaid = 0;
  for (const adj of input.adjustments ?? []) {
    const amount = toPence(adj.amount);
    if (adj.kind === 'BONUS' || adj.kind === 'ADDITIONAL_PAYMENT') {
      bonuses += amount;
      lines.push({ label: adj.label, amount: toPounds(amount), beforeCis: true });
    } else if (adj.kind === 'DEDUCTION') {
      netEffects -= amount;
      lines.push({ label: adj.label, amount: toPounds(-amount), beforeCis: false });
    } else if (adj.kind === 'ADMIN_FEE') {
      netEffects -= amount;
      adminFees += amount;
      lines.push({ label: adj.label, amount: toPounds(-amount), beforeCis: false });
    } else {
      netEffects += amount;
      adjustmentsPaid += amount;
      lines.push({ label: adj.label, amount: toPounds(amount), beforeCis: false });
    }
  }

  const cisPercent = Math.round(input.cisRate * 100);
  const compute = (o: Overrides) => {
    const gross = o.gross !== undefined ? toPence(o.gross) : basePay + bonuses;
    const cis = o.cisDeduction !== undefined ? toPence(o.cisDeduction) : Math.round((gross * cisPercent) / 10_000);
    const fee = o.payrollFee !== undefined ? toPence(o.payrollFee) : toPence(input.payrollFee);
    const net = o.netPay !== undefined ? toPence(o.netPay) : gross - cis - fee + netEffects;
    const chargeTotal = o.chargeTotal !== undefined ? toPence(o.chargeTotal) : times(charge, units);
    const profit = chargeTotal - gross + fee + adminFees - adjustmentsPaid;
    return { gross: toPounds(gross), cisDeduction: toPounds(cis), payrollFee: toPounds(fee), netPay: toPounds(net), chargeTotal: toPounds(chargeTotal), profit: toPounds(profit) };
  };

  const calculated = compute({});
  const final = input.overrides && Object.keys(input.overrides).length > 0 ? compute(input.overrides) : calculated;
  return { ...final, basePay: toPounds(basePay), lines, calculated };
}
