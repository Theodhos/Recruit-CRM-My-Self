import { totalPages } from '@crm/utils';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';

import { AppException, ResourceNotFoundException } from '../../../common/exceptions/app.exception';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import { CandidatesService } from '../../candidates/service/candidates.service';
import { JobsService } from '../../jobs/service/jobs.service';
import { PipelineStagesService } from '../../pipeline-stages/service/pipeline-stages.service';
import { PlacementsService } from '../../placements/service/placements.service';
import type { CreateApplicationDto } from '../dto/create-application.dto';
import type { ListApplicationsQueryDto } from '../dto/list-applications-query.dto';
import type { UpdateApplicationDto } from '../dto/update-application.dto';
import { ApplicationsRepository } from '../repositories/applications.repository';

type ApplicationWithRelations = Awaited<ReturnType<ApplicationsRepository['update']>>;

type StageRef = { type: string; name: string };

/** A card in this stage takes one of the job's places: a Placed stage, Completed, or a Temporary pipeline's Active. */
const fillsPlace = (stage: StageRef) =>
  stage.type === 'PLACED' || (stage.type === 'STANDARD' && ['completed', 'active'].includes(stage.name.trim().toLowerCase()));

/** A card in this stage becomes an Active Employee: a Placed stage, or Active / Completed on a Temporary job (Active Jobs Temporary) — the placement is only created if it is not there yet. */
const startsWork = (stage: StageRef, jobEmploymentType?: string) =>
  stage.type === 'PLACED' || (jobEmploymentType !== undefined && jobEmploymentType !== 'PERMANENT' && stage.type === 'STANDARD' && ['active', 'completed'].includes(stage.name.trim().toLowerCase()));

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly repository: ApplicationsRepository,
    private readonly candidatesService: CandidatesService,
    private readonly jobsService: JobsService,
    private readonly placementsService: PlacementsService,
    private readonly pipelineStagesService: PipelineStagesService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async list(organisationId: string, query: ListApplicationsQueryDto) {
    const leaveOut = query.hideCompletedJobs ? await this.jobsService.fullJobIds(organisationId) : [];
    const { items, totalItems } = await this.repository.findMany(organisationId, query, leaveOut);
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: totalPages(totalItems, query.pageSize),
    };
  }

  async getById(organisationId: string, id: string) {
    const application = await this.repository.findById(organisationId, id);
    if (!application) throw new ResourceNotFoundException('Application', id);
    return application;
  }

  /** Cheap existence check (no relations loaded) for callers that ignore `getById`'s result; throws exactly what `getById` throws. */
  async assertExists(organisationId: string, id: string): Promise<void> {
    if (!(await this.repository.exists(organisationId, id))) {
      throw new ResourceNotFoundException('Application', id);
    }
  }

  /** `userId` is null when the application is raised by the public website form (CandidateIntakeService). */
  async create(organisationId: string, userId: string | null, dto: CreateApplicationDto) {
    // Confirms both belong to this org the same way every other cross-entity
    // FK gets validated elsewhere — getById already throws if either is missing.
    // The duplicate lookup is independent of the two existence checks, so all
    // three run together; a missing candidate/job still throws before the
    // duplicate result is looked at, exactly as before.
    const jobId = dto.jobId;
    const [, , existing] = await Promise.all([
      this.candidatesService.assertExists(organisationId, dto.candidateId),
      jobId ? this.jobsService.assertExists(organisationId, jobId) : Promise.resolve(),
      jobId ? this.repository.findByCandidateAndJob(organisationId, dto.candidateId, jobId) : this.repository.findJoblessByCandidate(organisationId, dto.candidateId),
    ]);
    let pipelineId = dto.pipelineId;
    let pipelineStageId = dto.pipelineStageId;
    if (pipelineStageId && jobId) {
      const target = await this.repository.findStageSummary(organisationId, pipelineStageId);
      if (target && fillsPlace(target)) {
        await this.jobsService.assertPlaceFree(organisationId, jobId, dto.candidateId);
        await this.assertCanStartWork(organisationId, jobId, target);
      }
    }
    if (!pipelineId || !pipelineStageId) {
      // the job decides the scheme: Permanent jobs on the Permanent pipeline, Temporary jobs on the Temporary one
      const job = jobId ? await this.jobsService.getById(organisationId, jobId) : null;
      const defaults = await this.resolveDefaultPipelineStage(organisationId, job?.employmentType === 'PERMANENT' ? 'PERMANENT' : job ? 'TEMPORARY' : undefined);
      pipelineId = pipelineId ?? defaults.pipelineId;
      pipelineStageId = pipelineStageId ?? defaults.pipelineStageId;
    }

    if (existing?.deletedAt) {
      // The pair (candidate, job) is unique: an application deleted earlier comes back instead of colliding.
      const restored = await this.repository.restore(organisationId, existing.id, {
        pipelineId,
        pipelineStageId,
        ...(dto.ownerId ? { ownerId: dto.ownerId } : {}),
      });
      // taken off the pipeline and added again: the History of this job starts over, nothing from before is kept
      await this.repository.clearHistory(organisationId, restored.id);
      await this.auditLogs.record({
        organisationId,
        userId,
        action: 'READD_APPLICATION',
        entityType: 'Application',
        entityId: restored.id,
        newValues: { pipelineId, pipelineStageId },
      });
      return (await this.syncStatusWithStage(organisationId, restored)) ?? (await this.maybeAutoPlace(organisationId, userId, restored)) ?? restored;
    }

    if (existing) {
      const closed = existing.status === 'REJECTED' || existing.status === 'WITHDRAWN';
      if (!closed) {
        throw new AppException(
          'DUPLICATE_APPLICATION',
          'This candidate has already applied to this job',
          HttpStatus.CONFLICT,
        );
      }
      // A rejected / withdrawn applicant being added again: re-open the same application at the requested (or first)
      // stage. syncStatusWithStage then flips it back to ACTIVE, so they show as "Active" in Candidates again.
      const reopened = await this.repository.update(organisationId, existing.id, {
        pipelineId,
        pipelineStageId,
        status: 'ACTIVE',
        ...(dto.ownerId ? { ownerId: dto.ownerId } : {}),
      });
      await this.auditLogs.record({
        organisationId,
        userId,
        action: 'REOPEN_APPLICATION',
        entityType: 'Application',
        entityId: reopened.id,
        newValues: { pipelineId, pipelineStageId },
      });
      return (await this.syncStatusWithStage(organisationId, reopened)) ?? (await this.maybeAutoPlace(organisationId, userId, reopened)) ?? reopened;
    }

    const application = await this.repository.create(organisationId, userId, {
      ...dto,
      pipelineId,
      pipelineStageId,
    });

    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'CREATE_APPLICATION',
      entityType: 'Application',
      entityId: application.id,
      newValues: dto,
    });

    return (await this.syncStatusWithStage(organisationId, application)) ?? (await this.maybeAutoPlace(organisationId, userId, application)) ?? application;
  }

  /**
   * A candidate who applied through the website goes straight onto the pipeline of the job they chose: at
   * "Job Applicants" for a Permanent job, straight at "Active" for a Temporary one (there is no Screening stage any more). Applying again to a job they are already on changes nothing.
   */
  async admitFromWebsite(organisationId: string, candidateId: string, jobId: string) {
    // Applying again to a job they are already on (in ANY state) changes nothing. In particular a rejected or
    // withdrawn applicant is not put back on the pipeline by filling in the public form a second time.
    const already = await this.repository.findByCandidateAndJob(organisationId, candidateId, jobId);
    if (already && !already.deletedAt) return null;
    const job = await this.jobsService.getById(organisationId, jobId);
    // the job's own type (set in Jobs) decides the pipeline: Permanent -> Permanent pipeline, anything else -> Temporary
    const scheme = job.employmentType === 'PERMANENT' ? 'PERMANENT' : 'TEMPORARY';
    const target = await this.repository.findStageByName(organisationId, scheme, ...(scheme === 'PERMANENT' ? ['Sent CV', 'Job Applicants'] : ['Active']));
    try {
      return await this.create(organisationId, null, {
        candidateId,
        jobId,
        ...(target ?? {}),
        source: 'CAREER_SITE',
        // the application belongs to the recruiter who posted the vacancy
        ...(job.ownerId ? { ownerId: job.ownerId } : {}),
      });
    } catch (error) {
      if (error instanceof AppException && error.getStatus() === HttpStatus.CONFLICT) return null; // already on this job
      // a Temporary job that cannot take another person (all places filled, no client yet) must not lose the application: the candidate stays in Candidates
      if (scheme === 'TEMPORARY' && error instanceof AppException) {
        this.logger.warn(`Website applicant ${candidateId} was not put on the Active stage of job ${jobId}: ${error.message}`);
        return null;
      }
      throw error;
    }
  }

  /**
   * The job was chosen later for a candidate who went onto the pipeline without one: the same card now belongs to
   * that job, keeping its stage. Returns null when there is no such card (or the candidate is already on that job).
   */
  async linkJob(organisationId: string, userId: string | null, candidateId: string, jobId: string) {
    await this.jobsService.assertExists(organisationId, jobId);
    const [jobless, onJob] = await Promise.all([
      this.repository.findJoblessByCandidate(organisationId, candidateId),
      this.repository.findByCandidateAndJob(organisationId, candidateId, jobId),
    ]);
    if (!jobless || onJob) return null;
    const linked = await this.repository.setJob(organisationId, jobless.id, jobId);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'UPDATE_APPLICATION',
      entityType: 'Application',
      entityId: linked.id,
      newValues: { jobId },
    });
    return linked;
  }

  async update(organisationId: string, userId: string, id: string, dto: UpdateApplicationDto) {
    const existing = await this.getById(organisationId, id);
    // moving a card into the Completed stage fills a place: refused when the job's stated places are all taken
    if (dto.pipelineStageId && dto.pipelineStageId !== existing.pipelineStageId && existing.jobId) {
      const target = await this.repository.findStageSummary(organisationId, dto.pipelineStageId);
      if (target && fillsPlace(target)) {
        await this.jobsService.assertPlaceFree(organisationId, existing.jobId, existing.candidateId);
        await this.assertCanStartWork(organisationId, existing.jobId, target);
      }
    }
    const application = await this.repository.update(organisationId, id, dto);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'UPDATE_APPLICATION',
      entityType: 'Application',
      entityId: id,
      oldValues: existing,
      newValues: dto,
    });

    return (await this.syncStatusWithStage(organisationId, application)) ?? (await this.maybeAutoPlace(organisationId, userId, application)) ?? application;
  }

  /** Undo of a removal: the card is back on the pipeline, in the stage it was removed from. */
  async restore(organisationId: string, userId: string, id: string) {
    const restored = await this.repository.restoreRemoved(organisationId, id);
    if (!restored) throw new ResourceNotFoundException('Removed application', id);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'RESTORE_APPLICATION',
      entityType: 'Application',
      entityId: id,
    });
    return this.getById(organisationId, id);
  }

  async remove(organisationId: string, userId: string, id: string) {
    await this.assertExists(organisationId, id);
    await this.repository.softDelete(organisationId, id);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'DELETE_APPLICATION',
      entityType: 'Application',
      entityId: id,
    });
  }

  /**
   * "After going through every pipeline phase and being approved at the
   * end, the company/job assignment happens automatically" — the trigger is
   * the pipeline stage's own `type` (see PipelineStageType), not a status
   * string, so it fires however that stage was reached: this create, an
   * update that changes pipelineStageId, or a future kanban drag-and-drop.
   * Never throws — a job with no company yet just means no Placement can
   * be inferred, not a failed pipeline move.
   */
  /**
   * The applicant's status follows the stage they sit in: a stage of type REJECTED marks the application REJECTED
   * (the candidate then shows as "Rejected" in Candidates); moving them back to a normal stage re-opens it as ACTIVE.
   * PLACED stages are handled by maybeAutoPlace. Returns the refreshed application when it changed anything.
   */
  private async syncStatusWithStage(
    organisationId: string,
    application: ApplicationWithRelations,
  ): Promise<ApplicationWithRelations | null> {
    const stageType = application.pipelineStage.type;
    if (stageType === 'REJECTED' && application.status !== 'REJECTED') {
      return this.repository.update(organisationId, application.id, { status: 'REJECTED' });
    }
    if (stageType === 'STANDARD' && (application.status === 'REJECTED' || application.status === 'WITHDRAWN')) {
      return this.repository.update(organisationId, application.id, { status: 'ACTIVE' });
    }
    return null;
  }

  /**
   * Moving a card to a stage that makes the person an Active Employee creates their placement for the job's client.
   * Without a client company that placement cannot exist, and the card would sit in "Placed" while the person is
   * missing from Active Employees — so the move is refused before anything changes, with the reason.
   */
  private async assertCanStartWork(organisationId: string, jobId: string, target: StageRef) {
    const job = await this.jobsService.getById(organisationId, jobId);
    if (!startsWork(target, job.employmentType)) return;
    const hasClient = Boolean((job as { companyId?: string | null }).companyId ?? (job as { company?: { id?: string } | null }).company?.id);
    if (!hasClient) {
      throw new AppException('JOB_HAS_NO_CLIENT', 'This job has no client company yet. Link the job to its client first — the Active Employee is placed with that client.', HttpStatus.UNPROCESSABLE_ENTITY);
    }
  }

  private async maybeAutoPlace(
    organisationId: string,
    userId: string | null,
    application: ApplicationWithRelations,
  ): Promise<ApplicationWithRelations | null> {
    if (!startsWork(application.pipelineStage, application.job?.employmentType)) return null;
    // a placement is for a job (and its company); a card with no job yet cannot be placed
    if (!application.jobId) return null;

    // No acting user (website intake) — the placement is attributed to whoever owns the application.
    const actor = userId ?? application.ownerId;
    if (!actor) {
      this.logger.warn(`Application ${application.id} reached a "Placed" stage with no user or owner to attribute the Placement to.`);
      return null;
    }

    const placement = await this.placementsService.createFromApplicationIfAbsent(organisationId, actor, {
      candidateId: application.candidateId,
      jobId: application.jobId,
      companyId: application.job?.company?.id ?? null,
      // the job decides: permanent or temporary employee, as it was set when the job was added
      employmentType: application.job?.employmentType === 'PERMANENT' ? 'PERMANENT' : 'TEMPORARY',
    });

    if (!placement) {
      this.logger.warn(
        `Application ${application.id} reached a "Placed" pipeline stage but its job has no company yet — Placement not auto-created.`,
      );
      return null;
    }

    if (application.status !== 'PLACED') {
      return this.repository.update(organisationId, application.id, { status: 'PLACED' });
    }

    return null;
  }

  /**
   * Marks one of the applicant's current pipeline stage's "test/question"
   * checklist items as done or not. Both the Application and the checklist
   * item are verified tenant-owned independently (see their services), and
   * the item must belong to the SAME pipeline this application is actually
   * in — an item from a different pipeline is a client bug, not something
   * to silently accept.
   */
  async toggleChecklistItem(
    organisationId: string,
    applicationId: string,
    checklistItemId: string,
    completed: boolean,
  ) {
    // Only the application's pipeline is compared below, so don't load the whole application with every relation.
    const application = await this.repository.findPipelineId(organisationId, applicationId);
    if (!application) throw new ResourceNotFoundException('Application', applicationId);
    const item = await this.pipelineStagesService.getOwnedChecklistItem(organisationId, checklistItemId);

    if (item.pipelineStage.pipelineId !== application.pipelineId) {
      throw new AppException(
        'CHECKLIST_ITEM_WRONG_PIPELINE',
        'This checklist item belongs to a different pipeline than this application.',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.repository.toggleChecklistItem(applicationId, checklistItemId, completed);
  }

  /** A fresh organisation has no pipeline yet (the current seed creates one, but a real signup won't) — provision the same default shape on first use rather than making "create a pipeline" a prerequisite step before anyone can record an application. */
  private async resolveDefaultPipelineStage(organisationId: string, employmentType?: 'PERMANENT' | 'TEMPORARY') {
    const existing = await this.repository.findDefaultPipelineStage(organisationId, employmentType);
    if (existing) return existing;

    const created = await this.repository.createDefaultPipeline(organisationId);
    return { pipelineId: created.id, pipelineStageId: created.stages[0]!.id };
  }
}
