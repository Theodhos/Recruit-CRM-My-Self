import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../../infrastructure/database/database.service';

export interface PayslipData {
  employeeName: string;
  nino: string | null;
  utr: string | null;
  weekStart: Date;
  weekEnd: Date;
  paymentDate: Date;
  rateType: 'DAY' | 'HOUR';
  rate: number;
  quantity: number;
  gross: number;
  cisRate: number;
  cisDeduction: number;
  payrollFee: number;
  netPay: number;
  currency: string;
  notes: string | null;
}

/** Tenant-scoped data access for 'payslips' — always through `forTenant` (see docs/architecture/multi-tenancy.md). */
@Injectable()
export class PayslipsRepository {
  constructor(private readonly db: DatabaseService) {}

  async findMany(organisationId: string, query: { page: number; pageSize: number; search?: string }) {
    const db = this.db.forTenant(organisationId);
    const term = query.search?.trim();
    const where = term
      ? { OR: [{ employeeName: { contains: term, mode: 'insensitive' as const } }, { nino: { contains: term, mode: 'insensitive' as const } }, { utr: { contains: term } }] }
      : {};
    const [items, totalItems] = await Promise.all([
      db.payslip.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }] }),
      db.payslip.count({ where }),
    ]);
    return { items, totalItems };
  }

  /** The figures on top of the page. */
  findForTotals(organisationId: string) {
    return this.db.forTenant(organisationId).payslip.findMany({ select: { currency: true, gross: true, cisDeduction: true, payrollFee: true, netPay: true, paymentDate: true } });
  }

  findById(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).payslip.findFirst({ where: { id } });
  }

  create(organisationId: string, data: PayslipData) {
    return this.db.forTenant(organisationId).payslip.create({ data: { ...data, organisationId } });
  }

  update(organisationId: string, id: string, data: PayslipData) {
    return this.db.forTenant(organisationId).payslip.update({ where: { id }, data });
  }

  delete(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).payslip.delete({ where: { id } });
  }
}
