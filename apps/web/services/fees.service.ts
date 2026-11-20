import type { OffsetPaginatedResult } from '@crm/types';

import { apiClient } from '@/lib/api-client';

export type FeeStatus = 'PENDING' | 'INVOICED' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type EmploymentType = 'PERMANENT' | 'TEMPORARY';
/** Totals per currency, e.g. { GBP: 1200, EUR: 300 } — amounts in different currencies are never added together. */
export type MoneyTotals = Record<string, number>;

interface Named {
  id: string;
  firstName: string;
  lastName: string;
}

export interface Fee {
  id: string;
  placementId: string;
  amount: number;
  currency: string;
  status: FeeStatus;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
  /** Terms of a permanent placement: a percentage of the annual salary, or a fixed fee. Empty on an older fee. */
  feeType: 'PERCENTAGE' | 'FIXED' | null;
  annualSalary: number | null;
  feePercent: number | null;
  fixedFee: number | null;
  placementDate: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  placement: {
    resourcers?: { userId: string; splitPercent: number | string; user: { id: string; firstName: string; lastName: string } }[];
    id: string;
    status: string;
    employmentType: EmploymentType;
    startDate: string;
    candidate: Named;
    job: { id: string; title: string };
    company: { id: string; name: string };
  };
}

/** A permanent placement that has no fee record yet. */
export interface FeeSuggestion {
  placementId: string;
  employmentType: EmploymentType;
  candidate: Named;
  job: { id: string; title: string };
  company: { id: string; name: string };
  startDate: string;
}

export interface FeesOverview {
  toInvoice: MoneyTotals;
  awaitingPayment: MoneyTotals;
  overdue: MoneyTotals;
  overdueCount: number;
  paidThisYear: MoneyTotals;
  permanentPlacements: number;
  suggestions: FeeSuggestion[];
}
export interface ListFeesParams {
  page?: number;
  pageSize?: number;
  status?: FeeStatus;
  companyId?: string;
  placementId?: string;
}

export interface FeeInput {
  placementId: string;
  feeType?: 'PERCENTAGE' | 'FIXED';
  annualSalary?: number;
  feePercent?: number;
  fixedFee?: number;
  /** Only for an older fee without terms. */
  amount?: number;
  currency?: string;
  status?: FeeStatus;
  dueDate?: string | null;
  placementDate?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
}

export function listFees(params: ListFeesParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.status) query.set('status', params.status);
  if (params.companyId) query.set('companyId', params.companyId);
  if (params.placementId) query.set('placementId', params.placementId);

  return apiClient<OffsetPaginatedResult<Fee>>(`/fees?${query.toString()}`);
}

export function getFeesOverview() {
  return apiClient<FeesOverview>('/fees/overview');
}

export function createFee(input: FeeInput) {
  return apiClient<Fee>('/fees', { method: 'POST', body: input });
}

export function updateFee(id: string, input: Partial<FeeInput>) {
  return apiClient<Fee>(`/fees/${id}`, { method: 'PATCH', body: input });
}

export function deleteFee(id: string) {
  return apiClient<void>(`/fees/${id}`, { method: 'DELETE' });
}
