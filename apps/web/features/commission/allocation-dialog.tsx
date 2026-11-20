'use client';

import { Button, Dialog, Input, Label, SearchSelect } from '@crm/ui';
import { CheckCircle2, Loader2, Users, XCircle } from '@crm/ui/icons';
import { useEffect, useState } from 'react';

import { useAllocation, useClearAllocation, useResourcers, useSetAllocation } from '@/hooks/use-commissions';
import { ApiClientError } from '@/lib/api-client';

const money = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
const pct = (value: string) => (value.trim() === '' || Number.isNaN(Number(value)) ? NaN : Number(value));
const round2 = (n: number) => Math.round(n * 100) / 100;

/** The shares of one amount for one or two resourcers; the second gets the remainder so the parts add up to the whole. */
function shares(amount: number, percents: number[]) {
  const total = Math.round(amount * 100);
  let used = 0;
  return percents.map((p, i) => {
    const part = i === percents.length - 1 ? total - used : Math.round((total * Math.round(p * 100)) / 10_000);
    used += part;
    return part / 100;
  });
}

/**
 * Who is responsible for this temporary placement: one resourcer, or two when it was shared with a split the
 * administrator decides. The two shares must add up to exactly 100%; the dialog shows the agency profit and the
 * client billing of the placement split between them, and the commission each would earn on it.
 */
