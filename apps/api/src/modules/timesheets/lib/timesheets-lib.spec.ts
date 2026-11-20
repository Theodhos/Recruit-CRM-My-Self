import { findDiscrepancies, hasBlockingError, type DiscrepancyInput } from './discrepancies';
import { buildZip, crc32 } from '../../payroll/lib/zip';
import { crc32 as nodeCrc32 } from 'node:zlib';
import { buildPayslipPdf } from './payslip-pdf';
import { calculatePayroll } from './payroll-calc';
import { isMonday, mondayOf, sundayOf, weekDates } from './week';

describe('calculatePayroll', () => {
  it('works out pay, CIS, payroll fee, net, client charge and profit', () => {
    // 5 days × £150, 20% CIS, £15 fee; client charged £190 a day
    const r = calculatePayroll({ payRate: 150, chargeRate: 190, units: 5, cisRate: 20, payrollFee: 15 });
    expect(r).toMatchObject({ gross: 750, cisDeduction: 150, payrollFee: 15, netPay: 585, chargeTotal: 950, profit: 215 });
  });

  it('half days and hours with pence do not drift (no floating-point error)', () => {
    const r = calculatePayroll({ payRate: 12.35, chargeRate: 16.1, units: 37.5, cisRate: 20, payrollFee: 15 });
    expect(r.gross).toBe(463.13); // 12.35 × 37.5 = 463.125 → nearest penny
    expect(r.cisDeduction).toBe(92.63);
    expect(r.netPay).toBe(463.13 - 92.63 - 15);
    expect(r.chargeTotal).toBe(603.75);
  });

  it('0.1 + 0.2 style sums are exact: 3 × £0.10 is £0.30', () => {
    expect(calculatePayroll({ payRate: 0.1, chargeRate: 0.1, units: 3, cisRate: 0, payrollFee: 0 }).gross).toBe(0.3);
  });

  it('unverified CIS (30%) and gross status (0%)', () => {
    expect(calculatePayroll({ payRate: 100, chargeRate: 130, units: 2, cisRate: 30, payrollFee: 15 }).cisDeduction).toBe(60);
    expect(calculatePayroll({ payRate: 100, chargeRate: 130, units: 2, cisRate: 0, payrollFee: 15 })).toMatchObject({ cisDeduction: 0, netPay: 185 });
  });

  it('a loss shows as negative profit and can make net pay negative; nothing is hidden', () => {
    const r = calculatePayroll({ payRate: 20, chargeRate: 15, units: 1, cisRate: 20, payrollFee: 15 });
    expect(r.netPay).toBe(1);
    expect(r.profit).toBe(10);
    const loss = calculatePayroll({ payRate: 100, chargeRate: 80, units: 1, cisRate: 20, payrollFee: 0 });
    expect(loss.profit).toBe(-20);
  });
});

describe('weeks', () => {
  it('a week is Monday to Sunday, whatever day is given', () => {
    expect(mondayOf('2026-11-08').toISOString().slice(0, 10)).toBe('2026-11-02'); // a Sunday
    expect(mondayOf('2026-11-02').toISOString().slice(0, 10)).toBe('2026-11-02');
    expect(mondayOf('2026-11-04').toISOString().slice(0, 10)).toBe('2026-11-02');
    expect(sundayOf(mondayOf('2026-11-04')).toISOString().slice(0, 10)).toBe('2026-11-08');
    expect(weekDates(mondayOf('2026-11-04'))).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
  });

  it('knows a Monday', () => {
    expect(isMonday('2026-11-02')).toBe(true);
    expect(isMonday('2026-11-03')).toBe(false);
  });
});

const base = (extra: Partial<DiscrepancyInput> = {}): DiscrepancyInput => ({
  rateType: 'DAY',
  payRate: 150,
  chargeRate: 190,
  days: [
    { date: '2026-11-02', units: 1 },
    { date: '2026-11-03', units: 1 },
  ],
  totalUnits: 2,
  weekDates: weekDates(mondayOf('2026-11-02')),
  clientConfirmedBy: 'Sam at ACME',
  hasAttachment: true,
  profile: { nino: 'QQ123456C', utr: '1234567890', payRate: 150, chargeRate: 190, rateType: 'DAY' },
  otherClientSameWeek: false,
  ...extra,
});

