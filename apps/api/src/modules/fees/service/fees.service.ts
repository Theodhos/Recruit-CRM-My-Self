import { totalPages } from '@crm/utils';
import { HttpStatus, Injectable } from '@nestjs/common';

import { AppException, ResourceNotFoundException } from '../../../common/exceptions/app.exception';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import type { CreateFeeDto, FeeStatusValue, ListFeesQueryDto, UpdateFeeDto } from '../dto';
import { totalClientFee, type FeeTypeValue } from '../lib/fee-calc';
import { FeesRepository } from '../repositories/fees.repository';

type Money = Record<string, number>;

const add = (totals: Money, currency: string, amount: number) => {
  totals[currency] = +((totals[currency] ?? 0) + amount).toFixed(2);
};
const num = (value: unknown) => (value === null || value === undefined ? null : Number(value));

/**
 * Fees are what the agency invoices a client for a PERMANENT placement: one fee record per successful placement, so a
 * vacancy that produced three hires has three fees, each with its own terms, invoice and commission. (Temporary
 * workers are billed from their weekly timesheets, not here.)
 *
 * The terms are chosen per placement: a percentage of the candidate's annual salary, or a fixed fee. The total client
 * fee is always worked out here from the terms. The invoice goes Draft (PENDING) → Sent (INVOICED) → Paid; unpaid past
 * its due date it counts as Overdue, whatever is stored.
 */
@Injectable()
export class FeesService {
  constructor(
    private readonly repository: FeesRepository,
    private readonly auditLogs: AuditLogsService,
  ) {}

  private present<T extends { amount: unknown; status: string; dueDate: Date | null; annualSalary?: unknown; feePercent?: unknown; fixedFee?: unknown }>(fee: T, now: Date) {
    const unpaid = fee.status === 'PENDING' || fee.status === 'INVOICED' || fee.status === 'OVERDUE';
    return {
      ...fee,
      amount: Number(fee.amount),
      annualSalary: num(fee.annualSalary),
      feePercent: num(fee.feePercent),
      fixedFee: num(fee.fixedFee),
      status: (unpaid && fee.dueDate && fee.dueDate < now ? 'OVERDUE' : fee.status === 'OVERDUE' ? 'INVOICED' : fee.status) as FeeStatusValue,
    };
  }

  async list(organisationId: string, query: ListFeesQueryDto) {
    const now = new Date();
    const { items, totalItems } = await this.repository.findMany(organisationId, query, now);
    return {
      items: items.map((fee) => this.present(fee, now)),
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: totalPages(totalItems, query.pageSize),
    };
  }

  /** The figures on top of the Fees page (per currency) and the permanent placements that still have no fee. */
  async overview(organisationId: string) {
    const now = new Date();
    const [fees, placements] = await Promise.all([this.repository.findAllForOverview(organisationId), this.repository.findPermanentPlacements(organisationId)]);
    const toInvoice: Money = {};
    const awaitingPayment: Money = {};
    const overdue: Money = {};
    const paidThisYear: Money = {};
    let overdueCount = 0;
    for (const raw of fees) {
      const fee = this.present(raw, now);
      if (fee.status === 'PENDING') add(toInvoice, fee.currency, fee.amount);
      if (fee.status === 'INVOICED') add(awaitingPayment, fee.currency, fee.amount);
      if (fee.status === 'OVERDUE') {
        add(overdue, fee.currency, fee.amount);
        overdueCount += 1;
      }
      if (fee.status === 'PAID' && (raw.paidAt ?? raw.createdAt).getUTCFullYear() === now.getUTCFullYear()) add(paidThisYear, fee.currency, fee.amount);
    }
    const withFee = new Set(fees.map((f) => f.placementId));
    const suggestions = placements.filter((p) => !withFee.has(p.id)).map((p) => ({ placementId: p.id, employmentType: p.employmentType, candidate: p.candidate, job: p.job, company: p.company, startDate: p.startDate }));
    return { toInvoice, awaitingPayment, overdue, overdueCount, paidThisYear, permanentPlacements: placements.length, suggestions };
  }

  async getById(organisationId: string, id: string) {
    const fee = await this.repository.findById(organisationId, id);
    if (!fee) throw new ResourceNotFoundException('Fee', id);
    return this.present(fee, new Date());
  }

  /** The fee total of the given terms, or a clear error. With no fee type the typed amount is kept (an older fee). */
  private amountFor(terms: { feeType?: FeeTypeValue | null; annualSalary?: number | null; feePercent?: number | null; fixedFee?: number | null; amount?: number | null }): number {
    if (!terms.feeType) {
      if (terms.amount === null || terms.amount === undefined) throw new AppException('FEE_TERMS_REQUIRED', 'Choose the fee type (percentage of the salary, or a fixed fee).', HttpStatus.BAD_REQUEST);
      return terms.amount;
    }
    const result = totalClientFee({ feeType: terms.feeType, annualSalary: terms.annualSalary, feePercent: terms.feePercent, fixedFee: terms.fixedFee });
    if (!result.ok) throw new AppException('FEE_TERMS_INVALID', result.message, HttpStatus.BAD_REQUEST);
    return result.total;
  }

