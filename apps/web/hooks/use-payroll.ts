import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { authorisePayments, getPayroll, issuePayslips, markPaid, recalculateWeek, unauthorisePayments, type PaymentResult, type PayrollFilters } from '@/services/payroll.service';

export function usePayroll(filters: PayrollFilters) {
  return useQuery({ queryKey: ['payroll', filters], queryFn: () => getPayroll(filters), placeholderData: (previous) => previous });
}

function usePaymentMutation<T>(fn: (input: T) => Promise<PaymentResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['payroll'] });
      void queryClient.invalidateQueries({ queryKey: ['timesheets'] });
    },
  });
}

export const useAuthorisePayments = () => usePaymentMutation((ids: string[]) => authorisePayments(ids));
export const useUnauthorisePayments = () => usePaymentMutation((ids: string[]) => unauthorisePayments(ids));
export const useMarkPaid = () => usePaymentMutation((input: { payslipIds: string[]; paidDate?: string; reference?: string }) => markPaid(input));

export function useRecalculate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ week, dryRun }: { week: string; dryRun: boolean }) => recalculateWeek(week, dryRun),
    onSuccess: (_result, variables) => {
      if (variables.dryRun) return;
      void queryClient.invalidateQueries({ queryKey: ['payroll'] });
      void queryClient.invalidateQueries({ queryKey: ['timesheets'] });
    },
  });
}
export const useIssuePayslips = () => usePaymentMutation((ids: string[]) => issuePayslips(ids));