describe('findDiscrepancies', () => {
  it('a clean timesheet has nothing to report', () => {
    expect(findDiscrepancies(base())).toEqual([]);
  });

  it('errors that block approval: nothing entered, impossible days, a day outside the week, a loss', () => {
    expect(hasBlockingError(findDiscrepancies(base({ days: [], totalUnits: 0 })))).toBe(true);
    expect(findDiscrepancies(base({ days: [{ date: '2026-11-02', units: 1.5 }], totalUnits: 1.5 })).map((d) => d.code)).toContain('TOO_MUCH_IN_A_DAY');
    expect(findDiscrepancies(base({ days: [{ date: '2026-11-20', units: 1 }], totalUnits: 1 })).map((d) => d.code)).toContain('DAY_OUTSIDE_WEEK');
    expect(findDiscrepancies(base({ chargeRate: 100 })).map((d) => d.code)).toContain('NEGATIVE_MARGIN');
  });

  it('warnings the administrator decides on: rate differs from the agreed rate, missing NINO/UTR, no client confirmation', () => {
    const codes = findDiscrepancies(base({ payRate: 160, profile: { nino: null, utr: null, payRate: 150, chargeRate: 190, rateType: 'DAY' }, clientConfirmedBy: null })).map((d) => d.code);
    expect(codes).toEqual(expect.arrayContaining(['PAY_RATE_DIFFERS', 'NO_NINO', 'NO_UTR', 'NOT_CONFIRMED']));
    expect(hasBlockingError(findDiscrepancies(base({ payRate: 160, clientConfirmedBy: null })))).toBe(false);
  });

  it('hourly timesheets: 16 hours in a day is the limit; a 70 hour week is flagged', () => {
    const hourly = base({ rateType: 'HOUR', payRate: 12, chargeRate: 16, profile: null });
    expect(findDiscrepancies({ ...hourly, days: [{ date: '2026-11-02', units: 17 }], totalUnits: 17 }).map((d) => d.code)).toContain('TOO_MUCH_IN_A_DAY');
    const long = ['02', '03', '04', '05', '06', '07'].map((d) => ({ date: `2026-11-${d}`, units: 12 }));
    expect(findDiscrepancies({ ...hourly, days: long, totalUnits: 72 }).map((d) => d.code)).toContain('LONG_WEEK');
  });

  it('weekend work is only information; a second client in the same week is a warning', () => {
    const weekend = findDiscrepancies(base({ days: [{ date: '2026-11-07', units: 1 }], totalUnits: 1 }));
    expect(weekend.find((d) => d.code === 'WEEKEND')?.severity).toBe('info');
    expect(findDiscrepancies(base({ otherClientSameWeek: true })).find((d) => d.code === 'OTHER_CLIENT_SAME_WEEK')?.severity).toBe('warning');
  });
});

describe('buildPayslipPdf', () => {
  it('produces a real PDF file with the worker, week and amounts', async () => {
    const bytes = await buildPayslipPdf({
      employeeName: 'Jamie Smith',
      nino: 'QQ123456C',
      utr: '1234567890',
      weekStart: new Date('2026-11-02T00:00:00Z'),
      weekEnd: new Date('2026-11-08T00:00:00Z'),
      paymentDate: new Date('2026-11-13T00:00:00Z'),
      rateType: 'DAY',
      rate: 150,
      quantity: 5,
      gross: 750,
      cisRate: 20,
      cisDeduction: 150,
      payrollFee: 15,
      netPay: 585,
      currency: 'GBP',
      notes: 'Thank you — includes an unusual letter: Ł',
    });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(5_000);
  });
});

