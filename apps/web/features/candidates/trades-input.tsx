'use client';

import { X } from '@crm/ui/icons';
import { useState } from 'react';

/** The trades are kept in one text, separated by commas: "Electrician, Plumber". */
export function splitTrades(value: string | null | undefined): string[] {
  return (value ?? '')
    .split(/[,;\n]/)
    .map((trade) => trade.trim())
    .filter(Boolean);
}

/**
 * The trades of a candidate: the main one first, then the other jobs the person can do. Type one and press Enter (or a
 * comma) to add it; the x on a chip removes it.
 */
export function TradesInput({ id, value, onChange }: { id?: string; value: string | undefined; onChange: (next: string) => void }) {
  const [draft, setDraft] = useState('');
  const trades = splitTrades(value);

  const add = (raw: string) => {
    const incoming = splitTrades(raw).filter((trade) => !trades.some((have) => have.toLowerCase() === trade.toLowerCase()));
    if (incoming.length > 0) onChange([...trades, ...incoming].join(', '));
    setDraft('');
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {trades.map((trade, index) => (
          <span key={trade} className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium">
            {trade}
            {index === 0 && trades.length > 1 ? <span className="text-[10px] font-normal text-foreground/50">main</span> : null}
            <button type="button" aria-label={`Remove ${trade}`} className="text-foreground/50 hover:text-foreground" onClick={() => onChange(trades.filter((_, at) => at !== index).join(', '))}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          className="h-8 min-w-[10rem] flex-1 border-0 bg-transparent px-0 text-sm shadow-none outline-none placeholder:italic placeholder:text-foreground/40"
          placeholder={trades.length === 0 ? 'e.g. electrician, plumber' : 'Another trade the person can do…'}
          value={draft}
          onChange={(event) => {
            const next = event.target.value;
            if (next.includes(',')) add(next);
            else setDraft(next);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add(draft);
            } else if (event.key === 'Backspace' && draft === '' && trades.length > 0) {
              onChange(trades.slice(0, -1).join(', '));
            }
          }}
          onBlur={() => draft.trim() && add(draft)}
        />
      </div>
      <p className="mt-1 text-xs text-foreground/50">The main trade first, then the other jobs this person can do. Press Enter or a comma to add each one.</p>
    </div>
  );
}
