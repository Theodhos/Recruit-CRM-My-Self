/**
 * Commission arithmetic, in whole pence.
 *
 *   attributed  = the placement's figure × the resourcer's split %   (two resourcers: the second gets the remainder,
 *                 so the two parts always add up to the whole, to the penny)
 *   commissionable = the attributed figure the commission is worked out on — the agency PROFIT or the client BILLING,
 *                 whichever basis is chosen (nothing is hardcoded: the basis is a setting)
 *   commission  = commissionable × the resourcer's commission %
 */
export type CommissionBasis = 'PROFIT' | 'BILLING';

const toPence = (pounds: number) => Math.round((pounds + Number.EPSILON) * 100);

/** The split of one or two resourcers is valid when each is above 0, none is above 100, and they add up to exactly 100. */
export function checkSplit(percents: number[]): { ok: true } | { ok: false; message: string } {
  if (percents.length < 1 || percents.length > 2) return { ok: false, message: 'A placement has one resourcer, or two when it was shared.' };
  if (percents.some((p) => !(p > 0) || p > 100 || Number.isNaN(p))) return { ok: false, message: 'Each share must be more than 0% and at most 100%.' };
  const total = percents.reduce((sum, p) => sum + Math.round(p * 100), 0);
  if (total !== 10_000) return { ok: false, message: `The shares must add up to 100% (now ${total / 100}%).` };
  return { ok: true };
}

/** Shares of one amount (pounds) for resourcers with the given split percentages; the parts add up to the amount. */
export function attribute(amount: number, percents: number[]): number[] {
  const total = toPence(amount);
  const parts: number[] = [];
  let used = 0;
  percents.forEach((percent, index) => {
    const part = index === percents.length - 1 ? total - used : Math.round((total * Math.round(percent * 100)) / 10_000);
    parts.push(part);
    used += part;
  });
  return parts.map((p) => p / 100);
}

export function commissionOf(commissionable: number, ratePercent: number): number {
  return Math.round((toPence(commissionable) * Math.round(ratePercent * 100)) / 10_000) / 100;
}

export const basisFigure = (basis: CommissionBasis, profit: number, billing: number) => (basis === 'PROFIT' ? profit : billing);

/** "2026-11" → the first day of the month and of the next one (UTC). */
export function monthRange(month: string): { start: Date; end: Date } {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) throw new Error('INVALID_MONTH');
  const start = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return { start, end: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)) };
}
