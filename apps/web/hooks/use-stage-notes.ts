import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listStageNotes, upsertStageNote, type StageNotesResponse, type UpsertStageNoteInput } from '@/services/stage-notes.service';

const key = (applicationId: string) => ['applications', 'stage-notes', applicationId] as const;

export function useStageNotes(applicationId: string | undefined, placeholder?: StageNotesResponse) {
  return useQuery({
    queryKey: key(applicationId ?? ''),
    queryFn: () => listStageNotes(applicationId!),
    enabled: Boolean(applicationId),
    // shown until the real answer arrives, so the pop-up and its buttons are there at once
    placeholderData: placeholder,
  });
}

export function useUpsertStageNote(applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stageId, input }: { stageId: string; input: UpsertStageNoteInput }) => upsertStageNote(applicationId, stageId, input),
    // refreshed in the background: a save does not wait for the notes to be fetched again
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key(applicationId) });
    },
  });
}
