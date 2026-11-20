import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  callCandidate,
  checkDialpadHealth,
  connectDialpad,
  createTemplate,
  deleteTemplate,
  disconnectDialpad,
  getCandidateCommunications,
  getCommunicationStatus,
  getDialpadStatus,
  listDialpadNumbers,
  listTemplates,
  listUnmatched,
  assignUnmatched,
  sendCandidateSms,
  setDialpadNumber,
  updateTemplate,
} from '@/services/communications.service';

const key = {
  dialpad: ['dialpad'] as const,
  status: ['communications', 'status'] as const,
  templates: ['message-templates'] as const,
  unmatched: ['communications', 'unmatched'] as const,
  candidate: (id: string) => ['communications', 'candidate', id] as const,
};

/** Is Dialpad connected (for the Call / Text buttons)? Same answer for everyone who can read candidates. */
export function useCommunicationStatus() {
  return useQuery({ queryKey: key.status, queryFn: getCommunicationStatus, staleTime: 60_000 });
}

const OPEN: string[] = ['QUEUED', 'SENDING', 'SENT', 'RINGING', 'CONNECTED'];

/** The candidate's calls and texts; refreshes by itself while something is still in flight (a text not yet delivered, a call in progress). */
export function useCandidateCommunications(candidateId: string) {
  return useQuery({
    queryKey: key.candidate(candidateId),
    queryFn: () => getCandidateCommunications(candidateId),
    refetchInterval: (query) => {
      const rows = query.state.data;
      const recent = rows?.some((r) => OPEN.includes(r.status) && Date.now() - new Date(r.createdAt).getTime() < 15 * 60_000);
      return recent ? 8_000 : 60_000;
    },
  });
}

export function useCallCandidate(candidateId: string) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: () => callCandidate(candidateId), onSettled: () => queryClient.invalidateQueries({ queryKey: key.candidate(candidateId) }) });
}

export function useSendSms(candidateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { text: string; jobId?: string }) => sendCandidateSms(candidateId, input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key.candidate(candidateId) }),
  });
}

export function useTemplates(enabled = true) {
  return useQuery({ queryKey: key.templates, queryFn: listTemplates, enabled });
}

export function useTemplateMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: key.templates });
  return {
    create: useMutation({ mutationFn: createTemplate, onSuccess: refresh }),
    update: useMutation({ mutationFn: (v: { id: string; name?: string; body?: string }) => updateTemplate(v.id, { name: v.name, body: v.body }), onSuccess: refresh }),
    remove: useMutation({ mutationFn: deleteTemplate, onSuccess: refresh }),
  };
}

export function useDialpad() {
  return useQuery({ queryKey: key.dialpad, queryFn: getDialpadStatus });
}

export function useDialpadMutations() {
  const queryClient = useQueryClient();
  const done = (status: unknown) => {
    queryClient.setQueryData(key.dialpad, status);
    void queryClient.invalidateQueries({ queryKey: key.status });
  };
  return {
    connect: useMutation({ mutationFn: connectDialpad, onSuccess: done }),
    setNumber: useMutation({ mutationFn: setDialpadNumber, onSuccess: done }),
    health: useMutation({ mutationFn: checkDialpadHealth, onSuccess: done }),
    disconnect: useMutation({ mutationFn: disconnectDialpad, onSuccess: done }),
  };
}

export function useDialpadNumbers(enabled: boolean) {
  return useQuery({ queryKey: ['dialpad', 'numbers'], queryFn: listDialpadNumbers, enabled, staleTime: 5 * 60_000, retry: false });
}

export function useUnmatched(enabled: boolean) {
  return useQuery({ queryKey: key.unmatched, queryFn: listUnmatched, enabled });
}

export function useAssignUnmatched() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; candidateId: string }) => assignUnmatched(v.id, v.candidateId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['communications'] }),
  });
}
