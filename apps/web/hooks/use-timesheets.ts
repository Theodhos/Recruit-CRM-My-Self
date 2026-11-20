import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addAdjustment,
  amendTimesheet,
  approveTimesheet,
  clearOverrides,
  createTimesheet,
  getTimesheet,
  getWorkerProfile,
  listTimesheets,
  listWorkers,
  markTimesheetChecked,
  rejectTimesheet,
  removeAdjustment,
  saveWorkerProfile,
  setOverrides,
  setPayslipNotes,
  type AdjustmentKind,
  type ListTimesheetsParams,
  type OverrideFigures,
  type TimesheetAmendment,
  type TimesheetInput,
  type WorkerProfile,
} from '@/services/timesheets.service';

const key = {
  all: ['timesheets'] as const,
  list: (params: ListTimesheetsParams) => ['timesheets', 'list', params] as const,
  one: (id: string) => ['timesheets', 'one', id] as const,
  workers: (search: string) => ['timesheets', 'workers', search] as const,
  profile: (candidateId: string) => ['timesheets', 'profile', candidateId] as const,
};

export function useTimesheets(params: ListTimesheetsParams = {}) {
  return useQuery({ queryKey: key.list(params), queryFn: () => listTimesheets(params), placeholderData: (previous) => previous });
}

export function useTimesheet(id: string) {
  return useQuery({ queryKey: key.one(id), queryFn: () => getTimesheet(id), enabled: Boolean(id) });
}

export function useWorkers(search: string) {
  return useQuery({ queryKey: key.workers(search), queryFn: () => listWorkers(search || undefined), placeholderData: (previous) => previous });
}

export function useWorkerProfile(candidateId: string | null) {
  return useQuery({ queryKey: key.profile(candidateId ?? ''), queryFn: () => getWorkerProfile(candidateId!), enabled: Boolean(candidateId) });
}

function useInvalidating<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key.all });
      // the weekly payroll screen lists the same timesheets
      void queryClient.invalidateQueries({ queryKey: ['payroll'] });
    },
  });
}

export const useCreateTimesheet = () => useInvalidating((input: TimesheetInput) => createTimesheet(input));
export const useAmendTimesheet = () => useInvalidating(({ id, input }: { id: string; input: TimesheetAmendment }) => amendTimesheet(id, input));
export const useApproveTimesheet = () => useInvalidating(({ id, note }: { id: string; note?: string }) => approveTimesheet(id, note));
export const useRejectTimesheet = () => useInvalidating(({ id, reason }: { id: string; reason: string }) => rejectTimesheet(id, reason));
export const useSaveWorkerProfile = () => useInvalidating(({ candidateId, input }: { candidateId: string; input: Partial<WorkerProfile> }) => saveWorkerProfile(candidateId, input));
export const useAddAdjustment = () => useInvalidating(({ id, input }: { id: string; input: { kind: AdjustmentKind; label: string; amount: number; reason: string } }) => addAdjustment(id, input));
export const useRemoveAdjustment = () => useInvalidating(({ id, adjustmentId, reason }: { id: string; adjustmentId: string; reason: string }) => removeAdjustment(id, adjustmentId, reason));
export const useSetOverrides = () => useInvalidating(({ id, input }: { id: string; input: OverrideFigures & { reason: string } }) => setOverrides(id, input));
export const useClearOverrides = () => useInvalidating(({ id, reason }: { id: string; reason: string }) => clearOverrides(id, reason));
export const useSetPayslipNotes = () => useInvalidating(({ id, notes }: { id: string; notes: string | null }) => setPayslipNotes(id, notes));
export const useMarkChecked = () => useInvalidating((id: string) => markTimesheetChecked(id));
