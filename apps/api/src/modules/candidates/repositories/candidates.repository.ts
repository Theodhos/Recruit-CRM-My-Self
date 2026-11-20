import { phoneDigits, searchWords } from '../../../common/utils/search';
import type { ApplicationStatus, Prisma } from '@crm/database';
import { HttpStatus, Injectable } from '@nestjs/common';

import { AppException } from '../../../common/exceptions/app.exception';
import { normalizeCandidatePhone } from '../../../common/utils/phone';
import { CacheService } from '../../../infrastructure/cache/cache.service';
import { DatabaseService } from '../../../infrastructure/database/database.service';
import { GeocodingService } from '../../../infrastructure/geocoding/geocoding.service';
import type { CreateCandidateDto } from '../dto/create-candidate.dto';
import type { ListCandidatesQueryDto, ReviewStatus } from '../dto/list-candidates-query.dto';
import type { UpdateCandidateDto } from '../dto/update-candidate.dto';
import { EXPORT_SELECT } from '../lib/export-fields';
import { parseList } from '../lib/list-values';

/**
 * Fields that need more than a straight copy: a date typed as 2026-11-05 becomes a real date (null clears it), and
 * changing any consent stamps when it happened.
 */
function writtenFields(dto: { lastContactedAt?: string | null; smsConsent?: string; emailConsent?: string; callConsent?: string }) {
  return {
    ...(dto.lastContactedAt !== undefined ? { lastContactedAt: dto.lastContactedAt ? new Date(dto.lastContactedAt) : null } : {}),
    ...(dto.smsConsent || dto.emailConsent || dto.callConsent ? { consentUpdatedAt: new Date() } : {}),
  };
}

/** A date typed as 2026-11-05 means the whole day. */
const endOfDay = (value: string) => new Date(new Date(value).getTime() + 24 * 60 * 60 * 1000 - 1);

/** Application statuses that mean "still in play" (or hired). Anything else is a closed door. */
const LIVE_APPLICATION = { in: ['ACTIVE', 'ON_HOLD', 'PLACED'] as ApplicationStatus[] };
/**
 * Just enough of each application to derive the review status (PENDING / ACTIVE / REJECTED) and the "where are they
 * now" pipeline stage that the Candidates table shows — the raw rows never leave the service.
 */
const APPLICATION_SUMMARY = {
  where: { deletedAt: null },
  select: {
    id: true,
    status: true,
    jobId: true,
    pipelineId: true,
    updatedAt: true,
    job: { select: { title: true } },
    pipelineStage: { select: { name: true, type: true, order: true } },
    // the mark Terminated leaves on the Rejected stage (reason = Terminated): what "Do not use" is read from
    stageNotes: { where: { fields: { path: ['reason'], equals: 'Terminated' } }, select: { id: true }, take: 1 },
  },
} as const;
const REVIEW_STATUS_WHERE: Record<ReviewStatus, Prisma.CandidateWhereInput> = {
  PENDING: { applications: { none: { deletedAt: null } } },
  ACTIVE: { applications: { some: { deletedAt: null, status: LIVE_APPLICATION } } },
  REJECTED: {
    AND: [{ applications: { some: { deletedAt: null } } }, { applications: { none: { deletedAt: null, status: LIVE_APPLICATION } } }],
  },
  REAPPLIED: {
    AND: [
      { applications: { some: { deletedAt: null, status: { in: ['REJECTED', 'WITHDRAWN'] as ApplicationStatus[] } } } },
      { applications: { some: { deletedAt: null, status: LIVE_APPLICATION } } },
    ],
  },
  // the pool the suggestion matcher works on: anyone turned down at least once (the service narrows it to those
  // with a similar open job)
  SUGGESTED: { applications: { some: { deletedAt: null, status: { in: ['REJECTED', 'WITHDRAWN'] as ApplicationStatus[] } } } },
};

