'use client';

import type { Company, CompanyWin } from '@crm/types';
import { Button, Card, CardContent, CardHeader, CardTitle, Dialog, Input, Label, Select, Textarea } from '@crm/ui';
import { Handshake, Pencil } from '@crm/ui/icons';
import { useState } from 'react';

import { convertText, fxNote, useFxRates } from '@/lib/fx';

import { useSaveCompanyPipelineRecord } from '@/hooks/use-companies';
import { useOrganisation } from '@/hooks/use-organisation';

export const FEE_CURRENCIES = ['GBP', 'EUR', 'USD', 'ALL'] as const;

export interface AgreedFeeDraft {
  fee: string;
  currency: string;
  terms: string;
}

export const money = (value: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);

/** The draft to start from: what was agreed before, otherwise the pay calculation's currency (or the organisation's). */
export function agreedFeeDraft(company: Pick<Company, 'pipelineRecord'>, fallbackCurrency = 'GBP'): AgreedFeeDraft {
  const win = company.pipelineRecord?.win ?? null;
  return {
    fee: win ? String(win.fee) : '',
    currency: win?.currency ?? company.pipelineRecord?.pay?.currency ?? fallbackCurrency,
    terms: win?.terms ?? '',
  };
}

/** The fee as a number, or null when the draft is empty / not a number — the fee is required to win a company. */
export function agreedFeeValue(draft: AgreedFeeDraft): number | null {
  if (draft.fee.trim() === '') return null;
  const n = Number(draft.fee);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * The fields of the fee agreed with a company: the amount, its currency and how it works (per hire, % of the annual
 * salary, monthly retainer…). Used in the Win pop-up and on the company's profile.
 */
export function AgreedFeeFields({
  draft,
  onChange,
  disabled,
  idPrefix = 'agreed-fee',
}: {
  draft: AgreedFeeDraft;
  onChange: (draft: AgreedFeeDraft) => void;
  disabled?: boolean;
  idPrefix?: string;
}) {
  const { data: fx } = useFxRates();
  const [fxMessage, setFxMessage] = useState<string | null>(null);
  // choosing another currency converts the typed fee at the market rate
  const set = (field: keyof AgreedFeeDraft) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    if (field === 'currency') {
      setFxMessage(fxNote(draft.currency, value, fx));
      onChange({ ...draft, currency: value, fee: convertText(draft.fee, draft.currency, value, fx) });
      return;
    }
    onChange({ ...draft, [field]: value });
  };
  return (
    <div className="flex flex-col gap-3" data-testid="agreed-fee-fields">
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${idPrefix}-amount`}>Fee agreed</Label>
          <Input
            id={`${idPrefix}-amount`}
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            required
            disabled={disabled}
            value={draft.fee}
            onChange={set('fee')}
            placeholder="e.g. 1500"
            data-testid="agreed-fee-amount"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${idPrefix}-currency`}>Currency</Label>
          <Select id={`${idPrefix}-currency`} disabled={disabled} value={draft.currency} onChange={set('currency')}>
            {FEE_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {fxMessage ? <p className="col-span-full text-xs text-foreground/60" data-testid="fx-note">{fxMessage}</p> : null}
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefix}-terms`}>
          Terms <span className="font-normal text-foreground/50">(optional)</span>
        </Label>
        <Textarea
          id={`${idPrefix}-terms`}
          rows={2}
          className="min-h-0"
          disabled={disabled}
          value={draft.terms}
          onChange={set('terms')}
          placeholder="e.g. per hire, 15% of the annual salary, monthly retainer…"
        />
      </div>
    </div>
  );
}

const when = (iso: string) => (iso ? new Date(iso).toLocaleDateString([], { dateStyle: 'medium' }) : '');

/** The agreed fee as it is shown: amount, terms and when it was agreed. */
export function AgreedFeeSummary({ win }: { win: CompanyWin }) {
  return (
    <div data-testid="agreed-fee-summary">
      <p className="text-2xl font-semibold tabular-nums">{money(win.fee, win.currency)}</p>
      {win.terms ? <p className="mt-1 whitespace-pre-wrap text-sm">{win.terms}</p> : null}
      {win.agreedAt ? <p className="mt-1 text-xs text-foreground/50">Agreed on {when(win.agreedAt)}</p> : null}
    </div>
  );
}

/**
 * The card on the company's profile with the fee agreed when the company was won (set in the Win pop-up on Pipeline
 * Companies). It can be changed here; the date it was first agreed stays.
 */
export function AgreedFeeCard({ company }: { company: Company }) {
  const win = company.pipelineRecord?.win ?? null;
  const { data: organisation } = useOrganisation();
  const save = useSaveCompanyPipelineRecord();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AgreedFeeDraft>(() => agreedFeeDraft(company, organisation?.payDefaults?.currency ?? 'GBP'));
  const [error, setError] = useState<string | null>(null);

  function open() {
    setDraft(agreedFeeDraft(company, organisation?.payDefaults?.currency ?? 'GBP'));
    setError(null);
    setEditing(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const fee = agreedFeeValue(draft);
    if (fee === null) {
      setError('Enter the fee agreed.');
      return;
    }
    setError(null);
    try {
      await save.mutateAsync({ id: company.id, input: { win: { fee, currency: draft.currency, terms: draft.terms.trim() } } });
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the agreed fee.');
    }
  }

  return (
    <Card data-testid="company-agreed-fee">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Handshake className="h-4 w-4 text-foreground/50" /> Fee agreed
        </CardTitle>
        <Button type="button" variant="outline" size="sm" onClick={open}>
          <Pencil className="mr-1 h-3.5 w-3.5" /> {win ? 'Change' : 'Set'}
        </Button>
      </CardHeader>
      <CardContent>
        {win ? (
          <AgreedFeeSummary win={win} />
        ) : (
          <p className="text-sm text-foreground/50">
            {company.pipelineStage === 'WIN'
              ? 'No fee recorded for this company yet.'
              : 'Asked for when the company is moved to Signed on Pipeline Companies.'}
          </p>
        )}
      </CardContent>
      {editing ? (
        <Dialog
          open
          onOpenChange={(o) => !o && !save.isPending && setEditing(false)}
          title={`Fee agreed with ${company.name}`}
          footer={
            <div className="flex gap-2">
              <Button type="button" variant="ghost" disabled={save.isPending} onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button type="submit" form="agreed-fee-form" disabled={save.isPending}>
                {save.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          }
        >
          <form id="agreed-fee-form" onSubmit={(e) => void submit(e)}>
            <AgreedFeeFields draft={draft} onChange={setDraft} disabled={save.isPending} idPrefix="profile-fee" />
            {error ? (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        </Dialog>
      ) : null}
    </Card>
  );
}
