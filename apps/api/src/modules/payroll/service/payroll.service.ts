import { scopedPrisma } from '@crm/database';
import { HttpStatus, Injectable } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import * as XLSX from 'xlsx';

import { AppException } from '../../../common/exceptions/app.exception';
import { DatabaseService } from '../../../infrastructure/database/database.service';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import { payrollStageOf, PAYROLL_STAGES, type PayrollStage } from '../../timesheets/lib/payroll-stage';
import { isoDate, mondayOf, sundayOf } from '../../timesheets/lib/week';
import { TimesheetsService } from '../../timesheets/service/timesheets.service';
import type { MarkPaidDto, PayrollQueryDto, PayslipsQueryDto } from '../dto';
import { invoiceFor } from '../lib/invoice-calc';
import { buildZip } from '../lib/zip';

export type CisStatus = 'VERIFIED' | 'UNVERIFIED' | 'GROSS' | 'OTHER';
export type PaymentState = 'NOT_READY' | 'UNPAID' | 'AUTHORISED' | 'PAID';

const num = (value: unknown) => Number(value);

const STAGE_LABEL: Record<PayrollStage, string> = {
  PENDING_TIMESHEET: 'Pending timesheet',
  TIMESHEET_RECEIVED: 'Timesheet received',
  AWAITING_APPROVAL: 'Awaiting approval',
  APPROVED_FOR_PAYROLL: 'Approved for payroll',
  PAYROLL_GENERATED: 'Payroll generated',
  PAYSLIP_ISSUED: 'Payslip issued',
  PAYMENT_AUTHORISED: 'Payment authorised',
  PAID: 'Paid',
  REJECTED: 'Rejected',
};
const pence = (value: number) => Math.round(value * 100);

/** The CIS rate tells how the worker is registered: 20% verified, 30% unverified, 0% gross payment status. */
export const cisStatusOf = (rate: number): CisStatus => (rate === 20 ? 'VERIFIED' : rate === 30 ? 'UNVERIFIED' : rate === 0 ? 'GROSS' : 'OTHER');

export interface PayrollRow {
  timesheetId: string;
  payslipId: string | null;
  candidateId: string;
  workerName: string;
  companyId: string;
  companyName: string;
  rateType: 'DAY' | 'HOUR';
  units: number;
  payRate: number;
  chargeRate: number;
  gross: number;
  cisRate: number;
  cisStatus: CisStatus;
  cisDeduction: number;
  payrollFee: number;
  netPay: number;
  chargeTotal: number;
  profit: number;
  approval: 'APPROVED' | 'PENDING_APPROVAL' | 'REJECTED';
  payment: PaymentState;
  stage: PayrollStage;
  checkedAt: Date | null;
  issuedAt: Date | null;
  authorisedAt: Date | null;
  paidAt: Date | null;
  paymentReference: string | null;
  hasNino: boolean;
  hasUtr: boolean;
}

const zero = () => ({ count: 0, gross: 0, cisDeduction: 0, payrollFee: 0, netPay: 0, chargeTotal: 0, profit: 0 });
type Totals = ReturnType<typeof zero>;

function add(target: Totals, row: PayrollRow) {
  target.count += 1;
  target.gross += pence(row.gross);
  target.cisDeduction += pence(row.cisDeduction);
  target.payrollFee += pence(row.payrollFee);
  target.netPay += pence(row.netPay);
  target.chargeTotal += pence(row.chargeTotal);
  target.profit += pence(row.profit);
}
const pounds = (t: Totals) => ({ ...t, gross: t.gross / 100, cisDeduction: t.cisDeduction / 100, payrollFee: t.payrollFee / 100, netPay: t.netPay / 100, chargeTotal: t.chargeTotal / 100, profit: t.profit / 100 });

/**
 * The weekly payroll screen: every temporary worker of a payroll week with what they are owed, where each timesheet
 * stands (pending / approved) and where the money stands (awaiting authorisation / authorised / paid). The
 * administrator sees the complete payroll of the week, authorises it, then records it as paid.
 *
 * Authorising is a decision and is kept in the timesheet's history together with who took it and when.
 */
