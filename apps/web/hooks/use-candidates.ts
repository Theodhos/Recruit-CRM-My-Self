import type { CreateCandidateInput, UpdateCandidateInput } from '@crm/validation';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createCandidate,
  createCandidateZoom,
  sendCandidateZoomInvite,
  type CandidateZoomInput,
  deleteCandidate,
  getCandidate,
  listCandidates,
  saveCandidateStage,
  type SaveCandidateStageInput,
  updateCandidate,
  type ListCandidatesParams,
} from '@/services/candidates.service';

const key = {
  all: ['candidates'] as const,
  list: (params: ListCandidatesParams) => ['candidates', 'list', params] as const,
  detail: (id: string) => ['candidates', 'detail', id] as const,
};

/** Reference implementation of the hooks/* pattern: TanStack Query wrapping a services/* function, with a stable query key. */
export function useCandidates(params: ListCandidatesParams = {}) {
  return useQuery({ queryKey: key.list(params), placeholderData: keepPreviousData, queryFn: () => listCandidates(params) });
}

export function useCandidate(id: string | undefined) {
  return useQuery({
    queryKey: key.detail(id ?? ''),
    queryFn: () => getCandidate(id!),
    enabled: Boolean(id),
  });
}

export function useCreateCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCandidateInput) => createCandidate(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useUpdateCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCandidateInput }) =>
      updateCandidate(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useDeleteCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCandidate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

/** Stages view: moves a candidate to another recruiting stage and/or saves the data written in a stage. */
export function useSaveCandidateStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SaveCandidateStageInput }) => saveCandidateStage(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useCreateCandidateZoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CandidateZoomInput }) => createCandidateZoom(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key.all });
      void queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
  });
}

export function useSendCandidateZoomInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sendCandidateZoomInvite(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}
