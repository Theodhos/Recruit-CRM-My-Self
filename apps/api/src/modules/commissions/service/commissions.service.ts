import { scopedPrisma } from '@crm/database';
import { HttpStatus, Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';

import { AppException, ResourceNotFoundException } from '../../../common/exceptions/app.exception';
import { DatabaseService } from '../../../infrastructure/database/database.service';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import type { AddPaymentDto, ResourcerShareDto, SetRateDto } from '../dto';
import { attribute, basisFigure, checkSplit, commissionOf, monthRange, type CommissionBasis } from '../lib/commission-calc';

const num = (value: unknown) => Number(value);
const pence = (pounds: number) => Math.round((pounds + Number.EPSILON) * 100);
const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim();

export interface StatementLine {
  /** TEMPORARY: from approved timesheets. PERMANENT: the client fee of the placement. */
  kind: 'TEMPORARY' | 'PERMANENT';
  feeType?: 'PERCENTAGE' | 'FIXED' | null;
  invoiceNumber?: string | null;
  invoiceStatus?: string | null;
  placementId: string;
  worker: string;
  client: string;
  timesheets: number;
  /** The placement's whole client billing and agency profit for the month. */
  billingTotal: number;
  profitTotal: number;
  splitPercent: number;
  sharedWith: string[];
  attributedBilling: number;
  attributedProfit: number;
  commissionable: number;
  commission: number;
}

/**
 * Resourcer allocation and monthly commission.
 *  - A temporary placement has one resourcer, or two with a split the administrator decides (always 100% in total).
 *  - Each person has a commission % and, optionally, their own basis; the organisation has a default basis
 *    (agency PROFIT or client BILLING) — the interpretation of "commissionable" is a setting, not code.
 *  - A month's figures are worked out from the APPROVED timesheets of that month (by the Monday of the week):
 *    the client billing and the agency profit are both kept, then attributed by the split.
 *  - Commission paid is recorded as payments; outstanding = earned − paid.
 */
@Injectable()
export class CommissionsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auditLogs: AuditLogsService,
  ) {}


  /**
   * The whole organisation's data. Payroll and commission figures are never limited to "my own records": whoever may
   * open the screen (or their own statement) must see complete totals, so the per-user owner scope is not applied here.
   */
  private tenant(organisationId: string) {
    return scopedPrisma(this.db.client, organisationId);
  }
  // ------------------------------------------------------------------------------------------- settings and rates

  async orgBasis(organisationId: string): Promise<CommissionBasis> {
    const org = await this.db.client.organisation.findUnique({ where: { id: organisationId }, select: { commissionBasis: true } });
    return (org?.commissionBasis ?? 'PROFIT') as CommissionBasis;
  }

  async setOrgBasis(organisationId: string, userId: string, basis: CommissionBasis) {
    const before = await this.orgBasis(organisationId);
    await this.db.client.organisation.update({ where: { id: organisationId }, data: { commissionBasis: basis } });
    await this.auditLogs.record({ organisationId, userId, action: 'SET_COMMISSION_BASIS', entityType: 'Organisation', entityId: organisationId, oldValues: { commissionBasis: before }, newValues: { commissionBasis: basis } });
    return { commissionBasis: basis };
  }

  async permanentTrigger(organisationId: string): Promise<'PLACEMENT' | 'PAID'> {
    const org = await this.db.client.organisation.findUnique({ where: { id: organisationId }, select: { permanentCommissionTrigger: true } });
    return (org?.permanentCommissionTrigger ?? 'PLACEMENT') as 'PLACEMENT' | 'PAID';
  }

  async setPermanentTrigger(organisationId: string, userId: string, trigger: 'PLACEMENT' | 'PAID') {
    const before = await this.permanentTrigger(organisationId);
    await this.db.client.organisation.update({ where: { id: organisationId }, data: { permanentCommissionTrigger: trigger } });
    await this.auditLogs.record({ organisationId, userId, action: 'SET_PERMANENT_COMMISSION_TRIGGER', entityType: 'Organisation', entityId: organisationId, oldValues: { trigger: before }, newValues: { trigger } });
    return { permanentCommissionTrigger: trigger };
  }

  async listResourcers(organisationId: string) {
    const [basis, trigger, users] = await Promise.all([
      this.orgBasis(organisationId),
      this.permanentTrigger(organisationId),
      this.tenant(organisationId).user.findMany({ where: { status: 'ACTIVE' }, select: { id: true, firstName: true, lastName: true, email: true, commissionRate: true, commissionBasis: true }, orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }] }),
    ]);
    return {
      defaultBasis: basis,
      permanentTrigger: trigger,
      resourcers: users.map((u) => ({ userId: u.id, name: fullName(u), email: u.email, commissionRate: num(u.commissionRate), commissionBasis: (u.commissionBasis as CommissionBasis | null) ?? null, effectiveBasis: ((u.commissionBasis as CommissionBasis | null) ?? basis) as CommissionBasis })),
    };
  }

  async setRate(organisationId: string, adminId: string, userId: string, dto: SetRateDto) {
    const user = await this.tenant(organisationId).user.findFirst({ where: { id: userId }, select: { id: true, commissionRate: true, commissionBasis: true } });
    if (!user) throw new ResourceNotFoundException('User', userId);
    await this.db.client.user.update({ where: { id: userId }, data: { commissionRate: dto.commissionRate, ...(dto.commissionBasis !== undefined ? { commissionBasis: dto.commissionBasis } : {}) } });
    await this.auditLogs.record({ organisationId, userId: adminId, action: 'SET_COMMISSION_RATE', entityType: 'User', entityId: userId, oldValues: { commissionRate: num(user.commissionRate), commissionBasis: user.commissionBasis }, newValues: { commissionRate: dto.commissionRate, commissionBasis: dto.commissionBasis } });
    return this.listResourcers(organisationId);
  }

  // ------------------------------------------------------------------------------------------- allocation

  /** The profit and billing a placement has produced (approved timesheets), for the allocation screen. */
  private async placementTotals(organisationId: string, placement: { id: string; candidateId: string; companyId: string; employmentType?: string }) {
    if (placement.employmentType === 'PERMANENT') {
      // a permanent placement earns its client fee: that is both the billing and the profit (there is no worker to pay)
      const fees = await this.tenant(organisationId).fee.findMany({ where: { placementId: placement.id, status: { not: 'CANCELLED' } }, select: { amount: true } });
      const fee = fees.reduce((s, f) => s + pence(num(f.amount)), 0) / 100;
      return { timesheets: 0, billing: fee, profit: fee };
    }
    const sheets = await this.tenant(organisationId).timesheet.findMany({
      where: { status: 'APPROVED', OR: [{ placementId: placement.id }, { placementId: null, candidateId: placement.candidateId, companyId: placement.companyId }] },
      select: { chargeTotal: true, profit: true },
    });
    return { timesheets: sheets.length, billing: sheets.reduce((s, t) => s + pence(num(t.chargeTotal)), 0) / 100, profit: sheets.reduce((s, t) => s + pence(num(t.profit)), 0) / 100 };
  }

  async getAllocation(organisationId: string, placementId: string) {
    const placement = await this.tenant(organisationId).placement.findFirst({
      where: { id: placementId },
      select: { id: true, candidateId: true, companyId: true, employmentType: true, candidate: { select: { firstName: true, lastName: true } }, company: { select: { name: true } }, job: { select: { title: true } }, resourcers: { select: { userId: true, splitPercent: true, user: { select: { firstName: true, lastName: true, commissionRate: true, commissionBasis: true } } } } },
    });
    if (!placement) throw new ResourceNotFoundException('Placement', placementId);
    const [basis, totals] = await Promise.all([this.orgBasis(organisationId), this.placementTotals(organisationId, { ...placement })]);
    const splits = placement.resourcers.map((r) => num(r.splitPercent));
    const profitParts = splits.length ? attribute(totals.profit, splits) : [];
    const billingParts = splits.length ? attribute(totals.billing, splits) : [];
    return {
      placementId,
      employmentType: placement.employmentType,
      worker: fullName(placement.candidate),
      client: placement.company.name,
      job: placement.job.title,
      defaultBasis: basis,
      totals,
      resourcers: placement.resourcers.map((r, i) => {
        const own = (r.user.commissionBasis as CommissionBasis | null) ?? basis;
        return { userId: r.userId, name: fullName(r.user), splitPercent: num(r.splitPercent), commissionRate: num(r.user.commissionRate), basis: own, attributedProfit: profitParts[i] ?? 0, attributedBilling: billingParts[i] ?? 0, commissionable: basisFigure(own, profitParts[i] ?? 0, billingParts[i] ?? 0) };
      }),
    };
  }

  /** One resourcer (100%) or two (the split the administrator decides, adding up to exactly 100%). */
  async setAllocation(organisationId: string, adminId: string, placementId: string, shares: ResourcerShareDto[]) {
    const placement = await this.tenant(organisationId).placement.findFirst({ where: { id: placementId }, select: { id: true, resourcers: { select: { userId: true, splitPercent: true } } } });
    if (!placement) throw new ResourceNotFoundException('Placement', placementId);
    const ids = shares.map((s) => s.userId);
    if (new Set(ids).size !== ids.length) throw new AppException('DUPLICATE_RESOURCER', 'The same person cannot be chosen twice.', HttpStatus.BAD_REQUEST);
    const effective = shares.length === 1 ? [100] : shares.map((s) => s.splitPercent);
    const check = checkSplit(effective);
    if (!check.ok) throw new AppException('SPLIT_NOT_100', check.message, HttpStatus.BAD_REQUEST);
    const users = await this.tenant(organisationId).user.findMany({ where: { id: { in: ids }, status: 'ACTIVE' }, select: { id: true } });
    if (users.length !== ids.length) throw new AppException('RESOURCER_NOT_FOUND', 'Every resourcer must be an active user of this CRM.', HttpStatus.BAD_REQUEST);
    await this.db.client.$transaction(async (tx) => {
      await tx.placementResourcer.deleteMany({ where: { placementId, organisationId } });
      for (const [i, s] of shares.entries()) await tx.placementResourcer.create({ data: { organisationId, placementId, userId: s.userId, splitPercent: effective[i]! } });
    });
    await this.auditLogs.record({ organisationId, userId: adminId, action: 'SET_PLACEMENT_RESOURCERS', entityType: 'Placement', entityId: placementId, oldValues: { resourcers: placement.resourcers.map((r) => ({ userId: r.userId, splitPercent: num(r.splitPercent) })) }, newValues: { resourcers: shares.map((s, i) => ({ userId: s.userId, splitPercent: effective[i] })) } });
    return this.getAllocation(organisationId, placementId);
  }

  async clearAllocation(organisationId: string, adminId: string, placementId: string) {
    await this.db.client.placementResourcer.deleteMany({ where: { placementId, organisationId } });
    await this.auditLogs.record({ organisationId, userId: adminId, action: 'CLEAR_PLACEMENT_RESOURCERS', entityType: 'Placement', entityId: placementId });
    return this.getAllocation(organisationId, placementId);
  }

  // ------------------------------------------------------------------------------------------- the month

  /** Every figure of a month, per resourcer and the part nobody is responsible for. */
  private async build(organisationId: string, month: string) {
    let range: { start: Date; end: Date };
    try {
      range = monthRange(month);
    } catch {
      throw new AppException('INVALID_MONTH', 'The month must be written YYYY-MM.', HttpStatus.BAD_REQUEST);
    }
    const [orgBasis, sheets] = await Promise.all([
      this.orgBasis(organisationId),
      this.tenant(organisationId).timesheet.findMany({
        where: { status: 'APPROVED', weekStart: { gte: range.start, lt: range.end } },
        select: { id: true, candidateId: true, companyId: true, placementId: true, chargeTotal: true, profit: true, candidate: { select: { firstName: true, lastName: true } }, company: { select: { name: true } } },
        take: 20000,
      }),
    ]);

    // the placement of a timesheet: the one it was created for, else the worker's temporary placement at that client
    const loose = sheets.filter((s) => !s.placementId);
    const looseKeys = new Map<string, string>();
    if (loose.length) {
      const candidates = await this.tenant(organisationId).placement.findMany({
        where: { employmentType: 'TEMPORARY', candidateId: { in: [...new Set(loose.map((s) => s.candidateId))] }, companyId: { in: [...new Set(loose.map((s) => s.companyId))] } },
        select: { id: true, candidateId: true, companyId: true },
        orderBy: { startDate: 'desc' },
      });
      for (const p of candidates) if (!looseKeys.has(`${p.candidateId}:${p.companyId}`)) looseKeys.set(`${p.candidateId}:${p.companyId}`, p.id);
    }
    type Bucket = { placementId: string | null; worker: string; client: string; timesheets: number; billing: number; profit: number; kind?: 'PERMANENT' };
    const buckets = new Map<string, Bucket>();
    for (const s of sheets) {
      const pid = s.placementId ?? looseKeys.get(`${s.candidateId}:${s.companyId}`) ?? null;
      const key = pid ?? `none:${s.candidateId}:${s.companyId}`;
      const b: Bucket = buckets.get(key) ?? { placementId: pid, worker: fullName(s.candidate), client: s.company.name, timesheets: 0, billing: 0, profit: 0 };
      b.timesheets += 1;
      b.billing += pence(num(s.chargeTotal));
      b.profit += pence(num(s.profit));
      buckets.set(key, b);
    }
    // permanent placements: the client fee, in the month it was placed — or, when the organisation chose it, paid
    const trigger = await this.permanentTrigger(organisationId);
    const feeRows = await this.tenant(organisationId).fee.findMany({
      where: {
        placement: { employmentType: 'PERMANENT' },
        ...(trigger === 'PAID' ? { status: 'PAID', paidAt: { gte: range.start, lt: range.end } } : { status: { not: 'CANCELLED' }, placementDate: { gte: range.start, lt: range.end } }),
      },
      select: { id: true, placementId: true, amount: true, feeType: true, invoiceNumber: true, status: true, placement: { select: { candidate: { select: { firstName: true, lastName: true } }, company: { select: { name: true } }, job: { select: { title: true } } } } },
      take: 5000,
    });
    const fees = new Map(feeRows.map((f) => [f.placementId, f]));
    for (const f of feeRows) {
      buckets.set(`perm:${f.id}`, { placementId: f.placementId, worker: fullName(f.placement.candidate), client: f.placement.company.name, timesheets: 0, billing: pence(num(f.amount)), profit: pence(num(f.amount)), kind: 'PERMANENT' });
    }
    const placementIds = [...buckets.values()].map((b) => b.placementId).filter((id): id is string => Boolean(id));
    const allocations = placementIds.length ? await this.tenant(organisationId).placementResourcer.findMany({ where: { placementId: { in: placementIds } }, select: { placementId: true, userId: true, splitPercent: true } }) : [];
    const byPlacement = new Map<string, { userId: string; split: number }[]>();
    for (const a of allocations) byPlacement.set(a.placementId, [...(byPlacement.get(a.placementId) ?? []), { userId: a.userId, split: num(a.splitPercent) }]);

    const payments = await this.tenant(organisationId).commissionPayment.findMany({ where: { month: range.start }, orderBy: { paidAt: 'asc' } });
    const userIds = [...new Set([...allocations.map((a) => a.userId), ...payments.map((p) => p.userId)])];
    const rateUsers = await this.tenant(organisationId).user.findMany({ where: { OR: [{ id: { in: userIds } }, { commissionRate: { gt: 0 }, status: 'ACTIVE' }] }, select: { id: true, firstName: true, lastName: true, commissionRate: true, commissionBasis: true } });
    const nameOf = new Map(rateUsers.map((u) => [u.id, fullName(u)]));

    const people = new Map<string, { userId: string; name: string; rate: number; basis: CommissionBasis; lines: StatementLine[]; payments: { id: string; amount: number; paidAt: Date; reference: string | null }[] }>();
    for (const u of rateUsers) people.set(u.id, { userId: u.id, name: fullName(u), rate: num(u.commissionRate), basis: ((u.commissionBasis as CommissionBasis | null) ?? orgBasis) as CommissionBasis, lines: [], payments: [] });
    const unallocated: { kind: 'TEMPORARY' | 'PERMANENT'; worker: string; client: string; timesheets: number; billing: number; profit: number }[] = [];
    for (const b of buckets.values()) {
      const shares = b.placementId ? (byPlacement.get(b.placementId) ?? []) : [];
      if (shares.length === 0) {
        unallocated.push({ kind: b.kind ?? 'TEMPORARY', worker: b.worker, client: b.client, timesheets: b.timesheets, billing: b.billing / 100, profit: b.profit / 100 });
        continue;
      }
      const splits = shares.map((s) => s.split);
      const bill = attribute(b.billing / 100, splits);
      const prof = attribute(b.profit / 100, splits);
      shares.forEach((share, i) => {
        const person = people.get(share.userId);
        if (!person) return;
        const commissionable = basisFigure(person.basis, prof[i]!, bill[i]!);
        const fee = b.kind === 'PERMANENT' ? fees.get(b.placementId as string) : undefined;
        person.lines.push({
          kind: b.kind ?? 'TEMPORARY',
          feeType: fee?.feeType ?? null,
          invoiceNumber: fee?.invoiceNumber ?? null,
          invoiceStatus: fee?.status ?? null,
          placementId: b.placementId as string,
          worker: b.worker,
          client: b.client,
          timesheets: b.timesheets,
          billingTotal: b.billing / 100,
          profitTotal: b.profit / 100,
          splitPercent: share.split,
          sharedWith: shares.filter((o) => o.userId !== share.userId).map((o) => nameOf.get(o.userId) ?? 'Someone'),
          attributedBilling: bill[i]!,
          attributedProfit: prof[i]!,
          commissionable,
          commission: commissionOf(commissionable, person.rate),
        });
      });
    }
    for (const p of payments) people.get(p.userId)?.payments.push({ id: p.id, amount: num(p.amount), paidAt: p.paidAt, reference: p.reference });

    const summarise = (p: NonNullable<ReturnType<typeof people.get>>) => {
      const sum = (pick: (l: StatementLine) => number) => Math.round(p.lines.reduce((t, l) => t + pick(l) * 100, 0)) / 100;
      const commissionable = sum((l) => l.commissionable);
      const ofKind = (kind: 'TEMPORARY' | 'PERMANENT') => commissionOf(Math.round(p.lines.filter((l) => l.kind === kind).reduce((t, l) => t + l.commissionable * 100, 0)) / 100, p.rate);
      const earnedTemporary = ofKind('TEMPORARY');
      const earnedPermanent = ofKind('PERMANENT');
      // the two parts always add up to the total earned
      const earned = Math.round((earnedTemporary + earnedPermanent) * 100) / 100;
      const paid = Math.round(p.payments.reduce((t, x) => t + x.amount * 100, 0)) / 100;
      return { userId: p.userId, name: p.name, commissionRate: p.rate, basis: p.basis, placements: p.lines.length, sharedPlacements: p.lines.filter((l) => l.sharedWith.length > 0).length, billings: sum((l) => l.attributedBilling), profit: sum((l) => l.attributedProfit), commissionable, earned, earnedTemporary, earnedPermanent, paid, outstanding: Math.round((earned - paid) * 100) / 100 };
    };
    const permanentRows = feeRows.map((f) => ({ amount: num(f.amount), feeType: f.feeType }));
    const permanent = { placements: permanentRows.length, revenue: permanentRows.reduce((t, f) => t + pence(f.amount), 0) / 100, fixedFee: permanentRows.filter((f) => f.feeType === 'FIXED').length, percentageFee: permanentRows.filter((f) => f.feeType === 'PERCENTAGE').length, fixedRevenue: permanentRows.filter((f) => f.feeType === 'FIXED').reduce((t, f) => t + pence(f.amount), 0) / 100, percentageRevenue: permanentRows.filter((f) => f.feeType === 'PERCENTAGE').reduce((t, f) => t + pence(f.amount), 0) / 100 };
    return { month, orgBasis, trigger, permanent, people, summarise, unallocated, clientBilling: sheets.reduce((t, s) => t + pence(num(s.chargeTotal)), 0) / 100, agencyProfit: sheets.reduce((t, s) => t + pence(num(s.profit)), 0) / 100, timesheets: sheets.length };
  }

  async overview(organisationId: string, month: string) {
    const built = await this.build(organisationId, month);
    const rows = [...built.people.values()].filter((p) => p.lines.length > 0 || p.payments.length > 0 || p.rate > 0).map(built.summarise).sort((a, b) => a.name.localeCompare(b.name));
    const total = (pick: (r: (typeof rows)[number]) => number) => Math.round(rows.reduce((t, r) => t + pick(r) * 100, 0)) / 100;
    return {
      month,
      defaultBasis: built.orgBasis,
      /** Both stay visible: what the clients were billed and what the agency actually made. */
      permanentTrigger: built.trigger,
      /** Temporary and permanent are kept apart: temporary comes from approved timesheets, permanent from client fees. */
      temporary: { billing: built.clientBilling, profit: built.agencyProfit, timesheets: built.timesheets },
      permanent: { ...built.permanent, profit: built.permanent.revenue, outstandingInvoices: await this.outstandingPermanentInvoices(organisationId) },
      clientBilling: Math.round((built.clientBilling + built.permanent.revenue) * 100) / 100,
      agencyProfit: Math.round((built.agencyProfit + built.permanent.revenue) * 100) / 100,
      timesheets: built.timesheets,
      resourcers: rows,
      totals: { earnedTemporary: total((r) => r.earnedTemporary), earnedPermanent: total((r) => r.earnedPermanent), attributedBilling: total((r) => r.billings), attributedProfit: total((r) => r.profit), commissionable: total((r) => r.commissionable), earned: total((r) => r.earned), paid: total((r) => r.paid), outstanding: total((r) => r.outstanding) },
      unallocated: { timesheets: built.unallocated.reduce((t, u) => t + u.timesheets, 0), billing: Math.round(built.unallocated.reduce((t, u) => t + u.billing * 100, 0)) / 100, profit: Math.round(built.unallocated.reduce((t, u) => t + u.profit * 100, 0)) / 100, placements: built.unallocated },
    };
  }

  /** Client invoices raised and not yet paid (Sent or Overdue), and drafts not yet raised — as of today, not tied to a month. */
  private async outstandingPermanentInvoices(organisationId: string) {
    const now = new Date();
    const fees = await this.tenant(organisationId).fee.findMany({ where: { placement: { employmentType: 'PERMANENT' }, status: { in: ['PENDING', 'INVOICED', 'OVERDUE'] } }, select: { amount: true, status: true, dueDate: true } });
    const sum = (list: typeof fees) => Math.round(list.reduce((t, f) => t + pence(num(f.amount)), 0)) / 100;
    const raised = fees.filter((f) => f.status !== 'PENDING');
    const overdue = raised.filter((f) => f.dueDate && f.dueDate < now);
    const drafts = fees.filter((f) => f.status === 'PENDING');
    return { count: raised.length, amount: sum(raised), overdueCount: overdue.length, overdueAmount: sum(overdue), draftCount: drafts.length, draftAmount: sum(drafts) };
  }

  async statement(organisationId: string, month: string, userId: string) {
    const built = await this.build(organisationId, month);
    const person = built.people.get(userId);
    if (!person) {
      const user = await this.tenant(organisationId).user.findFirst({ where: { id: userId }, select: { id: true, firstName: true, lastName: true, commissionRate: true, commissionBasis: true } });
      if (!user) throw new ResourceNotFoundException('User', userId);
      return { month, employee: { userId, name: fullName(user), commissionRate: num(user.commissionRate), basis: ((user.commissionBasis as CommissionBasis | null) ?? built.orgBasis) as CommissionBasis }, lines: [] as StatementLine[], payments: [], totals: { placements: 0, sharedPlacements: 0, billings: 0, profit: 0, commissionable: 0, earned: 0, earnedTemporary: 0, earnedPermanent: 0, paid: 0, outstanding: 0 } };
    }
    const s = built.summarise(person);
    return {
      month,
      employee: { userId, name: person.name, commissionRate: person.rate, basis: person.basis },
      lines: person.lines.sort((a, b) => a.client.localeCompare(b.client) || a.worker.localeCompare(b.worker)),
      payments: person.payments.map((p) => ({ id: p.id, amount: p.amount, paidAt: p.paidAt, reference: p.reference })),
      totals: { placements: s.placements, sharedPlacements: s.sharedPlacements, billings: s.billings, profit: s.profit, commissionable: s.commissionable, earned: s.earned, earnedTemporary: s.earnedTemporary, earnedPermanent: s.earnedPermanent, paid: s.paid, outstanding: s.outstanding },
    };
  }

  // ------------------------------------------------------------------------------------------- payments

  async addPayment(organisationId: string, adminId: string, dto: AddPaymentDto) {
    const user = await this.tenant(organisationId).user.findFirst({ where: { id: dto.userId }, select: { id: true } });
    if (!user) throw new ResourceNotFoundException('User', dto.userId);
    const paidAt = dto.paidDate ? new Date(`${dto.paidDate}T12:00:00.000Z`) : new Date();
    if (paidAt.getTime() > Date.now() + 86_400_000) throw new AppException('INVALID_PAID_DATE', 'The payment date cannot be in the future.', HttpStatus.BAD_REQUEST);
    const payment = await this.db.client.commissionPayment.create({ data: { organisationId, userId: dto.userId, month: monthRange(dto.month).start, amount: dto.amount, paidAt, reference: dto.reference?.trim() || null, recordedById: adminId } });
    await this.auditLogs.record({ organisationId, userId: adminId, action: 'RECORD_COMMISSION_PAYMENT', entityType: 'CommissionPayment', entityId: payment.id, newValues: { userId: dto.userId, month: dto.month, amount: dto.amount } });
    return this.statement(organisationId, dto.month, dto.userId);
  }

  async removePayment(organisationId: string, adminId: string, id: string) {
    const payment = await this.tenant(organisationId).commissionPayment.findFirst({ where: { id } });
    if (!payment) throw new ResourceNotFoundException('Payment', id);
    await this.db.client.commissionPayment.delete({ where: { id } });
    await this.auditLogs.record({ organisationId, userId: adminId, action: 'DELETE_COMMISSION_PAYMENT', entityType: 'CommissionPayment', entityId: id, oldValues: { userId: payment.userId, amount: num(payment.amount) } });
    return { ok: true };
  }

  // ------------------------------------------------------------------------------------------- Excel

  async exportXlsx(organisationId: string, month: string) {
    const o = await this.overview(organisationId, month);
    const built = await this.build(organisationId, month);
    const summary = o.resourcers.map((r) => ({ Resourcer: r.name, 'Commission %': r.commissionRate, Basis: r.basis === 'PROFIT' ? 'Agency profit' : 'Client billing', Placements: r.placements, Shared: r.sharedPlacements, 'Earned (temporary)': r.earnedTemporary, 'Earned (permanent)': r.earnedPermanent, 'Attributed billings': r.billings, 'Attributed profit': r.profit, Commissionable: r.commissionable, 'Commission earned': r.earned, Paid: r.paid, Outstanding: r.outstanding }));
    const lines = [...built.people.values()].flatMap((p) => p.lines.map((l) => ({ Resourcer: p.name, Type: l.kind === 'PERMANENT' ? 'Permanent' : 'Temporary', 'Fee type': l.feeType === 'FIXED' ? 'Fixed fee' : l.feeType === 'PERCENTAGE' ? 'Percentage' : '', 'Invoice no.': l.invoiceNumber ?? '', Worker: l.worker, Client: l.client, Timesheets: l.timesheets, 'Placement billing': l.billingTotal, 'Placement profit': l.profitTotal, 'Share %': l.splitPercent, 'Shared with': l.sharedWith.join(', '), 'Attributed billing': l.attributedBilling, 'Attributed profit': l.attributedProfit, Commissionable: l.commissionable, Commission: l.commission })));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(summary.length ? summary : [{ Resourcer: 'No resourcer has placements this month' }]), 'Commission');
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(lines.length ? lines : [{ Resourcer: '—' }]), 'Placements');
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet([{ Item: 'Month', Value: month }, { Item: 'Temporary billing', Value: o.temporary.billing }, { Item: 'Temporary profit', Value: o.temporary.profit }, { Item: 'Permanent placements', Value: o.permanent.placements }, { Item: 'Permanent recruitment revenue', Value: o.permanent.revenue }, { Item: 'Fixed-fee placements', Value: o.permanent.fixedFee }, { Item: 'Percentage-fee placements', Value: o.permanent.percentageFee }, { Item: 'Outstanding client invoices', Value: o.permanent.outstandingInvoices.amount }, { Item: 'Total client billing', Value: o.clientBilling }, { Item: 'Total agency profit', Value: o.agencyProfit }, { Item: 'Commission earned', Value: o.totals.earned }, { Item: 'Commission paid', Value: o.totals.paid }, { Item: 'Outstanding', Value: o.totals.outstanding }, { Item: 'Billing with no resourcer', Value: o.unallocated.billing }, { Item: 'Profit with no resourcer', Value: o.unallocated.profit }]), 'Totals');
    return { buffer: XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer, filename: `Commission ${month}.xlsx` };
  }
}
