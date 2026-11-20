import { randomUUID } from 'node:crypto';

import { Prisma, scopedPrisma } from '@crm/database';
import { totalPages } from '@crm/utils';
import { HttpStatus, Injectable } from '@nestjs/common';

import { AppException, ResourceNotFoundException } from '../../../common/exceptions/app.exception';
import { DatabaseService } from '../../../infrastructure/database/database.service';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import type { AddAdjustmentDto, ApproveTimesheetDto, CreateTimesheetDto, ListTimesheetsQueryDto, RejectTimesheetDto, UpdateTimesheetDto, UpsertWorkerProfileDto } from '../dto';
import { findDiscrepancies, hasBlockingError, type Discrepancy } from '../lib/discrepancies';
import { buildPayslipPdf } from '../lib/payslip-pdf';
import { calculatePayroll, OVERRIDE_FIELDS, type AdjustmentKind, type Overrides, type PayrollFigures } from '../lib/payroll-calc';
import { payrollStageOf } from '../lib/payroll-stage';
import { DAY_MS, isMonday, isoDate, mondayOf, sundayOf, weekDates } from '../lib/week';

type RateType = 'DAY' | 'HOUR';
export interface Day {
  date: string;
  units: number;
}

export interface StoredAdjustment {
  id: string;
  kind: AdjustmentKind;
  label: string;
  amount: number;
  reason: string;
  addedById: string;
  addedAt: string;
}
export interface StoredOverrides {
  fields: Overrides;
  calculated: PayrollFigures;
  reason: string;
  byId: string;
  at: string;
}

const FIGURE_KEYS = ['gross', 'cisDeduction', 'payrollFee', 'netPay', 'chargeTotal', 'profit'] as const;
const DEFAULT_CIS = 20;
const DEFAULT_FEE = 15;
const num = (value: unknown) => Number(value);
const clean = (value: string | null | undefined) => (value?.trim() ? value.trim() : null);
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const pence = (value: number) => Math.round(value * 100);

/**
 * Weekly timesheets of temporary workers. A timesheet is one worker, one client and one working week (Monday to
 * Sunday). It is submitted (pending approval), checked by the administrator, approved or rejected; a rejected one can
 * be amended and resubmitted. Approval works out the payroll (pay, CIS, payroll fee, net, client charge, profit) and
 * writes the payslip. Every step is kept in the approval history.
 *
 * The money is always worked out on the server from the days/hours and the rates: nothing arrives pre-calculated.
 */
@Injectable()
export class TimesheetsService {
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
  // ------------------------------------------------------------------------------------------------ helpers

  private normaliseDays(days: { date: string; units: number }[], monday: Date): { days: Day[]; total: number } {
    const week = new Set(weekDates(monday));
    const byDate = new Map<string, number>();
    for (const day of days) {
      if (!week.has(day.date)) throw new AppException('DAY_OUTSIDE_WEEK', `${day.date} is not in the week starting ${isoDate(monday)}.`, HttpStatus.BAD_REQUEST);
      byDate.set(day.date, round2((byDate.get(day.date) ?? 0) + day.units));
    }
    const list = [...byDate.entries()].filter(([, units]) => units > 0).sort(([a], [b]) => a.localeCompare(b)).map(([date, units]) => ({ date, units }));
    return { days: list, total: round2(list.reduce((sum, d) => sum + d.units, 0)) };
  }

  private async profileOf(organisationId: string, candidateId: string) {
    return this.tenant(organisationId).workerPayrollProfile.findFirst({ where: { candidateId } });
  }

  private figures(input: { payRate: number; chargeRate: number; units: number; profile: { cisRate: unknown; payrollFee: unknown } | null; adjustments?: StoredAdjustment[]; overrides?: Overrides }) {
    return calculatePayroll({
      adjustments: (input.adjustments ?? []).map((a) => ({ kind: a.kind, label: a.label, amount: a.amount })),
      overrides: input.overrides,
      payRate: input.payRate,
      chargeRate: input.chargeRate,
      units: input.units,
      cisRate: input.profile ? num(input.profile.cisRate) : DEFAULT_CIS,
      payrollFee: input.profile ? num(input.profile.payrollFee) : DEFAULT_FEE,
    });
  }

  private async namesOf(organisationId: string, ids: (string | null | undefined)[]) {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (unique.length === 0) return new Map<string, string>();
    const users = await this.db.client.user.findMany({ where: { organisationId, id: { in: unique } }, select: { id: true, firstName: true, lastName: true } });
    return new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
  }

  private present(row: Record<string, any>) {
    return {
      ...row,
      payRate: num(row.payRate),
      chargeRate: num(row.chargeRate),
      totalUnits: num(row.totalUnits),
      gross: num(row.gross),
      cisRate: num(row.cisRate),
      cisDeduction: num(row.cisDeduction),
      payrollFee: num(row.payrollFee),
      netPay: num(row.netPay),
      chargeTotal: num(row.chargeTotal),
      profit: num(row.profit),
      days: (row.days as Day[]) ?? [],
      adjustments: ((row.adjustments as unknown) as StoredAdjustment[]) ?? [],
      overrides: (row.overrides as unknown as StoredOverrides | null) ?? null,
    };
  }

  private async discrepanciesOf(organisationId: string, row: { id: string; candidateId: string; companyId: string; weekStart: Date; rateType: string; payRate: unknown; chargeRate: unknown; days: unknown; totalUnits: unknown; clientConfirmedBy: string | null; attachmentDocumentId: string | null }): Promise<Discrepancy[]> {
    const profile = await this.profileOf(organisationId, row.candidateId);
    const other = await this.tenant(organisationId).timesheet.count({ where: { candidateId: row.candidateId, weekStart: row.weekStart, companyId: { not: row.companyId }, status: { not: 'REJECTED' } } });
    return findDiscrepancies({
      rateType: row.rateType as RateType,
      payRate: num(row.payRate),
      chargeRate: num(row.chargeRate),
      days: (row.days as Day[]) ?? [],
      totalUnits: num(row.totalUnits),
      weekDates: weekDates(row.weekStart),
      clientConfirmedBy: row.clientConfirmedBy,
      hasAttachment: Boolean(row.attachmentDocumentId),
      profile: profile ? { nino: profile.nino, utr: profile.utr, payRate: profile.payRate === null ? null : num(profile.payRate), chargeRate: profile.chargeRate === null ? null : num(profile.chargeRate), rateType: profile.rateType as RateType } : null,
      otherClientSameWeek: other > 0,
    });
  }

