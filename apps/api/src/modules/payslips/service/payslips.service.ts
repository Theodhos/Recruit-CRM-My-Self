import { totalPages } from '@crm/utils';
import { HttpStatus, Injectable } from '@nestjs/common';

import { AppException, ResourceNotFoundException } from '../../../common/exceptions/app.exception';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import type { CreatePayslipDto, ListPayslipsQueryDto, UpdatePayslipDto } from '../dto';
import { PayslipsRepository, type PayslipData } from '../repositories/payslips.repository';

type Money = Record<string, number>;

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const clean = (value: string | null | undefined) => (value?.trim() ? value.trim() : null);

/**
 * Pagesat: the weekly CIS payslip of a worker. Gross = rate × days/hours; the CIS deduction is a percentage of the
 * gross (20% by default); the payroll fee (£15 by default) is taken off as well. The amounts are always worked out
 * here, never taken from the client, so a payslip always adds up.
 */
@Injectable()
export class PayslipsService {
  constructor(
    private readonly repository: PayslipsRepository,
    private readonly auditLogs: AuditLogsService,
  ) {}

  private present<T extends { rate: unknown; quantity: unknown; gross: unknown; cisRate: unknown; cisDeduction: unknown; payrollFee: unknown; netPay: unknown }>(payslip: T) {
    return {
      ...payslip,
      rate: Number(payslip.rate),
      quantity: Number(payslip.quantity),
      gross: Number(payslip.gross),
      cisRate: Number(payslip.cisRate),
      cisDeduction: Number(payslip.cisDeduction),
      payrollFee: Number(payslip.payrollFee),
      netPay: Number(payslip.netPay),
    };
  }

  private build(input: CreatePayslipDto): PayslipData {
    const weekStart = new Date(input.weekStart);
    const weekEnd = new Date(input.weekEnd);
    if (weekEnd < weekStart) throw new AppException('INVALID_PAYSLIP_WEEK', 'The end of the week is before its start.', HttpStatus.BAD_REQUEST);
    const gross = round(input.rate * input.quantity);
    const cisRate = input.cisRate ?? 20;
    const cisDeduction = round((gross * cisRate) / 100);
    const payrollFee = input.payrollFee ?? 15;
    return {
      employeeName: input.employeeName.trim(),
      nino: clean(input.nino)?.toUpperCase().replace(/\s+/g, '') ?? null,
      utr: clean(input.utr)?.replace(/\s+/g, '') ?? null,
      weekStart,
      weekEnd,
      paymentDate: new Date(input.paymentDate),
      rateType: input.rateType,
      rate: input.rate,
      quantity: input.quantity,
      gross,
      cisRate,
      cisDeduction,
      payrollFee,
      netPay: round(gross - cisDeduction - payrollFee),
      currency: (input.currency ?? 'GBP').toUpperCase(),
      notes: clean(input.notes),
    };
  }

  async list(organisationId: string, query: ListPayslipsQueryDto) {
    const { items, totalItems } = await this.repository.findMany(organisationId, query);
    return { items: items.map((item) => this.present(item)), page: query.page, pageSize: query.pageSize, totalItems, totalPages: totalPages(totalItems, query.pageSize) };
  }

  /** Totals per currency (never added across currencies) and how many payslips were paid this month. */
  async overview(organisationId: string) {
    const rows = await this.repository.findForTotals(organisationId);
    const now = new Date();
    const gross: Money = {};
    const cis: Money = {};
    const netPay: Money = {};
    let thisMonth = 0;
    for (const row of rows) {
      gross[row.currency] = round((gross[row.currency] ?? 0) + Number(row.gross));
      cis[row.currency] = round((cis[row.currency] ?? 0) + Number(row.cisDeduction));
      netPay[row.currency] = round((netPay[row.currency] ?? 0) + Number(row.netPay));
      if (row.paymentDate.getUTCFullYear() === now.getUTCFullYear() && row.paymentDate.getUTCMonth() === now.getUTCMonth()) thisMonth += 1;
    }
    return { total: rows.length, thisMonth, gross, cis, netPay };
  }

  async getById(organisationId: string, id: string) {
    const payslip = await this.repository.findById(organisationId, id);
    if (!payslip) throw new ResourceNotFoundException('Payslip', id);
    return this.present(payslip);
  }

  async create(organisationId: string, userId: string, dto: CreatePayslipDto) {
    const payslip = await this.repository.create(organisationId, this.build(dto));
    await this.auditLogs.record({ organisationId, userId, action: 'CREATE_PAYSLIP', entityType: 'Payslip', entityId: payslip.id, newValues: { employeeName: payslip.employeeName, netPay: Number(payslip.netPay) } });
    return this.present(payslip);
  }

  async update(organisationId: string, userId: string, id: string, dto: UpdatePayslipDto) {
    const existing = await this.repository.findById(organisationId, id);
    if (!existing) throw new ResourceNotFoundException('Payslip', id);
    const merged: CreatePayslipDto = {
      employeeName: dto.employeeName ?? existing.employeeName,
      nino: dto.nino !== undefined ? dto.nino : existing.nino,
      utr: dto.utr !== undefined ? dto.utr : existing.utr,
      weekStart: dto.weekStart ?? existing.weekStart.toISOString(),
      weekEnd: dto.weekEnd ?? existing.weekEnd.toISOString(),
      paymentDate: dto.paymentDate ?? existing.paymentDate.toISOString(),
      rateType: dto.rateType ?? existing.rateType,
      rate: dto.rate ?? Number(existing.rate),
      quantity: dto.quantity ?? Number(existing.quantity),
      cisRate: dto.cisRate ?? Number(existing.cisRate),
      payrollFee: dto.payrollFee ?? Number(existing.payrollFee),
      currency: dto.currency ?? existing.currency,
      notes: dto.notes !== undefined ? dto.notes : existing.notes,
    };
    const payslip = await this.repository.update(organisationId, id, this.build(merged));
    await this.auditLogs.record({ organisationId, userId, action: 'UPDATE_PAYSLIP', entityType: 'Payslip', entityId: id, newValues: dto });
    return this.present(payslip);
  }

  async remove(organisationId: string, userId: string, id: string) {
    const existing = await this.repository.findById(organisationId, id);
    if (!existing) throw new ResourceNotFoundException('Payslip', id);
    await this.repository.delete(organisationId, id);
    await this.auditLogs.record({ organisationId, userId, action: 'DELETE_PAYSLIP', entityType: 'Payslip', entityId: id });
  }
}
