import type { OffsetPaginatedResult } from '@crm/types';

import { apiClient } from '@/lib/api-client';

import type { MoneyTotals } from './fees.service';

export type PayslipRateType = 'DAY' | 'HOUR';

export interface Payslip {
  id: string;
  employeeName: string;
  nino: string | null;
  utr: string | null;
  weekStart: string;
  weekEnd: string;
  paymentDate: string;
  rateType: PayslipRateType;
  rate: number;
  /** Days or hours worked. */
  quantity: number;
  gross: number;
  /** In percent. */
  cisRate: number;
  cisDeduction: number;
  payrollFee: number;
  netPay: number;
  currency: string;
  notes: string | null;
  createdAt: string;
}

export interface PayslipsOverview {
  total: number;
  thisMonth: number;
  gross: MoneyTotals;
  cis: MoneyTotals;
  netPay: MoneyTotals;
}

export interface ListPayslipsParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

/** What is typed in: the amounts (gross, CIS, net) are always worked out by the server. */
export interface PayslipInput {
  employeeName: string;
  nino?: string | null;
  utr?: string | null;
  weekStart: string;
  weekEnd: string;
  paymentDate: string;
  rateType: PayslipRateType;
  rate: number;
  quantity: number;
  cisRate?: number;
  payrollFee?: number;
  currency?: string;
  notes?: string | null;
}

export function listPayslips(params: ListPayslipsParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.search) query.set('search', params.search);

  return apiClient<OffsetPaginatedResult<Payslip>>(`/payslips?${query.toString()}`);
}

export function getPayslipsOverview() {
  return apiClient<PayslipsOverview>('/payslips/overview');
}

export function createPayslip(input: PayslipInput) {
  return apiClient<Payslip>('/payslips', { method: 'POST', body: input });
}

export function updatePayslip(id: string, input: Partial<PayslipInput>) {
  return apiClient<Payslip>(`/payslips/${id}`, { method: 'PATCH', body: input });
}

export function deletePayslip(id: string) {
  return apiClient<void>(`/payslips/${id}`, { method: 'DELETE' });
}