  private async ensureAttachment(organisationId: string, documentId?: string | null) {
    if (!documentId) return;
    const found = await this.tenant(organisationId).document.findFirst({ where: { id: documentId }, select: { id: true } });
    if (!found) throw new AppException('ATTACHMENT_NOT_FOUND', 'The attached file was not found.', HttpStatus.BAD_REQUEST);
  }

  // ------------------------------------------------------------------------------------------------ workers

  /** Workers to choose from: with a search, any candidate by name; without one, people on an active temporary placement. */
  async workers(organisationId: string, search?: string, sensitive = false) {
    const term = search?.trim();
    const where = term
      ? { deletedAt: null, OR: term.split(/\s+/).flatMap((word) => [{ firstName: { contains: word, mode: 'insensitive' as const } }, { lastName: { contains: word, mode: 'insensitive' as const } }]) }
      : { deletedAt: null, placements: { some: { status: 'ACTIVE' as const, employmentType: 'TEMPORARY' as const } } };
    const candidates = await this.tenant(organisationId).candidate.findMany({
      where,
      take: term ? 20 : 50,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        placements: { where: { status: 'ACTIVE', employmentType: 'TEMPORARY' }, select: { id: true, company: { select: { id: true, name: true } }, job: { select: { id: true, title: true } } } },
        payrollProfiles: true,
      },
    });
    return candidates.map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`.trim(),
      placements: c.placements.map((p) => ({ id: p.id, companyId: p.company.id, companyName: p.company.name, jobId: p.job.id, jobTitle: p.job.title })),
      profile: c.payrollProfiles[0] ? this.presentProfile(c.payrollProfiles[0], sensitive) : null,
    }));
  }

  /** NINO and UTR are shown only to someone with payroll:sensitive; everyone else sees that they exist, with all but the last 3 characters hidden. */
  private presentProfile(p: { nino: string | null; utr: string | null; cisRate: unknown; payrollFee: unknown; rateType: string; payRate: unknown; chargeRate: unknown }, sensitive = false) {
    const hide = (value: string | null) => (value ? `${'•'.repeat(Math.max(0, value.length - 3))}${value.slice(-3)}` : null);
    return { restricted: !sensitive, nino: sensitive ? p.nino : hide(p.nino), utr: sensitive ? p.utr : hide(p.utr), cisRate: num(p.cisRate), payrollFee: num(p.payrollFee), rateType: p.rateType as RateType, payRate: p.payRate === null ? null : num(p.payRate), chargeRate: p.chargeRate === null ? null : num(p.chargeRate) };
  }

  async getProfile(organisationId: string, candidateId: string, sensitive = false) {
    const profile = await this.profileOf(organisationId, candidateId);
    return profile ? this.presentProfile(profile, sensitive) : { nino: null, utr: null, cisRate: DEFAULT_CIS, payrollFee: DEFAULT_FEE, rateType: 'DAY' as RateType, payRate: null, chargeRate: null };
  }

  async upsertProfile(organisationId: string, userId: string, candidateId: string, dto: UpsertWorkerProfileDto, sensitive = false) {
    if (!sensitive && (dto.nino !== undefined || dto.utr !== undefined)) throw new AppException('RESTRICTED', 'Only someone authorised for payroll details may see or change NINO and UTR.', HttpStatus.FORBIDDEN);
    const candidate = await this.tenant(organisationId).candidate.findFirst({ where: { id: candidateId, deletedAt: null }, select: { id: true } });
    if (!candidate) throw new ResourceNotFoundException('Candidate', candidateId);
    const data = {
      ...(dto.nino !== undefined ? { nino: clean(dto.nino)?.toUpperCase().replace(/\s+/g, '') ?? null } : {}),
      ...(dto.utr !== undefined ? { utr: clean(dto.utr)?.replace(/\s+/g, '') ?? null } : {}),
      ...(dto.cisRate !== undefined ? { cisRate: dto.cisRate } : {}),
      ...(dto.payrollFee !== undefined ? { payrollFee: dto.payrollFee } : {}),
      ...(dto.rateType !== undefined ? { rateType: dto.rateType } : {}),
      ...(dto.payRate !== undefined ? { payRate: dto.payRate } : {}),
      ...(dto.chargeRate !== undefined ? { chargeRate: dto.chargeRate } : {}),
    };
    const saved = await this.db.client.workerPayrollProfile.upsert({
      where: { organisationId_candidateId: { organisationId, candidateId } },
      create: { organisationId, candidateId, ...data },
      update: data,
    });
    // the audit log records which fields changed, never the tax references themselves
    await this.auditLogs.record({ organisationId, userId, action: 'UPDATE_WORKER_PAYROLL_PROFILE', entityType: 'Candidate', entityId: candidateId, newValues: { fields: Object.keys(data) } });
    return this.presentProfile(saved, sensitive);
  }

  // ------------------------------------------------------------------------------------------------ list / read

  async list(organisationId: string, query: ListTimesheetsQueryDto) {
    const week = query.week ? mondayOf(query.week) : undefined;
    const words = query.search?.trim().split(/\s+/).filter(Boolean) ?? [];
    const where = {
      ...(week ? { weekStart: week } : {}),
      ...(query.candidateId ? { candidateId: query.candidateId } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(words.length
        ? { AND: words.map((word) => ({ OR: [{ candidate: { firstName: { contains: word, mode: 'insensitive' as const } } }, { candidate: { lastName: { contains: word, mode: 'insensitive' as const } } }, { company: { name: { contains: word, mode: 'insensitive' as const } } }] })) }
        : {}),
    };
    const scoped = this.tenant(organisationId).timesheet;
    const [items, totalItems, grouped, sums] = await Promise.all([
      scoped.findMany({
        where: { ...where, ...(query.status ? { status: query.status } : {}) },
        orderBy: [{ weekStart: 'desc' }, { submittedAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { candidate: { select: { id: true, firstName: true, lastName: true } }, company: { select: { id: true, name: true } } },
      }),
      scoped.count({ where: { ...where, ...(query.status ? { status: query.status } : {}) } }),
      scoped.groupBy({ by: ['status'], where, _count: { _all: true } }),
      scoped.findMany({ where: { ...where, status: { not: 'REJECTED' } }, select: { status: true, gross: true, netPay: true, cisDeduction: true, payrollFee: true, chargeTotal: true, profit: true } }),
    ]);
    const slips = await this.tenant(organisationId).payslip.findMany({ where: { timesheetId: { in: items.map((i) => i.id) } }, select: { timesheetId: true, paymentStatus: true, issuedAt: true } });
    const slipOf = new Map(slips.map((p) => [p.timesheetId as string, { paymentStatus: p.paymentStatus, issuedAt: p.issuedAt }]));
    const counts = { PENDING_APPROVAL: 0, APPROVED: 0, REJECTED: 0 } as Record<string, number>;
    for (const g of grouped) counts[g.status] = g._count._all;
    const zero = () => ({ gross: 0, netPay: 0, cisDeduction: 0, payrollFee: 0, chargeTotal: 0, profit: 0 });
    const approved = zero();
    const pending = zero();
    for (const s of sums) {
      const target = s.status === 'APPROVED' ? approved : pending;
      for (const key of Object.keys(target) as (keyof typeof target)[]) target[key] += pence(num(s[key]));
    }
    const toPounds = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v / 100]));
    return {
      items: items.map((item) => ({ ...this.present(item), candidateName: `${item.candidate.firstName} ${item.candidate.lastName}`.trim(), stage: payrollStageOf({ status: item.status, checkedAt: item.checkedAt, payslip: slipOf.get(item.id) ?? null }) })),
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: totalPages(totalItems, query.pageSize),
      summary: { counts, approved: toPounds(approved), pending: toPounds(pending) },
    };
  }

  async getById(organisationId: string, id: string) {
    const row = await this.tenant(organisationId).timesheet.findFirst({
      where: { id },
      include: { candidate: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } }, company: { select: { id: true, name: true } }, events: { orderBy: { createdAt: 'asc' } } },
    });
    if (!row) throw new ResourceNotFoundException('Timesheet', id);
    const names = await this.namesOf(organisationId, [row.submittedById, row.decidedById, row.checkedById, ...row.events.map((e) => e.userId)]);
    const payslip = row.status === 'APPROVED' ? await this.tenant(organisationId).payslip.findFirst({ where: { timesheetId: id }, select: { id: true, notes: true, paymentStatus: true, paidAt: true, paymentReference: true, issuedAt: true } }) : null;
    const attachment = row.attachmentDocumentId ? await this.tenant(organisationId).document.findFirst({ where: { id: row.attachmentDocumentId }, select: { id: true, name: true } }) : null;
    const discrepancies = row.status === 'APPROVED' ? [] : await this.discrepanciesOf(organisationId, row);
    const profile = await this.profileOf(organisationId, row.candidateId);
    return {
      ...this.present(row),
      candidateName: `${row.candidate.firstName} ${row.candidate.lastName}`.trim(),
      submittedByName: row.submittedById ? (names.get(row.submittedById) ?? null) : null,
      decidedByName: row.decidedById ? (names.get(row.decidedById) ?? null) : null,
      payslipId: payslip?.id ?? null,
      payslipNotes: payslip?.notes ?? null,
      paymentStatus: payslip?.paymentStatus ?? null,
      paidAt: payslip?.paidAt ?? null,
      paymentReference: payslip?.paymentReference ?? null,
      attachment,
      stage: payrollStageOf({ status: row.status, checkedAt: row.checkedAt, payslip: payslip ? { paymentStatus: payslip.paymentStatus, issuedAt: payslip.issuedAt } : null }),
      checkedByName: row.checkedById ? (names.get(row.checkedById) ?? null) : null,
      issuedAt: payslip?.issuedAt ?? null,
      discrepancies,
      canApprove: row.status === 'PENDING_APPROVAL' && !hasBlockingError(discrepancies),
      profile: profile ? { cisRate: num(profile.cisRate), payrollFee: num(profile.payrollFee), hasNino: Boolean(profile.nino), hasUtr: Boolean(profile.utr) } : null,
      events: row.events.map((event) => ({ id: event.id, action: event.action, note: event.note, changes: event.changes, createdAt: event.createdAt, userName: event.userId ? (names.get(event.userId) ?? null) : null })),
    };
  }

  // ------------------------------------------------------------------------------------------------ submit / amend

  async create(organisationId: string, userId: string, dto: CreateTimesheetDto) {
    if (!isMonday(dto.weekStart)) throw new AppException('WEEK_NOT_MONDAY', 'The working week must start on a Monday.', HttpStatus.BAD_REQUEST);
    const monday = mondayOf(dto.weekStart);
    const [candidate, company] = await Promise.all([
      this.tenant(organisationId).candidate.findFirst({ where: { id: dto.candidateId, deletedAt: null }, select: { id: true } }),
      this.tenant(organisationId).company.findFirst({ where: { id: dto.companyId }, select: { id: true } }),
    ]);
    if (!candidate) throw new AppException('CANDIDATE_NOT_FOUND', 'Worker not found.', HttpStatus.NOT_FOUND);
    if (!company) throw new AppException('COMPANY_NOT_FOUND', 'Client not found.', HttpStatus.NOT_FOUND);
    await this.ensureAttachment(organisationId, dto.attachmentDocumentId);
    const { days, total } = this.normaliseDays(dto.days, monday);
    if (total <= 0) throw new AppException('NO_TIME', 'Enter at least one day or some hours worked.', HttpStatus.BAD_REQUEST);

    const duplicate = await this.tenant(organisationId).timesheet.findFirst({ where: { candidateId: dto.candidateId, companyId: dto.companyId, weekStart: monday }, select: { id: true, status: true } });
    if (duplicate) {
      throw new AppException('DUPLICATE_TIMESHEET', 'This worker already has a timesheet for this client in this week. Open it instead of adding another.', HttpStatus.CONFLICT, { timesheetId: duplicate.id, status: duplicate.status });
    }

    const profile = await this.profileOf(organisationId, dto.candidateId);
    const f = this.figures({ payRate: dto.payRate, chargeRate: dto.chargeRate, units: total, profile });
    const created = await this.db.client.$transaction(async (tx) => {
      const row = await tx.timesheet.create({
        data: {
          organisationId,
          candidateId: dto.candidateId,
          companyId: dto.companyId,
          placementId: dto.placementId ?? null,
          jobId: dto.jobId ?? null,
          weekStart: monday,
          weekEnd: sundayOf(monday),
          rateType: dto.rateType,
          payRate: dto.payRate,
          chargeRate: dto.chargeRate,
          days: days as never,
          totalUnits: total,
          gross: f.gross,
          cisRate: profile ? num(profile.cisRate) : DEFAULT_CIS,
          cisDeduction: f.cisDeduction,
          payrollFee: f.payrollFee,
          netPay: f.netPay,
          chargeTotal: f.chargeTotal,
          profit: f.profit,
          clientConfirmedBy: clean(dto.clientConfirmedBy),
          clientConfirmedEmail: clean(dto.clientConfirmedEmail),
          clientConfirmedAt: dto.clientConfirmedBy ? new Date() : null,
          attachmentDocumentId: dto.attachmentDocumentId ?? null,
          notes: clean(dto.notes),
          submittedById: userId,
        },
      });
      await tx.timesheetEvent.create({ data: { organisationId, timesheetId: row.id, action: 'SUBMITTED', userId, note: `${total} ${dto.rateType === 'DAY' ? 'day(s)' : 'hour(s)'} submitted` } });
      // remember this worker's usual rates the first time, so the next timesheet starts with them
      if (!profile || profile.payRate === null || profile.chargeRate === null) {
        await tx.workerPayrollProfile.upsert({
          where: { organisationId_candidateId: { organisationId, candidateId: dto.candidateId } },
          create: { organisationId, candidateId: dto.candidateId, rateType: dto.rateType, payRate: dto.payRate, chargeRate: dto.chargeRate },
          update: { rateType: dto.rateType, payRate: dto.payRate, chargeRate: dto.chargeRate },
        });
      }
      return row;
    });
    await this.auditLogs.record({ organisationId, userId, action: 'SUBMIT_TIMESHEET', entityType: 'Timesheet', entityId: created.id, newValues: { week: isoDate(monday), units: total } });
    return this.getById(organisationId, created.id);
  }

  async update(organisationId: string, userId: string, id: string, dto: UpdateTimesheetDto, canApprove = false) {
    const existing = await this.tenant(organisationId).timesheet.findFirst({ where: { id } });
    if (!existing) throw new ResourceNotFoundException('Timesheet', id);
    const wasApproved = existing.status === 'APPROVED';
    if (wasApproved) {
      // an approved timesheet can still be corrected by an authorised person, with a reason, until the payment is authorised
      if (!canApprove) throw new AppException('NOT_ALLOWED', 'Only an authorised person can change an approved timesheet.', HttpStatus.FORBIDDEN);
      if ((dto.amendmentNote?.trim().length ?? 0) < 3) throw new AppException('REASON_REQUIRED', 'Say why you are changing an approved timesheet.', HttpStatus.BAD_REQUEST);
      this.assertMoneyEditable(await this.tenant(organisationId).payslip.findFirst({ where: { timesheetId: id }, select: { paymentStatus: true } }));
    }
    await this.ensureAttachment(organisationId, dto.attachmentDocumentId);

    const days = dto.days ? this.normaliseDays(dto.days, existing.weekStart) : { days: ((existing.days as unknown) as Day[]) ?? [], total: num(existing.totalUnits) };
    if (days.total <= 0) throw new AppException('NO_TIME', 'Enter at least one day or some hours worked.', HttpStatus.BAD_REQUEST);
    const rateType = dto.rateType ?? (existing.rateType as RateType);
    const payRate = dto.payRate ?? num(existing.payRate);
    const chargeRate = dto.chargeRate ?? num(existing.chargeRate);
    const profile = await this.profileOf(organisationId, existing.candidateId);
    const f = this.figures({ payRate, chargeRate, units: days.total, profile, adjustments: ((existing.adjustments as unknown) as StoredAdjustment[]) ?? [], overrides: ((existing.overrides as unknown) as StoredOverrides | null)?.fields });

    const next = {
      rateType,
      payRate,
      chargeRate,
      totalUnits: days.total,
      clientConfirmedBy: dto.clientConfirmedBy !== undefined ? clean(dto.clientConfirmedBy) : existing.clientConfirmedBy,
      clientConfirmedEmail: dto.clientConfirmedEmail !== undefined ? clean(dto.clientConfirmedEmail) : existing.clientConfirmedEmail,
      attachmentDocumentId: dto.attachmentDocumentId !== undefined ? dto.attachmentDocumentId : existing.attachmentDocumentId,
      notes: dto.notes !== undefined ? clean(dto.notes) : existing.notes,
    };
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    const compare = (key: string, from: unknown, to: unknown) => {
      if (JSON.stringify(from) !== JSON.stringify(to)) changes[key] = { from, to };
    };
    compare('rateType', existing.rateType, next.rateType);
    compare('payRate', num(existing.payRate), next.payRate);
    compare('chargeRate', num(existing.chargeRate), next.chargeRate);
    compare('days', existing.days, days.days);
    compare('totalUnits', num(existing.totalUnits), next.totalUnits);
    compare('clientConfirmedBy', existing.clientConfirmedBy, next.clientConfirmedBy);
    compare('clientConfirmedEmail', existing.clientConfirmedEmail, next.clientConfirmedEmail);
    compare('attachmentDocumentId', existing.attachmentDocumentId, next.attachmentDocumentId);
    compare('notes', existing.notes, next.notes);
    const wasRejected = existing.status === 'REJECTED';
    if (Object.keys(changes).length === 0 && !wasRejected) throw new AppException('NOTHING_CHANGED', 'Nothing was changed.', HttpStatus.BAD_REQUEST);
    Object.assign(changes, this.figureChanges(existing, f));

    await this.db.client.$transaction(async (tx) => {
      await tx.timesheet.update({
        where: { id },
        data: {
          ...next,
          days: days.days as never,
          gross: f.gross,
          cisRate: profile ? num(profile.cisRate) : DEFAULT_CIS,
          cisDeduction: f.cisDeduction,
          payrollFee: f.payrollFee,
          netPay: f.netPay,
          chargeTotal: f.chargeTotal,
          profit: f.profit,
          clientConfirmedAt: next.clientConfirmedBy && next.clientConfirmedBy !== existing.clientConfirmedBy ? new Date() : existing.clientConfirmedAt,
          ...(wasApproved ? {} : { status: 'PENDING_APPROVAL' as const, decidedById: null, decidedAt: null, rejectionReason: null, checkedAt: null, checkedById: null }),
        },
      });
      if (wasApproved) await this.syncPayslip(tx, id, { rateType, payRate, units: days.total, cisRate: profile ? num(profile.cisRate) : DEFAULT_CIS, f, lines: f.lines });
      if (Object.keys(changes).length > 0) await tx.timesheetEvent.create({ data: { organisationId, timesheetId: id, action: 'AMENDED', userId, note: clean(dto.amendmentNote), changes: changes as never } });
      if (wasRejected) await tx.timesheetEvent.create({ data: { organisationId, timesheetId: id, action: 'RESUBMITTED', userId, note: 'Sent back for approval' } });
    });
    await this.auditLogs.record({ organisationId, userId, action: wasRejected ? 'RESUBMIT_TIMESHEET' : 'AMEND_TIMESHEET', entityType: 'Timesheet', entityId: id, newValues: { fields: Object.keys(changes) } });
    return this.getById(organisationId, id);
  }

  // ------------------------------------------------------------------------------------------------ decide

  async approve(organisationId: string, userId: string, id: string, dto: ApproveTimesheetDto) {
    const row = await this.tenant(organisationId).timesheet.findFirst({ where: { id }, include: { candidate: { select: { firstName: true, lastName: true } } } });
    if (!row) throw new ResourceNotFoundException('Timesheet', id);
    if (row.status === 'APPROVED') throw new AppException('ALREADY_APPROVED', 'This timesheet is already approved.', HttpStatus.CONFLICT);
    if (row.status === 'REJECTED') throw new AppException('TIMESHEET_REJECTED', 'This timesheet was rejected. It must be amended and resubmitted before it can be approved.', HttpStatus.CONFLICT);
    const problems = await this.discrepanciesOf(organisationId, row);
    if (hasBlockingError(problems)) throw new AppException('TIMESHEET_HAS_ERRORS', 'This timesheet has errors that must be fixed before it can be approved.', HttpStatus.UNPROCESSABLE_ENTITY, { discrepancies: problems.filter((p) => p.severity === 'error') });

    const profile = await this.profileOf(organisationId, row.candidateId);
    const paymentDate = new Date(row.weekEnd.getTime() + 5 * DAY_MS);
    const payslipId = await this.db.client.$transaction(async (tx) => {
      // the figures the administrator saw are the figures that are paid (the status check inside the update stops a double approval)
      const claimed = await tx.timesheet.updateMany({ where: { id, organisationId, status: 'PENDING_APPROVAL' }, data: { status: 'APPROVED', decidedById: userId, decidedAt: new Date(), rejectionReason: null, ...(row.checkedAt ? {} : { checkedAt: new Date(), checkedById: userId }) } });
      if (claimed.count !== 1) throw new AppException('ALREADY_DECIDED', 'This timesheet was just decided by someone else.', HttpStatus.CONFLICT);
      const payslip = await tx.payslip.create({
        data: {
          organisationId,
          timesheetId: id,
          paymentStatus: 'UNPAID',
          candidateId: row.candidateId,
          employeeName: `${row.candidate.firstName} ${row.candidate.lastName}`.trim(),
          nino: profile?.nino ?? null,
          utr: profile?.utr ?? null,
          weekStart: row.weekStart,
          weekEnd: row.weekEnd,
          paymentDate,
          rateType: row.rateType,
          rate: row.payRate,
          quantity: row.totalUnits,
          gross: row.gross,
          cisRate: row.cisRate,
          cisDeduction: row.cisDeduction,
          payrollFee: row.payrollFee,
          netPay: row.netPay,
          extraLines: this.figures({ payRate: num(row.payRate), chargeRate: num(row.chargeRate), units: num(row.totalUnits), profile, adjustments: ((row.adjustments as unknown) as StoredAdjustment[]) ?? [], overrides: ((row.overrides as unknown) as StoredOverrides | null)?.fields }).lines as never,
          currency: row.currency,
          notes: null,
        },
      });
      await tx.timesheetEvent.create({ data: { organisationId, timesheetId: id, action: 'APPROVED', userId, note: clean(dto.note) } });
      await tx.timesheetEvent.create({ data: { organisationId, timesheetId: id, action: 'PAYSLIP_GENERATED', userId, note: `Net pay £${num(row.netPay).toFixed(2)}` } });
      return payslip.id;
    });
    await this.auditLogs.record({ organisationId, userId, action: 'APPROVE_TIMESHEET', entityType: 'Timesheet', entityId: id, newValues: { payslipId, netPay: num(row.netPay) } });
    return this.getById(organisationId, id);
  }

  /** "Checked — ready for the approval decision": the timesheet moves from received to awaiting approval. */
  async markChecked(organisationId: string, userId: string, id: string) {
    const row = await this.tenant(organisationId).timesheet.findFirst({ where: { id }, select: { id: true, status: true, checkedAt: true } });
    if (!row) throw new ResourceNotFoundException('Timesheet', id);
    if (row.status !== 'PENDING_APPROVAL') throw new AppException('NOT_PENDING', 'Only a timesheet that is waiting for approval can be marked as checked.', HttpStatus.CONFLICT);
    if (row.checkedAt) return this.getById(organisationId, id);
    await this.db.client.$transaction(async (tx) => {
      await tx.timesheet.update({ where: { id }, data: { checkedAt: new Date(), checkedById: userId } });
      await tx.timesheetEvent.create({ data: { organisationId, timesheetId: id, action: 'CHECKED', userId, note: 'Checked and ready for approval' } });
    });
    await this.auditLogs.record({ organisationId, userId, action: 'CHECK_TIMESHEET', entityType: 'Timesheet', entityId: id });
    return this.getById(organisationId, id);
  }

  async reject(organisationId: string, userId: string, id: string, dto: RejectTimesheetDto) {
    const row = await this.tenant(organisationId).timesheet.findFirst({ where: { id }, select: { id: true, status: true } });
    if (!row) throw new ResourceNotFoundException('Timesheet', id);
    if (row.status !== 'PENDING_APPROVAL') throw new AppException('NOT_PENDING', 'Only a timesheet that is waiting for approval can be rejected.', HttpStatus.CONFLICT);
    await this.db.client.$transaction(async (tx) => {
      const claimed = await tx.timesheet.updateMany({ where: { id, organisationId, status: 'PENDING_APPROVAL' }, data: { status: 'REJECTED', decidedById: userId, decidedAt: new Date(), rejectionReason: dto.reason.trim() } });
      if (claimed.count !== 1) throw new AppException('ALREADY_DECIDED', 'This timesheet was just decided by someone else.', HttpStatus.CONFLICT);
      await tx.timesheetEvent.create({ data: { organisationId, timesheetId: id, action: 'REJECTED', userId, note: dto.reason.trim() } });
    });
    await this.auditLogs.record({ organisationId, userId, action: 'REJECT_TIMESHEET', entityType: 'Timesheet', entityId: id, newValues: { reason: dto.reason.trim() } });
    return this.getById(organisationId, id);
  }

  // ------------------------------------------------------------------------------------------------ manual control

  /** The figures cannot change once the money has been authorised or sent. */
  private assertMoneyEditable(payslip: { paymentStatus: string } | null) {
    if (!payslip || payslip.paymentStatus === 'UNPAID') return;
    throw new AppException(
      'PAYMENT_LOCKED',
      payslip.paymentStatus === 'PAID' ? 'This worker has already been paid, so the figures can no longer be changed.' : 'The payment is authorised. Take the authorisation back on the Weekly payroll screen before changing the figures.',
      HttpStatus.CONFLICT,
    );
  }

  /** What changed between the stored figures and new ones, for the history. */
  private figureChanges(row: Record<string, any>, f: PayrollFigures) {
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of FIGURE_KEYS) if (Math.round(num(row[key]) * 100) !== Math.round(f[key] * 100)) changes[key] = { from: num(row[key]), to: f[key] };
    return changes;
  }

  /** Rewrites the payslip of an approved timesheet (only while it is still unpaid) so it always matches the timesheet. */
  private async syncPayslip(tx: any, timesheetId: string, data: { rateType: string; payRate: number; units: number; cisRate: number; f: PayrollFigures; lines: unknown }) {
    await tx.payslip.updateMany({
      where: { timesheetId },
      data: { rateType: data.rateType, rate: data.payRate, quantity: data.units, gross: data.f.gross, cisRate: data.cisRate, cisDeduction: data.f.cisDeduction, payrollFee: data.f.payrollFee, netPay: data.f.netPay, extraLines: data.lines as never },
    });
  }

  private async moneyRow(organisationId: string, id: string) {
    const row = await this.tenant(organisationId).timesheet.findFirst({ where: { id } });
    if (!row) throw new ResourceNotFoundException('Timesheet', id);
    if (row.status === 'REJECTED') throw new AppException('TIMESHEET_REJECTED', 'This timesheet was rejected. Amend and resubmit it first.', HttpStatus.CONFLICT);
    const payslip = row.status === 'APPROVED' ? await this.tenant(organisationId).payslip.findFirst({ where: { timesheetId: id }, select: { id: true, paymentStatus: true } }) : null;
    this.assertMoneyEditable(payslip);
    return row;
  }

  /** Works the figures out again for a stored timesheet with the given adjustments and overrides, and saves them. */
  private async applyMoney(
    organisationId: string,
    userId: string,
    row: Record<string, any>,
    change: { adjustments: StoredAdjustment[]; overrides: StoredOverrides | null; action: 'ADJUSTMENT_ADDED' | 'ADJUSTMENT_REMOVED' | 'OVERRIDDEN' | 'OVERRIDE_CLEARED' | 'RECALCULATED'; note: string; extra?: Record<string, { from: unknown; to: unknown }> },
  ) {
    const profile = await this.profileOf(organisationId, row.candidateId);
    const cisRate = profile ? num(profile.cisRate) : DEFAULT_CIS;
    const result = this.figures({ payRate: num(row.payRate), chargeRate: num(row.chargeRate), units: num(row.totalUnits), profile, adjustments: change.adjustments, overrides: change.overrides?.fields });
    const changes = { ...(change.extra ?? {}), ...this.figureChanges(row, result) };
    await this.db.client.$transaction(async (tx) => {
      await tx.timesheet.update({
        where: { id: row.id },
        data: {
          adjustments: change.adjustments as never,
          overrides: change.overrides ? (change.overrides as never) : Prisma.DbNull,
          gross: result.gross,
          cisRate,
          cisDeduction: result.cisDeduction,
          payrollFee: result.payrollFee,
          netPay: result.netPay,
          chargeTotal: result.chargeTotal,
          profit: result.profit,
        },
      });
      if (row.status === 'APPROVED') await this.syncPayslip(tx, row.id, { rateType: row.rateType, payRate: num(row.payRate), units: num(row.totalUnits), cisRate, f: result, lines: result.lines });
      await tx.timesheetEvent.create({ data: { organisationId, timesheetId: row.id, action: change.action, userId, note: change.note, changes: changes as never } });
    });
    await this.auditLogs.record({ organisationId, userId, action: `PAYROLL_${change.action}`, entityType: 'Timesheet', entityId: row.id, newValues: { note: change.note, netPay: result.netPay } });
    return result;
  }

  async addAdjustment(organisationId: string, userId: string, id: string, dto: AddAdjustmentDto) {
    const row = await this.moneyRow(organisationId, id);
    if (dto.kind !== 'ADJUSTMENT' && dto.amount <= 0) throw new AppException('INVALID_AMOUNT', 'The amount must be more than zero. Use the type to say whether it is paid or taken off.', HttpStatus.BAD_REQUEST);
    if (dto.amount === 0) throw new AppException('INVALID_AMOUNT', 'The amount cannot be zero.', HttpStatus.BAD_REQUEST);
    const adjustments = [...(((row.adjustments as unknown) as StoredAdjustment[]) ?? [])];
    if (adjustments.length >= 20) throw new AppException('TOO_MANY_ADJUSTMENTS', 'A timesheet can have at most 20 adjustment lines.', HttpStatus.BAD_REQUEST);
    const added: StoredAdjustment = { id: randomUUID(), kind: dto.kind, label: dto.label.trim(), amount: round2(dto.amount), reason: dto.reason.trim(), addedById: userId, addedAt: new Date().toISOString() };
    adjustments.push(added);
    await this.applyMoney(organisationId, userId, row, {
      adjustments,
      overrides: ((row.overrides as unknown) as StoredOverrides | null) ?? null,
      action: 'ADJUSTMENT_ADDED',
      note: `${added.label}: £${added.amount.toFixed(2)} — ${added.reason}`,
      extra: { adjustment: { from: null, to: { kind: added.kind, label: added.label, amount: added.amount } } },
    });
    return this.getById(organisationId, id);
  }

  async removeAdjustment(organisationId: string, userId: string, id: string, adjustmentId: string, reason: string) {
    const row = await this.moneyRow(organisationId, id);
    const adjustments = ((row.adjustments as unknown) as StoredAdjustment[]) ?? [];
    const removed = adjustments.find((a) => a.id === adjustmentId);
    if (!removed) throw new AppException('ADJUSTMENT_NOT_FOUND', 'That adjustment line was not found.', HttpStatus.NOT_FOUND);
    await this.applyMoney(organisationId, userId, row, {
      adjustments: adjustments.filter((a) => a.id !== adjustmentId),
      overrides: ((row.overrides as unknown) as StoredOverrides | null) ?? null,
      action: 'ADJUSTMENT_REMOVED',
      note: `${removed.label}: £${removed.amount.toFixed(2)} removed — ${reason.trim()}`,
      extra: { adjustment: { from: { kind: removed.kind, label: removed.label, amount: removed.amount }, to: null } },
    });
    return this.getById(organisationId, id);
  }

  /** Replaces a calculated figure by hand. The calculated value is kept next to it, and the reason is recorded. */
  async setOverrides(organisationId: string, userId: string, id: string, fields: Overrides, reason: string) {
    const row = await this.moneyRow(organisationId, id);
    const chosen = Object.fromEntries(OVERRIDE_FIELDS.filter((key) => fields[key] !== undefined && fields[key] !== null).map((key) => [key, round2(Number(fields[key]))])) as Overrides;
    if (Object.keys(chosen).length === 0) throw new AppException('NOTHING_TO_OVERRIDE', 'Enter at least one figure to override.', HttpStatus.BAD_REQUEST);
    const adjustments = ((row.adjustments as unknown) as StoredAdjustment[]) ?? [];
    // what the calculation says with no override, so the screen and the history can show what was replaced
    const profile = await this.profileOf(organisationId, row.candidateId);
    const calculated = this.figures({ payRate: num(row.payRate), chargeRate: num(row.chargeRate), units: num(row.totalUnits), profile, adjustments }).calculated;
    const overrides: StoredOverrides = { fields: chosen, calculated, reason: reason.trim(), byId: userId, at: new Date().toISOString() };
    await this.applyMoney(organisationId, userId, row, {
      adjustments,
      overrides,
      action: 'OVERRIDDEN',
      note: `${Object.entries(chosen).map(([k, v]) => `${k} £${(v as number).toFixed(2)} (calculated £${(calculated as any)[k].toFixed(2)})`).join(', ')} — ${reason.trim()}`,
    });
    return this.getById(organisationId, id);
  }

  async clearOverrides(organisationId: string, userId: string, id: string, reason: string) {
    const row = await this.moneyRow(organisationId, id);
    if (!row.overrides) throw new AppException('NO_OVERRIDE', 'There is no override on this timesheet.', HttpStatus.BAD_REQUEST);
    await this.applyMoney(organisationId, userId, row, { adjustments: ((row.adjustments as unknown) as StoredAdjustment[]) ?? [], overrides: null, action: 'OVERRIDE_CLEARED', note: `Back to the calculated figures — ${reason.trim()}` });
    return this.getById(organisationId, id);
  }

  /**
   * Works the figures of one timesheet out again from its days, rates, the worker's current payroll details, its
   * adjustments and overrides. Used by "Recalculate the week". With `dryRun` nothing is saved: it only reports what
   * would change. Timesheets whose payment is authorised or paid are left alone.
   */
  async recalculate(organisationId: string, userId: string, id: string, dryRun: boolean) {
    const row = await this.tenant(organisationId).timesheet.findFirst({ where: { id } });
    if (!row) throw new ResourceNotFoundException('Timesheet', id);
    if (row.status === 'REJECTED') return { id, state: 'skipped' as const, reason: 'Rejected', changes: {} };
    const payslip = row.status === 'APPROVED' ? await this.tenant(organisationId).payslip.findFirst({ where: { timesheetId: id }, select: { paymentStatus: true } }) : null;
    if (payslip && payslip.paymentStatus !== 'UNPAID') return { id, state: 'skipped' as const, reason: payslip.paymentStatus === 'PAID' ? 'Already paid' : 'Payment authorised', changes: {} };
    const profile = await this.profileOf(organisationId, row.candidateId);
    const adjustments = ((row.adjustments as unknown) as StoredAdjustment[]) ?? [];
    const overrides = ((row.overrides as unknown) as StoredOverrides | null) ?? null;
    const cisRate = profile ? num(profile.cisRate) : DEFAULT_CIS;
    const result = this.figures({ payRate: num(row.payRate), chargeRate: num(row.chargeRate), units: num(row.totalUnits), profile, adjustments, overrides: overrides?.fields });
    const changes = this.figureChanges(row, result);
    if (Math.round(num(row.cisRate) * 100) !== Math.round(cisRate * 100)) changes.cisRate = { from: num(row.cisRate), to: cisRate };
    if (Object.keys(changes).length === 0) return { id, state: 'unchanged' as const, changes, netFrom: num(row.netPay), netTo: num(row.netPay) };
    if (!dryRun) {
      await this.db.client.$transaction(async (tx) => {
        await tx.timesheet.update({ where: { id }, data: { gross: result.gross, cisRate, cisDeduction: result.cisDeduction, payrollFee: result.payrollFee, netPay: result.netPay, chargeTotal: result.chargeTotal, profit: result.profit } });
        if (row.status === 'APPROVED') await this.syncPayslip(tx, id, { rateType: row.rateType, payRate: num(row.payRate), units: num(row.totalUnits), cisRate, f: result, lines: result.lines });
        await tx.timesheetEvent.create({ data: { organisationId, timesheetId: id, action: 'RECALCULATED', userId, note: 'Payroll recalculated for the week', changes: changes as never } });
      });
    }
    return { id, state: 'changed' as const, changes, netFrom: num(row.netPay), netTo: result.netPay };
  }

  // ------------------------------------------------------------------------------------------------ payslip

  /**
   * Everything the PDF payslip shows, from the stored payslip: the worker and week, the pay lines, bonuses and
   * deductions, what the work was (job and client), the notes, and when and how it was paid once it has been.
   */
  private async pdfDataFor(organisationId: string, payslip: Record<string, any>) {
    let description: string | null = null;
    if (payslip.timesheetId) {
      const sheet = await this.tenant(organisationId).timesheet.findFirst({ where: { id: payslip.timesheetId }, select: { jobId: true, company: { select: { name: true } } } });
      const job = sheet?.jobId ? await this.tenant(organisationId).job.findFirst({ where: { id: sheet.jobId }, select: { title: true } }) : null;
      description = [job?.title, sheet?.company.name].filter(Boolean).join(' — ') || null;
    }
    const paymentInfo =
      payslip.paymentStatus === 'PAID' && payslip.paidAt
        ? `Paid on ${payslip.paidAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}${payslip.paymentReference ? ` — reference ${payslip.paymentReference}` : ''}.`
        : null;
    return {
      employeeName: payslip.employeeName as string,
      nino: payslip.nino as string | null,
      utr: payslip.utr as string | null,
      weekStart: payslip.weekStart as Date,
      weekEnd: payslip.weekEnd as Date,
      paymentDate: payslip.paymentDate as Date,
      rateType: payslip.rateType as RateType,
      rate: num(payslip.rate),
      quantity: num(payslip.quantity),
      gross: num(payslip.gross),
      cisRate: num(payslip.cisRate),
      cisDeduction: num(payslip.cisDeduction),
      payrollFee: num(payslip.payrollFee),
      netPay: num(payslip.netPay),
      currency: payslip.currency as string,
      notes: payslip.notes as string | null,
      description,
      extraLines: ((payslip.extraLines as unknown) as { label: string; amount: number; beforeCis: boolean }[]) ?? [],
      paymentInfo,
    };
  }

  private async pdfOf(organisationId: string, payslip: Record<string, any>) {
    const bytes = await buildPayslipPdf(await this.pdfDataFor(organisationId, payslip));
    const filename = `Payslip - ${payslip.employeeName} - week ${isoDate(payslip.weekStart)}.pdf`.replace(/[^\w .\-()]/g, '_');
    return { buffer: Buffer.from(bytes), filename };
  }

  async payslipPdf(organisationId: string, id: string) {
    const payslip = await this.tenant(organisationId).payslip.findFirst({ where: { timesheetId: id } });
    if (!payslip) throw new AppException('NO_PAYSLIP', 'The payslip is created when the timesheet is approved.', HttpStatus.NOT_FOUND);
    return this.pdfOf(organisationId, payslip);
  }

  /** The same PDF by payslip id (the Payments page and the bulk download list payslips). */
  async payslipPdfByPayslip(organisationId: string, payslipId: string) {
    const payslip = await this.tenant(organisationId).payslip.findFirst({ where: { id: payslipId } });
    if (!payslip) throw new ResourceNotFoundException('Payslip', payslipId);
    return this.pdfOf(organisationId, payslip);
  }

  /** The note printed on the payslip ("Notes" section): payment information for the worker. */
  async setPayslipNotes(organisationId: string, userId: string, id: string, notes: string | null) {
    const payslip = await this.tenant(organisationId).payslip.findFirst({ where: { timesheetId: id }, select: { id: true, notes: true, paymentStatus: true } });
    if (!payslip) throw new AppException('NO_PAYSLIP', 'The payslip is created when the timesheet is approved.', HttpStatus.NOT_FOUND);
    const next = clean(notes);
    if ((payslip.notes ?? null) === next) return this.getById(organisationId, id);
    await this.db.client.$transaction(async (tx) => {
      await tx.payslip.update({ where: { id: payslip.id }, data: { notes: next } });
      await tx.timesheetEvent.create({ data: { organisationId, timesheetId: id, action: 'AMENDED', userId, note: 'Payslip notes changed', changes: { payslipNotes: { from: payslip.notes, to: next } } as never } });
    });
    await this.auditLogs.record({ organisationId, userId, action: 'UPDATE_PAYSLIP_NOTES', entityType: 'Timesheet', entityId: id });
    return this.getById(organisationId, id);
  }
}
