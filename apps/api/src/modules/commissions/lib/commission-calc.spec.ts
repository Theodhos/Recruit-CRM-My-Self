import { attribute, basisFigure, checkSplit, commissionOf, monthRange } from './commission-calc';

describe('checkSplit', () => {
  it('one resourcer, or two adding up to exactly 100%', () => {
    expect(checkSplit([100]).ok).toBe(true);
    expect(checkSplit([70, 30]).ok).toBe(true);
    expect(checkSplit([33.33, 66.67]).ok).toBe(true);
  });

  it('refuses anything that does not add up to 100%, with the figure it adds up to', () => {
    expect(checkSplit([60, 30])).toEqual({ ok: false, message: 'The shares must add up to 100% (now 90%).' });
    expect(checkSplit([70, 40]).ok).toBe(false);
  });

  it('refuses none, three, zero or negative shares', () => {
    expect(checkSplit([]).ok).toBe(false);
    expect(checkSplit([40, 30, 30]).ok).toBe(false);
    expect(checkSplit([100, 0]).ok).toBe(false);
    expect(checkSplit([120, -20]).ok).toBe(false);
  });
});

describe('attribute', () => {
  it('the example: £300 profit split 70% / 30% is £210 and £90', () => {
    expect(attribute(300, [70, 30])).toEqual([210, 90]);
  });

  it('the parts always add up to the whole, to the penny', () => {
    const parts = attribute(100.01, [33.33, 66.67]);
    expect(Math.round((parts[0]! + parts[1]!) * 100)).toBe(10001);
    expect(attribute(785, [70, 30])).toEqual([549.5, 235.5]);
    expect(attribute(250, [100])).toEqual([250]);
  });
});

describe('commissionOf', () => {
  it('£1,000 profit at 10% is £100', () => {
    expect(commissionOf(1000, 10)).toBe(100);
  });

  it('works in whole pence', () => {
    expect(commissionOf(90, 8)).toBe(7.2);
    expect(commissionOf(549.5, 10)).toBe(54.95);
    expect(commissionOf(0.1 + 0.2, 10)).toBe(0.03);
  });
});

describe('the basis is a setting', () => {
  it('commission is worked out on profit or on billing, as chosen', () => {
    expect(basisFigure('PROFIT', 300, 785)).toBe(300);
    expect(basisFigure('BILLING', 300, 785)).toBe(785);
  });
});

describe('monthRange', () => {
  it('a month runs from its first day to the first of the next', () => {
    const r = monthRange('2026-12');
    expect(r.start.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(r.end.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('rejects a month that is not a month', () => {
    expect(() => monthRange('2026-13')).toThrow();
    expect(() => monthRange('nov')).toThrow();
  });
});
