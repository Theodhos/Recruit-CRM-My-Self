import type { PlacementStatus } from '@crm/database';
import { Injectable } from '@nestjs/common';

import { CacheService } from '../../../infrastructure/cache/cache.service';
import { DatabaseService } from '../../../infrastructure/database/database.service';
import type { CreatePlacementDto } from '../dto/create-placement.dto';
import type { ListPlacementsQueryDto } from '../dto/list-placements-query.dto';
import type { UpdatePlacementDto } from '../dto/update-placement.dto';

const RELATION_INCLUDE = {
  candidate: { select: { id: true, firstName: true, lastName: true } },
  job: { select: { id: true, title: true, candidatesNeeded: true } },
  company: { select: { id: true, name: true } },
  // the resourcer(s) responsible for the placement and their shares
  resourcers: { select: { userId: true, splitPercent: true, user: { select: { id: true, firstName: true, lastName: true } } } },
  documents: { orderBy: { createdAt: 'desc' as const } },
};

/**
 * Tenant-scoped data access for 'placements'. Always resolve the client via
 * `this.db.forTenant(organisationId)` (packages/database scopedPrisma) —
 * never query the raw PrismaClient for tenant-scoped models. See
 * docs/architecture/multi-tenancy.md.
 */
@Injectable()
export class PlacementsRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly cache: CacheService,
  ) {}

  /**
   * One search box over the columns of Active Employees / Completed Jobs' people: Candidate, Job, Company, Start date,
   * Type (Permanent / Temporary), Added by — plus the status. A start date can be typed as a year (2026), a month
   * (2026-10 or 10/2026) or a day (2026-10-05, 05/10/2026 — day first or month first).
   */
  private searchClauses(word: string) {
    const like = { contains: word, mode: 'insensitive' as const };
    const lower = word.toLowerCase();
    const types = ('permanent'.startsWith(lower) ? ['PERMANENT'] : []).concat('temporary'.startsWith(lower) ? ['TEMPORARY'] : []) as ('PERMANENT' | 'TEMPORARY')[];
    const statuses = [['ACTIVE', 'active'], ['COMPLETED', 'completed'], ['CANCELLED', 'terminated']]
      .filter(([, label]) => lower.length >= 3 && label!.startsWith(lower))
      .map(([status]) => status as PlacementStatus);
    return [
      { candidate: { firstName: like } },
      { candidate: { lastName: like } },
      { job: { title: like } },
      { company: { name: like } },
      { owner: { firstName: like } },
      { owner: { lastName: like } },
      ...(types.length ? [{ employmentType: { in: types } }] : []),
      ...(statuses.length ? [{ status: { in: statuses } }] : []),
      ...this.dateRanges(word).map(([from, to]) => ({ startDate: { gte: from, lt: to } })),
    ];
  }

  /** The day ranges a typed date can mean ([from, to) in UTC), or none when the word is not a date. */
  private dateRanges(word: string): [Date, Date][] {
    const day = (y: number, m: number, d: number): [Date, Date] => [new Date(Date.UTC(y, m - 1, d)), new Date(Date.UTC(y, m - 1, d + 1))];
    const month = (y: number, m: number): [Date, Date] => [new Date(Date.UTC(y, m - 1, 1)), new Date(Date.UTC(y, m, 1))];
    const valid = (m: number, d = 1) => m >= 1 && m <= 12 && d >= 1 && d <= 31;
    let match: RegExpMatchArray | null;
    if ((match = word.match(/^(\d{4})$/))) return [[new Date(Date.UTC(+match[1]!, 0, 1)), new Date(Date.UTC(+match[1]! + 1, 0, 1))]];
    if ((match = word.match(/^(\d{4})[-/.](\d{1,2})$/))) return valid(+match[2]!) ? [month(+match[1]!, +match[2]!)] : [];
    if ((match = word.match(/^(\d{1,2})[-/.](\d{4})$/))) return valid(+match[1]!) ? [month(+match[2]!, +match[1]!)] : [];
    if ((match = word.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) return valid(+match[2]!, +match[3]!) ? [day(+match[1]!, +match[2]!, +match[3]!)] : [];
    if ((match = word.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) {
      const [a, b, y] = [+match[1]!, +match[2]!, +match[3]!];
      // day first (05/10/2026) or month first (10/05/2026): both are read
      return [...(valid(b, a) ? [day(y, b, a)] : []), ...(valid(a, b) && a !== b ? [day(y, a, b)] : [])];
    }
    return [];
  }

  async findMany(organisationId: string, query: ListPlacementsQueryDto, leaveOutJobIds: string[] = []) {
    const db = this.db.forTenant(organisationId);
    const words = (query.search ?? '').trim().split(/\s+/).filter(Boolean);
    const where = {
      // a single status ("ACTIVE") or several ("COMPLETED,CANCELLED" — Completed Contract shows both by default)
      ...(query.status ? { status: { in: query.status.split(',') as PlacementStatus[] } } : {}),
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      ...(query.employmentType ? { employmentType: query.employmentType } : {}),
      ...(query.candidateId ? { candidateId: query.candidateId } : {}),
      ...(query.jobId ? { jobId: query.jobId } : leaveOutJobIds.length > 0 ? { jobId: { notIn: leaveOutJobIds } } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      // every word typed has to match somewhere in the row, so "ana google permanent" narrows down step by step
      ...(words.length ? { AND: words.map((word) => ({ OR: this.searchClauses(word) })) } : {}),
    };

    const [items, totalItems] = await Promise.all([
      db.placement.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { startDate: 'desc' },
        include: RELATION_INCLUDE,
      }),
      this.cache.cachedCount(organisationId, 'placements', where, () => db.placement.count({ where })),
    ]);

    return { items, totalItems };
  }

  findById(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).placement.findFirst({
      where: { id },
      include: RELATION_INCLUDE,
    });
  }

  /** Existence check with the same tenant filter as `findById`, without loading any relations. */
  exists(organisationId: string, id: string) {
    return this.db
      .forTenant(organisationId)
      .placement.count({ where: { id } })
      .then((count) => count > 0);
  }

  /** Dedupe guard for auto-placement (see ApplicationsService) — a pipeline stage can be re-entered (moved out and back into "Placed"), and this must not spawn a second Placement each time. */
  findByCandidateAndJob(organisationId: string, candidateId: string, jobId: string) {
    return this.db.forTenant(organisationId).placement.findFirst({
      where: { candidateId, jobId },
    });
  }

  create(organisationId: string, ownerId: string, dto: CreatePlacementDto) {
    return this.db.forTenant(organisationId).placement.create({
      data: {
        ...dto,
        organisationId,
        ownerId: dto.ownerId ?? ownerId,
        // class-validator's @IsDateString() accepts a date-only string
        // ("2026-10-01"), but Prisma's DateTime scalar requires a full
        // ISO-8601 datetime — convert at the one place that talks to Prisma.
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
      include: RELATION_INCLUDE,
    });
  }

  update(organisationId: string, id: string, dto: UpdatePlacementDto) {
    return this.db.forTenant(organisationId).placement.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate === null ? null : dto.endDate ? new Date(dto.endDate) : undefined,
      },
      include: RELATION_INCLUDE,
    });
  }

  remove(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).placement.delete({ where: { id } });
  }
}
