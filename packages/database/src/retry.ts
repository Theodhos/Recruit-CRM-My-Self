/**
 * The database is a remote Postgres (Supabase) behind a connection pooler. Any pooled connection can be dropped from
 * the other side while it sits idle ("Server has closed the connection", Windows error 10054, Prisma P1017/P1001);
 * the next query that is handed that dead connection fails — and, without this, turns into an "Internal server
 * error" for the person who happened to click at that moment. The query has not run when this happens, so it is run
 * again on a fresh connection.
 */
const TRANSIENT =
  /Server has closed the connection|Connection terminated|ConnectionReset|ECONNRESET|ETIMEDOUT|EPIPE|Can't reach database server|kind: Io|Timed out fetching a new connection/i;
const TRANSIENT_CODES = new Set(['P1001', 'P1002', 'P1017', 'P2024']);

/** Reads are safe to repeat as often as needed; a write gets one more try. */
const READ_OPERATIONS = new Set(['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy']);

export function isTransientDbError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (typeof code === 'string' && TRANSIENT_CODES.has(code)) return true;
  return typeof message === 'string' && TRANSIENT.test(message);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Operations whose relations (`include` / nested `select`) can be loaded with one JOIN instead of one query each. */
const JOIN_OPERATIONS = new Set(['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'create', 'update', 'upsert', 'delete']);

/**
 * Runs one Prisma operation: with its relations loaded in a single JOIN query (the database is remote, ~90 ms per
 * round trip, and by default every relation in an `include` is a separate query run one after the other — a card with
 * eight relations cost eight round trips), and repeated when the connection was dropped. A query the JOIN strategy
 * does not accept falls back to the default one; the result is the same either way.
 */
export async function runQuery<T>(operation: string, args: unknown, query: (args: never) => Promise<T>): Promise<T> {
  const a = (args ?? {}) as Record<string, unknown>;
  const wantsJoin = JOIN_OPERATIONS.has(operation) && (a.include !== undefined || a.select !== undefined) && a.relationLoadStrategy === undefined;
  if (!wantsJoin) return withDbRetry(operation, () => query(a as never));
  try {
    return await withDbRetry(operation, () => query({ ...a, relationLoadStrategy: 'join' } as never));
  } catch (error) {
    if (error instanceof Error && error.name === 'PrismaClientValidationError') return withDbRetry(operation, () => query(a as never));
    throw error;
  }
}

/**
 * The pooler only allows a fixed number of clients at once (Supabase session mode: 15, "EMAXCONNSESSION — max clients
 * reached"). A moment of heavy use — or sessions a restarted server has not yet let go of — can leave none free. The
 * query was never sent, so it is safe to repeat (writes too), and waiting a little is what frees a slot.
 */
const POOL_FULL = /EMAXCONN|max clients reached/i;

export async function withDbRetry<T>(operation: string, run: () => Promise<T>): Promise<T> {
  const attempts = READ_OPERATIONS.has(operation) ? 4 : 2;
  const poolFullAttempts = 8;
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (POOL_FULL.test(message)) {
        if (attempt >= poolFullAttempts) throw error;
        await sleep(250 * attempt);
        continue;
      }
      if (attempt >= attempts || !isTransientDbError(error)) throw error;
      await sleep(80 * attempt);
    }
  }
}
