import type { PrismaClient } from './generated/client';

/**
 * Per-user record visibility, layered ON TOP of tenant scoping (scopedPrisma).
 *
 * Everyone in the organisation works on the same candidates, companies, jobs and what hangs off them (see SHARED);
 * only per-user data — calendar, calling lists, messages — stays each user's own. This extension enforces that at the data-access
 * layer — every list, detail, count, dashboard aggregate, search and update goes through it — instead of trusting each
 * call site to remember a filter.
 *
 * The filter for each model, for user `u`:
 *   candidate / company / job    ownerId = u
 *   contact                      its company is owned by u
 *   application / placement      its candidate is owned by u
 *   calendarEvent                it is u's event
 *   document                     u uploaded it, or it belongs to u's candidate / company / job
 *   applicationStageNote         its application's candidate is owned by u
 *   interview                    its application's candidate is owned by u
 *   phone / phoneImport          u imported it (phones are each instructor's own calling list)
 *   phoneCall                    its phone is owned by u
 *
 * Records created by a scoped user are owned by that user, except a candidate, company or job added with another
 * instructor named ("Added by"), which goes to that instructor.
 */
export const OWNER_SCOPED_MODELS = [
  'candidate',
  'company',
  'job',
  'contact',
  'application',
  'placement',
  'calendarEvent',
  'document',
  'applicationStageNote',
  'interview',
  'phone',
  'phoneCall',
  'phoneImport',
  'communication',
] as const;

export type OwnerScopedModel = (typeof OWNER_SCOPED_MODELS)[number];

/** Models whose `ownerId` is forced to the acting user on create. */
const OWNED_ON_CREATE: ReadonlySet<string> = new Set(['candidate', 'company', 'job', 'contact', 'application', 'placement', 'phone']);

/** Candidates, companies and jobs may be given to another instructor when they are added (the "Added by" dropdown): a named `ownerId` stands, otherwise the acting user is the owner. */
const ASSIGNABLE_ON_CREATE: ReadonlySet<string> = new Set(['candidate', 'company', 'job']);
const ownerOf = (key: string, data: Record<string, unknown>, userId: string) => (ASSIGNABLE_ON_CREATE.has(key) && typeof data.ownerId === 'string' && data.ownerId ? data.ownerId : userId);

export function ownerFilter(model: OwnerScopedModel, userId: string): Record<string, unknown> {
  switch (model) {
    case 'candidate':
    case 'company':
    case 'job':
      return { ownerId: userId };
    case 'contact':
      return { company: { ownerId: userId } };
    case 'application':
    case 'placement':
      return { candidate: { ownerId: userId } };
    case 'applicationStageNote':
    case 'interview':
      return { application: { candidate: { ownerId: userId } } };
    case 'calendarEvent':
    case 'phoneImport':
      return { userId };
    case 'phone':
      return { ownerId: userId };
    case 'phoneCall':
      return { phone: { ownerId: userId } };
    case 'communication':
      return { OR: [{ userId }, { candidate: { ownerId: userId } }] };
    case 'document':
      return {
        OR: [
          { uploadedById: userId },
          { candidate: { ownerId: userId } },
          { company: { ownerId: userId } },
          { job: { ownerId: userId } },
        ],
      };
  }
}

/**
 * The shared book: candidates, companies and jobs, and everything that hangs off them (contacts, applications, stage
 * notes, interviews, documents, placements). Every user sees and works on all of it, exactly as the administrator does,
 * so moving a card on the pipeline, hiring or editing a record never fails for lack of ownership. What a user creates
 * is theirs ("Added by"). Only per-user data — calendar, calling lists, messages — stays personal.
 */
const SHARED: ReadonlySet<string> = new Set(['candidate', 'company', 'job', 'contact', 'application', 'applicationStageNote', 'interview', 'document', 'placement']);
const CREATE_OPERATIONS: ReadonlySet<string> = new Set(['create', 'createMany', 'upsert']);

/** ANDs `filter` into a where clause without disturbing its own keys (unique lookups keep their unique field on top). */
function andWhere(where: unknown, filter: Record<string, unknown>): Record<string, unknown> {
  const w = (where ?? {}) as Record<string, unknown>;
  const existing = w.AND === undefined ? [] : Array.isArray(w.AND) ? w.AND : [w.AND];
  return { ...w, AND: [...existing, filter] };
}

/**
 * Pure transformation of one Prisma operation's args — exported so it can be unit-tested without a database.
 * Returns the args unchanged for models that are not owner-scoped.
 */
export function applyOwnerScope(model: string | undefined, operation: string, args: unknown, userId: string): unknown {
  if (!model) return args;
  const key = (model.charAt(0).toLowerCase() + model.slice(1)) as OwnerScopedModel;
  if (!OWNER_SCOPED_MODELS.includes(key)) return args;

  if (SHARED.has(key) && !CREATE_OPERATIONS.has(operation)) return args;

  const a = { ...((args ?? {}) as Record<string, unknown>) };
  const filter = ownerFilter(key, userId);

  switch (operation) {
    case 'findUnique':
    case 'findUniqueOrThrow':
    case 'findFirst':
    case 'findFirstOrThrow':
    case 'findMany':
    case 'count':
    case 'aggregate':
    case 'groupBy':
    case 'update':
    case 'updateMany':
    case 'delete':
    case 'deleteMany':
      a.where = andWhere(a.where, filter);
      break;
    case 'create':
      if (OWNED_ON_CREATE.has(key)) a.data = { ...(a.data as Record<string, unknown>), ownerId: ownerOf(key, a.data as Record<string, unknown>, userId) };
      break;
    case 'createMany':
      if (OWNED_ON_CREATE.has(key) && Array.isArray(a.data)) {
        a.data = (a.data as Record<string, unknown>[]).map((d) => ({ ...d, ownerId: ownerOf(key, d, userId) }));
      }
      break;
    case 'upsert':
      a.where = andWhere(a.where, filter);
      if (OWNED_ON_CREATE.has(key)) a.create = { ...(a.create as Record<string, unknown>), ownerId: ownerOf(key, a.create as Record<string, unknown>, userId) };
      break;
    default:
      break;
  }
  return a;
}

/** Wraps an (already tenant-scoped) client so that every query only sees `userId`'s records. */
export function ownerScopedPrisma<T>(client: T, userId: string): T {
  if (!userId) throw new Error('ownerScopedPrisma() requires a non-empty userId');
  return (client as unknown as PrismaClient).$extends({
    name: 'owner-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          return query(applyOwnerScope(model, operation, args, userId) as never);
        },
      },
    },
  }) as unknown as T;
}
