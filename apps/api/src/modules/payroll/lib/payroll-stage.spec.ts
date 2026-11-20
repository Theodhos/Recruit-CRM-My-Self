import { payrollStageOf } from '../../timesheets/lib/payroll-stage';

import { invoiceFor } from './invoice-calc';

const when = new Date('2026-11-06T10:00:00Z');

describe('payrollStageOf', () => {
  it('a new timesheet is "received" until somebody checks it, then "awaiting approval"', () => {
    expect(payrollStageOf({ status: 'PENDING_APPROVAL', checkedAt: null, payslip: null })).toBe('TIMESHEET_RECEIVED');
    expect(payrollStageOf({ status: 'PENDING_APPROVAL', checkedAt: when, payslip: null })).toBe('AWAITING_APPROVAL');
  });

  it('a rejected timesheet is outside the path', () => {
    expect(payrollStageOf({ status: 'REJECTED', checkedAt: when, payslip: null })).toBe('REJECTED');
  });

  it('approved without a payslip is "approved for payroll"; with one it is "payroll generated"', () => {
    expect(payrollStageOf({ status: 'APPROVED', checkedAt: when, payslip: null })).toBe('APPROVED_FOR_PAYROLL');
    expect(payrollStageOf({ status: 'APPROVED', checkedAt: when, payslip: { paymentStatus: 'UNPAID', issuedAt: null } })).toBe('PAYROLL_GENERATED');
  });

  it('then "payslip issued", "payment authorised" and "paid", the later one always winning', () => {
    expect(payrollStageOf({ status: 'APPROVED', checkedAt: when, payslip: { paymentStatus: 'UNPAID', issuedAt: when } })).toBe('PAYSLIP_ISSUED');
    expect(payrollStageOf({ status: 'APPROVED', checkedAt: when, payslip: { paymentStatus: 'AUTHORISED', issuedAt: null } })).toBe('PAYMENT_AUTHORISED');
    expect(payrollStageOf({ status: 'APPROVED', checkedAt: when, payslip: { paymentStatus: 'AUTHORISED', issuedAt: when } })).toBe('PAYMENT_AUTHORISED');
    expect(payrollStageOf({ status: 'APPROVED', checkedAt: when, payslip: { paymentStatus: 'PAID', issuedAt: null } })).toBe('PAID');
  });
});

describe('invoiceFor', () => {
  it('standard: 20% VAT, no client CIS', () => {
    expect(invoiceFor(1000, { cisDeductionRate: 0, vatRate: 20, vatReverseCharge: false })).toEqual({ net: 1000, vat: 200, total: 1200, clientCis: 0, receivable: 1200 });
  });

  it('the client deducts CIS from the labour, not from the VAT', () => {
    expect(invoiceFor(1000, { cisDeductionRate: 20, vatRate: 20, vatReverseCharge: false })).toEqual({ net: 1000, vat: 200, total: 1200, clientCis: 200, receivable: 1000 });
  });

  it('the domestic reverse charge puts no VAT on the invoice', () => {
    expect(invoiceFor(1000, { cisDeductionRate: 20, vatRate: 20, vatReverseCharge: true })).toEqual({ net: 1000, vat: 0, total: 1000, clientCis: 200, receivable: 800 });
  });

  it('works in whole pence', () => {
    const r = invoiceFor(333.33, { cisDeductionRate: 20, vatRate: 20, vatReverseCharge: false });
    expect(r.vat).toBe(66.67);
    expect(r.clientCis).toBe(66.67);
    expect(r.total).toBe(400);
  });
});
