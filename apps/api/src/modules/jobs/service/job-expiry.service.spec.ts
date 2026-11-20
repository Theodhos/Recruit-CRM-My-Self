jest.mock('../../../infrastructure/database/database.service', () => ({ DatabaseService: class DatabaseService {} }));

import type { DatabaseService } from '../../../infrastructure/database/database.service';
import type { SchedulerLockService } from '../../../infrastructure/scheduler/scheduler-lock.service';
import type { AuditLogsService } from '../../audit-logs/service/audit-logs.service';

import { JobExpiryService } from './job-expiry.service';

function setup(expired: unknown[]) {
  const job = { findMany: jest.fn().mockResolvedValue(expired), update: jest.fn().mockResolvedValue({}) };
  const db = { client: { job } } as unknown as DatabaseService;
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditLogsService & { record: jest.Mock };
  const lock = { runExclusive: jest.fn((_k: string, _ttl: number, fn: () => Promise<unknown>) => fn()) } as unknown as SchedulerLockService;
  return { service: new JobExpiryService(db, lock, audit), job, audit };
}

describe('JobExpiryService', () => {
  const now = new Date('2026-11-05T12:00:00Z');

  it('only looks at live vacancies whose expiry date has passed', async () => {
    const { service, job } = setup([]);

    await expect(service.closeExpired(now)).resolves.toBe(0);

    expect(job.findMany.mock.calls[0][0].where).toEqual({ deletedAt: null, expiresAt: { lte: now }, status: { in: ['OPEN', 'ON_HOLD', 'DRAFT'] } });
    expect(job.update).not.toHaveBeenCalled();
  });

  it('closes each expired vacancy, takes it off the website, stamps the closing date and writes an audit entry', async () => {
    const { service, job, audit } = setup([{ id: 'job1', organisationId: 'org1', status: 'OPEN', publishedOnWebsite: true }]);

    await expect(service.closeExpired(now)).resolves.toBe(1);

    expect(job.update).toHaveBeenCalledWith({
      where: { id: 'job1' },
      data: { status: 'CLOSED', closedAt: now, publishedOnWebsite: false, websitePublishedAt: null },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: 'org1',
        userId: null,
        action: 'EXPIRE_JOB',
        entityId: 'job1',
        oldValues: { status: 'OPEN', publishedOnWebsite: true },
        newValues: expect.objectContaining({ status: 'CLOSED', publishedOnWebsite: false }),
      }),
    );
  });

  it('runs under the scheduler lock so only one replica sweeps per tick', async () => {
    const { service } = setup([]);
    const lock = (service as unknown as { lock: { runExclusive: jest.Mock } }).lock;

    await service.tick();

    expect(lock.runExclusive).toHaveBeenCalledWith('job-expiry', expect.any(Number), expect.any(Function));
  });
});
