jest.mock('../../../infrastructure/database/database.service', () => ({ DatabaseService: class DatabaseService {} }));

import type { CacheService } from '../../../infrastructure/cache/cache.service';
import type { DatabaseService } from '../../../infrastructure/database/database.service';

import { CandidatesRepository } from './candidates.repository';

function setup(websiteIds: string[], rows: { id: string }[]) {
  const candidate = { findMany: jest.fn().mockResolvedValue(rows), count: jest.fn().mockResolvedValue(rows.length) };
  const auditLog = {
    findMany: jest.fn().mockImplementation(({ where }: { where: { entityId?: { in: string[] } } }) => {
      const wanted = where.entityId?.in;
      return Promise.resolve(websiteIds.filter((id) => !wanted || wanted.includes(id)).map((entityId) => ({ entityId })));
    }),
  };
  const db = { forTenant: jest.fn(() => ({ candidate, auditLog })) } as unknown as DatabaseService;
  const cache = { cachedCount: jest.fn((_o: string, _k: string, _w: unknown, load: () => Promise<number>) => load()) } as unknown as CacheService;
  return { repository: new CandidatesRepository(db, cache, {} as never), candidate, auditLog };
}

const query = (extra: object = {}) => ({ page: 1, pageSize: 25, ...extra }) as never;

describe('CandidatesRepository — website or manual', () => {
  it('marks every row with how it got into the CRM, using the website-intake audit entries', async () => {
    const { repository, auditLog } = setup(['web1', 'web2'], [{ id: 'web1' }, { id: 'hand1' }]);

    const items = await repository.findPage('org1', query());

    expect(items.map((i) => [i.id, i.addedVia])).toEqual([['web1', 'WEBSITE'], ['hand1', 'MANUAL']]);
    expect(auditLog.findMany.mock.calls[0][0].where).toMatchObject({ action: 'WEBSITE_APPLICATION', entityType: 'Candidate', entityId: { in: ['web1', 'hand1'] } });
  });

  it('origin=WEBSITE keeps only the people who applied through the website form', async () => {
    const { repository, candidate } = setup(['web1', 'web2'], [{ id: 'web1' }]);

    await repository.findMany('org1', query({ origin: 'WEBSITE' }));

    expect(candidate.findMany.mock.calls[0][0].where.AND).toContainEqual({ id: { in: ['web1', 'web2'] } });
    expect(candidate.count.mock.calls[0][0].where.AND).toContainEqual({ id: { in: ['web1', 'web2'] } });
  });

  it('origin=MANUAL leaves out the website applicants, and keeps the other filters', async () => {
    const { repository, candidate } = setup(['web1'], [{ id: 'hand1' }]);

    await repository.findMany('org1', query({ origin: 'MANUAL', jobTitle: 'Electrician' }));

    const where = candidate.findMany.mock.calls[0][0].where;
    expect(where.AND).toContainEqual({ id: { notIn: ['web1'] } });
    expect(JSON.stringify(where.AND)).toContain('Electrician');
  });

  it('without an origin choice nothing about origin is added to the filter', async () => {
    const { repository, candidate } = setup(['web1'], [{ id: 'a' }]);

    await repository.findMany('org1', query());

    expect(JSON.stringify(candidate.findMany.mock.calls[0][0].where)).not.toContain('"id":{');
  });
});