  async create(organisationId: string, userId: string, dto: CreateFeeDto) {
    const placement = await this.repository.placementType(organisationId, dto.placementId);
    if (!placement) throw new ResourceNotFoundException('Placement', dto.placementId);
    if (placement.employmentType !== 'PERMANENT') throw new AppException('NOT_PERMANENT', 'Fees are for permanent placements. Temporary workers are billed from their timesheets.', HttpStatus.BAD_REQUEST);
    const existing = await this.repository.findMany(organisationId, { page: 1, pageSize: 50, placementId: dto.placementId } as ListFeesQueryDto, new Date());
    if (existing.items.some((f) => f.status !== 'CANCELLED')) throw new AppException('DUPLICATE_FEE', 'This placement already has a fee. Open it to change the terms or the invoice.', HttpStatus.CONFLICT);
    const amount = this.amountFor(dto);
    const status = dto.status ?? 'PENDING';
    const fee = await this.repository.create(organisationId, {
      placementId: dto.placementId,
      amount,
      currency: (dto.currency ?? 'GBP').toUpperCase(),
      status,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      paidAt: status === 'PAID' ? new Date() : null,
      feeType: dto.feeType ?? null,
      annualSalary: dto.annualSalary ?? null,
      feePercent: dto.feeType === 'PERCENTAGE' ? (dto.feePercent ?? null) : null,
      fixedFee: dto.feeType === 'FIXED' ? (dto.fixedFee ?? null) : null,
      placementDate: new Date(dto.placementDate ?? Date.now()),
      invoiceNumber: dto.invoiceNumber?.trim() || null,
      invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : status === 'INVOICED' || status === 'PAID' ? new Date() : null,
    });
    await this.auditLogs.record({ organisationId, userId, action: 'CREATE_FEE', entityType: 'Fee', entityId: fee.id, newValues: { ...dto, amount } });
    return this.present(fee, new Date());
  }

  async update(organisationId: string, userId: string, id: string, dto: UpdateFeeDto) {
    const existing = await this.repository.findById(organisationId, id);
    if (!existing) throw new ResourceNotFoundException('Fee', id);
    // the terms after this change: what is sent, over what is stored
    const feeType = (dto.feeType ?? existing.feeType) as FeeTypeValue | null;
    const terms = { feeType, annualSalary: dto.annualSalary ?? num(existing.annualSalary), feePercent: dto.feePercent ?? num(existing.feePercent), fixedFee: dto.fixedFee ?? num(existing.fixedFee), amount: dto.amount ?? Number(existing.amount) };
    const touchesTerms = ['feeType', 'annualSalary', 'feePercent', 'fixedFee', 'amount'].some((k) => (dto as Record<string, unknown>)[k] !== undefined);
    const amount = touchesTerms ? this.amountFor(terms) : Number(existing.amount);
    const status = dto.status ?? (existing.status as FeeStatusValue);
    const fee = await this.repository.update(organisationId, id, {
      ...(touchesTerms ? { amount, feeType, annualSalary: terms.annualSalary, feePercent: feeType === 'PERCENTAGE' ? terms.feePercent : null, fixedFee: feeType === 'FIXED' ? terms.fixedFee : null } : {}),
      ...(dto.currency ? { currency: dto.currency.toUpperCase() } : {}),
      ...(dto.dueDate !== undefined ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null } : {}),
      ...(dto.placementDate ? { placementDate: new Date(dto.placementDate) } : {}),
      ...(dto.invoiceNumber !== undefined ? { invoiceNumber: dto.invoiceNumber.trim() || null } : {}),
      ...(dto.invoiceDate !== undefined ? { invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : null } : dto.status && (status === 'INVOICED' || status === 'PAID') && !existing.invoiceDate ? { invoiceDate: new Date() } : {}),
      // the day it was paid is the day it is marked paid; taking "paid" back clears it
      ...(dto.status ? { status: dto.status, paidAt: dto.status === 'PAID' ? (existing.paidAt ?? new Date()) : null } : {}),
    });
    await this.auditLogs.record({ organisationId, userId, action: 'UPDATE_FEE', entityType: 'Fee', entityId: id, oldValues: { status: existing.status, amount: Number(existing.amount) }, newValues: { ...dto, amount } });
    return this.present(fee, new Date());
  }

  async remove(organisationId: string, userId: string, id: string) {
    const existing = await this.repository.findById(organisationId, id);
    if (!existing) throw new ResourceNotFoundException('Fee', id);
    await this.repository.delete(organisationId, id);
    await this.auditLogs.record({ organisationId, userId, action: 'DELETE_FEE', entityType: 'Fee', entityId: id });
  }
}
