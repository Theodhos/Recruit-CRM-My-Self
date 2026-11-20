import { distanceKm } from '../../../common/utils/geo';
import { totalPages } from '@crm/utils';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';

import { AppException, ResourceNotFoundException } from '../../../common/exceptions/app.exception';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import { CompaniesService } from '../../companies/service/companies.service';
import { NotificationsService } from '../../notifications/service/notifications.service';
import type { CreateCandidateDto } from '../dto/create-candidate.dto';
import type { ListCandidatesQueryDto } from '../dto/list-candidates-query.dto';
import type { UpdateCandidateDto } from '../dto/update-candidate.dto';
import { CandidatesRepository } from '../repositories/candidates.repository';

// The whole point of the unassigned/"raw lead" pool is deciding who to work
// on next — this pool is realistically small (tens to low hundreds), so
// ranking it in memory rather than adding a raw-SQL computed ORDER BY is
// the simpler correct choice. Comfortably above any real org's count.
const UNASSIGNED_POOL_CAP = 1000;
/** The most people a distance search ranks by distance at once (the radius is at most 200 miles). */
const NEAR_CAP = 3000;
const KM_PER_MILE = 1.609344;

type PotentialSignals = {
  jobTitle: string | null;
  currentCompany: string | null;
  email: string | null;
  phone: string | null;
  location?: string | null;
  interestedJob?: { title: string; location: string | null } | null;
};

/**
 * "Potential" is entirely derived from what's actually on file — never a
 * black-box prediction. Weighted toward recorded work experience per the
 * brief: having a stated title + current employer says the most about
 * whether this is a placeable candidate; being reachable (email/phone)
 * matters, but less. When the candidate has a specific `interestedJob` (set
 * while still unassigned — see Candidate.interestedJobId), a job-fit bonus
 * is added on top so people competing for the SAME opening rank against
 * each other by fit, not just profile completeness. Capped at 100 either way.
 */
