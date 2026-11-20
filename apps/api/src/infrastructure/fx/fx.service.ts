import { Injectable, Logger } from '@nestjs/common';

/** The currencies the CRM works in. GBP is the default; the others can be chosen. */
export const FX_CURRENCIES = ['GBP', 'EUR', 'USD', 'ALL'] as const;
export type FxCurrency = (typeof FX_CURRENCIES)[number];

export interface FxRates {
  /** Every rate is "how much of this currency is 1 GBP". */
  base: 'GBP';
  rates: Record<FxCurrency, number>;
  /** live = just fetched from the rates provider; cached = fetched earlier; fallback = the provider could not be reached. */
  source: 'live' | 'cached' | 'fallback';
  updatedAt: string;
}

/** Only used when the provider cannot be reached and nothing was fetched before: close to the market, never exact. */
const FALLBACK: Record<FxCurrency, number> = { GBP: 1, EUR: 1.17, USD: 1.27, ALL: 118 };
const FRESH_MS = 3 * 60 * 60 * 1000;

/**
 * Exchange rates for the amounts the CRM converts when a currency is changed (a fee, a retainer, a pay rate…).
 * Fetched from open.er-api.com (daily market rates, includes the Albanian Lek), kept for three hours, and the last good
 * answer is kept if the provider is down.
 */
@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);
  private last: { rates: Record<FxCurrency, number>; at: number } | null = null;

  async rates(): Promise<FxRates> {
    const now = Date.now();
    if (this.last && now - this.last.at < FRESH_MS) return this.present(this.last.rates, 'cached', this.last.at);
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/GBP', { signal: AbortSignal.timeout(6000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = (await response.json()) as { result?: string; rates?: Record<string, number> };
      const rates = { GBP: 1 } as Record<FxCurrency, number>;
      for (const code of FX_CURRENCIES) {
        const rate = code === 'GBP' ? 1 : body.rates?.[code];
        if (typeof rate !== 'number' || !(rate > 0)) throw new Error(`no rate for ${code}`);
        rates[code] = rate;
      }
      this.last = { rates, at: now };
      return this.present(rates, 'live', now);
    } catch (error) {
      this.logger.warn(`Exchange rates not fetched: ${(error as Error).message}`);
      if (this.last) return this.present(this.last.rates, 'cached', this.last.at);
      return this.present(FALLBACK, 'fallback', now);
    }
  }

  private present(rates: Record<FxCurrency, number>, source: FxRates['source'], at: number): FxRates {
    return { base: 'GBP', rates, source, updatedAt: new Date(at).toISOString() };
  }
}
