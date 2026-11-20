import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { DatabaseService } from '../../../infrastructure/database/database.service';
import { SchedulerLockService } from '../../../infrastructure/scheduler/scheduler-lock.service';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';

/**
 * Vacancies with an expiry date close themselves. The public website already stops showing a job the moment its
 * expiry passes (it checks the date on every request); this sweep makes the CRM agree — status Closed, off the
 * website, the closing date recorded — so nobody keeps working a vacancy the website no longer shows.
 * It spans organisations on purpose (like the calendar reminders), so it uses the raw client.
 */
@Injectable()
export class JobExpiryService {
  private readonly logger = new Logger(JobExpiryService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly lock: SchedulerLockService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async tick(): Promise<void> {
    await this.lock.runExclusive('job-expiry', 9 * 60_000, () => this.closeExpired().then(() => undefined));
  }

  /** Returns how many vacancies were closed. */
  async closeExpired(now = new Date()): Promise<number> {
    const expired = await this.db.client.job.findMany({
      where: { deletedAt: null, expiresAt: { lte: now }, status: { in: ['OPEN', 'ON_HOLD', 'DRAFT'] } },
      select: { id: true, organisationId: true, status: true, publishedOnWebsite: true },
      take: 500,
    });
    for (const job of expired) {
      await this.db.client.job.update({
        where: { id: job.id },
        data: { status: 'CLOSED', closedAt: now, publishedOnWebsite: false, websitePublishedAt: null },
      });
      await this.auditLogs.record({
        organisationId: job.organisationId,
        userId: null,
        action: 'EXPIRE_JOB',
        entityType: 'Job',
        entityId: job.id,
        oldValues: { status: job.status, publishedOnWebsite: job.publishedOnWebsite },
        newValues: { status: 'CLOSED', publishedOnWebsite: false, reason: 'Expiry date reached' },
      });
    }
    if (expired.length) this.logger.log(`Closed ${expired.length} expired vacancy(ies)`);
    return expired.length;
  }
}
