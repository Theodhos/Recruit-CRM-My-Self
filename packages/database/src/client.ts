import { PrismaClient } from './generated/client';

// Prevent exhausting the Postgres connection pool from hot-reloading in dev
// (each reload would otherwise instantiate a new PrismaClient).
declare global {
  // eslint-disable-next-line no-var
  var __crmPrismaClient: PrismaClient | undefined;
}

/**
 * The pooler in front of the database (Supabase, session mode) lets only 15 clients in at once — across every process
 * and every restart that has not yet been let go of. A server that opens ten of them by itself leaves little room, and
 * the next query then fails with "max clients reached" (an Internal server error for whoever clicked). So the server
 * keeps its own pool small: the connection_limit of DATABASE_URL, but at most DB_POOL_MAX (default 6).
 */
function limitedDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  const max = Number(process.env.DB_POOL_MAX ?? 6);
  if (!url || !max) return undefined;
  const current = /connection_limit=(\d+)/.exec(url);
  if (current && Number(current[1]) <= max) return undefined;
  if (current) return url.replace(current[0], `connection_limit=${max}`);
  return `${url}${url.includes('?') ? '&' : '?'}connection_limit=${max}`;
}

function createPrismaClient(): PrismaClient {
  const levels = process.env.NODE_ENV === 'development' ? (['warn', 'error'] as const) : (['error'] as const);

  // Per-statement events (duration + SQL text) feed the query-latency metrics and the slow-query log. They are
  // opt-in because emitting one event per statement is not free; the default log configuration is unchanged.
  const wantsQueryEvents = process.env.DB_QUERY_METRICS === 'true' || Boolean(process.env.DB_SLOW_QUERY_MS);

  const url = limitedDatabaseUrl();
  return new PrismaClient({
    ...(url ? { datasources: { db: { url } } } : {}),
    log: wantsQueryEvents
      ? [{ emit: 'event', level: 'query' }, ...levels.map((level) => ({ emit: 'stdout' as const, level }))]
      : [...levels],
  });
}

export const prisma: PrismaClient = globalThis.__crmPrismaClient ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__crmPrismaClient = prisma;
}
