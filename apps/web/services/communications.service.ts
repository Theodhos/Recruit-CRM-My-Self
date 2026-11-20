import { apiClient } from '@/lib/api-client';
import type { CandidateSelection } from '@/services/candidates.service';

export type CommunicationStatusValue =
  | 'QUEUED'
  | 'SENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'UNDELIVERED'
  | 'FAILED'
  | 'RECEIVED'
  | 'RINGING'
  | 'CONNECTED'
  | 'COMPLETED'
  | 'MISSED'
  | 'NO_ANSWER';

export interface Communication {
  id: string;
  type: 'CALL' | 'SMS';
  direction: 'INBOUND' | 'OUTBOUND';
  status: CommunicationStatusValue;
  body: string | null;
  externalNumber: string;
  fromNumber: string | null;
  providerStatus: string | null;
  errorMessage: string | null;
  durationSeconds: number | null;
  batchId: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string } | null;
}

export interface Placeholder {
  key: string;
  label: string;
  example: string;
}

export interface HealthCheck {
  key: 'api_key' | 'business_number' | 'webhook';
  ok: boolean;
  message: string;
}

export interface DialpadStatus {
  connected: boolean;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'PENDING_SETUP';
  fromNumber: string | null;
  companyName: string | null;
  connectedAt: string | null;
  receiving: boolean;
  receivingError: string | null;
  lastWebhookAt: string | null;
  lastHealth: { at: string; ok: boolean; checks: HealthCheck[] } | null;
  webhookUrlConfigured: boolean;
}

export interface MessageTemplate {
  id: string;
  name: string;
  body: string;
  updatedAt: string;
  createdBy?: { firstName: string; lastName: string } | null;
}

export interface BulkPreview {
  connected: boolean;
  fromNumber: string | null;
  matching: number;
  eligible: number;
  excluded: Record<string, number>;
  excludedLabels: Record<string, string>;
  sample: { name: string; text: string; length: number } | null;
  minutes: number;
  tooMany: boolean;
}

export interface BatchStatus {
  id: string;
  status: 'RUNNING' | 'COMPLETED' | 'COMPLETED_WITH_ERRORS';
  matching: number;
  eligible: number;
  excluded: Record<string, number>;
  queued: number;
  sent: number;
  delivered: number;
  failed: number;
  failures: { id: string; candidateId: string | null; name: string | null; error: string | null }[];
  createdAt: string;
  finishedAt: string | null;
  alreadySubmitted?: boolean;
}

// ---- settings (administrators)
export const getDialpadStatus = () => apiClient<DialpadStatus>('/integrations/dialpad');
export const connectDialpad = (input: { apiKey: string; fromNumber?: string }) => apiClient<DialpadStatus>('/integrations/dialpad', { method: 'PUT', body: input });
export const setDialpadNumber = (fromNumber: string) => apiClient<DialpadStatus>('/integrations/dialpad/number', { method: 'PATCH', body: { fromNumber } });
export const listDialpadNumbers = () => apiClient<{ numbers: string[]; note?: string }>('/integrations/dialpad/numbers');
export const checkDialpadHealth = () => apiClient<DialpadStatus>('/integrations/dialpad/health', { method: 'POST' });
export const disconnectDialpad = () => apiClient<DialpadStatus>('/integrations/dialpad', { method: 'DELETE' });
export const listUnmatched = () => apiClient<Communication[]>('/communications/unmatched');
export const assignUnmatched = (id: string, candidateId: string) => apiClient<{ assigned: number }>(`/communications/${id}/assign`, { method: 'POST', body: { candidateId } });

// ---- everyone who may text or call
export const getCommunicationStatus = () => apiClient<{ connected: boolean; fromNumber: string | null; placeholders: Placeholder[] }>('/communications/status');
export const getCandidateCommunications = (candidateId: string) => apiClient<Communication[]>(`/candidates/${candidateId}/communications`);
export const callCandidate = (candidateId: string) => apiClient<Communication>(`/candidates/${candidateId}/call`, { method: 'POST' });
export const sendCandidateSms = (candidateId: string, input: { text: string; jobId?: string }) => apiClient<Communication>(`/candidates/${candidateId}/sms`, { method: 'POST', body: input });

// ---- bulk
export const previewBulkSms = (input: { selection: CandidateSelection; text: string; jobId?: string }) => apiClient<BulkPreview>('/communications/bulk/preview', { method: 'POST', body: input });
export const sendBulkSms = (input: { selection: CandidateSelection; text: string; jobId?: string; idempotencyKey: string }) => apiClient<BatchStatus>('/communications/bulk', { method: 'POST', body: input });
export const getBatch = (id: string) => apiClient<BatchStatus>(`/communications/batches/${id}`);

// ---- templates
export const listTemplates = () => apiClient<MessageTemplate[]>('/message-templates');
export const createTemplate = (input: { name: string; body: string }) => apiClient<MessageTemplate>('/message-templates', { method: 'POST', body: input });
export const updateTemplate = (id: string, input: { name?: string; body?: string }) => apiClient<MessageTemplate>(`/message-templates/${id}`, { method: 'PATCH', body: input });
export const deleteTemplate = (id: string) => apiClient<void>(`/message-templates/${id}`, { method: 'DELETE' });
