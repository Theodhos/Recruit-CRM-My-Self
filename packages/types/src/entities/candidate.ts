import type { CandidateStatus } from '../common';

import type { SoftDeletableEntity, TenantScopedEntity } from './base';

/**
 * Reference implementation of the entity-type pattern. One file per domain
 * entity, mirroring its Prisma model but expressed as a plain, frontend-safe
 * interface (dates as ISO strings, no Prisma-generated types). Add sibling
 * files (company.ts, job.ts, application.ts, ...) here as each module is
 * implemented in Phase 2 — do not pre-build all of them speculatively now.
 */
export interface Candidate extends TenantScopedEntity, SoftDeletableEntity {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  street: string | null;
  postalCode: string | null;
  jobTitle: string | null;
  currentCompany: string | null;
  source: string | null;
  trade?: string | null;
  grade?: 'A' | 'B' | 'C' | null;
  employmentStatus?: 'EMPLOYED' | 'SELF_EMPLOYED' | 'UNEMPLOYED' | null;
  experienceYears?: number | null;
  experienceNotes?: string | null;
  skills?: string[];
  qualifications?: string[];
  lastContactedAt?: string | null;
  smsConsent?: 'UNKNOWN' | 'GRANTED' | 'OPTED_OUT';
  emailConsent?: 'UNKNOWN' | 'GRANTED' | 'OPTED_OUT';
  callConsent?: 'UNKNOWN' | 'GRANTED' | 'OPTED_OUT';
  avatarUrl: string | null;
  status: CandidateStatus;
  manualStatus?: 'AVAILABLE' | 'ON_HOLD' | 'NOT_AVAILABLE' | 'DO_NOT_USE' | null;
  ownerId: string | null;
  companyId: string | null;
  interestedJobId: string | null;
  /** Recruiting stage used to complete the candidate's data (see /candidates). */
  recruitmentStage?: 'NEW' | 'CV_SENT' | 'INTERVIEW_1' | 'PLACEMENT';
  /** What was written in each recruiting stage. */
  stageData?: Record<string, Record<string, string>> | null;
}
