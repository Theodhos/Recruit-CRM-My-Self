import { totalClientFee } from './fee-calc';

describe('totalClientFee', () => {
  it('option 1: 10% of a £40,000 salary is £4,000', () => {
    expect(totalClientFee({ feeType: 'PERCENTAGE', annualSalary: 40000, feePercent: 10 })).toEqual({ ok: true, total: 4000 });
  });

  it('option 2: a fixed fee of £2,500 is £2,500 whatever the salary is', () => {
    expect(totalClientFee({ feeType: 'FIXED', annualSalary: 35000, fixedFee: 2500 })).toEqual({ ok: true, total: 2500 });
    expect(totalClientFee({ feeType: 'FIXED', fixedFee: 2500 })).toEqual({ ok: true, total: 2500 });
  });

  it('every client can have a different percentage', () => {
    expect(totalClientFee({ feeType: 'PERCENTAGE', annualSalary: 40000, feePercent: 12.5 })).toEqual({ ok: true, total: 5000 });
    expect(totalClientFee({ feeType: 'PERCENTAGE', annualSalary: 28500, feePercent: 8 })).toEqual({ ok: true, total: 2280 });
  });

  it('works in whole pence', () => {
    expect(totalClientFee({ feeType: 'PERCENTAGE', annualSalary: 33333.33, feePercent: 15 })).toEqual({ ok: true, total: 5000 });
  });

  it('asks for what is missing', () => {
    expect(totalClientFee({ feeType: 'PERCENTAGE', feePercent: 10 }).ok).toBe(false);
    expect(totalClientFee({ feeType: 'PERCENTAGE', annualSalary: 40000 }).ok).toBe(false);
    expect(totalClientFee({ feeType: 'PERCENTAGE', annualSalary: 40000, feePercent: 101 }).ok).toBe(false);
    expect(totalClientFee({ feeType: 'FIXED', annualSalary: 40000 }).ok).toBe(false);
  });
});