function completenessScore(candidate: PotentialSignals): number {
  let score = 0;
  if (candidate.jobTitle) score += 40;
  if (candidate.currentCompany) score += 30;
  if (candidate.email) score += 15;
  if (candidate.phone) score += 15;
  return score;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function titlesOverlap(candidateTitle: string, jobTitle: string): boolean {
  const a = normalize(candidateTitle);
  const b = normalize(jobTitle);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

function jobFitBonus(candidate: PotentialSignals): number {
  const job = candidate.interestedJob;
  if (!job) return 0;
  let bonus = 0;
  if (candidate.jobTitle && titlesOverlap(candidate.jobTitle, job.title)) bonus += 20;
  if (candidate.location && job.location && normalize(candidate.location) === normalize(job.location)) {
    bonus += 10;
  }
  return bonus;
}

function potentialScore(candidate: PotentialSignals): number {
  return Math.min(100, completenessScore(candidate) + jobFitBonus(candidate));
}

function potentialLabel(score: number): 'High' | 'Medium' | 'Low' {
  if (score >= 70) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}

function withPotential<T extends PotentialSignals>(candidate: T): T & { potentialScore: number; potentialLabel: string } {
  const score = potentialScore(candidate);
  return { ...candidate, potentialScore: score, potentialLabel: potentialLabel(score) };
}

const LIVE_APPLICATION_STATUSES = new Set(['ACTIVE', 'ON_HOLD', 'PLACED']);

/** The slice of an application the repository loads per candidate (CandidatesRepository APPLICATION_SUMMARY). */
type ApplicationSummary = {
  id: string;
  status: string;
  jobId: string | null;
  pipelineId: string;
  updatedAt: Date;
  job: { title: string } | null;
  pipelineStage: { name: string; type: string; order: number };
  stageNotes?: { id: string }[];
};

/** What the Candidates table shows as "where are they now": the stage of their live (else latest) application. */
export type CurrentApplication = { applicationId: string; pipelineId: string; jobId: string | null; jobTitle: string | null; stage: string; stageType: string };

/**
 * Where an applicant stands, from their applications: none yet -> PENDING (awaiting a decision), any in progress or
 * placed -> ACTIVE, only rejected/withdrawn -> REJECTED — plus the pipeline stage that status comes from. The raw
 * application rows are not part of the response.
 */
function withReviewStatus<T extends { applications?: ApplicationSummary[] }>(
  candidate: T,
): Omit<T, 'applications'> & { reviewStatus: 'PENDING' | 'ACTIVE' | 'REJECTED'; currentApplication: CurrentApplication | null; terminated: boolean; availability: Availability; availabilityManual: boolean } {
  const { applications = [], ...rest } = candidate;
  const live = applications.filter((a) => LIVE_APPLICATION_STATUSES.has(a.status));
  const reviewStatus = applications.length === 0 ? 'PENDING' : live.length > 0 ? 'ACTIVE' : 'REJECTED';
  const latest = [...(live.length > 0 ? live : applications)].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  const currentApplication = latest
    ? { applicationId: latest.id, pipelineId: latest.pipelineId, jobId: latest.jobId, jobTitle: latest.job?.title ?? null, stage: latest.pipelineStage.name, stageType: latest.pipelineStage.type }
    : null;
  // terminated from Pipeline Jobs (Active Employees -> Terminated): the Candidates table says "Do not use"
  const terminated = applications.some((a) => (a.stageNotes?.length ?? 0) > 0);
  // the status a person chose by hand beats the one read off the pipeline
  const manual = (rest as { manualStatus?: string | null }).manualStatus as Availability | null | undefined;
  const fromPipeline: Availability = terminated
    ? 'DO_NOT_USE'
    : currentApplication?.stageType === 'PLACED'
      ? 'NOT_AVAILABLE'
      : currentApplication && /interview/i.test(currentApplication.stage)
        ? 'ON_HOLD'
        : 'AVAILABLE';
  return { ...rest, reviewStatus, currentApplication, terminated, availability: manual ?? fromPipeline, availabilityManual: Boolean(manual) };
}

/** The Status column: what a person is for the recruiters. Set by hand, or read off the pipeline. */
export type Availability = 'AVAILABLE' | 'ON_HOLD' | 'NOT_AVAILABLE' | 'DO_NOT_USE';

/**
 * Choosing a status by hand carries the logic of that status: it is stored on the candidate's own status too, which is what
 * contact lists, exports, SMS and the availability filter read — Do not use is never contacted, Not available is out of the
 * Available lists, On hold is paused, Available is back in. Choosing Automatic puts it back to what the pipeline says.
 */
const STATUS_OF_MANUAL: Record<Availability, 'ACTIVE' | 'PASSIVE' | 'PLACED' | 'DO_NOT_CONTACT'> = {
  AVAILABLE: 'ACTIVE',
  ON_HOLD: 'PASSIVE',
  NOT_AVAILABLE: 'PLACED',
  DO_NOT_USE: 'DO_NOT_CONTACT',
};

/**
 * The recruiting-stage part of an update: what was written per stage is merged into the stored JSON (text only, capped),
 * and entering a stage stamps its `enteredAt`. Everything else in the dto passes through unchanged.
 */
function withStageData(
  existing: { recruitmentStage?: string | null; stageData?: unknown },
  dto: UpdateCandidateDto,
): UpdateCandidateDto {
  if (!dto.stageData && !dto.recruitmentStage) return dto;
  const stored = (existing.stageData && typeof existing.stageData === 'object' ? existing.stageData : {}) as Record<string, Record<string, string>>;
  const next: Record<string, Record<string, string>> = { ...stored };
  const at = new Date().toISOString();
  for (const [stage, fields] of Object.entries(dto.stageData ?? {})) {
    if (!['NEW', 'CV_SENT', 'INTERVIEW_1', 'PLACEMENT'].includes(stage) || !fields || typeof fields !== 'object') continue;
    const clean: Record<string, string> = { ...(next[stage] ?? {}) };
    for (const [key, value] of Object.entries(fields)) {
      if (typeof value === 'string') clean[key.slice(0, 40)] = value.slice(0, 3000);
    }
    next[stage] = clean;
  }
  if (dto.recruitmentStage && dto.recruitmentStage !== existing.recruitmentStage) {
    // what was written in the stage it leaves (History) is inherited by the stage it enters, unless that already has its own
    const from = next[existing.recruitmentStage ?? 'NEW'] ?? {};
    const into = next[dto.recruitmentStage] ?? {};
    next[dto.recruitmentStage] = { ...into, ...(from.notes?.trim() && !into.notes?.trim() ? { notes: from.notes } : {}), enteredAt: at };
  }
  return { ...dto, stageData: next };
}

/**
 * The CRM logic of the recruiting stages. Entering Placement makes the candidate Not available (status PLACED) and
 * copies the placement company and job to the Candidates table; a stage that has no job title yet gives the one it
 * has (the job the CV was sent for); moving back out of Placement makes a placed candidate Available again. A
 * candidate marked Do not use keeps that status.
 */
function applyStages(
  existing: { recruitmentStage?: string | null; stageData?: unknown; status?: string | null; jobTitle?: string | null },
  dto: UpdateCandidateDto,
): UpdateCandidateDto {
  const merged = withStageData(existing, dto);
  if (merged === dto) return dto;
  const data = (merged.stageData ?? {}) as Record<string, Record<string, string>>;
  const stage = dto.recruitmentStage ?? existing.recruitmentStage;
  const out: UpdateCandidateDto = { ...merged };
  if (stage === 'PLACEMENT') {
    const placement = data.PLACEMENT ?? {};
    if (placement.company?.trim()) out.currentCompany = placement.company.trim();
    if (placement.job?.trim()) out.jobTitle = placement.job.trim();
    if (!dto.status && existing.status !== 'DO_NOT_CONTACT') out.status = 'PLACED';
  } else if (dto.recruitmentStage && existing.recruitmentStage === 'PLACEMENT' && existing.status === 'PLACED' && !dto.status) {
    out.status = 'ACTIVE';
  }
  if (!existing.jobTitle?.trim() && !out.jobTitle?.trim()) {
    const job = data.CV_SENT?.job?.trim();
    if (job) out.jobTitle = job;
  }
  return out;
}

const TITLE_STOP_WORDS = new Set(['the', 'and', 'for', 'of', 'senior', 'junior', 'sr', 'jr', 'ii', 'iii', 'lead', 'assistant', 'associate', 'head', 'staff', 'team']);

/** Significant words of a job title — what "the same kind of job" is judged on. */
function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9ëç\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !TITLE_STOP_WORDS.has(w)),
  );
}

