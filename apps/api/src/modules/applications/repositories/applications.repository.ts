import { searchWords } from '../../../common/utils/search';
import { Injectable } from '@nestjs/common';

import { CacheService } from '../../../infrastructure/cache/cache.service';
import { DatabaseService } from '../../../infrastructure/database/database.service';
import type { CreateApplicationDto } from '../dto/create-application.dto';
import type { ListApplicationsQueryDto } from '../dto/list-applications-query.dto';
import type { UpdateApplicationDto } from '../dto/update-application.dto';

const RELATION_INCLUDE = {
  candidate: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true, location: true, postalCode: true } },
  job: {
    select: {
      id: true,
      title: true,
      status: true,
      // Permanent or Temporary, set when the job was added: it decides what a placed candidate becomes
      employmentType: true,
      company: { select: { id: true, name: true } },
    },
  },
  pipelineStage: { select: { id: true, name: true, type: true, order: true } },
  // the scheme decides what a placed candidate becomes (permanent / temporary employee)
  pipeline: { select: { id: true, name: true, employmentType: true } },
  checklistResponses: {
    select: { id: true, checklistItemId: true, completed: true, completedAt: true },
  },
  // the per-stage records: the board card shows the current stage's outcome (screening passed, offer sent…) and the
  // latest pay recorded, and the pay filter matches on that pay; `notes` is the mandatory free-text reason behind a
  // Reject (see Rejected Applicants). A handful of small rows per application.
  stageNotes: {
    orderBy: { updatedAt: 'desc' as const },
    select: { pipelineStageId: true, notes: true, fields: true, hourlyRate: true, hoursPerDay: true, daysPerMonth: true, feePercent: true, currency: true, updatedAt: true },
  },
};

/** Shown on a card whose candidate was added without a job: the job is linked later. Empty id = "no job". */
const NO_JOB = { id: '', title: 'No job yet', status: 'OPEN' as const, employmentType: 'PERMANENT' as const, company: { id: '', name: '' } };

/** Gives a job-less row a placeholder job, so the pipeline and every page that reads `application.job` keeps working. */
function withJob<T extends { job: unknown }>(row: T): Omit<T, 'job'> & { job: NonNullable<T['job']> | typeof NO_JOB } {
  return { ...row, job: row.job ?? NO_JOB } as never;
}

/**
 * Tenant-scoped data access for 'applications' — the join between Candidate
 * and Job (see schema.prisma's comment on the Application model: a
 * candidate is never linked to a job directly). Always resolve the client
 * via `this.db.forTenant(organisationId)` (packages/database scopedPrisma).
 */