// Available = can still be put forward: active or passive, and not already placed in a job. Everyone else is not available.
const PLACED_APPLICATION = { applications: { some: { deletedAt: null, status: 'PLACED' as ApplicationStatus } } };
// On hold = in progress at an Interview stage of Pipeline Jobs (the Status column says "On hold" there)
const INTERVIEW_APPLICATION = { applications: { some: { deletedAt: null, status: LIVE_APPLICATION, pipelineStage: { name: { contains: 'interview', mode: 'insensitive' as const } } } } };
const AVAILABILITY_WHERE: Record<'AVAILABLE' | 'ON_HOLD' | 'NOT_AVAILABLE' | 'DO_NOT_USE', Prisma.CandidateWhereInput> = {
  // a status chosen by hand (manualStatus) wins over what the pipeline and the old status say
  AVAILABLE: { OR: [{ manualStatus: 'AVAILABLE' }, { manualStatus: null, status: { in: ['ACTIVE', 'PASSIVE'] }, NOT: [PLACED_APPLICATION, INTERVIEW_APPLICATION] }] },
  ON_HOLD: { OR: [{ manualStatus: 'ON_HOLD' }, { manualStatus: null, status: { in: ['ACTIVE', 'PASSIVE'] }, NOT: PLACED_APPLICATION, ...INTERVIEW_APPLICATION }] },
  NOT_AVAILABLE: {
    OR: [{ manualStatus: 'NOT_AVAILABLE' }, { manualStatus: null, status: { not: 'DO_NOT_CONTACT' }, OR: [{ status: { in: ['PLACED', 'ARCHIVED'] } }, PLACED_APPLICATION] }],
  },
  DO_NOT_USE: { OR: [{ manualStatus: 'DO_NOT_USE' }, { manualStatus: null, status: 'DO_NOT_CONTACT' }] },
};

/**
 * Tenant-scoped data access for 'candidates'. Always resolve the client via
 * `this.db.forTenant(organisationId)` (packages/database scopedPrisma) —
 * never query the raw PrismaClient for tenant-scoped models. See
 * docs/architecture/multi-tenancy.md.
 */
