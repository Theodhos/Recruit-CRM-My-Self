import type { CreateJobInput, UpdateJobInput } from '@crm/validation';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  changeJobPublication,
  createJob,
  deleteJob,
  getJob,
  getJobCandidateHistory,
  listJobs,
  releaseJobPlaces,
  replaceJobCandidate,
  updateJob,
  type JobPublicationAction,
  type ListJobsParams,
} from '@/services/jobs.service';

const key = {
  all: ['jobs'] as const,
  list: (params: ListJobsParams) => ['jobs', 'list', params] as const,
  detail: (id: string) => ['jobs', 'detail', id] as const,
};

export function useJobs(params: ListJobsParams = {}) {
  return useQuery({ queryKey: key.list(params), placeholderData: keepPreviousData, queryFn: () => listJobs(params) });
}

/** Every job that matches, not just the first page (the server gives at most 100 a page) — for pickers that must offer all of them. */
export function useAllJobs(params: ListJobsParams = {}) {
  return useQuery({
    queryKey: [...key.list(params), 'all'],
    queryFn: async () => {
      const first = await listJobs({ ...params, page: 1, pageSize: 100 });
      const items = [...first.items];
      for (let page = 2; page <= (first.totalPages ?? 1) && page <= 50; page += 1) {
        items.push(...(await listJobs({ ...params, page, pageSize: 100 })).items);
      }
      return { ...first, items, page: 1, pageSize: items.length };
    },
  });
}

export function useJob(id: string | undefined) {
  return useQuery({
    queryKey: key.detail(id ?? ''),
    queryFn: () => getJob(id!),
    enabled: Boolean(id),
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateJobInput) => createJob(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateJobInput }) => updateJob(id, input),
    // Candidates needed decides where the job lives (Jobs while a place is free, Completed Jobs when every place is filled),
    // and with it which cards / contracts the pipeline and Active Employees show
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: key.all }),
        queryClient.invalidateQueries({ queryKey: ['applications'] }),
        queryClient.invalidateQueries({ queryKey: ['placements'] }),
      ]),
  });
}

export function useChangeJobPublication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: JobPublicationAction }) => changeJobPublication(id, action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}

export function useJobCandidateHistory(id: string | undefined) {
  return useQuery({ queryKey: ['jobs', 'candidate-history', id ?? ''], queryFn: () => getJobCandidateHistory(id!), enabled: Boolean(id) });
}

export function useReleaseJobPlaces() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, count, dryRun }: { id: string; count: number; dryRun?: boolean }) => releaseJobPlaces(id, { count, dryRun }),
    onSuccess: (_result, variables) => {
      if (variables.dryRun) return;
      return Promise.all(['jobs', 'applications', 'placements', 'candidates'].map((name) => queryClient.invalidateQueries({ queryKey: [name] })));
    },
  });
}

export function useReplaceJobCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fromCandidateId, toCandidateId }: { id: string; fromCandidateId: string; toCandidateId: string }) =>
      replaceJobCandidate(id, { fromCandidateId, toCandidateId }),
    onSuccess: () => Promise.all(['jobs', 'applications', 'placements', 'candidates'].map((name) => queryClient.invalidateQueries({ queryKey: [name] }))),
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteJob(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}
