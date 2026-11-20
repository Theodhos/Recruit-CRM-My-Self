import type { Prisma } from '@crm/database';
import { searchWords } from '../../../common/utils/search';
import { Injectable } from '@nestjs/common';

import { CacheService } from '../../../infrastructure/cache/cache.service';
import { DatabaseService } from '../../../infrastructure/database/database.service';
import { distanceKm } from '../../../common/utils/geo';
import { GeocodingService } from '../../../infrastructure/geocoding/geocoding.service';
import type { CreateJobDto } from '../dto/create-job.dto';
import type { ListJobsQueryDto } from '../dto/list-jobs-query.dto';
import type { UpdateJobDto } from '../dto/update-job.dto';

/** The "find candidates" dates arrive as YYYY-MM-DD; the database wants dates (null clears one). */
function recruitDates(dto: { recruitStartDate?: string | null; recruitEndDate?: string | null; expiresAt?: string | null; publishedOnWebsite?: boolean }, creating = false) {
  const toDate = (value: string | null | undefined) => (value === undefined ? undefined : value ? new Date(value) : null);
  return {
    ...(dto.recruitStartDate !== undefined ? { recruitStartDate: toDate(dto.recruitStartDate) } : {}),
    ...(dto.recruitEndDate !== undefined ? { recruitEndDate: toDate(dto.recruitEndDate) } : {}),
    ...(dto.expiresAt !== undefined ? { expiresAt: toDate(dto.expiresAt) } : {}),
    // the moment the job went onto the website — set here on create only; update() below decides for an existing
    // job, so saving an already published job does not move its "published" date
    ...(creating && dto.publishedOnWebsite === true ? { websitePublishedAt: new Date() } : {}),
  };
}

