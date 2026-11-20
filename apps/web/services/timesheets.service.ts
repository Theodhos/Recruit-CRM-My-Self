import { apiBlob, apiClient } from '@/lib/api-client';

export type TimesheetStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
export type RateType = 'DAY' | 'HOUR';
export type EventAction = 'SUBMITTED' | 'AMENDED' | 'RESUBMITTED' | 'APPROVED' | 'REJECTED' | 'PAYSLIP_GENERATED' | 'PAYMENT_AUTHORISED' | 'PAYMENT_REVERSED' | 'PAID' | 'ADJUSTMENT_ADDED' | 'ADJUSTMENT_REMOVED' | 'OVERRIDDEN' | 'OVERRIDE_CLEARED' | 'RECALCULATED' | 'CHECKED' | 'PAYSLIP_ISSUED';

export interface TimesheetDay {
  /** YYYY-MM-DD */
  date: string;
  units: number;
}

export interface Discrepancy {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export type AdjustmentKind = 'BONUS' | 'ADDITIONAL_PAYMENT' | 'DEDUCTION' | 'ADMIN_FEE' | 'ADJUSTMENT';

export const ADJUSTMENT_KINDS: { kind: AdjustmentKind; label: string; help: string; sign: '+' | '−' | '±' }[] = [
  { kind: 'BONUS', label: 'Bonus', sign: '+', help: 'Extra pay on top of the hours. Added to gross pay, so CIS is deducted from it.' },
  { kind: 'ADDITIONAL_PAYMENT', label: 'Additional payment', sign: '+', help: 'Another payment for work done (e.g. travel time). Added to gross pay; CIS applies.' },
  { kind: 'DEDUCTION', label: 'Deduction', sign: '−', help: 'Money taken back from the worker (e.g. an advance, equipment). Reduces the net payment only.' },
  { kind: 'ADMIN_FEE', label: 'Administration fee', sign: '−', help: 'An extra fee charged to the worker. Reduces the net payment and counts as income for the agency.' },
  { kind: 'ADJUSTMENT', label: 'Adjustment (+ or −)', sign: '±', help: 'A correction to the net payment, up or down. Use a minus to reduce it.' },
];

export interface StoredAdjustment {
  id: string;
  kind: AdjustmentKind;
  label: string;
  amount: number;
  reason: string;
  addedById: string;
  addedAt: string;
}

export interface OverrideFigures {
  gross?: number;
  cisDeduction?: number;
  payrollFee?: number;
  netPay?: number;
  chargeTotal?: number;
}

export interface StoredOverrides {
  fields: OverrideFigures;
  calculated: { gross: number; cisDeduction: number; payrollFee: number; netPay: number; chargeTotal: number; profit: number };
  reason: string;
  byId: string;
  at: string;
}

export type { PayrollStage } from './payroll.service';
import type { PayrollStage as Stage } from './payroll.service';

export interface TimesheetRow {
  /** Where the week stands, from received to paid. */
  stage: Stage;
  id: string;
  candidateId: string;
  candidateName: string;
  companyId: string;
  company: { id: string; name: string };
  weekStart: string;
  weekEnd: string;
  status: TimesheetStatus;
  rateType: RateType;
  payRate: number;
  chargeRate: number;
  totalUnits: number;
  days: TimesheetDay[];
  gross: number;
  cisRate: number;
  cisDeduction: number;
  payrollFee: number;
  netPay: number;
  chargeTotal: number;
  profit: number;
  currency: string;
  clientConfirmedBy: string | null;
  clientConfirmedEmail: string | null;
  clientConfirmedAt: string | null;
  notes: string | null;
  submittedAt: string;
  decidedAt: string | null;
  rejectionReason: string | null;
  adjustments: StoredAdjustment[];
  overrides: StoredOverrides | null;
}

export interface TimesheetEvent {
  id: string;
  action: EventAction;
  note: string | null;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  createdAt: string;
  userName: string | null;
}

export interface TimesheetDetail extends TimesheetRow {
  candidate: { id: string; firstName: string; lastName: string; email: string | null; phone: string | null };
  submittedByName: string | null;
  checkedByName: string | null;
  issuedAt: string | null;
  decidedByName: string | null;
  payslipId: string | null;
  payslipNotes: string | null;
  paymentStatus: 'UNPAID' | 'AUTHORISED' | 'PAID' | null;
  paidAt: string | null;
  paymentReference: string | null;
  attachment: { id: string; name: string } | null;
  discrepancies: Discrepancy[];
  canApprove: boolean;
  profile: { cisRate: number; payrollFee: number; hasNino: boolean; hasUtr: boolean } | null;
  events: TimesheetEvent[];
}

export interface MoneySummary {
  gross: number;
  netPay: number;
  cisDeduction: number;
  payrollFee: number;
  chargeTotal: number;
  profit: number;
}

export interface TimesheetList {
  items: TimesheetRow[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  summary: { counts: Record<TimesheetStatus, number>; approved: MoneySummary; pending: MoneySummary };
}

export interface ListTimesheetsParams {
  page?: number;
  pageSize?: number;
  week?: string;
  status?: TimesheetStatus;
  search?: string;
  candidateId?: string;
}

export interface WorkerProfile {
  nino: string | null;
  utr: string | null;
  cisRate: number;
  payrollFee: number;
  rateType: RateType;
  payRate: number | null;
  chargeRate: number | null;
}

export interface Worker {
  id: string;
  name: string;
  placements: { id: string; companyId: string; companyName: string; jobId: string; jobTitle: string }[];
  profile: WorkerProfile | null;
}

export interface TimesheetInput {
  candidateId: string;
  companyId: string;
  placementId?: string;
  jobId?: string;
  weekStart: string;
  rateType: RateType;
  payRate: number;
  chargeRate: number;
  days: TimesheetDay[];
  clientConfirmedBy?: string;
  clientConfirmedEmail?: string;
  attachmentDocumentId?: string;
  notes?: string;
}

export type TimesheetAmendment = Partial<Omit<TimesheetInput, 'candidateId' | 'companyId' | 'placementId' | 'jobId' | 'weekStart'>> & { amendmentNote?: string };

export function listTimesheets(params: ListTimesheetsParams = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') query.set(key, String(value));
  return apiClient<TimesheetList>(`/timesheets?${query.toString()}`);
}

export const getTimesheet = (id: string) => apiClient<TimesheetDetail>(`/timesheets/${id}`);
export const createTimesheet = (input: TimesheetInput) => apiClient<TimesheetDetail>('/timesheets', { method: 'POST', body: input });
export const amendTimesheet = (id: string, input: TimesheetAmendment) => apiClient<TimesheetDetail>(`/timesheets/${id}`, { method: 'PATCH', body: input });
export const approveTimesheet = (id: string, note?: string) => apiClient<TimesheetDetail>(`/timesheets/${id}/approve`, { method: 'POST', body: { note } });
export const rejectTimesheet = (id: string, reason: string) => apiClient<TimesheetDetail>(`/timesheets/${id}/reject`, { method: 'POST', body: { reason } });
export const listWorkers = (search?: string) => apiClient<Worker[]>(`/timesheets/workers${search ? `?search=${encodeURIComponent(search)}` : ''}`);
export const getWorkerProfile = (candidateId: string) => apiClient<WorkerProfile>(`/timesheets/workers/${candidateId}/profile`);
export const saveWorkerProfile = (candidateId: string, input: Partial<WorkerProfile>) => apiClient<WorkerProfile>(`/timesheets/workers/${candidateId}/profile`, { method: 'PUT', body: input });

/** Saves the PDF payslip of an approved timesheet to the user's computer. */
export async function downloadPayslipPdf(timesheetId: string, filename: string) {
  const blob = await apiBlob(`/timesheets/${timesheetId}/payslip.pdf`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const addAdjustment = (id: string, input: { kind: AdjustmentKind; label: string; amount: number; reason: string }) => apiClient<TimesheetDetail>(`/timesheets/${id}/adjustments`, { method: 'POST', body: input });
export const removeAdjustment = (id: string, adjustmentId: string, reason: string) => apiClient<TimesheetDetail>(`/timesheets/${id}/adjustments/${adjustmentId}`, { method: 'DELETE', body: { reason } });
export const setOverrides = (id: string, input: OverrideFigures & { reason: string }) => apiClient<TimesheetDetail>(`/timesheets/${id}/overrides`, { method: 'PUT', body: input });
export const clearOverrides = (id: string, reason: string) => apiClient<TimesheetDetail>(`/timesheets/${id}/overrides`, { method: 'DELETE', body: { reason } });
export const setPayslipNotes = (id: string, notes: string | null) => apiClient<TimesheetDetail>(`/timesheets/${id}/payslip-notes`, { method: 'PUT', body: { notes } });

/** Opens the PDF payslip in a new tab (to look at it, print it or send it). */
export async function openPayslipPdf(timesheetId: string) {
  const win = window.open('', '_blank');
  const blob = await apiBlob(`/timesheets/${timesheetId}/payslip.pdf`);
  const url = URL.createObjectURL(blob);
  if (win) win.location.href = url;
  else window.location.assign(url);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const markTimesheetChecked = (id: string) => apiClient<TimesheetDetail>(`/timesheets/${id}/checked`, { method: 'POST' });
