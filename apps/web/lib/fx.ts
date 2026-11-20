'use client';

import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';

/** The currencies that can be chosen. GBP first: it is the default everywhere. */
export const CURRENCY_CODES = ['GBP', 'EUR', 'USD', 'ALL'] as const;
export const CURRENCY_LABEL: Record<string, string> = { GBP: 'GBP — Pound', EUR: 'EUR — Euro', USD: 'USD — Dollar', ALL: 'ALL — Lek' };

export interface FxRates {
  base: 'GBP';
  rates: Record<string, number>;
  source: 'live' | 'cached' | 'fallback';
  updatedAt: string;
}

/** The live exchange rates (1 GBP in each currency), fetched once an hour. */
export function useFxRates() {
  return useQuery({ queryKey: ['fx', 'rates'], queryFn: () => apiClient<FxRates>('/fx/rates'), staleTime: 60 * 60 * 1000 });
}

/** An amount in one currency worth the same in another, to the penny. Null when a rate is not known. */
export function convertAmount(value: number, from: string, to: string, fx: FxRates | undefined): number | null {
  if (from === to) return value;
  const a = fx?.rates[from];
  const b = fx?.rates[to];
  if (!a || !b) return null;
  return Math.round(((value / a) * b + Number.EPSILON) * 100) / 100;
}

/** The same for an amount typed in a box: empty or not a number stays as it is. */
export function convertText(text: string, from: string, to: string, fx: FxRates | undefined): string {
  if (text.trim() === '' || Number.isNaN(Number(text))) return text;
  const converted = convertAmount(Number(text), from, to, fx);
  return converted === null ? text : String(converted);
}

/** "1 GBP = 1.27 USD · live rate" — what the conversion used, shown under a currency box. */
export function fxNote(from: string, to: string, fx: FxRates | undefined): string | null {
  if (from === to || !fx?.rates[from] || !fx?.rates[to]) return null;
  const rate = fx.rates[to]! / fx.rates[from]!;
  return `Amounts converted automatically: 1 ${from} = ${rate.toFixed(rate < 10 ? 4 : 2)} ${to}${fx.source === 'fallback' ? ' (approximate — live rate unavailable)' : ' (market rate)'}`;
}
