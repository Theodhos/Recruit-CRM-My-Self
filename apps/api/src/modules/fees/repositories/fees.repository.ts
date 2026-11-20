import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../../infrastructure/database/database.service';
import type { FeeStatusValue, ListFeesQueryDto } from '../dto';

const PLACEMENT = {
  placement: {
    select: {
      id: true,
      status: true,
      employmentType: true,
      startDate: true,
      candidate: { select: { id: true, firstName: true, lastName: true } },
      job: { select: { id: true, title: true } },
      company: { select: { id: true, name: true } },
      resourcers: { select: { userId: true, splitPercent: true, user: { select: { id: true, firstName: true, lastName: true } } } },
    },
  },
} as const;

/**
 * Tenant-scoped data access for 'fees'. Always resolve the client via
 * `this.db.forTenant(organisationId)` (packages/database scopedPrisma) —
 * never query the raw PrismaClient for tenant-scoped models. See
 * docs/architecture/multi-tenancy.md.
 */
@Injectable()
export class FeesRepository {
  constructor(private readonly db: DatabaseService) {}

  async findMany(organisationId: string, query: ListFeesQueryDto, now: Date) {
    const db = this.db.forTenant(organisationId);
    // "Overdue" is a fee still unpaid after its due date — asked for by date, not by a stored status that could go stale
    const unpaid = { status: { in: ['PENDING', 'INVOICED', 'OVERDUE'] as FeeStatusValue[] } };
    const byStatus =
      query.status === 'OVERDUE'
        ? { ...unpaid, dueDate: { lt: now } }
        : query.status === 'PENDING' || query.status === 'INVOICED'
          ? { status: query.status, OR: [{ dueDate: null }, { dueDate: { gte: now } }] }
          : query.status
            ? { status: query.status }
            : {};
    const where = {
      ...byStatus,
      ...(query.placementId ? { placementId: query.placementId } : {}),
      // Fees are the permanent placements' billing; temporary workers are billed from their timesheets
      placement: { employmentType: 'PERMANENT' as const, ...(query.companyId ? { companyId: query.companyId } : {}) },
    };
    const [items, totalItems] = await Promise.all([
      db.fee.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: { createdAt: 'desc' }, include: PLACEMENT }),
      db.fee.count({ where }),
    ]);
    return { items, totalItems };
  }

  findById(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).fee.findFirst({ where: { id }, include: PLACEMENT });
  }

  /** Every fee that still counts (not cancelled), lean — the overview is computed from these. */
  findAllForOverview(organisationId: string) {
    return this.db.forTenant(organisationId).fee.findMany({
      where: { status: { not: 'CANCELLED' }, placement: { employmentType: 'PERMANENT' } },
      select: { id: true, placementId: true, amount: true, currency: true, status: true, dueDate: true, paidAt: true, createdAt: true, placementDate: true, feeType: true },
    });
  }

  /** Permanent placements that have no fee record yet (a placement is a successful hire; its fee is a separate record). */
  findPermanentPlacements(organisationId: string) {
    return this.db.forTenant(organisationId).placement.findMany({
      where: { employmentType: 'PERMANENT', status: { not: 'CANCELLED' } },
      orderBy: { startDate: 'desc' },
      select: { id: true, employmentType: true, startDate: true, candidate: { select: { id: true, firstName: true, lastName: true } }, job: { select: { id: true, title: true } }, company: { select: { id: true, name: true } } },
    });
  }

  placementType(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).placement.findFirst({ where: { id }, select: { id: true, employmentType: true } });
  }

  placementExists(organisationId: string, id: string) {
    return this.db
      .forTenant(organisationId)
      .placement.count({ where: { id } })
      .then((count) => count > 0);
  }

  create(organisationId: string, data: Record<string, unknown>) {
    return this.db.forTenant(organisationId).fee.create({ data: { ...data, organisationId } as never, include: PLACEMENT });
  }

  update(organisationId: string, id: string, data: Record<string, unknown>) {
    return this.db.forTenant(organisationId).fee.update({ where: { id }, data: data as never, include: PLACEMENT });
  }

  delete(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).fee.delete({ where: { id } });
  }
}
