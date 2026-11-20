jest.mock('../../../infrastructure/database/database.service', () => ({ DatabaseService: class DatabaseService {} }));

import type { CacheService } from '../../../infrastructure/cache/cache.service';
import type { DatabaseService } from '../../../infrastructure/database/database.service';

import { CandidatesRepository } from './candidates.repository';

type Row = { id: string; firstName: string; lastName: string; email: string | null; phone: string | null; normalizedPhone: string | null };
const row = (extra: Partial<Row>): Row => ({ id: 'c1', firstName: '', lastName: '', email: null, phone: null, normalizedPhone: null, ...extra });

function repositoryWith(rows: Row[]) {
  const db = { forTenant: () => ({ candidate: { findMany: jest.fn().mockResolvedValue(rows) } }) } as unknown as DatabaseService;
  return new CandidatesRepository(db, {} as unknown as CacheService, {} as never);
}

describe('CandidatesRepository.findDuplicate', () => {
  it('finds the same phone number however it is written, also when no digits-only copy was saved', async () => {
    const saved = repositoryWith([row({ id: 'p', firstName: 'Ana', phone: '+355) 69 788 3395', normalizedPhone: null })]);
    expect(await saved.findDuplicate('org', { phone: '+355 697883395' })).toMatchObject({ id: 'p', why: 'phone' });
    const uk = repositoryWith([row({ id: 'u', phone: '(+44) 7700-900123', normalizedPhone: '447700900123' })]);
    expect(await uk.findDuplicate('org', { phone: '07700 900123' })).toMatchObject({ id: 'u', why: 'phone' });
  });

  it('does not treat the same name alone as a duplicate', async () => {
    const repository = repositoryWith([]);
    expect(await repository.findDuplicate('org', { firstName: 'Theodhos', lastName: 'Lupe' } as never)).toBeNull();
  });

  it('finds the same e-mail address, and lets a different person through', async () => {
    const repository = repositoryWith([row({ id: 'e', firstName: 'Eda', lastName: 'Berisha', email: 'Eda@Example.com' })]);
    expect(await repository.findDuplicate('org', { email: 'eda@example.com' })).toMatchObject({ id: 'e', why: 'email' });
    expect(await repository.findDuplicate('org', { phone: '07700 900999', email: 'besa@example.com' })).toBeNull();
  });
});