export function AllocationDialog({ placementId, onClose }: { placementId: string; onClose: () => void }) {
  const { data: allocation, isLoading } = useAllocation(placementId);
  const { data: people } = useResourcers();
  const save = useSetAllocation();
  const clear = useClearAllocation();
  const [two, setTwo] = useState(false);
  const [aId, setAId] = useState('');
  const [bId, setBId] = useState('');
  const [aPct, setAPct] = useState('100');
  const [bPct, setBPct] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // start from what is saved
  useEffect(() => {
    if (!allocation || loaded) return;
    const [a, b] = allocation.resourcers;
    if (a) {
      setAId(a.userId);
      setAPct(String(a.splitPercent));
    }
    if (b) {
      setTwo(true);
      setBId(b.userId);
      setBPct(String(b.splitPercent));
    }
    setLoaded(true);
  }, [allocation, loaded]);

  const a = pct(aPct);
  const b = pct(bPct);
  const total = two ? (Number.isNaN(a) || Number.isNaN(b) ? NaN : round2(a + b)) : 100;
  const chosen = [aId, ...(two ? [bId] : [])];
  const problem = !aId ? 'Choose the resourcer.' : two && !bId ? 'Choose the second resourcer.' : two && aId === bId ? 'The two resourcers must be different people.' : two && Number.isNaN(total) ? 'Enter both shares.' : two && total !== 100 ? `The shares must add up to 100% (now ${total}%).` : null;
  const percents = two ? [a, b] : [100];
  const ready = !problem && percents.every((p) => !Number.isNaN(p) && p > 0);

  function setFirst(value: string) {
    setAPct(value);
    const n = pct(value);
    if (two && !Number.isNaN(n)) setBPct(String(round2(100 - n)));
  }
  function setSecond(value: string) {
    setBPct(value);
    const n = pct(value);
    if (!Number.isNaN(n)) setAPct(String(round2(100 - n)));
  }
  function preset(first: number) {
    setTwo(true);
    setAPct(String(first));
    setBPct(String(100 - first));
  }

  const profit = allocation?.totals.profit ?? 0;
  const billing = allocation?.totals.billing ?? 0;
  const profitParts = ready ? shares(profit, percents) : [];
  const billingParts = ready ? shares(billing, percents) : [];
  const preview = chosen.map((id, i) => {
    const person = people?.resourcers.find((r) => r.userId === id);
    const basis = person?.effectiveBasis ?? allocation?.defaultBasis ?? 'PROFIT';
    const commissionable = basis === 'PROFIT' ? profitParts[i] ?? 0 : billingParts[i] ?? 0;
    return { id, name: person?.name ?? '—', rate: person?.commissionRate ?? 0, basis, profit: profitParts[i] ?? 0, billing: billingParts[i] ?? 0, commission: round2((commissionable * (person?.commissionRate ?? 0)) / 100) };
  });

  async function submit() {
    setError(null);
    try {
      await save.mutateAsync({ placementId, resourcers: chosen.map((userId, i) => ({ userId, splitPercent: percents[i]! })) });
      onClose();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'The resourcers were not saved.');
    }
  }

  const options = (excluded: string) =>
    (people?.resourcers ?? []).map((r) => (
      <option key={r.userId} value={r.userId} disabled={r.userId === excluded}>
        {r.name} · {r.commissionRate}%
      </option>
    ));

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Resourcers of this placement"
      description={allocation ? `${allocation.worker} · ${allocation.client} · ${allocation.job}` : 'Who found and placed this worker'}
      className="max-w-2xl"
      footer={
        <>
          {allocation && allocation.resourcers.length > 0 ? (
            <Button type="button" variant="ghost" className="mr-auto" disabled={clear.isPending} onClick={() => void clear.mutateAsync(placementId).then(onClose)} data-testid="clear-resourcers">
              Remove resourcers
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={!ready || save.isPending} onClick={() => void submit()} data-testid="save-resourcers">
            {save.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </>
      }
    >
      {isLoading || !allocation ? (
        <div className="h-40 animate-pulse rounded-lg bg-accent/50" aria-busy="true" />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="inline-flex self-start rounded-lg border border-border p-0.5" role="group" aria-label="How many resourcers">
            {[
              [false, 'One resourcer'],
              [true, 'Shared between two'],
            ].map(([value, label]) => (
              <button
                key={String(value)}
                type="button"
                aria-pressed={two === value}
                onClick={() => {
                  setTwo(value as boolean);
                  if (!value) setAPct('100');
                  else if (pct(aPct) === 100 || Number.isNaN(pct(aPct))) preset(50);
                }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${two === value ? 'bg-primary text-primary-foreground' : 'text-foreground/70 hover:bg-accent'}`}
                data-testid={value ? 'mode-two' : 'mode-one'}
              >
                {label as string}
              </button>
            ))}
          </div>

          <div className={`grid gap-3 ${two ? 'sm:grid-cols-2' : ''}`}>
            {[0, ...(two ? [1] : [])].map((i) => (
              <div key={i} className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
                <Label htmlFor={`res-${i}`}>{two ? `Resourcer ${i === 0 ? 'A' : 'B'}` : 'Resourcer'}</Label>
                <SearchSelect id={`res-${i}`} value={i === 0 ? aId : bId} onChange={(event) => (i === 0 ? setAId(event.target.value) : setBId(event.target.value))} searchPlaceholder="Search people…" data-testid={`resourcer-${i}`}>
                  <option value="">Choose…</option>
                  {options(i === 0 ? bId : aId)}
                </SearchSelect>
                {two ? (
                  <div className="flex items-center gap-2">
                    <Input type="number" min={0.01} max={99.99} step={0.01} className="w-28" aria-label={`Share of resourcer ${i === 0 ? 'A' : 'B'} in percent`} value={i === 0 ? aPct : bPct} onChange={(event) => (i === 0 ? setFirst(event.target.value) : setSecond(event.target.value))} data-testid={`share-${i}`} />
                    <span className="text-sm text-foreground/60">%</span>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {two ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-foreground/60">Quick split:</span>
              {[50, 60, 70, 80].map((first) => (
                <button key={first} type="button" className="rounded border border-border px-2 py-0.5 text-xs hover:bg-accent" onClick={() => preset(first)}>
                  {first} / {100 - first}
                </button>
              ))}
              <span className={`ml-auto inline-flex items-center gap-1 font-semibold ${total === 100 ? 'text-emerald-700 dark:text-emerald-300' : 'text-destructive'}`} data-testid="split-total" aria-live="polite">
                {total === 100 ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                Total {Number.isNaN(total) ? '—' : `${total}%`}
              </span>
            </div>
          ) : null}

          <div className="rounded-lg border border-border bg-accent/20 px-3 py-3" data-testid="allocation-preview">
            <p className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground/60">
              <Users className="h-3.5 w-3.5" /> {allocation.employmentType === 'PERMANENT' ? 'This placement’s client fee' : 'This placement so far'}: client billing <strong className="text-foreground">{money(billing)}</strong> · agency profit <strong className="text-foreground">{money(profit)}</strong> ({allocation.employmentType === 'PERMANENT' ? 'the client fee' : `${allocation.totals.timesheets} approved timesheet${allocation.totals.timesheets === 1 ? '' : 's'}`})
            </p>
            {ready && preview.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-foreground/55">
                  <tr>
                    <th className="py-1 font-medium">Resourcer</th>
                    <th className="py-1 text-right font-medium">Share</th>
                    <th className="py-1 text-right font-medium">Billing</th>
                    <th className="py-1 text-right font-medium">Profit</th>
                    <th className="py-1 text-right font-medium">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((p, i) => (
                    <tr key={p.id || i}>
                      <td className="py-1">{p.name}</td>
                      <td className="py-1 text-right tabular-nums">{percents[i]}%</td>
                      <td className="py-1 text-right tabular-nums">{money(p.billing)}</td>
                      <td className="py-1 text-right tabular-nums">{money(p.profit)}</td>
                      <td className="py-1 text-right tabular-nums" title={`${p.rate}% of the ${p.basis === 'PROFIT' ? 'profit' : 'billing'}`}>
                        {money(p.commission)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-foreground/55">{problem ?? 'Choose the resourcer to see the split.'}</p>
            )}
          </div>

          {problem && ready === false && !isLoading && (aId || bId) ? (
            <p className="text-sm text-destructive" role="alert" data-testid="allocation-problem">
              {problem}
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </Dialog>
  );
}