@Injectable()
export class PayrollService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auditLogs: AuditLogsService,
    private readonly timesheets: TimesheetsService,
  ) {}


  /**
   * The whole organisation's data. Payroll and commission figures are never limited to "my own records": whoever may
   * open the screen (or their own statement) must see complete totals, so the per-user owner scope is not applied here.
   */
  private tenant(organisationId: string) {
    return scopedPrisma(this.db.client, organisationId);
  }
  private async rowsOfWeek(organisationId: string, monday: Date): Promise<PayrollRow[]> {
    const sheets = await this.tenant(organisationId).timesheet.findMany({
      where: { weekStart: monday },
      include: { candidate: { select: { id: true, firstName: true, lastName: true } }, company: { select: { id: true, name: true } } },
      take: 2000,
    });
    if (sheets.length === 0) return [];
    const slips = await this.tenant(organisationId).payslip.findMany({ where: { timesheetId: { in: sheets.map((s) => s.id) } } });
    const bySheet = new Map(slips.map((p) => [p.timesheetId as string, p]));
    const profiles = await this.tenant(organisationId).workerPayrollProfile.findMany({ where: { candidateId: { in: [...new Set(sheets.map((s) => s.candidateId))] } }, select: { candidateId: true, nino: true, utr: true } });
    const profileOf = new Map(profiles.map((p) => [p.candidateId, p]));
    return sheets
      .map((s): PayrollRow => {
        const slip = bySheet.get(s.id);
        const profile = profileOf.get(s.candidateId);
        const payment: PaymentState = s.status !== 'APPROVED' || !slip ? 'NOT_READY' : (slip.paymentStatus as PaymentState);
        return {
          timesheetId: s.id,
          payslipId: slip?.id ?? null,
          candidateId: s.candidateId,
          workerName: `${s.candidate.firstName} ${s.candidate.lastName}`.trim(),
          companyId: s.companyId,
          companyName: s.company.name,
          rateType: s.rateType as 'DAY' | 'HOUR',
          units: num(s.totalUnits),
          payRate: num(s.payRate),
          chargeRate: num(s.chargeRate),
          gross: num(s.gross),
          cisRate: num(s.cisRate),
          cisStatus: cisStatusOf(num(s.cisRate)),
          cisDeduction: num(s.cisDeduction),
          payrollFee: num(s.payrollFee),
          netPay: num(s.netPay),
          chargeTotal: num(s.chargeTotal),
          profit: num(s.profit),
          approval: s.status,
          payment,
          stage: payrollStageOf({ status: s.status, checkedAt: s.checkedAt, payslip: slip ? { paymentStatus: slip.paymentStatus as 'UNPAID' | 'AUTHORISED' | 'PAID', issuedAt: slip.issuedAt } : null }),
          checkedAt: s.checkedAt,
          issuedAt: slip?.issuedAt ?? null,
          authorisedAt: slip?.authorisedAt ?? null,
          paidAt: slip?.paidAt ?? null,
          paymentReference: slip?.paymentReference ?? null,
          hasNino: Boolean(profile?.nino),
          hasUtr: Boolean(profile?.utr),
        };
      })
      .sort((a, b) => a.companyName.localeCompare(b.companyName) || a.workerName.localeCompare(b.workerName));
  }

  private filter(rows: PayrollRow[], query: PayrollQueryDto): PayrollRow[] {
    const words = query.search?.trim().toLowerCase().split(/\s+/).filter(Boolean) ?? [];
    return rows.filter((row) => {
      if (query.companyId && row.companyId !== query.companyId) return false;
      if (query.approval && row.approval !== query.approval) return false;
      if (query.stage && row.stage !== query.stage) return false;
      if (query.payment && row.payment !== query.payment) return false;
      if (query.paid === 'PAID' && row.payment !== 'PAID') return false;
      if (query.paid === 'UNPAID' && row.payment === 'PAID') return false;
      if (query.cis && row.cisStatus !== query.cis) return false;
      if (words.length) {
        const text = `${row.workerName} ${row.companyName}`.toLowerCase();
        if (!words.every((word) => text.includes(word))) return false;
      }
      return true;
    });
  }

  async overview(organisationId: string, query: PayrollQueryDto) {
    const monday = mondayOf(query.week ?? new Date());
    const all = await this.rowsOfWeek(organisationId, monday);
    const rows = this.filter(all, query);

    const approved = zero();
    const waiting = zero();
    const toAuthorise = zero();
    const authorised = zero();
    const paid = zero();
    const workers = new Set<string>();
    const cis = { VERIFIED: 0, UNVERIFIED: 0, GROSS: 0, OTHER: 0 } as Record<CisStatus, number>;
    for (const row of rows) {
      workers.add(row.candidateId);
      if (row.approval === 'APPROVED') {
        add(approved, row);
        cis[row.cisStatus] += 1;
        if (row.payment === 'UNPAID') add(toAuthorise, row);
        if (row.payment === 'AUTHORISED') add(authorised, row);
        if (row.payment === 'PAID') add(paid, row);
      } else if (row.approval === 'PENDING_APPROVAL') add(waiting, row);
    }

    // what the administrator must know about the whole week before authorising, whatever filter is on
    const pendingAll = all.filter((r) => r.approval === 'PENDING_APPROVAL');
    const rejectedAll = all.filter((r) => r.approval === 'REJECTED');
    const missing = all.filter((r) => r.approval === 'APPROVED' && r.payment === 'UNPAID' && (!r.hasNino || !r.hasUtr));
    const warnings: { code: string; severity: 'warning' | 'info'; message: string }[] = [];
    if (pendingAll.length) warnings.push({ code: 'PENDING', severity: 'warning', message: `${pendingAll.length} timesheet${pendingAll.length === 1 ? ' is' : 's are'} still waiting for approval (${pendingAll.map((r) => r.workerName).slice(0, 4).join(', ')}${pendingAll.length > 4 ? '…' : ''}). They are not in the payable total yet.` });
    if (rejectedAll.length) warnings.push({ code: 'REJECTED', severity: 'info', message: `${rejectedAll.length} timesheet${rejectedAll.length === 1 ? ' was' : 's were'} rejected and must be amended before ${rejectedAll.length === 1 ? 'it' : 'they'} can be paid.` });
    if (missing.length) warnings.push({ code: 'MISSING_DETAILS', severity: 'warning', message: `${missing.length} worker${missing.length === 1 ? ' has' : 's have'} no NINO or UTR recorded (${missing.map((r) => r.workerName).slice(0, 4).join(', ')}${missing.length > 4 ? '…' : ''}).` });

    const expectedAll = await this.expectedOfWeek(organisationId, monday, all);
    const expected = expectedAll.filter((e) => (!query.companyId || e.companyId === query.companyId) && (!query.search || `${e.workerName} ${e.companyName}`.toLowerCase().includes(query.search.trim().toLowerCase())));
    const stageCounts = Object.fromEntries(PAYROLL_STAGES.map((stage) => [stage, 0])) as Record<PayrollStage, number>;
    for (const row of all) stageCounts[row.stage] += 1;
    stageCounts.PENDING_TIMESHEET = expectedAll.length;
    const weekly = await this.weeklySummary(organisationId, rows);
    const clients = [...new Map(all.map((r) => [r.companyId, r.companyName])).entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    return {
      week: { start: isoDate(monday), end: isoDate(sundayOf(monday)) },
      rows,
      totalInWeek: all.length,
      expected,
      stageCounts,
      weekly: weekly.summary,
      invoices: weekly.invoices,
      clients,
      warnings,
      summary: {
        workers: workers.size,
        timesheets: rows.length,
        approved: pounds(approved),
        waitingApproval: pounds(waiting),
        awaitingAuthorisation: pounds(toAuthorise),
        authorised: pounds(authorised),
        paid: pounds(paid),
        outstandingNet: (toAuthorise.netPay + authorised.netPay) / 100,
        cis,
      },
    };
  }

  /** Workers on an active temporary placement this week with no timesheet yet: stage "pending timesheet". */
  private async expectedOfWeek(organisationId: string, monday: Date, rows: PayrollRow[]) {
    const placements = await this.tenant(organisationId).placement.findMany({
      where: { status: 'ACTIVE', employmentType: 'TEMPORARY', startDate: { lte: sundayOf(monday) }, OR: [{ endDate: null }, { endDate: { gte: monday } }] },
      select: { id: true, candidateId: true, companyId: true, candidate: { select: { firstName: true, lastName: true } }, company: { select: { name: true } }, job: { select: { title: true } } },
      take: 500,
    });
    const have = new Set(rows.map((r) => `${r.candidateId}:${r.companyId}`));
    const seen = new Set<string>();
    const out: { placementId: string; candidateId: string; workerName: string; companyId: string; companyName: string; jobTitle: string }[] = [];
    for (const p of placements) {
      const key = `${p.candidateId}:${p.companyId}`;
      if (have.has(key) || seen.has(key)) continue;
      seen.add(key);
      out.push({ placementId: p.id, candidateId: p.candidateId, workerName: `${p.candidate.firstName} ${p.candidate.lastName}`.trim(), companyId: p.companyId, companyName: p.company.name, jobTitle: p.job.title });
    }
    return out.sort((a, b) => a.companyName.localeCompare(b.companyName) || a.workerName.localeCompare(b.workerName));
  }

  /**
   * The weekly summary: workers, days / hours, gross worker payments, CIS deducted from workers, net payments,
   * client charges, CIS the clients deduct, invoices (one per client for the week), VAT and the agency's profit.
   * It counts the approved timesheets of the lines shown; invoices follow each client's own CIS and VAT terms.
   */
  async weeklySummary(organisationId: string, rows: PayrollRow[]) {
    const payable = rows.filter((r) => r.approval === 'APPROVED');
    const sum = (pick: (r: PayrollRow) => number) => Math.round(payable.reduce((t, r) => t + pick(r) * 100, 0)) / 100;
    const byClient = new Map<string, { name: string; charge: number; workers: Set<string>; timesheets: number }>();
    for (const r of payable) {
      const entry = byClient.get(r.companyId) ?? { name: r.companyName, charge: 0, workers: new Set<string>(), timesheets: 0 };
      entry.charge += pence(r.chargeTotal);
      entry.workers.add(r.candidateId);
      entry.timesheets += 1;
      byClient.set(r.companyId, entry);
    }
    const companies = byClient.size
      ? await this.tenant(organisationId).company.findMany({ where: { id: { in: [...byClient.keys()] } }, select: { id: true, cisDeductionRate: true, vatRate: true, vatReverseCharge: true } })
      : [];
    const terms = new Map(companies.map((c) => [c.id, { cisDeductionRate: num(c.cisDeductionRate), vatRate: num(c.vatRate), vatReverseCharge: c.vatReverseCharge }]));
    const invoices = [...byClient.entries()]
      .map(([companyId, entry]) => {
        const t = terms.get(companyId) ?? { cisDeductionRate: 0, vatRate: 20, vatReverseCharge: false };
        return { companyId, client: entry.name, workers: entry.workers.size, timesheets: entry.timesheets, ...invoiceFor(entry.charge / 100, t), cisRate: t.cisDeductionRate, vatRate: t.vatRate, reverseCharge: t.vatReverseCharge };
      })
      .sort((a, b) => a.client.localeCompare(b.client));
    const total = (pick: (i: (typeof invoices)[number]) => number) => Math.round(invoices.reduce((t, i) => t + pick(i) * 100, 0)) / 100;
    return {
      invoices,
      summary: {
        workers: new Set(payable.map((r) => r.candidateId)).size,
        workersInWeek: new Set(rows.map((r) => r.candidateId)).size,
        timesheets: payable.length,
        days: Math.round(payable.filter((r) => r.rateType === 'DAY').reduce((t, r) => t + r.units * 100, 0)) / 100,
        hours: Math.round(payable.filter((r) => r.rateType === 'HOUR').reduce((t, r) => t + r.units * 100, 0)) / 100,
        grossPay: sum((r) => r.gross),
        cisDeductions: sum((r) => r.cisDeduction),
        payrollFees: sum((r) => r.payrollFee),
        netPay: sum((r) => r.netPay),
        clientCharges: sum((r) => r.chargeTotal),
        clientCisDeductions: total((i) => i.clientCis),
        invoiceCount: invoices.length,
        invoiceNet: total((i) => i.net),
        invoiceTotal: total((i) => i.total),
        vat: total((i) => i.vat),
        toReceive: total((i) => i.receivable),
        profit: sum((r) => r.profit),
      },
    };
  }

  /** The payslips were given to the workers. Independent of the payment: it can happen before or after authorising. */
  async issue(organisationId: string, userId: string, payslipIds: string[]) {
    const unique = [...new Set(payslipIds)];
    const { found, skipped } = await this.load(organisationId, unique);
    let updated = 0;
    for (const slip of found.values()) {
      if (slip.issuedAt) {
        skipped.push({ id: slip.id, reason: 'Already issued.' });
        continue;
      }
      const ok = await this.db.client.$transaction(async (tx) => {
        const claimed = await tx.payslip.updateMany({ where: { id: slip.id, organisationId, issuedAt: null }, data: { issuedAt: new Date(), issuedById: userId } });
        if (claimed.count !== 1) return false;
        await tx.timesheetEvent.create({ data: { organisationId, timesheetId: slip.timesheetId as string, action: 'PAYSLIP_ISSUED', userId, note: 'Payslip given to the worker' } });
        return true;
      });
      if (ok) updated += 1;
      else skipped.push({ id: slip.id, reason: 'Changed by someone else just now.' });
    }
    await this.auditLogs.record({ organisationId, userId, action: 'PAYROLL_PAYSLIPS_ISSUED', entityType: 'Payslip', entityId: unique[0] ?? 'none', newValues: { count: updated } });
    return { updated, skipped, netPay: 0 };
  }

  // -------------------------------------------------------------------------------------------- payment actions

  private async load(organisationId: string, payslipIds: string[]) {
    const slips = await this.tenant(organisationId).payslip.findMany({ where: { id: { in: payslipIds }, timesheetId: { not: null } } });
    const found = new Map(slips.map((p) => [p.id, p]));
    const skipped: { id: string; reason: string }[] = [];
    for (const id of payslipIds) if (!found.has(id)) skipped.push({ id, reason: 'Not found, or not a payslip from an approved timesheet.' });
    return { found, skipped };
  }

  private async move(
    organisationId: string,
    userId: string,
    payslipIds: string[],
    rule: { from: 'UNPAID' | 'AUTHORISED'; to: 'AUTHORISED' | 'UNPAID' | 'PAID'; event: 'PAYMENT_AUTHORISED' | 'PAYMENT_REVERSED' | 'PAID'; data: Record<string, unknown>; note?: string; wrongState: (status: string) => string },
  ) {
    const unique = [...new Set(payslipIds)];
    const { found, skipped } = await this.load(organisationId, unique);
    let updated = 0;
    let netPay = 0;
    for (const slip of found.values()) {
      if (slip.paymentStatus !== rule.from) {
        skipped.push({ id: slip.id, reason: rule.wrongState(slip.paymentStatus) });
        continue;
      }
      const ok = await this.db.client.$transaction(async (tx) => {
        // the status check inside the update stops two people moving the same payslip at once
        const claimed = await tx.payslip.updateMany({ where: { id: slip.id, organisationId, paymentStatus: rule.from }, data: { paymentStatus: rule.to, ...rule.data } as never });
        if (claimed.count !== 1) return false;
        await tx.timesheetEvent.create({ data: { organisationId, timesheetId: slip.timesheetId as string, action: rule.event, userId, note: rule.note ?? null } });
        return true;
      });
      if (ok) {
        updated += 1;
        netPay += pence(num(slip.netPay));
      } else skipped.push({ id: slip.id, reason: 'Changed by someone else just now.' });
    }
    await this.auditLogs.record({ organisationId, userId, action: `PAYROLL_${rule.event}`, entityType: 'Payslip', entityId: unique[0] ?? 'none', newValues: { count: updated, netPay: netPay / 100 } });
    return { updated, skipped, netPay: netPay / 100 };
  }

  authorise(organisationId: string, userId: string, payslipIds: string[]) {
    return this.move(organisationId, userId, payslipIds, {
      from: 'UNPAID',
      to: 'AUTHORISED',
      event: 'PAYMENT_AUTHORISED',
      data: { authorisedById: userId, authorisedAt: new Date() },
      wrongState: (status) => (status === 'AUTHORISED' ? 'Already authorised.' : 'Already paid.'),
    });
  }

  /** Takes an authorisation back (before the money is sent). */
  reverse(organisationId: string, userId: string, payslipIds: string[]) {
    return this.move(organisationId, userId, payslipIds, {
      from: 'AUTHORISED',
      to: 'UNPAID',
      event: 'PAYMENT_REVERSED',
      data: { authorisedById: null, authorisedAt: null },
      wrongState: (status) => (status === 'PAID' ? 'Already paid: it cannot be taken back.' : 'It was not authorised.'),
    });
  }

  markPaid(organisationId: string, userId: string, dto: MarkPaidDto) {
    const paidAt = dto.paidDate ? new Date(`${dto.paidDate}T12:00:00.000Z`) : new Date();
    if (Number.isNaN(paidAt.getTime()) || paidAt.getTime() > Date.now() + 86_400_000) throw new AppException('INVALID_PAID_DATE', 'The payment date cannot be in the future.', HttpStatus.BAD_REQUEST);
    const reference = dto.reference?.trim() || null;
    return this.move(organisationId, userId, dto.payslipIds, {
      from: 'AUTHORISED',
      to: 'PAID',
      event: 'PAID',
      data: { paidById: userId, paidAt, paymentReference: reference },
      note: reference ? `Reference ${reference}` : undefined,
      wrongState: (status) => (status === 'PAID' ? 'Already paid.' : 'Authorise the payment first.'),
    });
  }

  // -------------------------------------------------------------------------------------------- payslips in bulk

  /**
   * The payslips of a payroll week in one download. They are the payslips of the lines on screen (the filters apply),
   * or only the ticked ones. Each is the same PDF as the individual download. Unapproved timesheets have no payslip.
   */
  async bulkPayslips(organisationId: string, userId: string, query: PayslipsQueryDto) {
    const monday = mondayOf(query.week ?? new Date());
    const only = query.ids ? new Set(query.ids.split(',').map((id) => id.trim()).filter(Boolean)) : null;
    const rows = this.filter(await this.rowsOfWeek(organisationId, monday), query).filter((row) => row.payslipId && (!only || only.has(row.payslipId)));
    if (rows.length === 0) throw new AppException('NO_PAYSLIPS', 'There are no payslips for these filters. A payslip exists once its timesheet is approved.', HttpStatus.NOT_FOUND);
    if (rows.length > 500) throw new AppException('TOO_MANY_PAYSLIPS', 'Too many payslips at once (500 at most). Narrow the filters.', HttpStatus.BAD_REQUEST);

    const files: { filename: string; buffer: Buffer }[] = [];
    for (const row of rows) files.push(await this.timesheets.payslipPdfByPayslip(organisationId, row.payslipId as string));
    const week = isoDate(monday);
    await this.auditLogs.record({ organisationId, userId, action: 'GENERATE_PAYSLIPS_BULK', entityType: 'Payroll', entityId: week, newValues: { count: files.length, format: query.format ?? 'zip' } });

    if (query.format === 'pdf') {
      const merged = await PDFDocument.create();
      for (const file of files) {
        const source = await PDFDocument.load(file.buffer);
        for (const page of await merged.copyPages(source, source.getPageIndices())) merged.addPage(page);
      }
      merged.setTitle(`Payslips - week ${week}`);
      return { buffer: Buffer.from(await merged.save()), filename: `Payslips week ${week}.pdf`, contentType: 'application/pdf', count: files.length };
    }
    const used = new Map<string, number>();
    const entries = files.map((file) => {
      const count = (used.get(file.filename) ?? 0) + 1;
      used.set(file.filename, count);
      return { name: count === 1 ? file.filename : file.filename.replace(/\.pdf$/, ` (${count}).pdf`), data: file.buffer };
    });
    return { buffer: buildZip(entries), filename: `Payslips week ${week}.zip`, contentType: 'application/zip', count: files.length };
  }

  // -------------------------------------------------------------------------------------------- recalculate

  /**
   * Works the whole week's payroll out again (days, rates, the workers' current CIS rate and fee, adjustments and
   * overrides). Timesheets already authorised or paid are left alone and reported. With dryRun nothing is saved.
   */
  async recalculateWeek(organisationId: string, userId: string, week: string, dryRun: boolean) {
    const monday = mondayOf(week);
    const sheets = await this.tenant(organisationId).timesheet.findMany({ where: { weekStart: monday }, select: { id: true, candidate: { select: { firstName: true, lastName: true } } }, take: 2000 });
    const lines: { id: string; worker: string; state: 'changed' | 'unchanged' | 'skipped'; reason?: string; netFrom?: number; netTo?: number; changes: Record<string, { from: unknown; to: unknown }> }[] = [];
    for (const sheet of sheets) {
      const result = await this.timesheets.recalculate(organisationId, userId, sheet.id, dryRun);
      lines.push({ id: sheet.id, worker: `${sheet.candidate.firstName} ${sheet.candidate.lastName}`.trim(), state: result.state, reason: 'reason' in result ? result.reason : undefined, netFrom: 'netFrom' in result ? result.netFrom : undefined, netTo: 'netTo' in result ? result.netTo : undefined, changes: result.changes });
    }
    const changed = lines.filter((l) => l.state === 'changed');
    const netDelta = Math.round(changed.reduce((t, l) => t + ((l.netTo ?? 0) - (l.netFrom ?? 0)) * 100, 0)) / 100;
    if (!dryRun) await this.auditLogs.record({ organisationId, userId, action: 'PAYROLL_RECALCULATED', entityType: 'Payroll', entityId: isoDate(monday), newValues: { timesheets: sheets.length, changed: changed.length, netDelta } });
    return { week: isoDate(monday), dryRun, total: sheets.length, changed: changed.length, unchanged: lines.filter((l) => l.state === 'unchanged').length, skipped: lines.filter((l) => l.state === 'skipped').length, netDelta, lines: lines.filter((l) => l.state !== 'unchanged') };
  }

  // -------------------------------------------------------------------------------------------- export

  /** An Excel workbook of the payroll as filtered on screen: one sheet of lines, one of totals — for the accountant. */
  async exportXlsx(organisationId: string, userId: string, query: PayrollQueryDto, sensitive = false) {
    const monday = mondayOf(query.week ?? new Date());
    const rows = this.filter(await this.rowsOfWeek(organisationId, monday), query);
    const profiles = await this.tenant(organisationId).workerPayrollProfile.findMany({ where: { candidateId: { in: rows.map((r) => r.candidateId) } }, select: { candidateId: true, nino: true, utr: true } });
    const tax = new Map(profiles.map((p) => [p.candidateId, p]));
    const approvalLabel = { APPROVED: 'Approved', PENDING_APPROVAL: 'Pending approval', REJECTED: 'Rejected' } as const;
    const paymentLabel = { NOT_READY: 'Not ready', UNPAID: 'Awaiting authorisation', AUTHORISED: 'Authorised', PAID: 'Paid' } as const;
    const cisLabel = { VERIFIED: 'Verified (20%)', UNVERIFIED: 'Unverified (30%)', GROSS: 'Gross payment (0%)', OTHER: 'Other' } as const;
    const safe = (value: string) => (/^[=+\-@\t\r]/.test(value) ? `'${value}` : value); // a name can never run as a spreadsheet formula
    const lines = rows.map((r) => ({
      Worker: safe(r.workerName),
      Client: safe(r.companyName),
      NINO: sensitive ? (tax.get(r.candidateId)?.nino ?? '') : 'restricted',
      UTR: sensitive ? (tax.get(r.candidateId)?.utr ?? '') : 'restricted',
      'CIS status': cisLabel[r.cisStatus],
      'Paid per': r.rateType === 'DAY' ? 'Day' : 'Hour',
      'Days / hours': r.units,
      'Pay rate': r.payRate,
      'Gross pay': r.gross,
      'CIS deduction': r.cisDeduction,
      'Payroll fee': r.payrollFee,
      'Net payment': r.netPay,
      'Charge rate': r.chargeRate,
      'Client charge': r.chargeTotal,
      Profit: r.profit,
      Stage: STAGE_LABEL[r.stage],
      Approval: approvalLabel[r.approval],
      Payment: paymentLabel[r.payment],
      'Paid on': r.paidAt ? isoDate(r.paidAt) : '',
      Reference: safe(r.paymentReference ?? ''),
    }));
    const sum = (key: keyof (typeof lines)[number]) => Math.round(lines.reduce((s, l) => s + Number(l[key] || 0) * 100, 0)) / 100;
    const totals = [{ Worker: 'TOTAL', 'Gross pay': sum('Gross pay'), 'CIS deduction': sum('CIS deduction'), 'Payroll fee': sum('Payroll fee'), 'Net payment': sum('Net payment'), 'Client charge': sum('Client charge'), Profit: sum('Profit') }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(lines.length ? lines : [{ Worker: 'No payroll lines for these filters' }]), 'Payroll');
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(totals), 'Totals');
    const weekly = await this.weeklySummary(organisationId, rows);
    const w = weekly.summary;
    const summaryRows = [
      ['Payroll week', `${isoDate(monday)} to ${isoDate(sundayOf(monday))}`],
      ['Total workers', w.workers],
      ['Timesheets', w.timesheets],
      ['Total days', w.days],
      ['Total hours', w.hours],
      ['Total gross worker payments', w.grossPay],
      ['Total CIS deductions (workers)', w.cisDeductions],
      ['Total payroll fees', w.payrollFees],
      ['Total net payments', w.netPay],
      ['Total client charges (before VAT)', w.clientCharges],
      ['Total client CIS deductions', w.clientCisDeductions],
      ['Total invoices (number)', w.invoiceCount],
      ['Total invoices (including VAT)', w.invoiceTotal],
      ['Total VAT', w.vat],
      ['To receive from clients (after their CIS)', w.toReceive],
      ['Total agency profit', w.profit],
    ].map(([Item, Value]) => ({ Item, Value }));
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(summaryRows), 'Summary');
    const invoiceRows = weekly.invoices.map((i) => ({ Client: safe(i.client), Workers: i.workers, Timesheets: i.timesheets, 'Net invoice': i.net, 'VAT rate %': i.reverseCharge ? 'Reverse charge' : i.vatRate, VAT: i.vat, 'Invoice total': i.total, 'Client CIS rate %': i.cisRate, 'Client CIS deduction': i.clientCis, 'To receive': i.receivable }));
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(invoiceRows.length ? invoiceRows : [{ Client: 'No approved timesheets for these filters' }]), 'Client invoices');
    const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    await this.auditLogs.record({ organisationId, userId, action: 'EXPORT_PAYROLL', entityType: 'Payroll', entityId: isoDate(monday), newValues: { rows: rows.length } });
    return { buffer, filename: `Payroll week ${isoDate(monday)}.xlsx` };
  }
}