/** Same title, or at least one significant word in common ("Store Team Lead" ~ "Store Manager"). */
function similarTitles(a: string, b: string): boolean {
  if (a.trim().toLowerCase() === b.trim().toLowerCase()) return true;
  const ta = titleTokens(a);
  for (const w of titleTokens(b)) if (ta.has(w)) return true;
  return false;
}

export interface SuggestedJob {
  id: string;
  title: string;
  location: string | null;
  company: { id: string; name: string } | null;
  /** The job they were turned down for (or wanted) that this opening resembles. */
  matchedOn: string;
}

/** Raised after a candidate is created by hand — see `CandidatesService.onCandidateCreated`. */
export interface CandidateCreatedEvent {
  organisationId: string;
  /** Who entered them; null when they came in through the public website form. */
  userId: string | null;
  candidate: { id: string; firstName: string; lastName: string; ownerId: string | null; interestedJobId: string | null };
  via: 'MANUAL' | 'WEBSITE';
  /** Someone already on file applying again (website only). */
  returning?: boolean;
  /** The job was chosen later, on an existing candidate: put them on its pipeline without a "new candidate" notice. */
  linkedLater?: boolean;
}

@Injectable()
export class CandidatesService {
  private readonly logger = new Logger(CandidatesService.name);
  private readonly createdListeners = new Set<(event: CandidateCreatedEvent) => Promise<unknown>>();