@Injectable()
export class CandidatesRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly cache: CacheService,
    private readonly geocoding: GeocodingService,
  ) {}

  /** Shared list filter — `findMany` (page + total) and `findPage` (page only) must never diverge on it. */
  private listWhere(query: ListCandidatesQueryDto) {
    const terms = searchWords(query.search);
    const and: Prisma.CandidateWhereInput[] = [
      ...(query.reviewStatus ? [REVIEW_STATUS_WHERE[query.reviewStatus]] : []),
      ...(query.availability ? [AVAILABILITY_WHERE[query.availability]] : []),
      ...terms.map((term) => this.termMatch(term)),
      ...this.columnFilters(query),
    ];
    return {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      ...(query.recruitmentStage ? { recruitmentStage: query.recruitmentStage } : {}),
      ...(query.interestedJobId ? { interestedJobId: query.interestedJobId } : {}),
      ...(query.unassigned ? { applications: { none: {} } } : {}),
      ...(query.hasApplications ? { applications: { some: {} } } : {}),
      // every word typed must match somewhere, so "ana kelmendi" finds the full name and "developer london" a job title + place;
      // the status filter moves inside the AND because some of its entries use `AND` themselves
      ...(and.length ? { AND: and } : {}),
    };
  }

  /** The per-column filters above the table (name, location, number, job title); each one narrows the list. */
  private columnFilters(query: ListCandidatesQueryDto): Prisma.CandidateWhereInput[] {
    const contains = (value: string) => ({ contains: value.trim(), mode: 'insensitive' as const });
    const filters: Prisma.CandidateWhereInput[] = [];
    for (const word of query.name?.trim().split(/\s+/).filter(Boolean) ?? []) {
      filters.push({ OR: [{ firstName: contains(word) }, { lastName: contains(word) }] });
    }
    // the Location box finds the town, the street, the post code or what is written in Location
    if (query.location?.trim()) filters.push({ OR: [{ location: contains(query.location) }, { city: contains(query.location) }, { street: contains(query.location) }, { postalCode: contains(query.location) }] });
    if (query.phone?.trim()) filters.push({ phone: contains(query.phone) });
    if (query.jobTitle?.trim()) filters.push({ jobTitle: contains(query.jobTitle) });
    // the post code column, or — for people typed in as one address line — the location text
    if (query.postcode?.trim()) filters.push({ OR: [{ postalCode: { startsWith: query.postcode.trim(), mode: 'insensitive' } }, { location: contains(query.postcode) }] });
    if (query.trade?.trim()) filters.push({ trade: contains(query.trade) });
    if (query.grade) filters.push({ grade: { in: query.grade.split(',') as ('A' | 'B' | 'C')[] } });
    if (query.employmentStatus) filters.push({ employmentStatus: query.employmentStatus });
    if (query.experienceMin !== undefined) filters.push({ experienceYears: { gte: query.experienceMin } });
    for (const word of query.experience?.trim().split(/\s+/).filter(Boolean) ?? []) {
      filters.push({ OR: [{ experienceNotes: contains(word) }, { jobTitle: contains(word) }, { trade: contains(word) }] });
    }
    // "has all of these": skills and qualifications are stored lower-case, one by one
    const skills = parseList(query.skills);
    if (skills?.length) filters.push({ skills: { hasEvery: skills } });
    const qualifications = parseList(query.qualifications);
    if (qualifications?.length) filters.push({ qualifications: { hasEvery: qualifications } });
    if (query.contactedFrom) filters.push({ lastContactedAt: { gte: new Date(query.contactedFrom) } });
    if (query.contactedTo) filters.push({ lastContactedAt: { lte: endOfDay(query.contactedTo) } });
    // never contacted counts as "not contacted since"
    if (query.notContactedSince) filters.push({ OR: [{ lastContactedAt: null }, { lastContactedAt: { lt: new Date(query.notContactedSince) } }] });
    return filters;
  }

  /** One search word against name, job title, trade, location, post code, source (where they came from) and the rest of the row. */
  private termMatch(term: string) {
    const contains = { contains: term, mode: 'insensitive' as const };
    // a typed number also finds the stored international form: 07700 900123 -> +447700900123
    const phone = phoneDigits(term);
    return {
      OR: [
        { firstName: contains },
        { lastName: contains },
        { email: contains },
        { phone: contains },
        { jobTitle: contains },
        { trade: contains },
        { currentCompany: contains },
        { location: contains },
        { city: contains },
        { street: contains },
        { postalCode: contains },
        { source: contains },
        { skills: { has: term.toLowerCase() } },
        { owner: { OR: [{ firstName: contains }, { lastName: contains }] } },
        { company: { name: contains } },
        ...(phone ? [{ normalizedPhone: { contains: phone } }] : []),
        // the "Interested in" column: the job they are after, and that job's company
        { interestedJob: { title: contains } },
        { interestedJob: { company: { name: contains } } },
      ],
    };
  }

  /**
   * Who came in through the public website form. The website intake writes one WEBSITE_APPLICATION audit entry when
   * it CREATES a candidate, so this is exact — unlike the free-text "Source", which anyone can set to "Web" by hand.
   */
  private async websiteCandidateIds(organisationId: string, among?: string[]): Promise<Set<string>> {
    const rows = await this.db.forTenant(organisationId).auditLog.findMany({
      where: { action: 'WEBSITE_APPLICATION', entityType: 'Candidate', ...(among ? { entityId: { in: among } } : {}) },
      select: { entityId: true },
      distinct: ['entityId'],
      take: 50_000,
    });
    return new Set(rows.map((row) => row.entityId));
  }

  /** The list filter, plus the Website / Manual choice (which needs the ids of the website candidates). */
  private async whereFor(organisationId: string, query: ListCandidatesQueryDto) {
    const where = this.listWhere(query);
    const extra: Prisma.CandidateWhereInput[] = [];
    if (query.origin) {
      const ids = [...(await this.websiteCandidateIds(organisationId))];
      extra.push(query.origin === 'WEBSITE' ? { id: { in: ids } } : { id: { notIn: ids } });
    }
    // "within x km" of a job's place or of a typed street / city / post code
    if ((query.nearJobId || query.nearLocation?.trim()) && query.radiusKm) {
      const centre = await this.startPoint(organisationId, query);
      extra.push({ id: { in: await this.idsWithin(organisationId, centre, query.radiusKm) } });
    }
    if (!extra.length) return where;
    return { ...where, AND: [...((where as { AND?: Prisma.CandidateWhereInput[] }).AND ?? []), ...extra] };
  }

  /** Where a job is on the map (null when not looked up yet or not found). */
  async pointOfJob(organisationId: string, jobId: string): Promise<{ lat: number; lon: number } | null> {
    const row = await this.db.forTenant(organisationId).job.findFirst({ where: { id: jobId, deletedAt: null }, select: { latitude: true, longitude: true, location: true, city: true, street: true, postcode: true } });
    if (!row) return null;
    if (row.latitude != null && row.longitude != null) return { lat: row.latitude, lon: row.longitude };
    // not on the map yet: put it there now instead of making the user wait for the background sweep
    const point = await this.geocoding.locateAddress({ street: row.street, city: row.city, postcode: row.postcode, location: row.location });
    if (point) await this.db.client.job.update({ where: { id: jobId }, data: { latitude: point.lat, longitude: point.lon, geocodedAt: new Date() } });
    return point ?? null;
  }

  /** Ids of the candidates whose place is within `radiusKm` of the point (straight line). Candidates not yet on the map are not in it. */
  async idsWithin(organisationId: string, centre: { lat: number; lon: number }, radiusKm: number): Promise<string[]> {
    const rows = await this.db.client.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "candidates"
      WHERE "organisationId" = ${organisationId} AND "deletedAt" IS NULL AND "latitude" IS NOT NULL AND "longitude" IS NOT NULL
        AND 6371 * acos(LEAST(1, GREATEST(-1,
          cos(radians(${centre.lat})) * cos(radians("latitude")) * cos(radians("longitude") - radians(${centre.lon}))
          + sin(radians(${centre.lat})) * sin(radians("latitude"))))) <= ${radiusKm}`;
    return rows.map((row) => row.id);
  }

  /** How many candidates are not on the map (no address, or one the map could not find): a distance search cannot include them. */
  countUnlocated(organisationId: string): Promise<number> {
    return this.db.forTenant(organisationId).candidate.count({ where: { deletedAt: null, OR: [{ latitude: null }, { longitude: null }] } });
  }

  /** How far the farthest candidate is from the point (km), or null when none is on the map. */
  async farthestKm(organisationId: string, centre: { lat: number; lon: number }): Promise<number | null> {
    const rows = await this.db.client.$queryRaw<{ km: number | null }[]>`
      SELECT MAX(6371 * acos(LEAST(1, GREATEST(-1,
        cos(radians(${centre.lat})) * cos(radians("latitude")) * cos(radians("longitude") - radians(${centre.lon}))
        + sin(radians(${centre.lat})) * sin(radians("latitude")))))) AS km
      FROM "candidates"
      WHERE "organisationId" = ${organisationId} AND "deletedAt" IS NULL AND "latitude" IS NOT NULL AND "longitude" IS NOT NULL`;
    const km = rows[0]?.km;
    return km == null ? null : Number(km);
  }

  /** Start point of a distance filter: a job's place or a typed street / city / post code. */
  async startPoint(organisationId: string, query: ListCandidatesQueryDto): Promise<{ lat: number; lon: number }> {
    const centre = query.nearJobId ? await this.pointOfJob(organisationId, query.nearJobId) : await this.geocoding.locate(query.nearLocation ?? '');
    if (!centre) {
      throw new AppException('LOCATION_NOT_FOUND', query.nearJobId ? 'This job has no address the map can find. Add a street, city, post code or location to the job.' : `"${query.nearLocation?.trim()}" was not found on the map. Try a street, a town or a post code.`, HttpStatus.BAD_REQUEST);
    }
    return centre;
  }

  /** Candidates with an address written but not yet looked up on the map. */
  findUngeocoded(take: number) {
    return this.db.client.candidate.findMany({
      where: { deletedAt: null, geocodedAt: null, OR: [{ location: { not: null } }, { city: { not: null } }, { street: { not: null } }, { postalCode: { not: null } }] },
      select: { id: true, location: true, city: true, street: true, postalCode: true },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  saveGeocode(id: string, point: { lat: number; lon: number } | null) {
    return this.db.client.candidate.update({ where: { id }, data: { latitude: point?.lat ?? null, longitude: point?.lon ?? null, geocodedAt: new Date() } });
  }

  /**
   * The candidates a selection stands for: exactly the ticked ones (IDS), or everyone the filters match minus the ones
   * taken out by hand (FILTER). Reading the filters on the server means "select all 1,234 results" never depends on
   * what the browser happened to load.
   */
  async selectionWhere(
    organisationId: string,
    selection: { mode: 'IDS' | 'FILTER'; ids?: string[]; filters?: ListCandidatesQueryDto; excludeIds?: string[] },
  ): Promise<Prisma.CandidateWhereInput> {
    if (selection.mode === 'IDS') return { deletedAt: null, id: { in: selection.ids ?? [] } };
    const where = await this.whereFor(organisationId, selection.filters ?? ({ page: 1, pageSize: 1 } as ListCandidatesQueryDto));
    const exclude = selection.excludeIds?.length ? [{ id: { notIn: selection.excludeIds } }] : [];
    return { ...where, AND: [...((where as { AND?: Prisma.CandidateWhereInput[] }).AND ?? []), ...exclude] };
  }

  /** Only the columns an export may contain (see EXPORT_SELECT) — one more row than the limit so "too many" is detectable. */
  findForExport(organisationId: string, where: Prisma.CandidateWhereInput, take: number) {
    return this.db.forTenant(organisationId).candidate.findMany({ where, select: EXPORT_SELECT, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }], take });
  }

  count(organisationId: string, where: Prisma.CandidateWhereInput) {
    return this.db.forTenant(organisationId).candidate.count({ where });
  }

  /** Sets the consent of everyone in the selection. A person who opted out is never switched back to "granted" in bulk. */
  async setConsent(
    organisationId: string,
    where: Prisma.CandidateWhereInput,
    data: Partial<Record<'smsConsent' | 'emailConsent' | 'callConsent', 'UNKNOWN' | 'GRANTED' | 'OPTED_OUT'>>,
  ) {
    const grants = Object.entries(data).filter(([, status]) => status === 'GRANTED').map(([channel]) => ({ [channel]: { not: 'OPTED_OUT' as const } }));
    const result = await this.db.forTenant(organisationId).candidate.updateMany({
      where: { AND: [where, ...grants] },
      data: { ...data, consentUpdatedAt: new Date() },
    });
    return result.count;
  }

  /** One page of candidates, without the total — for callers that never read it (the unassigned pool derives its own total). */
  async findPage(organisationId: string, query: ListCandidatesQueryDto) {
    const items = await this.db.forTenant(organisationId).candidate.findMany({
      where: await this.whereFor(organisationId, query),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      // id breaks ties: people added in one import share a createdAt, and without it pages overlap (one person twice, another never)
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        company: { select: { id: true, name: true } },
        interestedJob: { select: { id: true, title: true, location: true, company: { select: { id: true, name: true } } } },
        applications: APPLICATION_SUMMARY,
      },
    });
    // each row says how it got here, so the table can tell a website applicant from a person added by hand
    const fromWebsite = await this.websiteCandidateIds(organisationId, items.map((item) => item.id));
    return items.map((item) => ({ ...item, addedVia: fromWebsite.has(item.id) ? ('WEBSITE' as const) : ('MANUAL' as const) }));
  }

  async findMany(organisationId: string, query: ListCandidatesQueryDto) {
    const where = await this.whereFor(organisationId, query);
    const [items, totalItems] = await Promise.all([
      this.findPage(organisationId, query),
      this.cache.cachedCount(organisationId, 'candidates', where, () => this.db.forTenant(organisationId).candidate.count({ where })),
    ]);

    return { items, totalItems };
  }

  /** The openings a rejected candidate could be suggested for. */
  findOpenJobs(organisationId: string) {
    return this.db.forTenant(organisationId).job.findMany({
      where: { deletedAt: null, status: 'OPEN' },
      select: { id: true, title: true, location: true, company: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).candidate.findFirst({
      where: { id, deletedAt: null },
      include: {
        documents: { orderBy: { createdAt: 'desc' } },
        candidateTags: { include: { tag: true } },
        company: true,
        interestedJob: { select: { id: true, title: true, location: true, company: { select: { id: true, name: true } } } },
        // same derived status + current stage as the list, so the detail page agrees with the table
        applications: APPLICATION_SUMMARY,
      },
    });
  }

  /** Existence check with the same tenant and soft-delete filter as `findById`, without loading any relations. */
  exists(organisationId: string, id: string) {
    return this.db
      .forTenant(organisationId)
      .candidate.count({ where: { id, deletedAt: null } })
      .then((count) => count > 0);
  }

  /**
   * Someone already on file with the same phone number or e-mail address — null when nobody is. Only these two count: the same
   * name alone is not a duplicate (two people can share one). A phone number is compared on its digits (so "07700 900123",
   * "+44 7700 900123" and "(+44) 7700-900123" are one, and the numbers saved before the digits were kept on file too), an
   * e-mail without capitals and extra spaces.
   */
  async findDuplicate(organisationId: string, dto: { email?: string; phone?: string }): Promise<{ id: string; firstName: string; lastName: string; why: 'phone' | 'email' } | null> {
    const digits = (value?: string | null) => (value ?? '').replace(/\D/g, '');
    const phone = normalizeCandidatePhone(dto.phone);
    const phoneTail = phone ? digits(phone).slice(-9) : null;
    const email = dto.email?.trim().toLowerCase() || null;

    const matches = [
      ...(phone ? [{ normalizedPhone: phone }, { phone: { contains: digits(phone).slice(-4) } }] : []),
      ...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : []),
    ];
    if (matches.length === 0) return null;
    const rows = await this.db.forTenant(organisationId).candidate.findMany({
      where: { deletedAt: null, OR: matches },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, normalizedPhone: true },
      take: 500,
    });
    for (const row of rows) {
      if (phone && (row.normalizedPhone === phone || (phoneTail && phoneTail.length >= 7 && digits(row.phone).slice(-9) === phoneTail))) return { id: row.id, firstName: row.firstName, lastName: row.lastName, why: 'phone' };
      if (email && row.email?.trim().toLowerCase() === email) return { id: row.id, firstName: row.firstName, lastName: row.lastName, why: 'email' };
    }
    return null;
  }

  create(organisationId: string, ownerId: string, dto: CreateCandidateDto, companyId?: string) {
    return this.db.forTenant(organisationId).candidate.create({
      data: { ...dto, ...writtenFields(dto), normalizedPhone: normalizeCandidatePhone(dto.phone), firstName: dto.firstName ?? '', lastName: dto.lastName ?? '', organisationId, ownerId: dto.ownerId ?? ownerId, companyId },
    });
  }

  update(organisationId: string, id: string, dto: UpdateCandidateDto, companyId?: string) {
    return this.db.forTenant(organisationId).candidate.update({
      where: { id },
      data: { ...dto, ...writtenFields(dto), ...(dto.location !== undefined || dto.city !== undefined || dto.street !== undefined || dto.postalCode !== undefined ? { latitude: null, longitude: null, geocodedAt: null } : {}), ...(dto.phone !== undefined ? { normalizedPhone: normalizeCandidatePhone(dto.phone) } : {}), ...(companyId ? { companyId } : {}) },
    });
  }

  /** The candidate, and their cards on the pipelines with them. */
  softDelete(organisationId: string, id: string) {
    const db = this.db.forTenant(organisationId);
    const deletedAt = new Date();
    return db.$transaction([
      db.application.updateMany({ where: { candidateId: id, deletedAt: null }, data: { deletedAt } }),
      db.candidate.update({ where: { id }, data: { deletedAt } }),
    ]);
  }
}
