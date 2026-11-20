/**
 * Where a worker's week stands, in the order the work happens. One word for the whole path from "we are waiting for
 * the timesheet" to "the money has been paid", worked out from the facts already stored (no separate field to drift):
 *
 *   PENDING_TIMESHEET     the worker is on a placement this week, no timesheet has arrived
 *   TIMESHEET_RECEIVED    a timesheet arrived; nobody has checked it yet
 *   AWAITING_APPROVAL     it was checked and waits for an authorised person to approve it
 *   APPROVED_FOR_PAYROLL  approved; the payroll has not been generated yet (normally instant)
 *   PAYROLL_GENERATED     pay, CIS, fee and net are worked out and the payslip exists
 *   PAYSLIP_ISSUED        the payslip was given to the worker
 *   PAYMENT_AUTHORISED    the payment is authorised
 *   PAID                  the worker has been paid
 *   REJECTED              sent back to be amended (outside the path)
 */
export const PAYROLL_STAGES = ['PENDING_TIMESHEET', 'TIMESHEET_RECEIVED', 'AWAITING_APPROVAL', 'APPROVED_FOR_PAYROLL', 'PAYROLL_GENERATED', 'PAYSLIP_ISSUED', 'PAYMENT_AUTHORISED', 'PAID', 'REJECTED'] as const;
export type PayrollStage = (typeof PAYROLL_STAGES)[number];

export interface StageFacts {
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  checkedAt: Date | null;
  payslip: { paymentStatus: 'UNPAID' | 'AUTHORISED' | 'PAID'; issuedAt: Date | null } | null;
}

export function payrollStageOf(facts: StageFacts): PayrollStage {
  if (facts.status === 'REJECTED') return 'REJECTED';
  if (facts.status === 'PENDING_APPROVAL') return facts.checkedAt ? 'AWAITING_APPROVAL' : 'TIMESHEET_RECEIVED';
  if (!facts.payslip) return 'APPROVED_FOR_PAYROLL';
  if (facts.payslip.paymentStatus === 'PAID') return 'PAID';
  if (facts.payslip.paymentStatus === 'AUTHORISED') return 'PAYMENT_AUTHORISED';
  return facts.payslip.issuedAt ? 'PAYSLIP_ISSUED' : 'PAYROLL_GENERATED';
}