describe('calculatePayroll with adjustments and overrides', () => {
  const base = { payRate: 100, chargeRate: 130, units: 5, cisRate: 20, payrollFee: 15 }; // gross 500, CIS 100, fee 15, net 385, charge 650, profit 165

  it('a bonus is part of the gross pay, so CIS is taken from it too', () => {
    const r = calculatePayroll({ ...base, adjustments: [{ kind: 'BONUS', label: 'Bonus', amount: 50 }] });
    expect(r).toMatchObject({ gross: 550, cisDeduction: 110, netPay: 425, chargeTotal: 650, profit: 115 });
    expect(r.lines).toEqual([{ label: 'Bonus', amount: 50, beforeCis: true }]);
  });

  it('a deduction takes money off the net only: CIS and profit do not move', () => {
    const r = calculatePayroll({ ...base, adjustments: [{ kind: 'DEDUCTION', label: 'Advance repaid', amount: 40 }] });
    expect(r).toMatchObject({ gross: 500, cisDeduction: 100, netPay: 345, profit: 165 });
    expect(r.lines[0]).toEqual({ label: 'Advance repaid', amount: -40, beforeCis: false });
  });

  it('an administration fee reduces the net and is income for the agency', () => {
    const r = calculatePayroll({ ...base, adjustments: [{ kind: 'ADMIN_FEE', label: 'Admin fee', amount: 10 }] });
    expect(r).toMatchObject({ netPay: 375, profit: 175 });
  });

  it('an adjustment can go up or down; paying more lowers the profit', () => {
    expect(calculatePayroll({ ...base, adjustments: [{ kind: 'ADJUSTMENT', label: 'Correction', amount: 20 }] })).toMatchObject({ netPay: 405, profit: 145 });
    expect(calculatePayroll({ ...base, adjustments: [{ kind: 'ADJUSTMENT', label: 'Correction', amount: -20 }] })).toMatchObject({ netPay: 365, profit: 185 });
  });

  it('several lines add up exactly', () => {
    const r = calculatePayroll({
      ...base,
      adjustments: [
        { kind: 'BONUS', label: 'b', amount: 10.1 },
        { kind: 'ADDITIONAL_PAYMENT', label: 'travel', amount: 20.2 },
        { kind: 'DEDUCTION', label: 'd', amount: 5.05 },
      ],
    });
    expect(r.gross).toBe(530.3);
    expect(r.cisDeduction).toBe(106.06);
    expect(r.netPay).toBe(Math.round((530.3 - 106.06 - 15 - 5.05) * 100) / 100);
  });

  it('an override replaces a figure; the figures after it follow, and the calculated value is kept', () => {
    const r = calculatePayroll({ ...base, overrides: { gross: 600 } });
    expect(r).toMatchObject({ gross: 600, cisDeduction: 120, netPay: 465 });
    expect(r.calculated).toMatchObject({ gross: 500, cisDeduction: 100, netPay: 385 });
  });

  it('overriding the net pay leaves gross and CIS as calculated', () => {
    const r = calculatePayroll({ ...base, overrides: { netPay: 400 } });
    expect(r).toMatchObject({ gross: 500, cisDeduction: 100, netPay: 400 });
  });

  it('with no override calculated equals the result', () => {
    const r = calculatePayroll(base);
    expect(r.calculated).toEqual({ gross: r.gross, cisDeduction: r.cisDeduction, payrollFee: r.payrollFee, netPay: r.netPay, chargeTotal: r.chargeTotal, profit: r.profit });
  });
});

describe('buildPayslipPdf with the details of the master copy', () => {
  it('draws the work description, bonus and deduction lines and the payment information', async () => {
    const bytes = await buildPayslipPdf({
      employeeName: 'Jamie Smith', nino: 'QQ123456C', utr: '1234567890',
      weekStart: new Date('2026-11-02T00:00:00Z'), weekEnd: new Date('2026-11-08T00:00:00Z'), paymentDate: new Date('2026-11-13T00:00:00Z'),
      rateType: 'DAY', rate: 100, quantity: 5, gross: 550, cisRate: 20, cisDeduction: 110, payrollFee: 15, netPay: 385, currency: 'GBP', notes: null,
      description: 'Site Electrician — ACME Build',
      extraLines: [{ label: 'Bonus', amount: 50, beforeCis: true }, { label: 'Advance repaid', amount: -40, beforeCis: false }],
      paymentInfo: 'Paid on 13 Nov 2026 — reference BACS 112.',
    });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
  });
});

describe('buildZip', () => {
  it('crc32 matches the one in Node', () => {
    const data = Buffer.from('payslip contents');
    expect(crc32(data)).toBe(nodeCrc32(data));
  });

  it('writes local headers, a central directory and an end record for every file', () => {
    const zip = buildZip([{ name: 'a.pdf', data: Buffer.from('AAAA') }, { name: 'b - Ł.txt', data: Buffer.from('hello hello hello'), deflate: true }]);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    const end = zip.length - 22;
    expect(zip.readUInt32LE(end)).toBe(0x06054b50);
    expect(zip.readUInt16LE(end + 10)).toBe(2);
    expect(zip.readUInt32LE(zip.readUInt32LE(end + 16))).toBe(0x02014b50);
  });
});
