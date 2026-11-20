import { distanceKm } from '../../../common/utils/geo';
import { NotificationsService } from '../../notifications/service/notifications.service';
import { totalPages } from '@crm/utils';
import { HttpStatus, Injectable } from '@nestjs/common';

import { GeocodingService } from '../../../infrastructure/geocoding/geocoding.service';
import { AppException, ResourceNotFoundException } from '../../../common/exceptions/app.exception';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import { CompaniesService } from '../../companies/service/companies.service';
import type { CreateJobDto } from '../dto/create-job.dto';
import type { ListJobsQueryDto } from '../dto/list-jobs-query.dto';
import type { ReleasePlacesDto } from '../dto/release-places.dto';
import type { ReplaceCandidateDto } from '../dto/replace-candidate.dto';
import type { UpdateJobDto } from '../dto/update-job.dto';
import { JobsRepository } from '../repositories/jobs.repository';


/** The most jobs a distance search ranks by distance at once (the radius is at most 200 miles). */
const NEAR_CAP = 3000;
const KM_PER_MILE = 1.609344;

@Injectable()
export class JobsService {
  constructor(
    private readonly repository: JobsRepository,
    private readonly companiesService: CompaniesService,
    private readonly auditLogs: AuditLogsService,
    private readonly geocode: GeocodingService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(organisationId: string, query: ListJobsQueryDto) {
    let nearIds: string[] | undefined;
    if ((query.nearLocation?.trim() || query.nearCandidateId) && query.radiusKm) {
      const centre = await this.startPoint(organisationId, query);
      nearIds = await this.repository.idsWithin(organisationId, centre, query.radiusKm);
      // "within x miles of a place": the nearest first, each with how far it is
      const found = await this.repository.findMany(organisationId, { ...query, page: 1, pageSize: NEAR_CAP }, nearIds);
      const ranked = found.items
        .map((job) => ({ job, km: job.latitude != null && job.longitude != null ? distanceKm(centre, { lat: job.latitude, lon: job.longitude }) : Number.POSITIVE_INFINITY }))
        .sort((a, b) => a.km - b.km);
      const start = (query.page - 1) * query.pageSize;
      return {
        items: ranked.slice(start, start + query.pageSize).map(({ job, km }) => ({ ...job, distanceMiles: Math.round((km / KM_PER_MILE) * 10) / 10 })),
        page: query.page,
        pageSize: query.pageSize,
        totalItems: ranked.length,
        totalPages: totalPages(ranked.length, query.pageSize),
      };
    }
    const { items, totalItems } = await this.repository.findMany(organisationId, query, nearIds);
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: totalPages(totalItems, query.pageSize),
    };
  }

  async getById(organisationId: string, id: string) {
    const job = await this.repository.findById(organisationId, id);
    if (!job) throw new ResourceNotFoundException('Job', id);
    return job;
  }

  /** The jobs whose every place is filled (Completed Jobs): other pages, like Pipeline Jobs, leave them out. */
  fullJobIds(organisationId: string): Promise<string[]> {
    return this.repository.fullJobIdsOf(organisationId);
  }

  /**
   * Frees filled places: the `count` people who filled the job last lose their place (contract deleted, card off the
   * pipeline), so the job has room again and goes back to Jobs. `dryRun` only says who they would be.
   */
  async releasePlaces(organisationId: string, userId: string, id: string, dto: ReleasePlacesDto) {
    await this.assertExists(organisationId, id);
    const fillers = await this.repository.fillersOf(organisationId, id);
    if (dto.count > fillers.length) {
      throw new AppException('NOT_ENOUGH_FILLED', `Only ${fillers.length} place${fillers.length === 1 ? ' is' : 's are'} filled on this job`, HttpStatus.BAD_REQUEST);
    }
    const released = fillers.slice(fillers.length - dto.count);
    if (!dto.dryRun) {
      await this.repository.releaseCandidates(organisationId, id, released.map((person) => person.candidateId));
      await this.auditLogs.record({
        organisationId,
        userId,
        action: 'RELEASE_JOB_PLACES',
        entityType: 'Job',
        entityId: id,
        newValues: { candidateIds: released.map((person) => person.candidateId) },
      });
    }
    return { released: released.map((person) => ({ id: person.candidateId, name: person.name })) };
  }

  /** The history of the people on the job: who joined, completed, was terminated, replaced or taken off. */
  async candidateHistory(organisationId: string, id: string) {
    await this.assertExists(organisationId, id);
    return { items: await this.repository.candidateHistory(organisationId, id) };
  }

