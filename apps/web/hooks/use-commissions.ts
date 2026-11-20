import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { addPayment, clearAllocation, getAllocation, getMonth, getResourcers, getStatement, removePayment, setAllocation, setDefaultBasis, setPermanentTrigger, setRate, type CommissionBasis } from '@/services/commissions.service';

const key = ['commissions'] as const;

export const useResourcers = () => useQuery({ queryKey: [...key, 'resourcers'], queryFn: getResourcers });
export const useAllocation = (placementId: string | null) => useQuery({ queryKey: [...key, 'allocation', placementId], queryFn: () => getAllocation(placementId!), enabled: Boolean(placementId) });
export const useMonth = (month: string) => useQuery({ queryKey: [...key, 'month', month], queryFn: () => getMonth(month), placeholderData: (previous) => previous });
export const useStatement = (month: string, userId: string | null) => useQuery({ queryKey: [...key, 'statement', month, userId], queryFn: () => getStatement(month, userId!), enabled: Boolean(userId) });

function useChanging<T, R>(fn: (input: T) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      // the Active Employees tables show the resourcers of each placement
      void queryClient.invalidateQueries({ queryKey: ['placements'] });
    },
  });
}

export const useSetAllocation = () => useChanging(({ placementId, resourcers }: { placementId: string; resourcers: { userId: string; splitPercent: number }[] }) => setAllocation(placementId, resourcers));
export const useClearAllocation = () => useChanging((placementId: string) => clearAllocation(placementId));
export const useSetRate = () => useChanging(({ userId, commissionRate, commissionBasis }: { userId: string; commissionRate: number; commissionBasis: CommissionBasis | null }) => setRate(userId, { commissionRate, commissionBasis }));
export const useSetDefaultBasis = () => useChanging((basis: CommissionBasis) => setDefaultBasis(basis));
export const useAddPayment = () => useChanging((input: { userId: string; month: string; amount: number; paidDate?: string; reference?: string }) => addPayment(input));
export const useRemovePayment = () => useChanging((id: string) => removePayment(id));
export const useSetPermanentTrigger = () => useChanging((trigger: 'PLACEMENT' | 'PAID') => setPermanentTrigger(trigger));
