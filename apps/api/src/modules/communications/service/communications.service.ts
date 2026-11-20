import { HttpStatus, Injectable, Logger } from '@nestjs/common';

import { AppException } from '../../../common/exceptions/app.exception';
import { normalizeCandidatePhone } from '../../../common/utils/phone';
import { DatabaseService } from '../../../infrastructure/database/database.service';
import { checkContactPolicy, EXCLUSION_LABEL, toE164, type ContactPurpose } from '../../candidates/lib/contact-policy';
import { DialpadError } from '../dialpad/dialpad.client';
import { inspectTemplate, MAX_SMS_LENGTH, renderTemplate } from '../lib/placeholders';

import { DialpadConnectionService } from './dialpad-connection.service';

export const POLICY_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  status: true,
  phone: true,
  email: true,
  smsConsent: true,
  emailConsent: true,
  callConsent: true,
} as const;

/** Duplicate guard for a single text: the same words to the same person within this window are refused. */
const DOUBLE_CLICK_WINDOW_MS = 60_000;

@Injectable()
export class CommunicationsService {
  private readonly logger = new Logger(CommunicationsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly dialpad: DialpadConnectionService,
  ) {}

  // --------------------------------------------------------------------------------------------- shared helpers

  /** The job title for {{jobTitle}}: the chosen vacancy, else the vacancy the candidate most recently applied to. */
  async jobTitleFor(organisationId: string, candidateId: string, jobId?: string | null): Promise<string | null> {
    if (jobId) {
      const job = await this.db.forTenant(organisationId).job.findFirst({ where: { id: jobId, deletedAt: null }, select: { title: true } });
      return job?.title ?? null;
    }
    const application = await this.db.forTenant(organisationId).application.findFirst({
      where: { candidateId, jobId: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { job: { select: { title: true } } },
    });
    return application?.job?.title ?? null;
  }

  /** Matches a phone number to a candidate of the organisation (digits-only form, same as de-duplication). */
  async findCandidateByNumber(organisationId: string, e164: string): Promise<string | null> {
    const normalized = normalizeCandidatePhone(e164);
    if (!normalized) return null;
    const found = await this.db.client.candidate.findFirst({
      where: { organisationId, deletedAt: null, normalizedPhone: normalized },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    return found?.id ?? null;
  }

  async findCrmUserByEmail(organisationId: string, email: string | undefined | null): Promise<string | null> {
    if (!email) return null;
    const user = await this.db.client.user.findFirst({ where: { organisationId, email: { equals: email, mode: 'insensitive' } }, select: { id: true } });
    return user?.id ?? null;
  }

  private async loadCandidate(organisationId: string, candidateId: string) {
    const candidate = await this.db.forTenant(organisationId).candidate.findFirst({ where: { id: candidateId, deletedAt: null }, select: POLICY_SELECT });
    if (!candidate) throw new AppException('CANDIDATE_NOT_FOUND', 'Candidate not found.', HttpStatus.NOT_FOUND);
    return candidate;
  }

  private assertAllowed(candidate: Awaited<ReturnType<CommunicationsService['loadCandidate']>>, purpose: ContactPurpose) {
    const reason = checkContactPolicy(candidate as never, purpose);
    if (reason) {
      throw new AppException('CONTACT_NOT_ALLOWED', `${candidate.firstName} ${candidate.lastName} cannot be ${purpose === 'CALL' ? 'called' : 'texted'}: ${EXCLUSION_LABEL[reason]}.`, HttpStatus.UNPROCESSABLE_ENTITY, { reason });
    }
  }

  // ------------------------------------------------------------------------------------------------------ calls

  async callCandidate(organisationId: string, userId: string, email: string, candidateId: string) {
    const candidate = await this.loadCandidate(organisationId, candidateId);
    this.assertAllowed(candidate, 'CALL');
    const number = toE164(candidate.phone)!;
    const { client, fromNumber } = await this.dialpad.clientFor(organisationId);

    const row = await this.db.client.communication.create({
      data: { organisationId, candidateId, userId, type: 'CALL', direction: 'OUTBOUND', status: 'QUEUED', externalNumber: number, fromNumber },
    });
    try {
      const dialpadUser = await this.dialpad.dialpadUserId(organisationId, client, email);
      await client.initiateCall(dialpadUser, { phoneNumber: number, outboundCallerId: fromNumber, customData: row.id });
      return this.db.client.communication.update({ where: { id: row.id }, data: { status: 'SENT', providerStatus: 'sent_to_dialpad_app' } });
    } catch (error) {
      const message = error instanceof AppException ? error.message : this.callFailureMessage(error);
      await this.db.client.communication.update({ where: { id: row.id }, data: { status: 'FAILED', errorMessage: message.slice(0, 500) } });
      throw error instanceof AppException ? error : this.dialpad.asException(error, message);
    }
  }

  private callFailureMessage(error: unknown): string {
    if (error instanceof DialpadError) {
      if (error.isRateLimit) return 'Dialpad allows only a few calls per minute from one user. Wait a moment and try again.';
      if (error.status === 400 || error.status === 404 || error.status === 409) return `Dialpad could not start the call. Open the Dialpad app (web or desktop) and sign in, then try again. (${error.message})`;
      return error.message;
    }
    return 'The call could not be started.';
  }

  // -------------------------------------------------------------------------------------------------------- SMS

  /** One text to one candidate, sent now. The message may use placeholders ({{firstName}}, {{jobTitle}}…). */
  async sendSms(organisationId: string, userId: string, recruiterName: string, candidateId: string, template: string, jobId?: string | null) {
    this.assertTemplate(template);
    const candidate = await this.loadCandidate(organisationId, candidateId);
    this.assertAllowed(candidate, 'SMS');
    const jobTitle = inspectTemplate(template).used.includes('jobTitle') ? await this.jobTitleFor(organisationId, candidateId, jobId) : null;
    const rendered = renderTemplate(template, { firstName: candidate.firstName, lastName: candidate.lastName, fullName: `${candidate.firstName} ${candidate.lastName}`.trim(), jobTitle, recruiterName });
    if ('missing' in rendered) {
      throw new AppException('MISSING_PLACEHOLDER', `This message needs ${rendered.missing.join(', ')} but there is no value for ${candidate.firstName}. Pick a vacancy or edit the message.`, HttpStatus.UNPROCESSABLE_ENTITY);
    }
    if (rendered.text.length > MAX_SMS_LENGTH) {
      throw new AppException('MESSAGE_TOO_LONG', `The message is ${rendered.text.length} characters; the limit is ${MAX_SMS_LENGTH}.`, HttpStatus.BAD_REQUEST);
    }

    const recent = await this.db.client.communication.findFirst({
      where: { organisationId, candidateId, type: 'SMS', direction: 'OUTBOUND', body: rendered.text, status: { notIn: ['FAILED'] }, createdAt: { gte: new Date(Date.now() - DOUBLE_CLICK_WINDOW_MS) } },
      select: { id: true },
    });
    if (recent) throw new AppException('DUPLICATE_MESSAGE', 'This exact message was just sent to this person. Wait a minute before sending it again.', HttpStatus.CONFLICT);

    const { fromNumber } = await this.dialpad.clientFor(organisationId);
    const row = await this.db.client.communication.create({
      data: { organisationId, candidateId, userId, type: 'SMS', direction: 'OUTBOUND', status: 'QUEUED', body: rendered.text, externalNumber: toE164(candidate.phone)!, fromNumber },
    });
    const sent = await this.deliver(row.id);
    if (sent.status === 'FAILED') {
      throw new AppException('SMS_FAILED', sent.errorMessage ?? 'The message was not sent.', HttpStatus.BAD_GATEWAY, { communicationId: sent.id });
    }
    return sent;
  }

  async recruiterName(organisationId: string, userId: string): Promise<string> {
    const user = await this.db.client.user.findFirst({ where: { id: userId, organisationId }, select: { firstName: true, lastName: true } });
    return user ? `${user.firstName} ${user.lastName}`.trim() : '';
  }

  assertTemplate(template: string) {
    if (!template.trim()) throw new AppException('EMPTY_MESSAGE', 'Write a message first.', HttpStatus.BAD_REQUEST);
    const { unknown } = inspectTemplate(template);
    if (unknown.length) {
      throw new AppException('UNKNOWN_PLACEHOLDER', `Unknown placeholder: ${unknown.map((u) => `{{${u}}}`).join(', ')}. Use firstName, lastName, fullName, jobTitle or recruiterName.`, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Sends one stored text through Dialpad and records the outcome on the row. Claims the row first (QUEUED →
   * SENDING), so two workers can never send the same text. Never throws for a Dialpad failure: the row says what happened
   * (`retryAfterMs` is set when the caller should wait and call again for a rate limit).
   */
  async deliver(communicationId: string): Promise<{ id: string; status: string; errorMessage: string | null; retryAfterMs?: number; fatal?: boolean }> {
    const claimed = await this.db.client.communication.updateMany({ where: { id: communicationId, status: 'QUEUED' }, data: { status: 'SENDING' } });
    const row = await this.db.client.communication.findUniqueOrThrow({ where: { id: communicationId } });
    if (claimed.count === 0) return { id: row.id, status: row.status, errorMessage: row.errorMessage };

    try {
      const { client, fromNumber } = await this.dialpad.clientFor(row.organisationId);
      const sms = await client.sendSms({ to: row.externalNumber, text: row.body ?? '', fromNumber });
      const failed = sms.message_status === 'failed';
      const updated = await this.db.client.communication.update({
        where: { id: row.id },
        data: {
          status: failed ? 'FAILED' : 'SENT',
          providerId: String(sms.id),
          providerStatus: [sms.message_status, sms.message_delivery_result].filter(Boolean).join(':') || null,
          errorMessage: failed ? `Dialpad could not send it (${sms.message_delivery_result ?? 'unknown reason'}).` : null,
          lastEventAt: new Date(),
        },
      });
      if (!failed) await this.db.client.candidate.updateMany({ where: { id: row.candidateId ?? '', organisationId: row.organisationId }, data: { lastContactedAt: new Date() } });
      return { id: updated.id, status: updated.status, errorMessage: updated.errorMessage };
    } catch (error) {
      if (error instanceof DialpadError && error.isRateLimit) {
        await this.db.client.communication.update({ where: { id: row.id }, data: { status: 'QUEUED' } });
        return { id: row.id, status: 'QUEUED', errorMessage: null, retryAfterMs: error.retryAfterMs ?? 15_000 };
      }
      const transient = error instanceof DialpadError && error.isTransient;
      const message = error instanceof AppException ? error.message : error instanceof DialpadError ? (error.isAuth ? 'Dialpad rejected the credentials — reconnect Dialpad in Settings.' : error.message) : 'The message was not sent.';
      // a network error is ambiguous (Dialpad may have accepted it) — never auto-retry those, a person decides
      await this.db.client.communication.update({ where: { id: row.id }, data: { status: 'FAILED', errorMessage: (transient ? `${message} (not retried automatically — check Dialpad before sending again)` : message).slice(0, 500) } });
      this.logger.warn(`SMS ${row.id} failed: ${message}`);
      return { id: row.id, status: 'FAILED', errorMessage: message, fatal: error instanceof AppException || (error instanceof DialpadError && error.isAuth) };
    }
  }

  // --------------------------------------------------------------------------------------------------- history

  private readonly historySelect = {
    id: true,
    type: true,
    direction: true,
    status: true,
    body: true,
    externalNumber: true,
    fromNumber: true,
    providerStatus: true,
    errorMessage: true,
    durationSeconds: true,
    batchId: true,
    createdAt: true,
    user: { select: { id: true, firstName: true, lastName: true } },
  } as const;

  async history(organisationId: string, candidateId: string, take = 100) {
    await this.loadCandidate(organisationId, candidateId);
    return this.db.forTenant(organisationId).communication.findMany({ where: { candidateId }, orderBy: { createdAt: 'desc' }, take: Math.min(take, 200), select: this.historySelect });
  }

  /** Calls and texts from numbers that match no candidate — kept apart so nothing is attached to the wrong person. */
  async unmatched(organisationId: string, take = 100) {
    return this.db.forTenant(organisationId).communication.findMany({ where: { candidateId: null }, orderBy: { createdAt: 'desc' }, take: Math.min(take, 200), select: this.historySelect });
  }

  /** Attaches an unmatched number's traffic to a candidate chosen by a person. */
  async assignUnmatched(organisationId: string, communicationId: string, candidateId: string) {
    await this.loadCandidate(organisationId, candidateId);
    const row = await this.db.forTenant(organisationId).communication.findFirst({ where: { id: communicationId, candidateId: null }, select: { externalNumber: true } });
    if (!row) throw new AppException('NOT_FOUND', 'That communication is not in the unmatched list.', HttpStatus.NOT_FOUND);
    const result = await this.db.client.communication.updateMany({ where: { organisationId, candidateId: null, externalNumber: row.externalNumber }, data: { candidateId } });
    return { assigned: result.count };
  }
}