@Injectable()
export class ApplicationsRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly cache: CacheService,
  ) {}

  async findMany(organisationId: string, query: ListApplicationsQueryDto, leaveOutJobIds: string[] = []) {
    const db = this.db.forTenant(organisationId);
    const base = {
      deletedAt: null,
      // a card of a candidate or a job that was deleted is gone with it
      candidate: { deletedAt: null },
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      ...(query.source ? { source: query.source } : {}),
      // Rejected is decided by where the card sits (the Rejected stage), as well as by its status — see `extra`
      ...(query.status && query.status !== 'REJECTED' ? { status: query.status } : {}),
      ...(query.candidateId ? { candidateId: query.candidateId } : {}),
      ...(query.jobId ? { jobId: query.jobId } : {}),
      // a card with no job yet stays (unless a company is asked for); a card of a deleted job is gone
      ...(query.companyId ? { job: { deletedAt: null, companyId: query.companyId } } : { OR: [{ jobId: null }, { job: { deletedAt: null } }] }),
      ...(query.pipelineId ? { pipelineId: query.pipelineId } : {}),
      ...(query.appliedFrom || query.appliedTo
        ? {
            appliedAt: {
              ...(query.appliedFrom ? { gte: new Date(query.appliedFrom) } : {}),
              ...(query.appliedTo ? { lte: new Date(query.appliedTo) } : {}),
            },
          }
        : {}),
      ...(query.minHourlyRate !== undefined || query.maxHourlyRate !== undefined
        ? {
            stageNotes: {
              some: {
                hourlyRate: {
                  ...(query.minHourlyRate !== undefined ? { gte: query.minHourlyRate } : {}),
                  ...(query.maxHourlyRate !== undefined ? { lte: query.maxHourlyRate } : {}),
                },
              },
            },
          }
        : {}),
      // every word typed must match somewhere: the person's name, e-mail, phone, town, the job, its company or town
      ...(searchWords(query.search).length
        ? {
            AND: searchWords(query.search).map((word) => {
              const like = { contains: word, mode: 'insensitive' as const };
              return {
                OR: [
                  { candidate: { firstName: like } },
                  { candidate: { lastName: like } },
                  { candidate: { email: like } },
                  { candidate: { phone: like } },
                  { candidate: { city: like } },
                  { candidate: { location: like } },
                  { candidate: { jobTitle: like } },
                  { job: { title: like } },
                  { job: { company: { name: like } } },
                  { job: { location: like } },
                ],
              };
            }),
          }
        : {}),
    };
    // the cards of jobs that are complete are not on the board (a card with no job yet stays)
    const extra = [
      // Rejected Applicants: every card in a Rejected-type stage, however it got there (Reject, Terminated, a drop)
      ...(query.status === 'REJECTED' ? [{ OR: [{ status: 'REJECTED' as const }, { pipelineStage: { type: 'REJECTED' as const } }] }] : []),
      // ...except people still waiting at the first stages (a new applicant of a job that is already full is not a
      // filled place, and must not vanish from the board the moment they apply) and people in Placement, who stay until
      // Completed or Terminated is pressed; the cards in Completed leave the board when the job is full
      ...(leaveOutJobIds.length > 0
        ? [{ OR: [{ jobId: null }, { jobId: { notIn: leaveOutJobIds } }, { pipelineStage: { name: { in: ['Job Applicants', 'Screening', 'Sent CV', 'Interview 1'], mode: 'insensitive' as const } } }, { pipelineStage: { type: 'PLACED' as const } }] }]
        : []),
    ];
    const where = extra.length > 0 ? { AND: [base, ...extra] } : base;

    const [items, totalItems] = await Promise.all([
      db.application.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { appliedAt: 'desc' },
        include: RELATION_INCLUDE,
      }),
      this.cache.cachedCount(organisationId, 'applications', where, () => db.application.count({ where })),
    ]);

    return { items: items.map(withJob), totalItems };
  }

  findById(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).application.findFirst({
      where: { id, deletedAt: null },
      include: RELATION_INCLUDE,
    }).then((row) => (row ? withJob(row) : row));
  }

  /** Same tenant and soft-delete filter as `findById`, but only the pipeline id — for callers that just compare `pipelineId`. */
  findPipelineId(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).application.findFirst({
      where: { id, deletedAt: null },
      select: { pipelineId: true },
    });
  }

  /** Existence check with the same tenant and soft-delete filter as `findById`, without loading any relations. */
  exists(organisationId: string, id: string) {
    return this.db
      .forTenant(organisationId)
      .application.count({ where: { id, deletedAt: null } })
      .then((count) => count > 0);
  }

  /** Soft-deleted rows included: (candidateId, jobId) is unique, so a deleted application is restored, never duplicated. */
  findByCandidateAndJob(organisationId: string, candidateId: string, jobId: string) {
    return this.db.forTenant(organisationId).application.findFirst({
      where: { candidateId, jobId },
    });
  }

  /** The candidate's card that has no job yet (at most one). */
  findJoblessByCandidate(organisationId: string, candidateId: string) {
    return this.db.forTenant(organisationId).application.findFirst({ where: { candidateId, jobId: null, deletedAt: null } });
  }

  /** Links a job to a card that was on the pipeline without one. */
  setJob(organisationId: string, id: string, jobId: string, ownerId?: string) {
    return this.db.forTenant(organisationId).application.update({
      where: { id },
      data: { jobId, ...(ownerId ? { ownerId } : {}) },
      include: RELATION_INCLUDE,
    }).then(withJob);
  }

  findStageSummary(organisationId: string, stageId: string) {
    return this.db.forTenant(organisationId).pipelineStage.findFirst({ where: { id: stageId }, select: { name: true, type: true } });
  }

  /**
   * A person added to the pipeline again after they were taken off it starts afresh for that job: what was written at its
   * stages, the pay worked out there and the ticked questions are not kept. (The audit trail stays; History reads it from
   * the latest READD_APPLICATION on.)
   */
  async clearHistory(organisationId: string, applicationId: string) {
    const db = this.db.forTenant(organisationId);
    await db.$transaction([
      db.applicationStageNote.deleteMany({ where: { applicationId } }),
      db.applicationChecklistItem.deleteMany({ where: { applicationId } }),
    ]);
  }

  /** Brings a soft-deleted application back onto a pipeline. */
  restore(organisationId: string, id: string, data: { pipelineId: string; pipelineStageId: string; ownerId?: string }) {
    return this.db.forTenant(organisationId).application.update({
      where: { id },
      data: { ...data, deletedAt: null, status: 'ACTIVE' },
      include: RELATION_INCLUDE,
    }).then(withJob);
  }

  create(organisationId: string, ownerId: string | null, dto: CreateApplicationDto & { pipelineId: string; pipelineStageId: string }) {
    return this.db.forTenant(organisationId).application.create({
      data: { ...dto, organisationId, ownerId: dto.ownerId ?? ownerId },
      include: RELATION_INCLUDE,
    }).then(withJob);
  }

  update(organisationId: string, id: string, dto: UpdateApplicationDto) {
    return this.db.forTenant(organisationId).application.update({
      where: { id },
      data: dto,
      include: RELATION_INCLUDE,
    }).then(withJob);
  }

  softDelete(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).application.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /** Puts a removed (soft-deleted) application back on its pipeline. Null when it is not this tenant's or was never removed. */
  async restoreRemoved(organisationId: string, id: string) {
    const db = this.db.forTenant(organisationId);
    const removed = await db.application.findFirst({ where: { id, deletedAt: { not: null } }, select: { id: true } });
    if (!removed) return null;
    return db.application.update({ where: { id }, data: { deletedAt: null } });
  }

  /** The org's oldest pipeline (there is exactly one from the seed, but nothing stops a future Pipelines admin UI from adding more) plus its first-ordered stage — the sensible default when a candidate applies without the caller picking one explicitly. */
  async findDefaultPipelineStage(organisationId: string, employmentType?: 'PERMANENT' | 'TEMPORARY') {
    const db = this.db.forTenant(organisationId);
    const include = { stages: { orderBy: { order: 'asc' as const } } };
    // a Permanent job goes through the Permanent scheme, a Temporary one through the Temporary scheme; with no scheme
    // of that kind, the oldest pipeline
    const pipeline =
      (employmentType ? await db.pipeline.findFirst({ where: { employmentType }, orderBy: { createdAt: 'asc' }, include }) : null) ??
      (await db.pipeline.findFirst({ orderBy: { createdAt: 'asc' }, include }));
    if (!pipeline || pipeline.stages.length === 0) return null;
    // Screening no longer exists on the Temporary board: a card never starts there
    const first = pipeline.stages.find((stage) => !/screening/i.test(stage.name)) ?? pipeline.stages[0]!;
    return { pipelineId: pipeline.id, pipelineStageId: first.id };
  }

  /** The stage called `name` on the organisation's oldest pipeline of that scheme; null when there is none (the caller falls back to the first stage). */
  /** The stage of the first pipeline of this kind called any of these names (the Permanent pipeline's first stage was "Job Applicants", now "Sent CV"). */
  async findStageByName(organisationId: string, employmentType: 'PERMANENT' | 'TEMPORARY', ...names: string[]) {
    const db = this.db.forTenant(organisationId);
    const pipeline = await db.pipeline.findFirst({
      where: { employmentType },
      orderBy: { createdAt: 'asc' },
      include: { stages: { where: { OR: names.map((name) => ({ name: { equals: name, mode: 'insensitive' as const } })) }, orderBy: { order: 'asc' }, take: 1 } },
    });
    const stage = pipeline?.stages[0];
    return pipeline && stage ? { pipelineId: pipeline.id, pipelineStageId: stage.id } : null;
  }

  createDefaultPipeline(organisationId: string) {
    return this.db.forTenant(organisationId).pipeline.create({
      data: {
        organisationId,
        name: 'Permanent recruitment',
        employmentType: 'PERMANENT',
        stages: {
          // The agency's road from application to decision — each stage has its own form in the web app
          // (features/pipelines/stage-forms.ts), so keep these names in step with it.
          create: [
            { name: 'Sent CV', order: 1, type: 'STANDARD' },
            { name: 'Interview 1', order: 2, type: 'STANDARD' },
            { name: 'Interview 2', order: 3, type: 'STANDARD' },
            { name: 'Rejected', order: 4, type: 'REJECTED' },
            { name: 'Placement', order: 5, type: 'PLACED' },
            { name: 'Completed', order: 6, type: 'STANDARD' },
          ],
        },
      },
      include: { stages: { orderBy: { order: 'asc' }, take: 1 } },
    });
  }

  /**
   * `applicationChecklistItem` carries no organisationId of its own (see the
   * schema comment) — ApplicationsService verifies tenant ownership of both
   * the Application and the checklist item's stage/pipeline before this is
   * ever called, so it deliberately uses the raw, unscoped client.
   */
  toggleChecklistItem(applicationId: string, checklistItemId: string, completed: boolean) {
    return this.db.client.applicationChecklistItem.upsert({
      where: { applicationId_checklistItemId: { applicationId, checklistItemId } },
      create: { applicationId, checklistItemId, completed, completedAt: completed ? new Date() : null },
      update: { completed, completedAt: completed ? new Date() : null },
    });
  }
}
