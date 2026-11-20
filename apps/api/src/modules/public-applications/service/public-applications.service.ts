import { randomUUID } from 'node:crypto';

import type { StorageProvider } from '@crm/storage';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { normalizeCandidatePhone } from '../../../common/utils/phone';
import { DatabaseService } from '../../../infrastructure/database/database.service';
import { EmailService } from '../../../infrastructure/email/email.service';
import { STORAGE_PROVIDER } from '../../../infrastructure/storage/storage.constants';
import { CandidateIntakeService } from '../../applications/service/candidate-intake.service';
import { JobsService } from '../../jobs/service/jobs.service';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import type { WebsiteApplicationDto } from '../dto/website-application.dto';

/**
 * Applications that arrive from an agency's public website. They land in **Candidates** automatically — ranked by
 * the same potential score as everyone else — and, when the applicant picked a job, go straight onto that job's
 * pipeline with a notification to the team (CandidateIntakeService).
 *
 * This is a PUBLIC, unauthenticated write, so it is deliberately narrow:
 *  - the organisation comes from a slug looked up server-side; every query then goes through the tenant-scoped client;
 *  - nothing is created from untrusted text beyond the candidate itself (no auto-created companies, no free-form notes);
 *  - a chosen job must be OPEN and belong to that organisation;
 *  - an e-mail already on file is never duplicated (the visitor is told the same thing either way, so the form cannot
 *    be used to discover who is in the database);
 *  - a filled honeypot field is treated as a bot and silently accepted without creating anything;
 *  - the controller rate-limits per client IP.
 */
export type CvUpload = { buffer: Buffer; originalname: string; mimetype: string; size: number };

/**
 * A job is on the careers website as soon as it is on the CRM's Jobs pages (Jobs, Permanent, Temporary): nothing has to be
 * switched on. Only a job that was ended on purpose (Closed, Archived) or is past its expiry date is left out; a job that
 * is full is left out too (it is on Completed Jobs in the CRM — see listOpenJobs).
 */
const WEBSITE_VISIBLE = () => ({
  status: { notIn: ['CLOSED', 'ARCHIVED'] as ('CLOSED' | 'ARCHIVED')[] },
  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
});

@Injectable()
export class PublicApplicationsService {
  private readonly logger = new Logger(PublicApplicationsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly auditLogs: AuditLogsService,
    private readonly intake: CandidateIntakeService,
    private readonly email: EmailService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly jobsService: JobsService,
  ) {}

