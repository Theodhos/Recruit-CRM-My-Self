import { apiBlob, apiClient } from '@/lib/api-client';

export type CommissionBasis = 'PROFIT' | 'BILLING';

export interface PermanentSummary {
  placements: number;
  revenue: number;
  profit: number;
  fixedFee: number;
  percentageFee: number;
  fixedRevenue: number;
  percentageRevenue: number;
  outstandingInvoices: { count: number; amount: number; overdueCount: number; overdueAmount: number; draftCount: number; draftAmount: number };
}

export interface ResourcerRate {
  userId: string;
  name: string;
  email: string;
  commissionRate: number;
  commissionBasis: CommissionBasis | null;
  effectiveBasis: CommissionBasis;
}

export interface Allocation {
  placementId: string;
  employmentType: 'PERMANENT' | 'TEMPORARY';
  worker: string;
  client: string;
  job: string;
  defaultBasis: CommissionBasis;
  /** What the placement has produced so far (approved timesheets): both are kept visible. */
  totals: { timesheets: number; billing: number; profit: number };
  resourcers: { userId: string; name: string; splitPercent: number; commissionRate: number; basis: CommissionBasis; attributedProfit: number; attributedBilling: number; commissionable: number }[];
}

export interface MonthRow {
  userId: string;
  name: string;
  commissionRate: number;
  basis: CommissionBasis;
  placements: number;
  sharedPlacements: number;
  billings: number;
  profit: number;
  commissionable: number;
  earned: number;
  earnedTemporary: number;
  earnedPermanent: number;
  paid: number;
  outstanding: number;
}

export interface MonthOverview {
  month: string;
  defaultBasis: CommissionBasis;
  permanentTrigger: 'PLACEMENT' | 'PAID';
  temporary: { billing: number; profit: number; timesheets: number };
  permanent: PermanentSummary;
  clientBilling: number;
  agencyProfit: number;
  timesheets: number;
  resourcers: MonthRow[];
  totals: { earnedTemporary: number; earnedPermanent: number; attributedBilling: number; attributedProfit: number; commissionable: number; earned: number; paid: number; outstanding: number };
  unallocated: { timesheets: number; billing: number; profit: number; placements: { worker: string; client: string; timesheets: number; billing: number; profit: number }[] };
}

export interface StatementLine {
  placementId: string;
  worker: string;
  client: string;
  timesheets: number;
  billingTotal: number;
  profitTotal: number;
  splitPercent: number;
  sharedWith: string[];
  attributedBilling: number;
  attributedProfit: number;
  commissionable: number;
  commission: number;
  kind: 'TEMPORARY' | 'PERMANENT';
  feeType?: 'PERCENTAGE' | 'FIXED' | null;
  invoiceNumber?: string | null;
  invoiceStatus?: string | null;
}

export interface Statement {
  month: string;
  employee: { userId: string; name: string; commissionRate: number; basis: CommissionBasis };
  lines: StatementLine[];
  payments: { id: string; amount: number; paidAt: string; reference: string | null }[];
  totals: { placements: number; sharedPlacements: number; billings: number; profit: number; commissionable: number; earned: number; earnedTemporary: number; earnedPermanent: number; paid: number; outstanding: number };
}

export const getResourcers = () => apiClient<{ defaultBasis: CommissionBasis; permanentTrigger: 'PLACEMENT' | 'PAID'; resourcers: ResourcerRate[] }>('/commissions/resourcers');
export const setPermanentTrigger = (permanentCommissionTrigger: 'PLACEMENT' | 'PAID') => apiClient<{ permanentCommissionTrigger: 'PLACEMENT' | 'PAID' }>('/commissions/settings/permanent-trigger', { method: 'PUT', body: { permanentCommissionTrigger } });
export const setRate = (userId: string, input: { commissionRate: number; commissionBasis: CommissionBasis | null }) => apiClient<{ defaultBasis: CommissionBasis; permanentTrigger: 'PLACEMENT' | 'PAID'; resourcers: ResourcerRate[] }>(`/commissions/resourcers/${userId}`, { method: 'PUT', body: input });
export const setDefaultBasis = (commissionBasis: CommissionBasis) => apiClient<{ commissionBasis: CommissionBasis }>('/commissions/settings/basis', { method: 'PUT', body: { commissionBasis } });
export const getAllocation = (placementId: string) => apiClient<Allocation>(`/commissions/placements/${placementId}`);
export const setAllocation = (placementId: string, resourcers: { userId: string; splitPercent: number }[]) => apiClient<Allocation>(`/commissions/placements/${placementId}/resourcers`, { method: 'PUT', body: { resourcers } });
export const clearAllocation = (placementId: string) => apiClient<Allocation>(`/commissions/placements/${placementId}/resourcers`, { method: 'DELETE' });
export const getMonth = (month: string) => apiClient<MonthOverview>(`/commissions/month?month=${month}`);
export const getStatement = (month: string, userId: string) => apiClient<Statement>(`/commissions/statement?month=${month}&userId=${userId}`);
export const addPayment = (input: { userId: string; month: string; amount: number; paidDate?: string; reference?: string }) => apiClient<Statement>('/commissions/payments', { method: 'POST', body: input });
export const removePayment = (id: string) => apiClient<{ ok: true }>(`/commissions/payments/${id}`, { method: 'DELETE' });

async function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadStatementPdf(month: string, userId: string, name: string) {
  await save(await apiBlob(`/commissions/statement.pdf?month=${month}&userId=${userId}`), `Commission statement - ${name} - ${month}.pdf`);
}

export async function downloadCommissionXlsx(month: string) {
  await save(await apiBlob(`/commissions/export.xlsx?month=${month}`), `Commission ${month}.xlsx`);
}
