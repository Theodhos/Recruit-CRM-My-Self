import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { AppException } from '../../../common/exceptions/app.exception';
import { DatabaseService } from '../../../infrastructure/database/database.service';
import { SchedulerLockService } from '../../../infrastructure/scheduler/scheduler-lock.service';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import type { CandidateSelectionDto } from '../../candidates/dto';
import { checkContactPolicy, EXCLUSION_LABEL, toE164 } from '../../candidates/lib/contact-policy';
import { CandidatesRepository } from '../../candidates/repositories/candidates.repository';
import { inspectTemplate, MAX_SMS_LENGTH, renderTemplate } from '../lib/placeholders';

import { CommunicationsService, POLICY_SELECT } from './communications.service';
import { DialpadConnectionService } from './dialpad-connection.service';

/** One bulk send never goes to more people than this (Dialpad allows ~100 texts a minute; this is about 15 minutes). */
export const MAX_BULK_RECIPIENTS = 1500;
/** Gap between two texts: keeps us under Dialpad's 100-per-minute SMS limit. */
const SEND_GAP_MS = 700;
/** A row stuck "sending" this long may or may not have gone out — it is marked failed, never re-sent. */
const STUCK_AFTER_MS = 5 * 60_000;
const DUPLICATE_WINDOW_MS = 24 * 3600_000;

export type BulkExclusion = 'DO_NOT_CONTACT' | 'OPTED_OUT' | 'NO_CONSENT' | 'NO_PHONE' | 'NO_EMAIL' | 'DUPLICATE' | 'MISSING_PLACEHOLDER';

export interface BulkPreview {
  connected: boolean;
  fromNumber: string | null;
  matching: number;
  eligible: number;
  excluded: Partial<Record<BulkExclusion, number>>;
  excludedLabels: Record<string, string>;
  /** First eligible person, with the message exactly as they would get it. */
  sample: { name: string; text: string; length: number } | null;
  minutes: number;
  tooMany: boolean;
}

interface Prepared {
  matching: number;
  recipients: { id: string; number: string; text: string }[];
  excluded: Partial<Record<BulkExclusion, number>>;
  sample: BulkPreview['sample'];
}

@Injectable()
export class BulkSmsService {
  private readonly logger = new Logger(BulkSmsService.name);
  private readonly draining = new Set<string>();

  constructor(
    private readonly db: DatabaseService,
    private readonly candidates: CandidatesRepository,
    private readonly comms: CommunicationsService,
    private readonly dialpad: DialpadConnectionService,
    private readonly auditLogs: AuditLogsService,
    private readonly lock: SchedulerLockService,
  ) {}

  /** Resolves the selection on the server, applies the SMS consent rules and the duplicate guard, renders each message. */
  private async prepare(organisationId: string, recruiterName: string, selection: CandidateSelectionDto, template: string, jobId?: string | null): Promise<Prepared> {
    this.comms.assertTemplate(template);
    if (selection.mode === 'FILTER' && (selection.filters?.unassigned || selection.filters?.reviewStatus === 'SUGGESTED')) {
      throw new AppException('SELECTION_NOT_SUPPORTED', 'This view is ranked by the system and cannot be texted as a whole. Tick the people you want instead.', HttpStatus.BAD_REQUEST);
    }
    const where = await this.candidates.selectionWhere(organisationId, selection);
    const rows = await this.db.forTenant(organisationId).candidate.findMany({
      where,
      select: POLICY_SELECT,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
      take: MAX_BULK_RECIPIENTS * 4 + 1,
    });
    if (rows.length > MAX_BULK_RECIPIENTS * 4) {
      throw new AppException('TOO_MANY_ROWS', 'Too many people match. Narrow the filters first.', HttpStatus.BAD_REQUEST);
    }

    const excluded: Partial<Record<BulkExclusion, number>> = {};
    const bump = (reason: BulkExclusion) => {
      excluded[reason] = (excluded[reason] ?? 0) + 1;
    };

    const allowed = rows.filter((row) => {
      const reason = checkContactPolicy(row as never, 'SMS');
      if (reason) bump(reason);
      return !reason;
    });

    // job title per person only when the message uses it
    const needsJob = inspectTemplate(template).used.includes('jobTitle');
    let fixedJob: string | null | undefined;
    if (needsJob && jobId) fixedJob = await this.comms.jobTitleFor(organisationId, '', jobId);
    let titles = new Map<string, string | null>();
    if (needsJob && !jobId) {
      const apps = await this.db.forTenant(organisationId).application.findMany({
        where: { candidateId: { in: allowed.map((a) => a.id) }, jobId: { not: null } },
        orderBy: { createdAt: 'desc' },
        select: { candidateId: true, job: { select: { title: true } } },
      });
      titles = new Map();
      for (const app of apps) if (!titles.has(app.candidateId)) titles.set(app.candidateId, app.job?.title ?? null);
    }

    const rendered: Prepared['recipients'] = [];
    for (const row of allowed) {
      const out = renderTemplate(template, {
        firstName: row.firstName,
        lastName: row.lastName,
        fullName: `${row.firstName} ${row.lastName}`.trim(),
        jobTitle: needsJob ? (jobId ? fixedJob : titles.get(row.id)) : null,
        recruiterName,
      });
      if ('missing' in out) {
        bump('MISSING_PLACEHOLDER');
        continue;
      }
      if (out.text.length > MAX_SMS_LENGTH) {
        throw new AppException('MESSAGE_TOO_LONG', `The message is ${out.text.length} characters for ${row.firstName} ${row.lastName}; the limit is ${MAX_SMS_LENGTH}.`, HttpStatus.BAD_REQUEST);
      }
      rendered.push({ id: row.id, number: toE164(row.phone)!, text: out.text });
    }

    // the same words already went to the same person in the last 24 hours (a repeated click, a repeated campaign)
    const recent = rendered.length
      ? await this.db.client.communication.findMany({
          where: {
            organisationId,
            type: 'SMS',
            direction: 'OUTBOUND',
            status: { notIn: ['FAILED'] },
            createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
            candidateId: { in: rendered.map((r) => r.id) },
            body: { in: [...new Set(rendered.map((r) => r.text))] },
          },
          select: { candidateId: true, body: true },
        })
      : [];
    const seen = new Set(recent.map((r) => `${r.candidateId}|${r.body}`));
    const recipients = rendered.filter((r) => {
      const dup = seen.has(`${r.id}|${r.text}`);
      if (dup) bump('DUPLICATE');
      return !dup;
    });

    const first = recipients[0];
    const firstRow = first ? allowed.find((a) => a.id === first.id) : undefined;
    return {
      matching: rows.length,
      recipients,
      excluded,
      sample: first && firstRow ? { name: `${firstRow.firstName} ${firstRow.lastName}`.trim(), text: first.text, length: first.text.length } : null,
    };
  }

