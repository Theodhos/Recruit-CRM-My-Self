import type { Prisma } from '@crm/database';
import { searchWords } from '../../../common/utils/search';
import { Injectable } from '@nestjs/common';

import { CacheService } from '../../../infrastructure/cache/cache.service';
import { DatabaseService } from '../../../infrastructure/database/database.service';
import type { CreateCompanyDto } from '../dto/create-company.dto';
import type { ListCompaniesQueryDto } from '../dto/list-companies-query.dto';
import type { UpdateCompanyDto } from '../dto/update-company.dto';

type CompanyStatusValue = 'PROSPECT' | 'ACTIVE_CLIENT' | 'FORMER_CLIENT' | 'INACTIVE';
const AVAILABILITY_STATUSES: Record<'AVAILABLE' | 'NOT_AVAILABLE' | 'DO_NOT_USE', CompanyStatusValue[]> = {
  AVAILABLE: ['PROSPECT', 'ACTIVE_CLIENT'],
  NOT_AVAILABLE: ['FORMER_CLIENT'],
  DO_NOT_USE: ['INACTIVE'],
};

/**
 * Tenant-scoped data access for 'companies'. Always resolve the client via
 * `this.db.forTenant(organisationId)` (packages/database scopedPrisma) —
 * never query the raw PrismaClient for tenant-scoped models. See
 * docs/architecture/multi-tenancy.md.
 */
/** The address of a website without "https://", "www." and the path: "https://www.Acme.com/about" → "acme.com". */
const hostOf = (website: string | null | undefined): string | null => {
  const host = (website ?? '').trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0];
  return host && host.includes('.') ? host : null;
};

@Injectable()
export class CompaniesRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly cache: CacheService,
  ) {}

  /** One search box over every column of the Companies table: name, industry, email, city, status, added by. */
  private searchClauses(raw: string) {
    const term = raw.trim();
    const like = { contains: term, mode: 'insensitive' as const };
    const label = term.toLowerCase().replace(/[_-]+/g, ' ');
    const statuses = (['PROSPECT', 'ACTIVE_CLIENT', 'FORMER_CLIENT', 'INACTIVE'] as const).filter((status) =>
      status.toLowerCase().replace(/_/g, ' ').includes(label),
    );
    const [first, ...rest] = term.split(/[ ]+/);
    return [
      { name: like },
      { industry: like },
      { email: like },
      { city: like },
      { address: like },
      { country: like },
      { phone: like },
      { website: like },
      { source: like },
      ...(statuses.length ? [{ status: { in: statuses } }] : []),
      { owner: { OR: [{ firstName: like }, { lastName: like }] } },
      ...(rest.length
        ? [{ owner: { firstName: { contains: first, mode: 'insensitive' as const }, lastName: { contains: rest.join(' '), mode: 'insensitive' as const } } }]
        : []),
    ];
  }

  async findMany(organisationId: string, query: ListCompaniesQueryDto) {
    const db = this.db.forTenant(organisationId);
    // the filters that need an OR / AND of their own go in `and`, so none of them replaces another
    const and: Prisma.CompanyWhereInput[] = [];
    if (query.status) and.push({ status: query.status });
    if (query.availability) and.push({ status: { in: AVAILABILITY_STATUSES[query.availability] } });
    // every word typed must match somewhere in the row
    for (const word of searchWords(query.search)) and.push({ OR: this.searchClauses(word) });
    const where = {
      deletedAt: null,
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      ...(query.name ? { name: { contains: query.name, mode: 'insensitive' as const } } : {}),
      ...(query.industry ? { industry: { contains: query.industry, mode: 'insensitive' as const } } : {}),
      ...(query.city ? { OR: [{ city: { contains: query.city, mode: 'insensitive' as const } }, { address: { contains: query.city, mode: 'insensitive' as const } }] } : {}),
      ...(query.team === 'WITH' ? { candidates: { some: {} } } : {}),
      ...(query.team === 'WITHOUT' ? { candidates: { none: {} } } : {}),
      ...(and.length ? { AND: and } : {}),
    };

    const [items, totalItems] = await Promise.all([
      db.company.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { jobs: true, candidates: true, contacts: true } } },
      }),
      this.cache.cachedCount(organisationId, 'companies', where, () => db.company.count({ where })),
    ]);

    return { items, totalItems };
  }

  findById(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).company.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: { select: { jobs: true, candidates: true, contacts: true } },
        owner: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /** Win proofs (screenshots, files…) uploaded on the company: a company only moves to Win with one. */
  winProofCount(organisationId: string, companyId: string) {
    return this.db.forTenant(organisationId).document.count({ where: { companyId, type: 'WIN_PROOF' } });
  }

  /** Existence check used by other modules (Contacts, Jobs) validating a companyId belongs to this org before writing a foreign key to it. */
  exists(organisationId: string, id: string) {
    return this.db
      .forTenant(organisationId)
      .company.count({ where: { id, deletedAt: null } })
      .then((count) => count > 0);
  }

  /** Case-insensitive exact name match, used to avoid creating a duplicate Company for the same employer (e.g. resolving Candidate.currentCompany). */
  findByName(organisationId: string, name: string) {
    return this.db.forTenant(organisationId).company.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, deletedAt: null },
    });
  }

  /** A company already on file with the same name (any capitals) or the same website address — null when none is. */
  async findDuplicate(organisationId: string, dto: { name?: string; website?: string }) {
    const db = this.db.forTenant(organisationId);
    const name = dto.name?.trim();
    if (name) {
      const sameName = await db.company.findFirst({ where: { deletedAt: null, name: { equals: name, mode: 'insensitive' } }, select: { id: true, name: true } });
      if (sameName) return { ...sameName, why: 'the same name' };
    }
    const host = hostOf(dto.website);
    if (host) {
      const candidates = await db.company.findMany({ where: { deletedAt: null, website: { contains: host, mode: 'insensitive' } }, select: { id: true, name: true, website: true }, take: 20 });
      const sameSite = candidates.find((company) => hostOf(company.website) === host);
      if (sameSite) return { id: sameSite.id, name: sameSite.name, why: 'the same website' };
    }
    return null;
  }

  create(organisationId: string, ownerId: string, dto: CreateCompanyDto) {
    return this.db.forTenant(organisationId).company.create({
      data: { ...dto, name: dto.name ?? 'Untitled company', organisationId, ownerId: dto.ownerId ?? ownerId },
    });
  }

  /** Replaces what the Pipeline Companies pop-up keeps for the company (see service/pipeline-record.ts). */
  setPipelineRecord(organisationId: string, id: string, record: object) {
    return this.db.forTenant(organisationId).company.update({ where: { id }, data: { pipelineRecord: record } });
  }

  update(organisationId: string, id: string, dto: UpdateCompanyDto) {
    return this.db.forTenant(organisationId).company.update({
      where: { id },
      data: dto,
    });
  }

  /** The company, its jobs, and the cards of the people who applied to those jobs. */
  softDelete(organisationId: string, id: string) {
    const db = this.db.forTenant(organisationId);
    const deletedAt = new Date();
    return db.$transaction([
      db.application.updateMany({ where: { job: { companyId: id }, deletedAt: null }, data: { deletedAt } }),
      db.job.updateMany({ where: { companyId: id, deletedAt: null }, data: { deletedAt, closedAt: deletedAt, status: 'CLOSED' } }),
      db.company.update({ where: { id }, data: { deletedAt } }),
    ]);
  }
}
