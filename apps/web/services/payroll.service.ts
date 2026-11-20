import { apiBlob, apiClient } from '@/lib/api-client';

export type Approval = 'APPROVED' | 'PENDING_APPROVAL' | 'REJECTED';
export type PaymentState = 'NOT_READY' | 'UNPAID' | 'AUTHORISED' | 'PAID';
export type CisStatus = 'VERIFIED' | 'UNVERIFIED' | 'GROSS' | 'OTHER';
export type PayrollStage = 'PENDING_TIMESHEET' | 'TIMESHEET_RECEIVED' | 'AWAITING_APPROVAL' | 'APPROVED_FOR_PAYROLL' | 'PAYROLL_GENERATED' | 'PAYSLIP_ISSUED' | 'PAYMENT_AUTHORISED' | 'PAID' | 'REJECTED';

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
  approval: Approval;
  payment: PaymentState;
  stage: PayrollStage;
  checkedAt: string | null;
  issuedAt: string | null;
  authorisedAt: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  hasNino: boolean;
  hasUtr: boolean;
}

export interface Totals {
  count: number;
  gross: number;
  cisDeduction: number;
  payrollFee: number;
  netPay: number;
  chargeTotal: number;
  profit: number;
}

export interface PayrollOverview {
  week: { start: string; end: string };
  rows: PayrollRow[];
  totalInWeek: number;
  clients: { id: string; name: string }[];
  expected: { placementId: string; candidateId: string; workerName: string; companyId: string; companyName: string; jobTitle: string }[];
  stageCounts: Record<PayrollStage, number>;
  weekly: {
    workers: number;
    workersInWeek: number;
    timesheets: number;
    days: number;
    hours: number;
    grossPay: number;
    cisDeductions: number;
    payrollFees: number;
    netPay: number;
    clientCharges: number;
    clientCisDeductions: number;
    invoiceCount: number;
    invoiceNet: number;
    invoiceTotal: number;
    vat: number;
    toReceive: number;
    profit: number;
  };
  invoices: { companyId: string; client: string; workers: number; timesheets: number; net: number; vat: number; total: number; clientCis: number; receivable: number; cisRate: number; vatRate: number; reverseCharge: boolean }[];
  warnings: { code: string; severity: 'warning' | 'info'; message: string }[];
  summary: {
    workers: number;
    timesheets: number;
    approved: Totals;
    waitingApproval: Totals;
    awaitingAuthorisation: Totals;
    authorised: Totals;
    paid: Totals;
    outstandingNet: number;
    cis: Record<CisStatus, number>;
  };
}

export interface PayrollFilters {
  week?: string;
  companyId?: string;
  search?: string;
  approval?: Approval | '';
  stage?: PayrollStage | '';
  payment?: PaymentState | '';
  paid?: 'PAID' | 'UNPAID' | '';
  cis?: CisStatus | '';
}

export interface PaymentResult {
  updated: number;
  netPay: number;
  skipped: { id: string; reason: string }[];
}

const query = (filters: PayrollFilters) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, String(value));
  return params.toString();
};

export const getPayroll = (filters: PayrollFilters) => apiClient<PayrollOverview>(`/payroll?${query(filters)}`);
export const authorisePayments = (payslipIds: string[]) => apiClient<PaymentResult>('/payroll/authorise', { method: 'POST', body: { payslipIds } });
export const issuePayslips = (payslipIds: string[]) => apiClient<PaymentResult>('/payroll/issue', { method: 'POST', body: { payslipIds } });
export const unauthorisePayments = (payslipIds: string[]) => apiClient<PaymentResult>('/payroll/unauthorise', { method: 'POST', body: { payslipIds } });
export const markPaid = (input: { payslipIds: string[]; paidDate?: string; reference?: string }) => apiClient<PaymentResult>('/payroll/mark-paid', { method: 'POST', body: input });

/** Saves the Excel workbook of the payroll as filtered on screen. */
export async function downloadPayrollXlsx(filters: PayrollFilters, filename: string) {
  const blob = await apiBlob(`/payroll/export.xlsx?${query(filters)}`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export interface RecalculationPreview {
  week: string;
  dryRun: boolean;
  total: number;
  changed: number;
  unchanged: number;
  skipped: number;
  netDelta: number;
  lines: { id: string; worker: string; state: 'changed' | 'skipped'; reason?: string; netFrom?: number; netTo?: number; changes: Record<string, { from: unknown; to: unknown }> }[];
}

export const recalculateWeek = (week: string, dryRun: boolean) => apiClient<RecalculationPreview>('/payroll/recalculate', { method: 'POST', body: { week, dryRun } });

/** The payslips of the week (the filtered lines, or only the ticked ones) as a ZIP of PDFs or as one PDF. */
export async function downloadPayslips(filters: PayrollFilters, format: 'zip' | 'pdf', ids?: string[]) {
  const params = new URLSearchParams(query(filters));
  params.set('format', format);
  if (ids && ids.length > 0) params.set('ids', ids.join(','));
  const blob = await apiBlob(`/payroll/payslips?${params.toString()}`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Payslips week ${filters.week ?? ''}.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
