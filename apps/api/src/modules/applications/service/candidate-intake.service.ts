import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import { AppException } from '../../../common/exceptions/app.exception';
import { CandidatesService, type CandidateCreatedEvent } from '../../candidates/service/candidates.service';
import { JobsService } from '../../jobs/service/jobs.service';
import { NotificationsService } from '../../notifications/service/notifications.service';
import { UsersService } from '../../users/service/users.service';

import { ApplicationsService } from './applications.service';

type JobSummary = { title: string; ownerId: string | null };

/**
 * Intake of a new candidate. Whoever arrives — through the public website form or typed in by an instructor — is
 * recorded in Candidates and everyone concerned is told in the platform: the candidate's owner, the job's owner and
 * the admins. They are NOT put on the pipeline automatically: someone ticks the checkbox before their name in
 * Candidates, which puts them on Pipeline Jobs at the first stage (Job Applicants). Until then their status reads
 * Pending; afterwards it is read off their pipeline stage.
 *
 * Manual entry reaches this through CandidatesService.onCandidateCreated (CandidatesModule cannot import this
 * module); the website form (PublicApplicationsService) calls `admit` directly.
 */
@Injectable()
export class CandidateIntakeService implements OnModuleInit {
  private readonly logger = new Logger(CandidateIntakeService.name);

  constructor(
    private readonly candidatesService: CandidatesService,
    private readonly applicationsService: ApplicationsService,
    private readonly jobsService: JobsService,
    private readonly usersService: UsersService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.candidatesService.onCandidateCreated((event) => this.admit(event));
  }

  async admit(event: CandidateCreatedEvent): Promise<{ applicationId: string | null; stage: string | null }> {
    const { organisationId, userId, candidate } = event;
    let job: JobSummary | null = null;
    let application: { id: string; pipelineStage: { name: string } } | null = null;

    try {
      if (candidate.interestedJobId) {
        job = await this.jobsService.getById(organisationId, candidate.interestedJobId);
        // A card that is already waiting without a job moves onto the job chosen later. Nobody is put on the
        // pipeline here otherwise: that is a choice made by hand, with the checkbox in Candidates (Job Applicants).
        // Applied through the website: the person is only recorded in Candidates (with the job they chose as "Interested in"); they are
        // NOT put on the pipeline — a recruiter does that from Candidates (Add to pipeline), when they decide to.
        application = event.linkedLater ? await this.applicationsService.linkJob(organisationId, userId, candidate.id, candidate.interestedJobId) : null;
      }
    } catch (error) {
      // A candidate who was never put on the pipeline has no waiting card to move: nothing to do then.
      // Anything unexpected is logged, never lost silently.
      if (!(error instanceof AppException)) {
        this.logger.error(`Could not put candidate ${candidate.id} on the pipeline: ${error instanceof Error ? (error.stack ?? error.message) : error}`);
      }
    }

    const stage = application?.pipelineStage.name ?? null;
    if (event.via === 'WEBSITE') {
      this.logger.log(`Website applicant ${candidate.id} job=${candidate.interestedJobId ?? 'none'} -> pipeline stage: ${stage ?? 'not on the pipeline (a recruiter adds them from Candidates)'}`);
      if (application) {
        // where exactly the card went, and whether the board will show it (it hides the cards of jobs whose places are all filled)
        const full = candidate.interestedJobId ? (await this.jobsService.fullJobIds(organisationId).catch(() => [] as string[])).includes(candidate.interestedJobId) : false;
        const a = application as { id: string; pipelineId?: string; status?: string };
        this.logger.log(`Website applicant card ${a.id}: pipeline=${a.pipelineId ?? '?'} status=${a.status ?? '?'} jobFull(hidden on board)=${full}`);
      }
    }
    if (event.linkedLater) return { applicationId: application?.id ?? null, stage };
    await this.notifyArrival(event, job, stage);
    return { applicationId: application?.id ?? null, stage };
  }

  private async notifyArrival(event: CandidateCreatedEvent, job: JobSummary | null, stage: string | null): Promise<void> {
    const { organisationId, candidate } = event;
    const recipients = new Set<string>(await this.usersService.adminIds(organisationId));
    if (candidate.ownerId) recipients.add(candidate.ownerId);
    if (job?.ownerId) recipients.add(job.ownerId);

    const name = `${candidate.firstName} ${candidate.lastName}`;
    const how = event.via === 'WEBSITE' ? 'Applied through the website' : 'Added manually';
    const forJob = job ? ` for ${job.title}` : '';
    const where = stage ? ` · now on the pipeline at "${stage}"` : '';
    const data = {
      type: event.returning ? 'CANDIDATE_REAPPLIED' : 'NEW_CANDIDATE',
      title: event.returning ? `Returning applicant: ${name}` : `New candidate: ${name}`,
      message: `${how}${forJob}${where}`,
      link: `/candidates/${candidate.id}`,
    };
    await Promise.all([...recipients].map((userId) => this.notifications.notify(organisationId, userId, data)));
  }
}
