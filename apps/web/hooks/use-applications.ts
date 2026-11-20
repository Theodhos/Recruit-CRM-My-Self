import type { CreateApplicationInput, UpdateApplicationInput } from '@crm/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createApplication,
  deleteApplication,
  getApplication,
  listApplications,
  toggleChecklistItem,
  updateApplication,
  type ListApplicationsParams,
} from '@/services/applications.service';

const key = {
  all: ['applications'] as const,
  list: (params: ListApplicationsParams) => ['applications', 'list', params] as const,
  detail: (id: string) => ['applications', 'detail', id] as const,
};

/**
 * `all`: read every page, not just the first. The pipeline board needs every card — the server gives at most 100 per
 * page, and a card beyond the first page would be missing from its column (a person who has just been moved would
 * seem to vanish).
 */
async function listEveryApplication(params: ListApplicationsParams) {
  const first = await listApplications({ ...params, page: 1, pageSize: 100 });
  const items = [...first.items];
  for (let page = 2; page <= (first.totalPages ?? 1) && page <= 50; page += 1) {
    items.push(...(await listApplications({ ...params, page, pageSize: 100 })).items);
  }
  return { ...first, items, page: 1, pageSize: items.length };
}

export function useApplications(params: ListApplicationsParams = {}, options: { enabled?: boolean; all?: boolean } = {}) {
  return useQuery({
    queryKey: options.all ? [...key.list(params), 'all'] : key.list(params),
    queryFn: () => (options.all ? listEveryApplication(params) : listApplications(params)),
    enabled: options.enabled ?? true,
  });
}

export function useApplication(id: string | undefined) {
  return useQuery({
    queryKey: key.detail(id ?? ''),
    queryFn: () => getApplication(id!),
    enabled: Boolean(id),
  });
}

// An Application coming or going changes which Candidates count as
// "unassigned" (see the Candidates page's unassigned-applicants list and the pipeline
// board), so every mutation here also invalidates ['candidates'] — not just
// its own ['applications'] key.
function invalidateApplicationsAndCandidates(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: key.all });
  queryClient.invalidateQueries({ queryKey: ['candidates'] });
  // a card moving into (or out of) Active Employees changes its job's "3/10" on Jobs and its place on Completed Jobs
  queryClient.invalidateQueries({ queryKey: ['jobs'] });
  // reaching (or leaving) the hired stage creates (or removes) the Active Employees entry — the list must re-read
  queryClient.invalidateQueries({ queryKey: ['placements'] });
}

export function useCreateApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateApplicationInput) => createApplication(input),
    onSuccess: () => invalidateApplicationsAndCandidates(queryClient),
  });
}

export function useUpdateApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateApplicationInput }) =>
      updateApplication(id, input),
    onSuccess: () => invalidateApplicationsAndCandidates(queryClient),
  });
}

export function useDeleteApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteApplication(id),
    onSuccess: () => invalidateApplicationsAndCandidates(queryClient),
  });
}

export function useToggleChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      applicationId,
      checklistItemId,
      completed,
    }: {
      applicationId: string;
      checklistItemId: string;
      completed: boolean;
    }) => toggleChecklistItem(applicationId, checklistItemId, completed),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key.all }),
  });
}
