import type { QueryClient } from '@tanstack/react-query';

import type { ApplicationWithRelations } from '@/services/applications.service';
import { getCandidate } from '@/services/candidates.service';
import { listDocuments } from '@/services/documents.service';
import { getJob } from '@/services/jobs.service';
import { listStageNotes } from '@/services/stage-notes.service';

const FRESH_FOR_MS = 30_000;

/**
 * Starts loading everything a card's pop-up shows (its stage records and History, the candidate, the job, the
 * documents) as soon as the mouse is over the card — by the time it is clicked it is already in the cache, so the
 * pop-up opens complete and its buttons are live at once. The query keys are the ones the hooks use.
 */
export function prefetchCard(queryClient: QueryClient, application: ApplicationWithRelations) {
  const staleTime = FRESH_FOR_MS;
  void queryClient.prefetchQuery({ queryKey: ['applications', 'stage-notes', application.id], queryFn: () => listStageNotes(application.id), staleTime });
  void queryClient.prefetchQuery({ queryKey: ['candidates', 'detail', application.candidate.id], queryFn: () => getCandidate(application.candidate.id), staleTime });
  if (application.job.id) void queryClient.prefetchQuery({ queryKey: ['jobs', 'detail', application.job.id], queryFn: () => getJob(application.job.id), staleTime });
  const documents = { candidateId: application.candidate.id, pageSize: 50 };
  void queryClient.prefetchQuery({ queryKey: ['documents', 'list', documents], queryFn: () => listDocuments(documents), staleTime });
}
