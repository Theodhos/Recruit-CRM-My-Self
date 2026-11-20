import type { CreateCompanyInput, UpdateCompanyInput } from '@crm/validation';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createCompany,
  deleteCompany,
  getCompany,
  listAllCompanies,
  listCompanies,
  saveCompanyPipelineRecord,
  updateCompany,
  type ListCompaniesParams,
  type SaveCompanyPipelineRecordInput,
} from '@/services/companies.service';

const key = {
  all: ['companies'] as const,
  list: (params: ListCompaniesParams) => ['companies', 'list', params] as const,
  detail: (id: string) => ['companies', 'detail', id] as const,
  board: (search: string, ownerId: string) => ['companies', 'board', search, ownerId] as const,
};

export function useCompanies(params: ListCompaniesParams = {}, options: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: key.list(params), placeholderData: keepPreviousData, queryFn: () => listCompanies(params), enabled: options.enabled ?? true });
}

export function useCompanyBoard(search?: string, ownerId?: string) {
  return useQuery({ queryKey: key.board(search ?? '', ownerId ?? ''), queryFn: () => listAllCompanies(search, ownerId) });
}

export function useCompany(id: string | undefined) {
  return useQuery({
    queryKey: key.detail(id ?? ''),
    queryFn: () => getCompany(id!),
    enabled: Boolean(id),
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCompanyInput) => createCompany(input),
    // the lists refresh in the background — the form does not wait for them
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key.all });
    },
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCompanyInput }) =>
      updateCompany(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key.all });
    },
  });
}

export function useSaveCompanyPipelineRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SaveCompanyPipelineRecordInput }) => saveCompanyPipelineRecord(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

/** The same list/board data without the company: a row, or a card on the Pipeline Companies board. */
function without(data: unknown, id: string): unknown {
  if (Array.isArray(data)) return data.filter((c) => (c as { id?: string })?.id !== id);
  const list = data as { items?: { id?: string }[]; totalItems?: number } | undefined;
  if (list?.items) {
    const items = list.items.filter((c) => c.id !== id);
    return { ...list, items, ...(typeof list.totalItems === 'number' ? { totalItems: list.totalItems - (list.items.length - items.length) } : {}) };
  }
  return data;
}

export function useDeleteCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCompany(id),
    // the company leaves the screen at once; the server confirms in the background, and a refusal puts it back
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: key.all });
      const before = queryClient.getQueriesData({ queryKey: key.all });
      queryClient.setQueriesData({ queryKey: key.all }, (data) => without(data, id));
      return { before };
    },
    onError: (_error, _id, context) => {
      context?.before.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key.all });
      // its jobs and their cards went with it
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}
