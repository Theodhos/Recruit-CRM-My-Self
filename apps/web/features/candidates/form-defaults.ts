import type { CreateCandidateInput } from '@crm/validation';

import { toFormDefaults } from '@/lib/form-defaults';

type Row = Record<string, unknown> & { skills?: string[]; qualifications?: string[]; lastContactedAt?: string | null };

/** What the Add / Edit form shows for a candidate: lists as comma-separated text, dates as YYYY-MM-DD, nulls as empty. */
export function candidateFormDefaults(candidate: Row): Partial<CreateCandidateInput> {
  const fields = ['firstName', 'lastName', 'email', 'phone', 'location', 'city', 'street', 'postalCode', 'jobTitle', 'currentCompany', 'source', 'interestedJobId', 'trade', 'grade', 'employmentStatus', 'experienceYears', 'experienceNotes', 'smsConsent', 'emailConsent', 'callConsent'];
  const picked: Record<string, unknown> = {};
  for (const field of fields) picked[field] = candidate[field];
  picked.skills = candidate.skills?.join(', ') ?? '';
  picked.qualifications = candidate.qualifications?.join(', ') ?? '';
  picked.lastContactedAt = candidate.lastContactedAt ? candidate.lastContactedAt.slice(0, 10) : undefined;
  return toFormDefaults(picked) as Partial<CreateCandidateInput>;
}