  async preview(organisationId: string, recruiterName: string, selection: CandidateSelectionDto, template: string, jobId?: string | null): Promise<BulkPreview> {
    const status = await this.dialpad.status(organisationId);
    const prepared = await this.prepare(organisationId, recruiterName, selection, template, jobId);
    return {
      connected: status.connected && Boolean(status.fromNumber),
      fromNumber: status.fromNumber,
      matching: prepared.matching,
      eligible: prepared.recipients.length,
      excluded: prepared.excluded,
      excludedLabels: { ...EXCLUSION_LABEL, DUPLICATE: 'Already received this exact message in the last 24 hours', MISSING_PLACEHOLDER: 'The message needs a value (such as a job title) this person does not have' },
      sample: prepared.sample,
      minutes: Math.max(1, Math.ceil((prepared.recipients.length * SEND_GAP_MS) / 60_000)),
      tooMany: prepared.recipients.length > MAX_BULK_RECIPIENTS,
    };
  }

  /**
   * Queues the texts and starts sending. The browser's idempotency key makes a double click (or a retried request)
   * return the batch that already exists instead of texting everyone twice.
   */
  async send(organisationId: string, userId: string, recruiterName: string, input: { selection: CandidateSelectionDto; template: string; jobId?: string | null; idempotencyKey: string }) {
    const existing = await this.db.client.communicationBatch.findUnique({ where: { organisationId_idempotencyKey: { organisationId, idempotencyKey: input.idempotencyKey } } });
    if (existing) return { ...(await this.batchStatus(organisationId, existing.id)), alreadySubmitted: true };

    const { fromNumber } = await this.dialpad.clientFor(organisationId);
    const prepared = await this.prepare(organisationId, recruiterName, input.selection, input.template, input.jobId);
    if (prepared.recipients.length === 0) {
      throw new AppException('NOBODY_TO_TEXT', 'Nobody in this selection can be texted: see the exclusions in the preview.', HttpStatus.UNPROCESSABLE_ENTITY, { excluded: prepared.excluded });
    }
    if (prepared.recipients.length > MAX_BULK_RECIPIENTS) {
      throw new AppException('TOO_MANY_RECIPIENTS', `One bulk message can go to at most ${MAX_BULK_RECIPIENTS} people; this one has ${prepared.recipients.length}. Narrow the selection.`, HttpStatus.BAD_REQUEST);
    }

    let batchId: string;
    try {
      const batch = await this.db.client.communicationBatch.create({
        data: { organisationId, userId, idempotencyKey: input.idempotencyKey, template: input.template, matching: prepared.matching, eligible: prepared.recipients.length, excluded: prepared.excluded as never },
      });
      batchId = batch.id;
    } catch {
      // a parallel request with the same key won the race
      const winner = await this.db.client.communicationBatch.findUniqueOrThrow({ where: { organisationId_idempotencyKey: { organisationId, idempotencyKey: input.idempotencyKey } } });
      return { ...(await this.batchStatus(organisationId, winner.id)), alreadySubmitted: true };
    }
    await this.db.client.communication.createMany({
      data: prepared.recipients.map((r) => ({ organisationId, candidateId: r.id, userId, batchId, type: 'SMS' as const, direction: 'OUTBOUND' as const, status: 'QUEUED' as const, body: r.text, externalNumber: r.number, fromNumber })),
    });
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'BULK_SMS',
      entityType: 'CommunicationBatch',
      entityId: batchId,
      newValues: { matching: prepared.matching, eligible: prepared.recipients.length, excluded: prepared.excluded, selection: input.selection.mode, templateLength: input.template.length },
    });

    void this.drain(batchId);
    return { ...(await this.batchStatus(organisationId, batchId)), alreadySubmitted: false };
  }

  async batchStatus(organisationId: string, batchId: string) {
    const batch = await this.db.client.communicationBatch.findFirst({ where: { id: batchId, organisationId } });
    if (!batch) throw new AppException('NOT_FOUND', 'Batch not found.', HttpStatus.NOT_FOUND);
    const grouped = await this.db.client.communication.groupBy({ by: ['status'], where: { batchId }, _count: { _all: true } });
    const count = (...statuses: string[]) => grouped.filter((g) => statuses.includes(g.status)).reduce((n, g) => n + g._count._all, 0);
    const failures = await this.db.client.communication.findMany({
      where: { batchId, status: 'FAILED' },
      take: 20,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, errorMessage: true, candidate: { select: { id: true, firstName: true, lastName: true } } },
    });
    return {
      id: batch.id,
      status: batch.status,
      matching: batch.matching,
      eligible: batch.eligible,
      excluded: (batch.excluded ?? {}) as Record<string, number>,
      queued: count('QUEUED', 'SENDING'),
      sent: count('SENT', 'DELIVERED'),
      delivered: count('DELIVERED'),
      failed: count('FAILED', 'UNDELIVERED'),
      failures: failures.map((f) => ({ id: f.id, candidateId: f.candidate?.id ?? null, name: f.candidate ? `${f.candidate.firstName} ${f.candidate.lastName}` : null, error: f.errorMessage })),
      createdAt: batch.createdAt,
      finishedAt: batch.finishedAt,
    };
  }

  /** Sends a batch one text at a time, politely: paced under the limit, waiting out a 429, never re-sending an ambiguous failure. */
  async drain(batchId: string): Promise<void> {
    if (this.draining.has(batchId)) return;
    this.draining.add(batchId);
    try {
      let rateLimitedInARow = 0;
      for (;;) {
        const next = await this.db.client.communication.findFirst({ where: { batchId, status: 'QUEUED' }, orderBy: { createdAt: 'asc' }, select: { id: true } });
        if (!next) break;
        const result = await this.comms.deliver(next.id);
        if (result.retryAfterMs) {
          rateLimitedInARow += 1;
          if (rateLimitedInARow > 6) {
            await this.db.client.communication.updateMany({ where: { batchId, status: 'QUEUED' }, data: { status: 'FAILED', errorMessage: 'Dialpad kept refusing because of its sending limit. Try the remaining people again later.' } });
            break;
          }
          await sleep(Math.min(result.retryAfterMs, 60_000));
          continue;
        }
        rateLimitedInARow = 0;
        if (result.fatal) {
          // credentials / connection are broken: do not burn through the whole list with the same error
          await this.db.client.communication.updateMany({ where: { batchId, status: 'QUEUED' }, data: { status: 'FAILED', errorMessage: result.errorMessage ?? 'Dialpad is not available.' } });
          break;
        }
        await sleep(SEND_GAP_MS);
      }
      await this.finish(batchId);
    } catch (error) {
      this.logger.error(`Bulk SMS ${batchId} stopped: ${(error as Error).message}`);
    } finally {
      this.draining.delete(batchId);
    }
  }

  private async finish(batchId: string) {
    const open = await this.db.client.communication.count({ where: { batchId, status: { in: ['QUEUED', 'SENDING'] } } });
    if (open > 0) return;
    const failed = await this.db.client.communication.count({ where: { batchId, status: { in: ['FAILED', 'UNDELIVERED'] } } });
    await this.db.client.communicationBatch.updateMany({ where: { id: batchId, finishedAt: null }, data: { status: failed ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED', finishedAt: new Date() } });
  }

  /** Picks up batches whose process died, and settles rows that were left "sending". */
  @Cron(CronExpression.EVERY_MINUTE)
  async sweep(): Promise<void> {
    await this.lock.runExclusive('bulk-sms-sweep', 50_000, async () => {
      await this.db.client.communication.updateMany({
        where: { status: 'SENDING', updatedAt: { lt: new Date(Date.now() - STUCK_AFTER_MS) } },
        data: { status: 'FAILED', errorMessage: 'The server stopped while sending this one. It may or may not have gone out — check Dialpad before sending it again.' },
      });
      const running = await this.db.client.communicationBatch.findMany({ where: { status: 'RUNNING' }, select: { id: true }, take: 20 });
      for (const batch of running) {
        const queued = await this.db.client.communication.count({ where: { batchId: batch.id, status: 'QUEUED' } });
        if (queued > 0) void this.drain(batch.id);
        else await this.finish(batch.id);
      }
    });
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
