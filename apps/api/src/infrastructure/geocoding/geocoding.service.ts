import { Injectable, Logger } from '@nestjs/common';

export interface GeoPoint {
  lat: number;
  lon: number;
}

const GAP_MS = 1100; // OpenStreetMap's free geocoder allows one request a second
const CACHE_MAX = 2000;
const UK_POSTCODE = /^[a-z]{1,2}\d[a-z\d]?\s?\d[a-z]{2}$/i;
export const isUkPostcode = (value: string) => UK_POSTCODE.test(value.trim());
export const normaliseAddress = (query: string) => query.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Where an address, town or post code is on the map. One request a second to OpenStreetMap, answers kept in memory.
 * Used for the "within x km" filters (Jobs and Candidates) and to put every job / candidate on the map once, in the background.
 */
@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly cache = new Map<string, GeoPoint | null>();
  private last = 0;
  private chain: Promise<unknown> = Promise.resolve();

  /** The point; null = the service answered "no such place"; undefined = the service could not be asked (try again later). */
  resolve(query: string): Promise<GeoPoint | null | undefined> {
    const key = normaliseAddress(query);
    if (!key) return Promise.resolve(null);
    if (this.cache.has(key)) return Promise.resolve(this.cache.get(key) ?? null);
    // a UK post code is looked up in a service made for it: quick, and not held back by the one-a-second queue
    if (isUkPostcode(key)) return this.postcode(key);
    const run = this.chain.then(async () => {
      if (this.cache.has(key)) return this.cache.get(key) ?? null;
      const wait = this.last + GAP_MS - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      this.last = Date.now();
      const point = await this.lookup(key);
      if (point !== undefined) {
        if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value as string);
        this.cache.set(key, point);
      }
      return point;
    });
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async postcode(key: string): Promise<GeoPoint | null | undefined> {
    try {
      const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(key.replace(/\s/g, ''))}`, { signal: AbortSignal.timeout(8_000) });
      let point: GeoPoint | null;
      if (response.status === 404) point = null;
      else if (!response.ok) return undefined;
      else {
        const { result } = (await response.json()) as { result?: { latitude: number | null; longitude: number | null } };
        point = result?.latitude != null && result.longitude != null ? { lat: result.latitude, lon: result.longitude } : null;
      }
      if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value as string);
      this.cache.set(key, point);
      return point;
    } catch (error) {
      this.logger.warn(`Post code lookup "${key}" failed: ${(error as Error).message}`);
      return undefined;
    }
  }

  /** The point, or null when it cannot be found (or the service is down). */
  async locate(query: string): Promise<GeoPoint | null> {
    return (await this.resolve(query)) ?? null;
  }

  /**
   * An address in parts, most exact first: street + city + post code, then the post code alone, the city, the free-text
   * location. Returns the first that is found; undefined when none was found AND the service failed on the way.
   */
  async locateAddress(parts: { street?: string | null; city?: string | null; postcode?: string | null; location?: string | null }): Promise<GeoPoint | null | undefined> {
    const clean = (value?: string | null) => (value ?? '').trim();
    const [street, city, postcode, location] = [parts.street, parts.city, parts.postcode, parts.location].map(clean) as [string, string, string, string];
    // the town is the city, or what is written in Location when there is no city
    const full = [street, city || location, postcode].filter(Boolean).join(', ');
    // a UK post code is the quickest and most exact; otherwise the whole address first
    const tries = (isUkPostcode(postcode) ? [postcode, full, city, location] : [full, postcode, city, location]).filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);
    let failed = false;
    for (const query of tries) {
      const point = await this.resolve(query);
      if (point) return point;
      if (point === undefined) failed = true;
    }
    return failed ? undefined : null;
  }

  private async lookup(query: string): Promise<GeoPoint | null | undefined> {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'recruitment-crm/1.0 (distance search)' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return undefined;
      const [hit] = (await response.json()) as { lat: string; lon: string }[];
      return hit ? { lat: Number(hit.lat), lon: Number(hit.lon) } : null;
    } catch (error) {
      this.logger.warn(`Geocoding "${query}" failed: ${(error as Error).message}`);
      return undefined;
    }
  }
}
