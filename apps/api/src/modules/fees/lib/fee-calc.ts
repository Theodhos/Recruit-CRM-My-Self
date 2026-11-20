/**
 * The client fee of a permanent placement. Two kinds of agreement, chosen per placement (a client's terms are never
 * assumed to be the same as another's):
 *   PERCENTAGE  salary × fee %      (£40,000 at 10% = £4,000)
 *   FIXED       the agreed fixed fee (£2,500, whatever the salary is)
 * Worked out in whole pence.
 */
export type FeeTypeValue = 'PERCENTAGE' | 'FIXED';

export interface FeeTerms {
  feeType: FeeTypeValue;
  annualSalary?: number | null;
  feePercent?: number | null;
  fixedFee?: number | null;
}

export function totalClientFee(terms: FeeTerms): { ok: true; total: number } | { ok: false; message: string } {
  if (terms.feeType === 'PERCENTAGE') {
    if (terms.annualSalary === null || terms.annualSalary === undefined || !(terms.annualSalary >= 0)) return { ok: false, message: 'Enter the candidate’s annual salary.' };
    if (terms.feePercent === null || terms.feePercent === undefined || !(terms.feePercent >= 0) || terms.feePercent > 100) return { ok: false, message: 'Enter the agreed fee percentage (0 to 100).' };
    const pence = Math.round((Math.round((terms.annualSalary + Number.EPSILON) * 100) * Math.round(terms.feePercent * 100)) / 10_000);
    return { ok: true, total: pence / 100 };
  }
  if (terms.fixedFee === null || terms.fixedFee === undefined || !(terms.fixedFee >= 0)) return { ok: false, message: 'Enter the agreed fixed fee.' };
  return { ok: true, total: Math.round((terms.fixedFee + Number.EPSILON) * 100) / 100 };
}
