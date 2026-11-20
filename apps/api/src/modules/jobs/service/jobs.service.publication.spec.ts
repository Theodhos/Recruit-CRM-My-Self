import { AppException } from '../../../common/exceptions/app.exception';
import type { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import type { CompaniesService } from '../../companies/service/companies.service';
import type { JobsRepository } from '../repositories/jobs.repository';

import { JobsService } from './jobs.service';

type Existing = Partial<{ title: string; description: string | null; status: string; publishedOnWebsite: boolean; expiresAt: Date | null }>;

function setup(existing: Existing = {}) {
  const job = { id: 'job1', title: 'Electrician', description: 'Do the wiring', status: 'DRAFT', publishedOnWebsite: false, expiresAt: null, ...existing };
  const repository = {
    findById: jest.fn().mockResolvedValue(job),
    update: jest.fn().mockImplementation((_org: string, _id: string, change: object) => Promise.resolve({ ...job, ...change })),
  } as unknown as JobsRepository & { update: jest.Mock; findById: jest.Mock };
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditLogsService & { record: jest.Mock };
  const service = new JobsService(repository, {} as CompaniesService, audit, {} as never, {} as never);
  return { service, repository, audit };
}

describe('JobsService.setPublication', () => {
  it('PUBLISH makes the job Published (OPEN) and switches it on for the website', async () => {
    const { service, repository, audit } = setup();

    await service.setPublication('org1', 'user1', 'job1', 'PUBLISH');

    expect(repository.update).toHaveBeenCalledWith('org1', 'job1', { status: 'OPEN', publishedOnWebsite: true });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PUBLISH_JOB', userId: 'user1', oldValues: { status: 'DRAFT', publishedOnWebsite: false }, newValues: { status: 'OPEN', publishedOnWebsite: true } }),
    );
  });

  it('UNPUBLISH only takes it off the website — the vacancy stays open in the CRM', async () => {
    const { service, repository } = setup({ status: 'OPEN', publishedOnWebsite: true });

    await service.setPublication('org1', 'user1', 'job1', 'UNPUBLISH');

    expect(repository.update).toHaveBeenCalledWith('org1', 'job1', { publishedOnWebsite: false });
  });

  it('CLOSE and ARCHIVE set the status and always take the job off the website', async () => {
    const closed = setup({ status: 'OPEN', publishedOnWebsite: true });
    await closed.service.setPublication('org1', 'user1', 'job1', 'CLOSE');
    expect(closed.repository.update).toHaveBeenCalledWith('org1', 'job1', { status: 'CLOSED', publishedOnWebsite: false });

    const archived = setup({ status: 'CLOSED' });
    await archived.service.setPublication('org1', 'user1', 'job1', 'ARCHIVE');
    expect(archived.repository.update).toHaveBeenCalledWith('org1', 'job1', { status: 'ARCHIVED', publishedOnWebsite: false });
  });

  it.each([
    ['has no description', { description: '   ' }],
    ['is still called "Untitled job"', { title: 'Untitled job' }],
    ['has an expiry date in the past', { expiresAt: new Date('2020-01-01') }],
  ])('refuses to publish a job that %s (422) and changes nothing', async (_label, existing) => {
    const { service, repository, audit } = setup(existing);

    await expect(service.setPublication('org1', 'user1', 'job1', 'PUBLISH')).rejects.toBeInstanceOf(AppException);

    expect(repository.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('an expiry date in the future does not stop publishing', async () => {
    const { service, repository } = setup({ expiresAt: new Date(Date.now() + 86_400_000) });

    await service.setPublication('org1', 'user1', 'job1', 'PUBLISH');

    expect(repository.update).toHaveBeenCalled();
  });
});
