import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createPayslip,
  deletePayslip,
  getPayslipsOverview,
  listPayslips,
  updatePayslip,
  type ListPayslipsParams,
  type PayslipInput,
} from '@/services/payslips.service';

const key = {
  all: ['payslips'] as const,
  list: (params: ListPayslipsParams) => ['payslips', 'list', params] as const,
  overview: ['payslips', 'overview'] as const,
};

export function usePayslips(params: ListPayslipsParams = {}) {
  return useQuery({ queryKey: key.list(params), queryFn: () => listPayslips(params), placeholderData: (previous) => previous });
}

export function usePayslipsOverview() {
  return useQuery({ queryKey: key.overview, queryFn: getPayslipsOverview });
}

export function useCreatePayslip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PayslipInput) => createPayslip(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useUpdatePayslip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<PayslipInput> }) => updatePayslip(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useDeletePayslip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePayslip(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}
