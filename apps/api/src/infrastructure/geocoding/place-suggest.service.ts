import { Injectable, Logger } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

export interface PlaceSuggestion {
  /** What is put into the box. */
  value: string;
  kind: 'postcode' | 'city' | 'street';
}

const MAX = 8;
const POSTCODE_START = /^[a-z]{1,2}\d/i;

/**
 * The drop-down under the "street, city or post code" box of the distance filters: places that are already in the CRM
 * (the streets, cities and post codes of its jobs and candidates), then — when what is typed starts like a UK post code —
 * the post codes the free postcodes.io service completes. Nothing here calls a map service on every key.
 */
@Injectable()
export class PlaceSuggestService {
  private readonly logger = new Logger(PlaceSuggestService.name);
  private readonly postcodeCache = new Map<string, string[]>();

  constructor(private readonly db: DatabaseService) {}

  async suggest(organisationId: string, text: string): Promise<PlaceSuggestion[]> {
    const q = text.trim();
    if (q.length < 2) return [];
    const found = new Map<string, PlaceSuggestion>();
    const add = (value: string | null | undefined, kind: PlaceSuggestion['kind']) => {
      const clean = (value ?? '').trim();
      if (clean && !found.has(clean.toLowerCase()) && found.size < MAX) found.set(clean.toLowerCase(), { value: clean, kind });
    };

    const db = this.db.forTenant(organisationId);
    const starts = { startsWith: q, mode: 'insensitive' as const };
    const has = { contains: q, mode: 'insensitive' as const };
    const [jobs, people] = await Promise.all([
      db.job.findMany({ where: { deletedAt: null, OR: [{ city: starts }, { street: has }, { postcode: starts }] }, select: { city: true, street: true, postcode: true }, take: 40 }),
      db.candidate.findMany({ where: { deletedAt: null, OR: [{ city: starts }, { street: has }, { postalCode: starts }] }, select: { city: true, street: true, postalCode: true }, take: 40 }),
    ]);
    const lower = q.toLowerCase();
    for (const row of [...jobs, ...people.map((p) => ({ city: p.city, street: p.street, postcode: p.postalCode }))]) {
      if (row.postcode?.toLowerCase().startsWith(lower)) add(row.postcode, 'postcode');
      if (row.city?.toLowerCase().startsWith(lower)) add(row.city, 'city');
      if (row.street?.toLowerCase().includes(lower)) add([row.street, row.city].filter(Boolean).join(', '), 'street');
    }

    if (found.size < MAX && POSTCODE_START.test(q)) {
      for (const code of await this.completePostcode(q)) add(code, 'postcode');
    }
    return [...found.values()];
  }

  private async completePostcode(text: string): Promise<string[]> {
    const key = text.replace(/\s/g, '').toLowerCase();
    const cached = this.postcodeCache.get(key);
    if (cached) return cached;
    try {
      const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(key)}/autocomplete?limit=5`, { signal: AbortSignal.timeout(3_000) });
      if (!response.ok) return [];
      const { result } = (await response.json()) as { result: string[] | null };
      const codes = result ?? [];
      if (this.postcodeCache.size > 500) this.postcodeCache.clear();
      this.postcodeCache.set(key, codes);
      return codes;
    } catch (error) {
      this.logger.warn(`Post code suggestions failed: ${(error as Error).message}`);
      return [];
    }
  }
}