@Injectable()
export class JobsRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly cache: CacheService,
    private readonly geocoding: GeocodingService,
  ) {}

  /** One search box over every column of the Jobs table: title, company, location, type, experience, status, added by. */
  private searchClauses(raw: string) {
    const term = raw.trim();
    const like = { contains: term, mode: 'insensitive' as const };
    const label = term.toLowerCase().replace(/[_-]+/g, ' ');
    const matching = <T extends string>(values: readonly T[]) =>
      values.filter((value) => value.toLowerCase().replace(/_/g, ' ').includes(label));
    const types = matching(['PERMANENT', 'TEMPORARY'] as const);
    const statuses = matching(['DRAFT', 'OPEN', 'ON_HOLD', 'CLOSED', 'ARCHIVED'] as const);
    const years = /^[0-9]{1,2}$/.test(term) ? Number(term) : null;
    const [first, ...rest] = term.split(/[ ]+/);
    return [
      { title: like },
      { location: like },
      { city: like },
      { street: like },
      { postcode: like },
      { skills: like },
      { company: { name: like } },
      ...(types.length ? [{ employmentType: { in: types } }] : []),
      ...(statuses.length ? [{ status: { in: statuses } }] : []),
      ...(years !== null
        ? [
            {
              AND: [
                { OR: [{ experienceYearsMin: { not: null } }, { experienceYearsMax: { not: null } }] },
                { OR: [{ experienceYearsMin: null }, { experienceYearsMin: { lte: years } }] },
                { OR: [{ experienceYearsMax: null }, { experienceYearsMax: { gte: years } }] },
              ],
            },
          ]
        : []),
      { owner: { OR: [{ firstName: like }, { lastName: like }] } },
      ...(rest.length
        ? [{ owner: { firstName: { contains: first, mode: 'insensitive' as const }, lastName: { contains: rest.join(' '), mode: 'insensitive' as const } } }]
        : []),
    ];
  }

  /**
   * Per Permanent job: how many of its cards were moved out of the Interview stage by a decision — Approved (to Offer)
   * or Reject (to a Rejected stage) — counted once per card, however often it was moved. On hold never moves the card.
   */
  private async interviewDecisions(
    db: ReturnType<DatabaseService['forTenant']>,
    jobIds: string[],
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (jobIds.length === 0) return counts;
    const [stages, cards] = await Promise.all([
      db.pipelineStage.findMany({ select: { id: true, name: true, type: true } }),
      db.application.findMany({ where: { jobId: { in: jobIds } }, select: { id: true, jobId: true } }),
    ]);
    const interview = new Set(stages.filter((stage) => stage.type === 'STANDARD' && stage.name.trim().toLowerCase() === 'interview').map((stage) => stage.id));
    const leaving = new Set(
      stages.filter((stage) => stage.type === 'REJECTED' || (stage.type === 'STANDARD' && stage.name.trim().toLowerCase() === 'offer')).map((stage) => stage.id),
    );
    if (interview.size === 0 || cards.length === 0) return counts;
    const jobOf = new Map(cards.map((card) => [card.id, card.jobId]));
    const logs = await db.auditLog.findMany({
      where: { entityType: 'Application', action: 'UPDATE_APPLICATION', entityId: { in: cards.map((card) => card.id) } },
      select: { entityId: true, oldValues: true, newValues: true },
    });
    const stageOf = (values: unknown) =>
      values && typeof values === 'object' ? ((values as { pipelineStageId?: unknown }).pipelineStageId as string | undefined) : undefined;
    const decidedCards = new Set<string>();
    for (const log of logs) {
      const from = stageOf(log.oldValues);
      const to = stageOf(log.newValues);
      if (from && to && from !== to && interview.has(from) && leaving.has(to)) decidedCards.add(log.entityId);
    }
    for (const cardId of decidedCards) {
      const jobId = jobOf.get(cardId);
      if (jobId) counts.set(jobId, (counts.get(jobId) ?? 0) + 1);
    }
    return counts;
  }

  /**
   * Places filled per job: the people for whom the Completed button was pressed on Active Employees (Pipeline Jobs).
   * That press completes the placement and moves the card to the pipeline's Completed stage; either trace counts, and
   * a person is counted once. Terminated does not fill a place.
   */
  private async filledPlaces(
    db: ReturnType<DatabaseService['forTenant']>,
    jobIds: string[],
  ): Promise<Map<string, { count: number; lastAt: Date | null }>> {
    const [placements, cards] = await Promise.all([
      db.placement.findMany({
        where: { jobId: { in: jobIds }, status: { in: ['ACTIVE', 'COMPLETED'] } },
        select: { jobId: true, candidateId: true, endDate: true, updatedAt: true },
      }),
      db.application.findMany({
        where: {
          deletedAt: null,
          jobId: { in: jobIds },
          pipelineStage: { type: 'STANDARD', name: { equals: 'Completed', mode: 'insensitive' } },
        },
        select: { jobId: true, candidateId: true, updatedAt: true },
      }),
    ]);
    const people = new Map<string, { ids: Set<string>; lastAt: Date | null }>();
    for (const row of [...placements, ...cards]) {
      if (!row.jobId) continue;
      const entry = people.get(row.jobId) ?? { ids: new Set<string>(), lastAt: null };
      entry.ids.add(row.candidateId);
      // when the last place was filled: the contract's end date, or the moment its card reached Completed
      const at = new Date((('endDate' in row ? row.endDate : null) ?? row.updatedAt) as string | Date);
      if (!entry.lastAt || at > entry.lastAt) entry.lastAt = at;
      people.set(row.jobId, entry);
    }
    return new Map([...people].map(([jobId, entry]) => [jobId, { count: entry.ids.size, lastAt: entry.lastAt }]));
  }

  /**
   * Everything that happened to the people on the job, newest first: when each joined, completed or was terminated
   * (their contract), and who was replaced or taken off (the job's audit trail).
   */
  async candidateHistory(organisationId: string, jobId: string) {
    const db = this.db.forTenant(organisationId);
    const [placements, logs] = await Promise.all([
      db.placement.findMany({
        where: { jobId },
        select: { startDate: true, endDate: true, status: true, updatedAt: true, candidate: { select: { id: true, firstName: true, lastName: true } } },
      }),
      db.auditLog.findMany({
        where: { entityType: 'Job', entityId: jobId, action: { in: ['REPLACE_JOB_CANDIDATE', 'RELEASE_JOB_PLACES'] } },
        select: { action: true, oldValues: true, newValues: true, createdAt: true, user: { select: { firstName: true, lastName: true } } },
      }),
    ]);
    const idOf = (values: unknown) => (values && typeof values === 'object' ? ((values as { candidateId?: string }).candidateId ?? null) : null);
    const idsOf = (values: unknown) => (values && typeof values === 'object' && Array.isArray((values as { candidateIds?: unknown }).candidateIds) ? ((values as { candidateIds: string[] }).candidateIds) : []);
    const wanted = new Set<string>();
    for (const log of logs) {
      if (log.action === 'REPLACE_JOB_CANDIDATE') {
        for (const id of [idOf(log.oldValues), idOf(log.newValues)]) if (id) wanted.add(id);
      } else for (const id of idsOf(log.newValues)) wanted.add(id);
    }
    const people = await db.candidate.findMany({ where: { id: { in: [...wanted] } }, select: { id: true, firstName: true, lastName: true } });
    const nameOf = new Map(people.map((person) => [person.id, `${person.firstName} ${person.lastName}`.trim()]));
    const events: { at: Date; candidate: string; event: string; by: string | null }[] = [];
    for (const placement of placements) {
      const name = `${placement.candidate.firstName} ${placement.candidate.lastName}`.trim();
      events.push({ at: placement.startDate, candidate: name, event: 'Joined the job', by: null });
      if (placement.status === 'COMPLETED') events.push({ at: placement.endDate ?? placement.updatedAt, candidate: name, event: 'Contract completed', by: null });
      if (placement.status === 'CANCELLED') events.push({ at: placement.updatedAt, candidate: name, event: 'Contract terminated', by: null });
    }
    for (const log of logs) {
      const by = log.user ? `${log.user.firstName} ${log.user.lastName}`.trim() : null;
      if (log.action === 'REPLACE_JOB_CANDIDATE') {
        events.push({ at: log.createdAt, candidate: nameOf.get(idOf(log.oldValues) ?? '') ?? 'A candidate', event: `Replaced by ${nameOf.get(idOf(log.newValues) ?? '') ?? 'another candidate'}`, by });
      } else {
        for (const id of idsOf(log.newValues)) events.push({ at: log.createdAt, candidate: nameOf.get(id) ?? 'A candidate', event: 'Taken off the job (place freed)', by });
      }
    }
    return events.sort((a, b) => b.at.getTime() - a.at.getTime());
  }

  candidateExists(organisationId: string, candidateId: string) {
    return this.db.forTenant(organisationId).candidate.count({ where: { id: candidateId, deletedAt: null } }).then((count) => count > 0);
  }

  /** The people who fill the job's places, the one who filled it last at the end. */
  async fillersOf(organisationId: string, jobId: string): Promise<{ candidateId: string; name: string; at: Date }[]> {
    const db = this.db.forTenant(organisationId);
    const [placements, cards] = await Promise.all([
      db.placement.findMany({
        where: { jobId, status: { in: ['ACTIVE', 'COMPLETED'] } },
        select: { candidateId: true, createdAt: true, candidate: { select: { firstName: true, lastName: true } } },
      }),
      db.application.findMany({
        where: { deletedAt: null, jobId, pipelineStage: { type: 'STANDARD', name: { equals: 'Completed', mode: 'insensitive' } } },
        select: { candidateId: true, updatedAt: true, candidate: { select: { firstName: true, lastName: true } } },
      }),
    ]);
    const byCandidate = new Map<string, { candidateId: string; name: string; at: Date }>();
    for (const row of [...placements, ...cards]) {
      const at = 'createdAt' in row ? row.createdAt : row.updatedAt;
      const known = byCandidate.get(row.candidateId);
      if (!known || at < known.at) byCandidate.set(row.candidateId, { candidateId: row.candidateId, name: `${row.candidate.firstName} ${row.candidate.lastName}`.trim(), at });
    }
    return [...byCandidate.values()].sort((a, b) => a.at.getTime() - b.at.getTime());
  }

  /**
   * Puts `toId` in the place of `fromId` on the job and keeps everything the place carries: the contract (status, dates,
   * company, type, owner), the card on the pipeline (same stage and status) and the shift the person works. The person
   * who leaves loses the contract and the card. Returns null when `fromId` does not fill the job.
   */
  async replaceCandidate(organisationId: string, jobId: string, fromId: string, toId: string) {
    const db = this.db.forTenant(organisationId);
    const [placement, card, job] = await Promise.all([
      db.placement.findFirst({ where: { jobId, candidateId: fromId, status: { in: ['ACTIVE', 'COMPLETED'] } } }),
      db.application.findFirst({ where: { jobId, candidateId: fromId, deletedAt: null } }),
      db.job.findFirst({ where: { id: jobId, deletedAt: null }, select: { schedule: true } }),
    ]);
    if (!placement && !card) return null;

    // the newcomer: contract first (so the place is never empty), then the card
    if (placement) {
      const mine = await db.placement.findFirst({ where: { jobId, candidateId: toId } });
      const data = {
        companyId: placement.companyId,
        startDate: placement.startDate,
        endDate: placement.endDate,
        status: placement.status,
        employmentType: placement.employmentType,
        ownerId: placement.ownerId,
      };
      if (mine) await db.placement.update({ where: { id: mine.id }, data });
      else await db.placement.create({ data: { ...data, organisationId, candidateId: toId, jobId } });
    }
    if (card) {
      const mineCard = await db.application.findFirst({ where: { jobId, candidateId: toId } });
      const data = { pipelineId: card.pipelineId, pipelineStageId: card.pipelineStageId, status: card.status, ownerId: card.ownerId, deletedAt: null };
      if (mineCard) await db.application.update({ where: { id: mineCard.id }, data });
      else await db.application.create({ data: { ...data, organisationId, candidateId: toId, jobId, source: 'OTHER' } });
    }

    // the one who leaves
    await db.placement.deleteMany({ where: { jobId, candidateId: fromId } });
    await db.application.updateMany({ where: { jobId, candidateId: fromId, deletedAt: null }, data: { deletedAt: new Date() } });

    // the newcomer works the same shift
    const schedule = (job?.schedule ?? null) as { assignments?: Record<string, number> } | null;
    if (schedule?.assignments && schedule.assignments[fromId] !== undefined) {
      const { [fromId]: shift, ...rest } = schedule.assignments;
      await db.job.update({ where: { id: jobId }, data: { schedule: { ...schedule, assignments: { ...rest, [toId]: shift } } } });
    }
    return { placementId: placement?.id ?? null };
  }

  /** Takes these candidates off the job: their contracts are deleted and their cards leave its pipeline. */
  async releaseCandidates(organisationId: string, jobId: string, candidateIds: string[]) {
    const db = this.db.forTenant(organisationId);
    await db.placement.deleteMany({ where: { jobId, candidateId: { in: candidateIds } } });
    await db.application.updateMany({ where: { jobId, candidateId: { in: candidateIds }, deletedAt: null }, data: { deletedAt: new Date() } });
  }

  /** How many places the job states and how many are filled by people other than `exceptCandidateId`. Null when the job states no number. */
  async placesLeftOf(organisationId: string, jobId: string, exceptCandidateId: string): Promise<{ needed: number; filledByOthers: number } | null> {
    const db = this.db.forTenant(organisationId);
    const job = await db.job.findFirst({ where: { id: jobId, deletedAt: null }, select: { candidatesNeeded: true } });
    if (!job || job.candidatesNeeded === null) return null;
    const [placements, cards] = await Promise.all([
      db.placement.findMany({ where: { jobId, status: { in: ['ACTIVE', 'COMPLETED'] }, candidateId: { not: exceptCandidateId } }, select: { candidateId: true } }),
      db.application.findMany({
        where: { deletedAt: null, jobId, candidateId: { not: exceptCandidateId }, pipelineStage: { type: 'STANDARD', name: { equals: 'Completed', mode: 'insensitive' } } },
        select: { candidateId: true },
      }),
    ]);
    const others = new Set([...placements, ...cards].map((row) => row.candidateId));
    return { needed: job.candidatesNeeded, filledByOthers: others.size };
  }

  /**
   * The jobs whose every place is filled: they state how many candidates they need and that many people have had
   * their contract Completed for them. They live on Completed Jobs, not on Jobs.
   */
  fullJobIdsOf(organisationId: string): Promise<string[]> {
    return this.fullJobIds(this.db.forTenant(organisationId));
  }

  private async fullJobIds(db: ReturnType<DatabaseService['forTenant']>): Promise<string[]> {
    // a job is complete when every place it states is filled (Candidates needed, e.g. 4/4) — Permanent and Temporary alike
    const wanting = await db.job.findMany({
      where: { deletedAt: null, candidatesNeeded: { not: null } },
      select: { id: true, candidatesNeeded: true },
    });
    if (wanting.length === 0) return [];
    const filled = await this.filledPlaces(db, wanting.map((job) => job.id));
    return wanting.filter((job) => (filled.get(job.id)?.count ?? 0) >= (job.candidatesNeeded ?? Infinity)).map((job) => job.id);
  }

  /** The people who chose this job or applied to it, except those that `exceptOwnerId` owns himself — whose notifications are about their own candidate, not the job. */
  async candidateIdsOfJob(organisationId: string, jobId: string, exceptOwnerId: string): Promise<string[]> {
    const rows = await this.db.forTenant(organisationId).candidate.findMany({
      where: { deletedAt: null, ownerId: { not: exceptOwnerId }, OR: [{ interestedJobId: jobId }, { applications: { some: { jobId, deletedAt: null } } }] },
      select: { id: true },
      take: 500,
    });
    return rows.map((row) => row.id);
  }

  /** Ids of the jobs whose place is within `radiusKm` of the point (straight line). Jobs not yet looked up on the map are not in it. */
  async idsWithin(organisationId: string, centre: { lat: number; lon: number }, radiusKm: number): Promise<string[]> {
    const rows = await this.db.client.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "jobs"
      WHERE "organisationId" = ${organisationId} AND "deletedAt" IS NULL AND "latitude" IS NOT NULL AND "longitude" IS NOT NULL
        AND 6371 * acos(LEAST(1, GREATEST(-1,
          cos(radians(${centre.lat})) * cos(radians("latitude")) * cos(radians("longitude") - radians(${centre.lon}))
          + sin(radians(${centre.lat})) * sin(radians("latitude"))))) <= ${radiusKm}`;
    return rows.map((row) => row.id);
  }

  /** How many jobs are not on the map (no address, or one the map could not find): a distance search cannot include them. */
  countUnlocated(organisationId: string): Promise<number> {
    return this.db.forTenant(organisationId).job.count({ where: { deletedAt: null, OR: [{ latitude: null }, { longitude: null }] } });
  }

  /** How far the farthest job in the list is from the point (km), or null when no job is on the map. */
  async farthestKm(organisationId: string, centre: { lat: number; lon: number }, employmentGroup?: 'PERMANENT' | 'TEMPORARY'): Promise<number | null> {
    const rows = await this.db.forTenant(organisationId).job.findMany({
      where: {
        deletedAt: null,
        latitude: { not: null },
        longitude: { not: null },
        ...(employmentGroup ? { employmentType: employmentGroup === 'PERMANENT' ? ('PERMANENT' as const) : { not: 'PERMANENT' as const } } : {}),
      },
      select: { latitude: true, longitude: true },
    });
    let farthest: number | null = null;
    for (const row of rows) {
      const km = distanceKm(centre, { lat: row.latitude as number, lon: row.longitude as number });
      if (farthest === null || km > farthest) farthest = km;
    }
    return farthest;
  }

  /** Where a candidate is on the map (null when not looked up yet or not found). */
  async pointOfCandidate(organisationId: string, candidateId: string): Promise<{ lat: number; lon: number } | null> {
    const row = await this.db.forTenant(organisationId).candidate.findFirst({ where: { id: candidateId, deletedAt: null }, select: { latitude: true, longitude: true, location: true, city: true, street: true, postalCode: true } });
    if (!row) return null;
    if (row.latitude != null && row.longitude != null) return { lat: row.latitude, lon: row.longitude };
    // not on the map yet: put it there now instead of making the user wait for the background sweep
    const point = await this.geocoding.locateAddress({ street: row.street, city: row.city, postcode: row.postalCode, location: row.location });
    if (point) await this.db.client.candidate.update({ where: { id: candidateId }, data: { latitude: point.lat, longitude: point.lon, geocodedAt: new Date() } });
    return point ?? null;
  }

  /** Jobs with a place written but not yet looked up on the map (new, edited, or from before this existed). */
  findUngeocoded(take: number) {
    return this.db.client.job.findMany({
      where: { deletedAt: null, geocodedAt: null, OR: [{ location: { not: null } }, { city: { not: null } }, { street: { not: null } }, { postcode: { not: null } }] },
      select: { id: true, location: true, city: true, street: true, postcode: true },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  saveGeocode(id: string, point: { lat: number; lon: number } | null) {
    return this.db.client.job.update({ where: { id }, data: { latitude: point?.lat ?? null, longitude: point?.lon ?? null, geocodedAt: new Date() } });
  }

  async findMany(organisationId: string, query: ListJobsQueryDto, nearIds?: string[]) {
    const db = this.db.forTenant(organisationId);
    const fullIds = query.completion ? await this.fullJobIds(db) : [];
    // every filter narrows the list, and the ones that need an OR of their own are collected in `and`, so none of them
    // can replace another (owner + search, status + availability, experience + search all hold together)
    const and: Prisma.JobWhereInput[] = [];
    if (query.status) and.push({ status: query.status });
    if (query.availability) and.push({ status: ({ AVAILABLE: 'OPEN', NOT_AVAILABLE: 'ON_HOLD', DO_NOT_USE: 'CLOSED' } as const)[query.availability] });
    if (query.ownerId) and.push({ OR: [{ ownerId: query.ownerId }, { coRecruiterIds: { has: query.ownerId } }] });
    if (query.location?.trim()) {
      const place = { contains: query.location.trim(), mode: 'insensitive' as const };
      and.push({ OR: [{ location: place }, { city: place }, { street: place }, { postcode: place }] });
    }
    if (query.experience !== undefined) {
      // the job states a range (at least one end) and the entered years fall inside it
      and.push(
        { OR: [{ experienceYearsMin: { not: null } }, { experienceYearsMax: { not: null } }] },
        { OR: [{ experienceYearsMin: null }, { experienceYearsMin: { lte: query.experience } }] },
        { OR: [{ experienceYearsMax: null }, { experienceYearsMax: { gte: query.experience } }] },
      );
    }
    // every word typed must match somewhere in the row
    for (const word of searchWords(query.search)) and.push({ OR: this.searchClauses(word) });
    const baseWhere = {
      deletedAt: null,
      ...(query.completion === 'COMPLETED' ? { id: { in: fullIds } } : {}),
      ...(query.completion === 'OPEN' && fullIds.length > 0 ? { id: { notIn: fullIds } } : {}),
      ...(query.employmentGroup
        ? { employmentType: query.employmentGroup === 'PERMANENT' ? ('PERMANENT' as const) : { not: 'PERMANENT' as const } }
        : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.title ? { title: { contains: query.title, mode: 'insensitive' as const } } : {}),
      ...(query.company ? { company: { name: { contains: query.company, mode: 'insensitive' as const } } } : {}),
      ...(and.length ? { AND: and } : {}),
    };
    // "within x km": only the jobs the distance search found
    const where = nearIds ? { AND: [baseWhere, { id: { in: nearIds } }] } : baseWhere;

    // A job whose "find candidates by" date has arrived or is within the next two weeks (and is still open) goes to the top of
    // the list, the earliest date first; the rest follow newest first. The two groups are read one after the other so paging stays right across them.
    const include = {
      company: { select: { id: true, name: true } },
      // the table's CV Sent / Interview / Placement columns: people sent for the job, those who got an interview, those placed
      _count: {
        select: {
          applications: { where: { deletedAt: null } },
          placements: true,
        },
      },
    };
    const soon = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const due = { status: 'OPEN' as const, recruitEndDate: { lte: soon } };
    const rest = { OR: [{ status: { not: 'OPEN' as const } }, { recruitEndDate: null }, { recruitEndDate: { gt: soon } }] };
    const skip = (query.page - 1) * query.pageSize;
    const dueCount = await db.job.count({ where: { AND: [where, due] } });
    const dueItems =
      skip < dueCount
        ? await db.job.findMany({ where: { AND: [where, due] }, skip, take: query.pageSize, orderBy: { recruitEndDate: 'asc' }, include })
        : [];
    const restItems =
      dueItems.length < query.pageSize
        ? await db.job.findMany({ where: { AND: [where, rest] }, skip: Math.max(0, skip - dueCount), take: query.pageSize - dueItems.length, orderBy: { createdAt: 'desc' }, include })
        : [];
    const items = [...dueItems, ...restItems];
    const totalItems = await this.cache.cachedCount(organisationId, 'jobs', where, () => db.job.count({ where }));

    // people who got at least one interview, per job of this page
    const interviewed = await db.application.findMany({
      where: { deletedAt: null, jobId: { in: items.map((job) => job.id) }, interviews: { some: {} } },
      select: { jobId: true },
    });
    const interviews = new Map<string, number>();
    for (const { jobId } of interviewed) if (jobId) interviews.set(jobId, (interviews.get(jobId) ?? 0) + 1);

    // Permanent jobs: the Interview column counts the people on whom a decision was taken at the Interview stage — one for
    // each press of Approved (on to Offer) or Reject (to Rejected); On hold keeps the card at Interview and counts nothing.
    // Read from the audit trail of the cards, so the people who were decided before this column existed are counted too.
    const decided = await this.interviewDecisions(
      db,
      items.filter((job) => job.employmentType === 'PERMANENT').map((job) => job.id),
    );

    // places filled (the "3" of 3/5 in Candidates needed): contracts Completed from Active Employees
    const filled = await this.filledPlaces(db, items.map((job) => job.id));

    return {
      items: items.map((job) => ({
        ...job,
        _count: { ...job._count, interviews: job.employmentType === 'PERMANENT' ? (decided.get(job.id) ?? 0) : (interviews.get(job.id) ?? 0), filled: Math.min(filled.get(job.id)?.count ?? 0, job.candidatesNeeded ?? Infinity) },
        completedOn: filled.get(job.id)?.lastAt ?? null,
      })),
      totalItems,
    };
  }

  async findById(organisationId: string, id: string) {
    const db = this.db.forTenant(organisationId);
    const job = await db.job.findFirst({
      where: { id, deletedAt: null },
      include: {
        company: { select: { id: true, name: true, industry: true, website: true, email: true, phone: true, city: true, country: true, status: true } },
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { applications: true, placements: true, interestedCandidates: true, documents: true } },
      },
    });
    if (!job) return job;
    // the places filled so far — same count the Jobs lists show, so a job opened on its own knows it is complete
    const filled = await this.filledPlaces(db, [job.id]);
    return { ...job, _count: { ...job._count, filled: Math.min(filled.get(job.id)?.count ?? 0, job.candidatesNeeded ?? Infinity) } };
  }

  /** Existence check with the same tenant and soft-delete filter as `findById`, without loading any relations. */
  exists(organisationId: string, id: string) {
    return this.db
      .forTenant(organisationId)
      .job.count({ where: { id, deletedAt: null } })
      .then((count) => count > 0);
  }

  /**
   * An open job with the same title and of the same type — null when there is none. With a company chosen it has to be
   * that company's; with no company ("link later") any open job of that title counts, so the same job cannot be added
   * again just by leaving the company out. Closed and archived jobs may be posted again.
   */
  findDuplicate(organisationId: string, input: { title?: string; companyId?: string | null; employmentType?: string }) {
    const title = input.title?.trim();
    if (!title) return Promise.resolve(null);
    return this.db.forTenant(organisationId).job.findFirst({
      where: {
        deletedAt: null,
        status: { notIn: ['CLOSED', 'ARCHIVED'] },
        title: { equals: title, mode: 'insensitive' },
        ...(input.companyId ? { companyId: input.companyId } : {}),
        ...(input.employmentType ? { employmentType: input.employmentType as never } : {}),
      },
      select: { id: true, title: true },
    });
  }

  create(organisationId: string, ownerId: string, dto: Omit<CreateJobDto, 'companyName'>) {
    return this.db.forTenant(organisationId).job.create({
      data: { ...dto, ...recruitDates(dto, true), title: dto.title ?? 'Untitled job', organisationId, ownerId: dto.ownerId ?? ownerId },
    });
  }

  /** Permanent or Temporary is the job's: its placements (Active Employees, fees) always carry the job's type. */
  async update(organisationId: string, id: string, dto: Omit<UpdateJobDto, 'companyName'>) {
    const db = this.db.forTenant(organisationId);
    const before = await db.job.findFirst({ where: { id }, select: { publishedOnWebsite: true, closedAt: true } });
    const wasPublished = before?.publishedOnWebsite ?? false;
    const job = await db.job.update({
      where: { id },
      data: {
        ...dto,
        ...recruitDates(dto),
        // a new place has to be looked up on the map again
        ...(dto.location !== undefined || dto.city !== undefined || dto.street !== undefined || dto.postcode !== undefined ? { latitude: null, longitude: null, geocodedAt: null } : {}),
        // set when the job goes onto the website, cleared when it leaves — never on a plain save
        ...(dto.publishedOnWebsite === true && !wasPublished ? { websitePublishedAt: new Date() } : {}),
        ...(dto.publishedOnWebsite === false ? { websitePublishedAt: null } : {}),
        // a closed / archived vacancy records when it closed; re-opening clears it
        ...(dto.status === 'CLOSED' || dto.status === 'ARCHIVED' ? { closedAt: before?.closedAt ?? new Date() } : dto.status ? { closedAt: null } : {}),
      },
    });
    if (dto.employmentType) {
      await db.placement.updateMany({ where: { jobId: id, NOT: { employmentType: dto.employmentType } }, data: { employmentType: dto.employmentType } });
    }
    return job;
  }

  /** The job, and the cards of the people who applied to it with it. */
  softDelete(organisationId: string, id: string) {
    const db = this.db.forTenant(organisationId);
    const deletedAt = new Date();
    return db.$transaction([
      db.application.updateMany({ where: { jobId: id, deletedAt: null }, data: { deletedAt } }),
      db.job.update({ where: { id }, data: { deletedAt, closedAt: deletedAt, status: 'CLOSED' } }),
    ]);
  }
}