  /** Open jobs of one organisation, limited to what a candidate may see (no owner, fees, CV counts, notes). */
  async listOpenJobs(slug: string) {
    if (!/^[a-z0-9][a-z0-9-]{1,58}$/.test(slug ?? '')) throw new BadRequestException('organisation must be a valid slug');
    const organisation = await this.db.client.organisation.findUnique({
      where: { slug },
      select: { id: true, name: true, status: true },
    });
    if (!organisation || organisation.status === 'SUSPENDED') throw new NotFoundException('Organisation not found');

    // the jobs whose every place is filled are on Completed Jobs in the CRM, not on the Jobs pages: not here either
    const full = await this.jobsService.fullJobIds(organisation.id);
    const jobs = await this.db.forTenant(organisation.id).job.findMany({
      where: { deletedAt: null, ...(full.length > 0 ? { id: { notIn: full } } : {}), ...WEBSITE_VISIBLE() },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        title: true,
        description: true,
        responsibilities: true,
        requirements: true,
        skills: true,
        qualifications: true,
        applicationInstructions: true,
        location: true,
        employmentType: true,
        experienceYearsMin: true,
        experienceYearsMax: true,
        salaryMin: true,
        salaryMax: true,
        currency: true,
        showSalary: true,
        compensationPackage: true,
        // where the job is on the map: the careers page filters by distance from the place a visitor types
        latitude: true,
        longitude: true,
        expiresAt: true,
        websitePublishedAt: true,
        createdAt: true,
      },
    });
    return {
      organisation: organisation.name,
      jobs: jobs.map(({ showSalary, ...job }) => (showSalary ? job : { ...job, salaryMin: null, salaryMax: null })),
    };
  }

  async submit(dto: WebsiteApplicationDto, cv?: CvUpload): Promise<{ received: true }> {
    if (dto.website?.trim()) {
      this.logger.warn('Website application ignored: honeypot field was filled');
      return { received: true };
    }

    const organisation = await this.db.client.organisation.findUnique({
      where: { slug: dto.organisation },
      select: { id: true, status: true },
    });
    if (!organisation || organisation.status === 'SUSPENDED') {
      throw new NotFoundException('Organisation not found');
    }

    const db = this.db.forTenant(organisation.id);

    let job: { id: string; title: string; ownerId: string | null } | null = null;
    if (dto.jobId) {
      job = await db.job.findFirst({
        where: { id: dto.jobId, deletedAt: null, ...WEBSITE_VISIBLE() },
        select: { id: true, title: true, ownerId: true },
      });
      if (!job) throw new BadRequestException('This position is no longer open.');
      // every place filled: the job has left the careers page, and nobody can apply to it any more
      if ((await this.jobsService.fullJobIds(organisation.id)).includes(job.id)) throw new BadRequestException('This position is no longer open.');
    }

    const email = dto.email.trim().toLowerCase();
    const normalizedPhone = normalizeCandidatePhone(dto.phone);
    // One person = one profile: matched on the e-mail address, or on the phone number when that is on file — and the name has to be
    // the same too. The same e-mail with another name is another person (a shared address, a test): they are added as a new candidate,
    // so nobody who fills the form is lost behind someone else's profile.
    const sameName = (a: { firstName: string; lastName: string }, b: { firstName: string; lastName: string }) => {
      const norm = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
      return norm(a.firstName) === norm(b.firstName) && norm(a.lastName) === norm(b.lastName);
    };
    const found = await db.candidate.findFirst({
      where: {
        deletedAt: null,
        OR: [{ email: { equals: email, mode: 'insensitive' } }, ...(normalizedPhone ? [{ normalizedPhone }] : [])],
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, firstName: true, lastName: true, ownerId: true, interestedJobId: true, phone: true, normalizedPhone: true, location: true, email: true, smsConsent: true, emailConsent: true },
    });

    const existing = found && sameName(found, { firstName: dto.firstName, lastName: dto.lastName }) ? found : null;
    if (found && !existing) {
      this.logger.log(`Website applicant "${dto.firstName} ${dto.lastName}" shares an e-mail/phone with candidate ${found.id} but has another name: added as a new candidate`);
    }

    if (existing) {
      // Same person applying again (or for another role): keep one record, remember the job if none was chosen yet,
      // (they are not put on the pipeline: that is done by a recruiter from Candidates).
      // (a person is not put on the pipeline by the form any more, so "applied for this vacancy before" is also the job they chose then)
      const alreadyOnJob = job
        ? existing.interestedJobId === job.id || Boolean(await db.application.findFirst({ where: { candidateId: existing.id, jobId: job.id, deletedAt: null }, select: { id: true } }))
        : false;
      const update: Record<string, unknown> = {};
      if (job && !existing.interestedJobId) update.interestedJobId = job.id;
      if (job && !existing.ownerId && job.ownerId) {
        update.ownerId = job.ownerId;
        existing.ownerId = job.ownerId;
      }
      // Details they did not give before are filled in; what is on file is never overwritten from a public form.
      if (!existing.phone && dto.phone) Object.assign(update, { phone: dto.phone, normalizedPhone });
      // A ticked box records consent where none is on file; an opt-out is never reversed by filling in a form.
      if (dto.marketingConsent) Object.assign(update, this.consentUpdate(existing));
      if (!existing.location && dto.location) update.location = dto.location;
      if (Object.keys(update).length) await db.candidate.update({ where: { id: existing.id }, data: update });

      // The same person pressing "send" twice for the same vacancy is one application: no second e-mail or alert.
      if (alreadyOnJob) {
        this.logger.log(`Repeat website application: candidate ${existing.id} is already on job ${job!.id} (no second card); a CV that came with it is kept`);
        if (cv) await this.saveCv(organisation.id, existing, cv);
        return { received: true };
      }
      await this.afterApply(organisation.id, existing, job, cv);
      // Every submission tells the team, even a repeat one without a job (then nobody is moved on the pipeline).
      await this.intake.admit({
        organisationId: organisation.id,
        userId: null,
        candidate: { ...existing, interestedJobId: job?.id ?? null },
        via: 'WEBSITE',
        returning: true,
      });
      return { received: true };
    }

    const candidate = await db.candidate.create({
      data: {
        organisationId: organisation.id,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email,
        phone: dto.phone,
        normalizedPhone,
        ...(dto.marketingConsent ? { smsConsent: 'GRANTED' as const, emailConsent: 'GRANTED' as const, consentUpdatedAt: new Date() } : {}),
        location: dto.location,
        jobTitle: dto.jobTitle,
        currentCompany: dto.currentCompany,
        source: 'Web',
        status: 'ACTIVE',
        ownerId: job?.ownerId ?? undefined,
        interestedJobId: job?.id,
      },
      select: { id: true, firstName: true, lastName: true },
    });

    await this.auditLogs.record({
      organisationId: organisation.id,
      userId: null,
      action: 'WEBSITE_APPLICATION',
      entityType: 'Candidate',
      entityId: candidate.id,
      newValues: { source: 'Web', jobId: job?.id ?? null },
    });

    await this.afterApply(organisation.id, candidate, job, cv);

    // Straight onto the pipeline (when a job was chosen) + "new candidate" notification to the team.
    await this.intake.admit({
      organisationId: organisation.id,
      userId: null,
      candidate: { ...candidate, ownerId: job?.ownerId ?? null, interestedJobId: job?.id ?? null },
      via: 'WEBSITE',
    });

    return { received: true };
  }

  /** Consent given on the form: only the channels that are still "nothing recorded" move to granted. */
  private consentUpdate(existing: { smsConsent: string; emailConsent: string }) {
    const update: Record<string, unknown> = {};
    if (existing.smsConsent === 'UNKNOWN') update.smsConsent = 'GRANTED';
    if (existing.emailConsent === 'UNKNOWN') update.emailConsent = 'GRANTED';
    if (Object.keys(update).length) update.consentUpdatedAt = new Date();
    return update;
  }

  /** The CV goes to the candidate's Documents (what the CV card reads). A failure is recorded against the candidate and never blocks the application. */
  private async saveCv(organisationId: string, candidate: { id: string; firstName: string; lastName: string }, cv: CvUpload): Promise<void> {
    const db = this.db.forTenant(organisationId);
    try {
      const safe = cv.originalname.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-120) || 'cv';
      const key = `${organisationId}/candidates/${candidate.id}/${randomUUID()}-${safe}`;
      await this.storage.upload({
        key,
        body: cv.buffer,
        contentType: cv.mimetype,
        sizeBytes: cv.size,
        displayName: cv.originalname,
        folderPath: ['Candidates', `${candidate.firstName} ${candidate.lastName}`, 'CV'],
      });
      // in Documents (what the candidate's CV card and Preview read) — the same place as a CV uploaded in the CRM
      await db.document.create({
        data: { organisationId, candidateId: candidate.id, name: cv.originalname, type: 'CV', fileUrl: key, fileSize: cv.size },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Could not save the CV of website applicant ${candidate.id}: ${reason}`);
      // recorded against the candidate, so the recruiter can ask for the CV again instead of never knowing it was lost
      await this.auditLogs.record({
        organisationId,
        userId: null,
        action: 'WEBSITE_CV_SAVE_FAILED',
        entityType: 'Candidate',
        entityId: candidate.id,
        newValues: { fileName: cv.originalname, reason: reason.slice(0, 300) },
      });
    }
  }

  /** The CV is filed against the candidate's profile and the vacancy's account holder gets an e-mail. Neither blocks the application. */
  private async afterApply(
    organisationId: string,
    candidate: { id: string; firstName: string; lastName: string },
    job: { id: string; title: string; ownerId: string | null } | null,
    cv?: CvUpload,
  ): Promise<void> {
    const db = this.db.forTenant(organisationId);
    if (cv) await this.saveCv(organisationId, candidate, cv);
    if (!job?.ownerId) return;
    try {
      const owner = await db.user.findFirst({ where: { id: job.ownerId }, select: { email: true, firstName: true } });
      if (!owner) return;
      const web = (process.env.WEB_URL ?? '').replace(/\/$/, '');
      const name = `${candidate.firstName} ${candidate.lastName}`;
      await this.email.send({
        to: owner.email,
        subject: `New website application: ${name} for ${job.title}`,
        text: `Hi ${owner.firstName},

${name} has applied for "${job.title}" through the website${cv ? ' (CV attached to the profile)' : ''}.
${web ? `Open the profile: ${web}/candidates/${candidate.id}
` : ''}`,
      });
    } catch (error) {
      this.logger.error(`Could not e-mail the account holder about applicant ${candidate.id}: ${error instanceof Error ? error.message : error}`);
    }
  }
}