  constructor(
    private readonly repository: CandidatesRepository,
    private readonly companiesService: CompaniesService,
    private readonly notifications: NotificationsService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  /**
   * Runs after every candidate created through this service. This is how CandidateIntakeService (ApplicationsModule,
   * which already depends on this module) puts new arrivals straight onto the pipeline without a circular module
   * dependency. A failing listener is logged and never fails the create itself.
   */
  onCandidateCreated(listener: (event: CandidateCreatedEvent) => Promise<unknown>): void {
    this.createdListeners.add(listener);
  }

  private async emitCreated(event: CandidateCreatedEvent): Promise<void> {
    for (const listener of this.createdListeners) {
      try {
        await listener(event);
      } catch (error) {
        this.logger.warn(`Candidate-created listener failed for ${event.candidate.id}: ${error}`);
      }
    }
  }

  // Fields a resume/CV realistically supplies (see ResumeParserService and
  // CandidateForm's RESUME_FIELDS) — missing ones are worth flagging since
  // they also directly cost this candidate potentialScore points.
  private static readonly EXPECTED_FIELD_LABELS: Record<string, string> = {
    email: 'email',
    phone: 'phone',
    location: 'location',
    jobTitle: 'job title',
    currentCompany: 'current company',
  };

  private async notifyIfIncomplete(
    organisationId: string,
    candidate: {
      id: string;
      firstName: string;
      lastName: string;
      ownerId: string | null;
      email: string | null;
      phone: string | null;
      location: string | null;
      jobTitle: string | null;
      currentCompany: string | null;
    },
  ): Promise<void> {
    if (!candidate.ownerId) return;

    const missing = Object.entries(CandidatesService.EXPECTED_FIELD_LABELS)
      .filter(([field]) => !candidate[field as keyof typeof candidate])
      .map(([, label]) => label);
    if (missing.length === 0) return;

    await this.notifications.notify(organisationId, candidate.ownerId, {
      type: 'CANDIDATE_DATA_INCOMPLETE',
      title: `Missing info for ${candidate.firstName} ${candidate.lastName}`,
      message: `Missing: ${missing.join(', ')} — complete their profile for a more accurate potential score.`,
      link: `/candidates/${candidate.id}`,
    });
  }

  /** The longest distance from the start point to a candidate — the end of the distance slider (null with no start point). */
  async distanceRange(organisationId: string, query: ListCandidatesQueryDto) {
    if (!query.nearLocation?.trim() && !query.nearJobId) return { maxKm: null, unlocated: 0 };
    const centre = await this.repository.startPoint(organisationId, query);
    const [maxKm, unlocated] = await Promise.all([this.repository.farthestKm(organisationId, centre), this.repository.countUnlocated(organisationId)]);
    return { maxKm, unlocated };
  }

  async list(organisationId: string, query: ListCandidatesQueryDto) {
    // The unassigned pool is ranked by potential (highest first) so a
    // recruiter deciding who to promote into a pipeline sees the strongest
    // leads at the top — not just whoever was added most recently.
    if (query.unassigned) {
      // Page only — `totalItems` below is `ranked.length`, so the repository's
      // full-table count (an anti-join over every candidate) would be discarded.
      const pool = await this.repository.findPage(organisationId, {
        ...query,
        page: 1,
        pageSize: UNASSIGNED_POOL_CAP,
      });
      const ranked = pool.map(withReviewStatus).map(withPotential).sort((a, b) => b.potentialScore - a.potentialScore);
      const totalItems = ranked.length;
      const start = (query.page - 1) * query.pageSize;
      return {
        items: ranked.slice(start, start + query.pageSize),
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: totalPages(totalItems, query.pageSize),
      };
    }

    // "Suggested for open jobs": people turned down for a job, for whom a similar OPEN job exists now that they
    // have not applied to. Matched in memory over the rejected pool (small), like the unassigned ranking above.
    if (query.reviewStatus === 'SUGGESTED') {
      const [pool, openJobs] = await Promise.all([
        this.repository.findPage(organisationId, { ...query, page: 1, pageSize: UNASSIGNED_POOL_CAP }),
        this.repository.findOpenJobs(organisationId),
      ]);
      const suggested = pool
        .map((candidate) => {
          const closed = candidate.applications.filter((a) => a.status === 'REJECTED' || a.status === 'WITHDRAWN');
          const wanted = [...new Set([...closed.flatMap((a) => (a.job ? [a.job.title] : [])), ...(candidate.interestedJob ? [candidate.interestedJob.title] : [])])];
          const applied = new Set(candidate.applications.map((a) => a.jobId).filter(Boolean));
          const suggestedJobs: SuggestedJob[] = [];
          for (const job of openJobs) {
            if (applied.has(job.id)) continue;
            const matchedOn = wanted.find((title) => similarTitles(title, job.title));
            if (matchedOn) suggestedJobs.push({ id: job.id, title: job.title, location: job.location, company: job.company, matchedOn });
            if (suggestedJobs.length === 3) break;
          }
          return { ...withPotential(withReviewStatus(candidate)), suggestedJobs };
        })
        .filter((c) => c.suggestedJobs.length > 0);
      const totalItems = suggested.length;
      const start = (query.page - 1) * query.pageSize;
      return { items: suggested.slice(start, start + query.pageSize), page: query.page, pageSize: query.pageSize, totalItems, totalPages: totalPages(totalItems, query.pageSize) };
    }

    // "within x miles of a place": the nearest first, each with how far it is
    if (query.radiusKm && (query.nearJobId || query.nearLocation?.trim())) {
      const centre = await this.repository.startPoint(organisationId, query);
      const found = await this.repository.findPage(organisationId, { ...query, page: 1, pageSize: NEAR_CAP });
      const ranked = found
        .map((candidate) => ({ candidate, km: candidate.latitude != null && candidate.longitude != null ? distanceKm(centre, { lat: candidate.latitude, lon: candidate.longitude }) : Number.POSITIVE_INFINITY }))
        .sort((a, b) => a.km - b.km);
      const start = (query.page - 1) * query.pageSize;
      return {
        items: ranked.slice(start, start + query.pageSize).map(({ candidate, km }) => ({ ...withPotential(withReviewStatus(candidate)), distanceMiles: Math.round((km / KM_PER_MILE) * 10) / 10 })),
        page: query.page,
        pageSize: query.pageSize,
        totalItems: ranked.length,
        totalPages: totalPages(ranked.length, query.pageSize),
      };
    }

    const { items, totalItems } = await this.repository.findMany(organisationId, query);
    return {
      items: items.map(withReviewStatus).map(withPotential),
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: totalPages(totalItems, query.pageSize),
    };
  }

  async getById(organisationId: string, id: string) {
    const candidate = await this.repository.findById(organisationId, id);
    if (!candidate) throw new ResourceNotFoundException('Candidate', id);
    return withPotential(withReviewStatus(candidate));
  }

  /** Cheap existence check (no relations loaded) for callers that ignore `getById`'s result; throws exactly what `getById` throws. */
  async assertExists(organisationId: string, id: string): Promise<void> {
    if (!(await this.repository.exists(organisationId, id))) {
      throw new ResourceNotFoundException('Candidate', id);
    }
  }

  /** A person already on file (same phone number or e-mail address) is not added a second time. */
  private async assertNotDuplicate(organisationId: string, dto: CreateCandidateDto) {
    const found = await this.repository.findDuplicate(organisationId, dto);
    if (!found) return;
    const why = found.why === 'phone' ? 'the same phone number' : 'the same e-mail address';
    throw new AppException(
      'DUPLICATE_CANDIDATE',
      `This candidate is already in the system: ${found.firstName} ${found.lastName} has ${why}. It was not added again.`,
      HttpStatus.CONFLICT,
      { id: found.id },
    );
  }

  async create(organisationId: string, userId: string, dto: CreateCandidateDto) {
    // an empty record (no name, no phone, no e-mail) tells nobody apart and could never be checked for duplicates
    if (![dto.firstName, dto.lastName, dto.email, dto.phone].some((value) => value?.trim())) {
      throw new AppException('CANDIDATE_EMPTY', 'A candidate needs at least a name, a phone number or an e-mail address. Fill one in — if the document could not be read, type the name.', HttpStatus.UNPROCESSABLE_ENTITY);
    }
    await this.assertNotDuplicate(organisationId, dto);
    const companyId = dto.currentCompany?.trim()
      ? (await this.companiesService.findOrCreateByName(organisationId, userId, dto.currentCompany)).id
      : undefined;
    const candidate = await this.repository.create(organisationId, userId, dto, companyId);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'CREATE_CANDIDATE',
      entityType: 'Candidate',
      entityId: candidate.id,
      newValues: dto,
    });
    await this.notifyIfIncomplete(organisationId, candidate);
    await this.emitCreated({
      organisationId,
      userId,
      candidate: {
        id: candidate.id,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        ownerId: candidate.ownerId,
        interestedJobId: candidate.interestedJobId,
      },
      via: 'MANUAL',
    });
    return candidate;
  }

  async update(organisationId: string, userId: string, id: string, rawDto: UpdateCandidateDto) {
    const existing = await this.getById(organisationId, id);
    // recruiting stages: what was written in them reaches the candidate's own data (see applyStages)
    const staged = applyStages(existing, rawDto);
    const dto: UpdateCandidateDto = rawDto.manualStatus === undefined
      ? staged
      : { ...staged, manualStatus: rawDto.manualStatus, status: rawDto.status ?? (rawDto.manualStatus ? STATUS_OF_MANUAL[rawDto.manualStatus] : existing.manualStatus ? 'ACTIVE' : staged.status) };
    // Company / job may be left out when a candidate is added; the links are made whenever they are filled in later.
    const employer = dto.currentCompany?.trim();
    const companyId =
      employer && employer !== existing.currentCompany
        ? (await this.companiesService.findOrCreateByName(organisationId, userId, employer)).id
        : undefined;
    const candidate = await this.repository.update(organisationId, id, dto, companyId);
    // another recruiter now owns this candidate: what was notified about them goes to the new owner
    if (dto.ownerId && existing.ownerId && dto.ownerId !== existing.ownerId) {
      await this.notifications.handOver(organisationId, existing.ownerId, dto.ownerId, [`/candidates/${id}`]);
    }
    if (dto.interestedJobId && dto.interestedJobId !== existing.interestedJobId) {
      await this.emitCreated({
        organisationId,
        userId,
        candidate: {
          id: candidate.id,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          ownerId: candidate.ownerId,
          interestedJobId: dto.interestedJobId,
        },
        via: 'MANUAL',
        linkedLater: true,
      });
    }
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'UPDATE_CANDIDATE',
      entityType: 'Candidate',
      entityId: id,
      oldValues: existing,
      newValues: dto,
    });
    return candidate;
  }

  async remove(organisationId: string, userId: string, id: string) {
    await this.assertExists(organisationId, id);
    await this.repository.softDelete(organisationId, id);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'DELETE_CANDIDATE',
      entityType: 'Candidate',
      entityId: id,
    });
  }
}
