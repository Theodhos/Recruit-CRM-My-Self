jest.mock('../../../infrastructure/database/database.service', () => ({ DatabaseService: class DatabaseService {} }));

import type { CacheService } from '../../../infrastructure/cache/cache.service';
import type { DatabaseService } from '../../../infrastructure/database/database.service';

import { CandidatesRepository } from './candidates.repository';

function setup(websiteIds: string[] = []) {
  const candidate = { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), updateMany: jest.fn().mockResolvedValue({ count: 4 }) };
  const auditLog = { findMany: jest.fn().mockResolvedValue(websiteIds.map((entityId) => ({ entityId }))) };
  const db = { forTenant: jest.fn(() => ({ candidate, auditLog })) } as unknown as DatabaseService;
  const cache = { cachedCount: jest.fn((_o: string, _k: string, _w: unknown, load: () => Promise<number>) => load()) } as unknown as CacheService;
  return { repository: new CandidatesRepository(db, cache, {} as never), candidate };
}

const query = (extra: object = {}) => ({ page: 1, pageSize: 25, ...extra }) as never;
const andOf = (call: { where: { AND?: unknown[] } }) => call.where.AND ?? [];

describe('candidate filters', () => {
  it('every filter becomes its own condition, and they all apply together (AND)', async () => {
    const { repository, candidate } = setup();

    await repository.findPage(
      'org1',
      query({
        location: 'london',
        postcode: 'sw1',
        jobTitle: 'electrician',
        trade: 'elec',
        grade: 'A,B',
        employmentStatus: 'UNEMPLOYED',
        experienceMin: 5,
        skills: 'Conduit, Fault Finding',
        qualifications: 'NVQ 3',
        notContactedSince: '2026-10-01',
      }),
    );

    const conditions = andOf(candidate.findMany.mock.calls[0][0]);
    expect(conditions).toEqual(
      expect.arrayContaining([
        { OR: [{ location: { contains: 'london', mode: 'insensitive' } }, { city: { contains: 'london', mode: 'insensitive' } }, { street: { contains: 'london', mode: 'insensitive' } }, { postalCode: { contains: 'london', mode: 'insensitive' } }] },
        { OR: [{ postalCode: { startsWith: 'sw1', mode: 'insensitive' } }, { location: { contains: 'sw1', mode: 'insensitive' } }] },
        { jobTitle: { contains: 'electrician', mode: 'insensitive' } },
        { trade: { contains: 'elec', mode: 'insensitive' } },
        { grade: { in: ['A', 'B'] } },
        { employmentStatus: 'UNEMPLOYED' },
        { experienceYears: { gte: 5 } },
        { skills: { hasEvery: ['conduit', 'fault finding'] } },
        { qualifications: { hasEvery: ['nvq 3'] } },
        { OR: [{ lastContactedAt: null }, { lastContactedAt: { lt: new Date('2026-10-01') } }] },
      ]),
    );
    expect(conditions).toHaveLength(10);
  });

  it('filters combine with the existing ones (availability, search words) instead of replacing them', async () => {
    const { repository, candidate } = setup();

    await repository.findPage('org1', query({ availability: 'AVAILABLE', search: 'ana', grade: 'C' }));

    const conditions = andOf(candidate.findMany.mock.calls[0][0]);
    expect(conditions.length).toBeGreaterThanOrEqual(3);
    expect(conditions).toContainEqual({ grade: { in: ['C'] } });
  });

  it('a "last contacted between" range includes the whole last day', async () => {
    const { repository, candidate } = setup();

    await repository.findPage('org1', query({ contactedFrom: '2026-10-01', contactedTo: '2026-10-31' }));

    const conditions = andOf(candidate.findMany.mock.calls[0][0]) as { lastContactedAt?: { gte?: Date; lte?: Date } }[];
    expect(conditions).toContainEqual({ lastContactedAt: { gte: new Date('2026-10-01') } });
    const upper = conditions.find((c) => c.lastContactedAt?.lte)!.lastContactedAt!.lte!;
    expect(upper.toISOString()).toBe('2026-10-31T23:59:59.999Z');
  });

  it('pagination is applied together with the filters', async () => {
    const { repository, candidate } = setup();

    await repository.findPage('org1', query({ page: 3, pageSize: 50, grade: 'A' }));

    expect(candidate.findMany.mock.calls[0][0]).toMatchObject({ skip: 100, take: 50 });
  });

  it('no filter given -> no extra condition', async () => {
    const { repository, candidate } = setup();
    await repository.findPage('org1', query());
    expect(andOf(candidate.findMany.mock.calls[0][0])).toEqual([]);
  });
});

describe('selectionWhere', () => {
  it('IDS: exactly those people (and never a deleted one)', async () => {
    const { repository } = setup();
    expect(await repository.selectionWhere('org1', { mode: 'IDS', ids: ['a', 'b'] })).toEqual({ deletedAt: null, id: { in: ['a', 'b'] } });
  });

  it('FILTER: the same conditions as the list, minus the people taken out by hand', async () => {
    const { repository } = setup();

    const where = (await repository.selectionWhere('org1', { mode: 'FILTER', filters: query({ grade: 'A' }), excludeIds: ['x', 'y'] })) as { AND: unknown[] };

    expect(where.AND).toContainEqual({ grade: { in: ['A'] } });
    expect(where.AND).toContainEqual({ id: { notIn: ['x', 'y'] } });
  });

  it('FILTER with the website/manual choice keeps working inside a selection', async () => {
    const { repository } = setup(['w1']);
    const where = (await repository.selectionWhere('org1', { mode: 'FILTER', filters: query({ origin: 'MANUAL' }) })) as { AND: unknown[] };
    expect(where.AND).toContainEqual({ id: { notIn: ['w1'] } });
  });
});

describe('setConsent', () => {
  it('granting never overrides someone who opted out', async () => {
    const { repository, candidate } = setup();

    await expect(repository.setConsent('org1', { id: { in: ['a'] } }, { smsConsent: 'GRANTED' })).resolves.toBe(4);

    expect(candidate.updateMany.mock.calls[0][0].where).toEqual({ AND: [{ id: { in: ['a'] } }, { smsConsent: { not: 'OPTED_OUT' } }] });
    expect(candidate.updateMany.mock.calls[0][0].data).toMatchObject({ smsConsent: 'GRANTED', consentUpdatedAt: expect.any(Date) });
  });

  it('opting out applies to everyone selected', async () => {
    const { repository, candidate } = setup();
    await repository.setConsent('org1', { id: { in: ['a'] } }, { smsConsent: 'OPTED_OUT' });
    expect(candidate.updateMany.mock.calls[0][0].where).toEqual({ AND: [{ id: { in: ['a'] } }] });
  });

  it('a search word also finds the town, and a typed number finds the stored international form', async () => {
    const { repository, candidate } = setup();

    await repository.findPage('org1', query({ search: 'leeds 07700900123' }));

    const conditions = andOf(candidate.findMany.mock.calls[0][0]) as { OR: unknown[] }[];
    expect(conditions).toHaveLength(2); // one condition per word: every word must match
    expect(conditions[0]!.OR).toEqual(expect.arrayContaining([{ city: { contains: 'leeds', mode: 'insensitive' } }, { street: { contains: 'leeds', mode: 'insensitive' } }]));
    expect(conditions[1]!.OR).toEqual(expect.arrayContaining([{ normalizedPhone: { contains: '7700900123' } }]));
  });
});