  /** Another candidate takes the place of one who works the job: same contract, same card stage, same shift. */
  async replaceCandidate(organisationId: string, userId: string, id: string, dto: ReplaceCandidateDto) {
    await this.assertExists(organisationId, id);
    if (dto.fromCandidateId === dto.toCandidateId) {
      throw new AppException('SAME_CANDIDATE', 'Choose a different candidate', HttpStatus.BAD_REQUEST);
    }
    if (!(await this.repository.candidateExists(organisationId, dto.toCandidateId))) throw new ResourceNotFoundException('Candidate', dto.toCandidateId);
    const fillers = await this.repository.fillersOf(organisationId, id);
    if (!fillers.some((person) => person.candidateId === dto.fromCandidateId)) {
      throw new AppException('NOT_ON_JOB', 'That candidate does not work this job', HttpStatus.BAD_REQUEST);
    }
    if (fillers.some((person) => person.candidateId === dto.toCandidateId)) {
      throw new AppException('ALREADY_ON_JOB', 'That candidate already works this job', HttpStatus.CONFLICT);
    }
    const result = await this.repository.replaceCandidate(organisationId, id, dto.fromCandidateId, dto.toCandidateId);
    if (!result) throw new AppException('NOT_ON_JOB', 'That candidate does not work this job', HttpStatus.BAD_REQUEST);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'REPLACE_JOB_CANDIDATE',
      entityType: 'Job',
      entityId: id,
      oldValues: { candidateId: dto.fromCandidateId },
      newValues: { candidateId: dto.toCandidateId },
    });
    return { replaced: true };
  }

  /** Completing one more person on a job whose every stated place is already filled is refused. */
  async assertPlaceFree(organisationId: string, jobId: string, candidateId: string): Promise<void> {
    const places = await this.repository.placesLeftOf(organisationId, jobId, candidateId);
    if (places && places.filledByOthers >= places.needed) {
      throw new AppException(
        'JOB_PLACES_FULL',
        `All ${places.needed} places of this job are already filled`,
        HttpStatus.CONFLICT,
      );
    }
  }

  /** Cheap existence check (no relations loaded) for callers that ignore `getById`'s result; throws exactly what `getById` throws. */
  async assertExists(organisationId: string, id: string): Promise<void> {
    if (!(await this.repository.exists(organisationId, id))) {
      throw new ResourceNotFoundException('Job', id);
    }
  }

  /** The start point of a distance filter: a candidate's place (kept as numbers) or a typed street / city / post code. */
  private async startPoint(organisationId: string, query: ListJobsQueryDto) {
    const centre = query.nearCandidateId ? await this.repository.pointOfCandidate(organisationId, query.nearCandidateId) : await this.geocode.locate(query.nearLocation ?? '');
    if (!centre) {
      throw new AppException('LOCATION_NOT_FOUND', query.nearCandidateId ? 'This candidate has no address the map can find. Add a street, city, post code or location to the candidate.' : `"${query.nearLocation?.trim()}" was not found on the map. Try a street, a town or a post code.`, HttpStatus.BAD_REQUEST);
    }
    return centre;
  }

  /** The longest distance from the start point to a job of the list — the end of the distance slider (null with no start point). */
  async distanceRange(organisationId: string, query: ListJobsQueryDto) {
    if (!query.nearLocation?.trim() && !query.nearCandidateId) return { maxKm: null, unlocated: 0 };
    const [farthest, unlocated] = await Promise.all([
      this.repository.farthestKm(organisationId, await this.startPoint(organisationId, query), query.employmentGroup),
      this.repository.countUnlocated(organisationId),
    ]);
    return { maxKm: farthest, unlocated };
  }

  async create(organisationId: string, userId: string, dto: CreateJobDto) {
    this.assertTemporarySchedule(dto);
    this.assertExperienceRange(dto.experienceYearsMin, dto.experienceYearsMax);
    const { companyName, ...jobData } = dto;
    const companyId = await this.resolveCompanyId(organisationId, userId, dto.companyId, companyName);
    const duplicate = await this.repository.findDuplicate(organisationId, { title: jobData.title, companyId: companyId ?? null, employmentType: jobData.employmentType });
    if (duplicate) {
      throw new AppException('DUPLICATE_JOB', `This job is already in the system: "${duplicate.title}" is open with the same title and type${companyId ? ' for the same company' : ''}. It was not added again.`, HttpStatus.CONFLICT, { id: duplicate.id });
    }
    const job = await this.repository.create(organisationId, userId, { ...jobData, companyId });
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'CREATE_JOB',
      entityType: 'Job',
      entityId: job.id,
      newValues: dto,
    });
    return job;
  }

  async update(organisationId: string, userId: string, id: string, dto: UpdateJobDto) {
    const existing = await this.getById(organisationId, id);
    // a PATCH may carry only one end of the range — check it against the end already saved
    this.assertExperienceRange(
      dto.experienceYearsMin === undefined ? existing.experienceYearsMin : dto.experienceYearsMin,
      dto.experienceYearsMax === undefined ? existing.experienceYearsMax : dto.experienceYearsMax,
    );
    const { companyName, ...jobData } = dto;
    const companyId =
      dto.companyId || companyName
        ? await this.resolveCompanyId(organisationId, userId, dto.companyId, companyName)
        : undefined;
    const job = await this.repository.update(organisationId, id, { ...jobData, companyId });
    // another recruiter now runs this job: the notifications about the job, and about the people who chose it, go with it
    if (dto.ownerId && existing.ownerId && dto.ownerId !== existing.ownerId) {
      const candidateIds = await this.repository.candidateIdsOfJob(organisationId, id, existing.ownerId);
      await this.notifications.handOver(
        organisationId,
        existing.ownerId,
        dto.ownerId,
        [`/jobs/${id}`, ...candidateIds.map((candidateId) => `/candidates/${candidateId}`)],
        (dto.coRecruiterIds ?? []).filter((other) => !(existing.coRecruiterIds ?? []).includes(other)),
      );
    }
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'UPDATE_JOB',
      entityType: 'Job',
      entityId: id,
      oldValues: existing,
      newValues: dto,
    });
    return job;
  }

  /**
   * Publish / Unpublish / Close / Archive — the four buttons of a vacancy. The CRM stays the only place the text is
   * written: the website reads it live (GET /public/jobs), so these only decide WHETHER the vacancy is shown.
   * "Published" = status OPEN + switched on for the website + not past its expiry date.
   */
  async setPublication(organisationId: string, userId: string, id: string, action: 'PUBLISH' | 'UNPUBLISH' | 'CLOSE' | 'ARCHIVE') {
    const existing = await this.getById(organisationId, id);
    if (action === 'PUBLISH') {
      if (!existing.title?.trim() || existing.title === 'Untitled job') {
        throw new AppException('JOB_NOT_PUBLISHABLE', 'Give the job a title before publishing it.', HttpStatus.UNPROCESSABLE_ENTITY);
      }
      if (!existing.description?.trim()) {
        throw new AppException('JOB_NOT_PUBLISHABLE', 'Write the job description before publishing it.', HttpStatus.UNPROCESSABLE_ENTITY);
      }
      if (existing.expiresAt && existing.expiresAt <= new Date()) {
        throw new AppException('JOB_NOT_PUBLISHABLE', 'The expiry date has passed. Change or clear it before publishing.', HttpStatus.UNPROCESSABLE_ENTITY);
      }
    }
    const change =
      action === 'PUBLISH'
        ? { status: 'OPEN' as const, publishedOnWebsite: true }
        : action === 'UNPUBLISH'
          ? { publishedOnWebsite: false }
          : action === 'CLOSE'
            ? { status: 'CLOSED' as const, publishedOnWebsite: false }
            : { status: 'ARCHIVED' as const, publishedOnWebsite: false };
    const job = await this.repository.update(organisationId, id, change);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: action + '_JOB',
      entityType: 'Job',
      entityId: id,
      oldValues: { status: existing.status, publishedOnWebsite: existing.publishedOnWebsite },
      newValues: change,
    });
    return job;
  }

  async remove(organisationId: string, userId: string, id: string) {
    await this.assertExists(organisationId, id);
    await this.repository.softDelete(organisationId, id);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'DELETE_JOB',
      entityType: 'Job',
      entityId: id,
    });
  }

  /** A Temporary job is added with its schedule: dates, timezone, recurring type and the working days. */
  private assertTemporarySchedule(dto: CreateJobDto): void {
    if (dto.employmentType !== 'TEMPORARY') return;
    const schedule = (dto.schedule ?? {}) as { startDate?: string; endDate?: string; timezone?: string; recurringType?: string; workDays?: string[] };
    if (!schedule.startDate || !schedule.endDate || !schedule.timezone || !schedule.recurringType || !schedule.workDays?.length || schedule.endDate < schedule.startDate) {
      throw new AppException(
        'INVALID_TEMPORARY_SCHEDULE',
        'A temporary job needs a start date, an end date (not before the start), a timezone, a recurring type and its working days',
      );
    }
  }

  private assertExperienceRange(min: number | null | undefined, max: number | null | undefined): void {
    if (typeof min === 'number' && typeof max === 'number' && max < min) {
      throw new AppException(
        'INVALID_EXPERIENCE_RANGE',
        'experienceYearsMax must not be less than experienceYearsMin',
      );
    }
  }

  /**
   * `companyId` (an explicit pick from the Company dropdown) wins when both
   * are given; `companyName` falls back to CompaniesService.findOrCreateByName
   * (same resolution as Candidate.currentCompany — match by name or create a
   * new PROSPECT Company). Neither given is fine: the Job is created/updated
   * with no Company link, to be connected later once that's known.
   */
  private async resolveCompanyId(
    organisationId: string,
    userId: string,
    companyId: string | undefined,
    companyName: string | undefined,
  ): Promise<string | undefined> {
    if (companyId) {
      await this.companiesService.assertExists(organisationId, companyId);
      return companyId;
    }
    if (companyName?.trim()) {
      return (await this.companiesService.findOrCreateByName(organisationId, userId, companyName)).id;
    }
    return undefined;
  }
}
