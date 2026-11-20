import { z } from 'zod';

import { optionalId } from './optional-id';

/**
 * Reference implementation of the shared-schema pattern. One file per
 * domain entity's write operations, consumed by both React Hook Form
 * (apps/web) and NestJS DTOs via a class-validator/zod bridge (apps/api).
 * Add sibling files (company.schema.ts, job.schema.ts, ...) alongside each
 * module's Phase 2 implementation rather than pre-building all of them now.
 */
export const candidateStatusEnum = z.enum([
  'ACTIVE',
  'PASSIVE',
  'DO_NOT_CONTACT',
  'PLACED',
  'ARCHIVED',
]);

export const candidateGradeEnum = z.enum(['A', 'B', 'C']);
export const candidateEmploymentStatusEnum = z.enum(['EMPLOYED', 'SELF_EMPLOYED', 'UNEMPLOYED']);
export const consentStatusEnum = z.enum(['UNKNOWN', 'GRANTED', 'OPTED_OUT']);

export const createCandidateSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  location: z.string().max(150).optional(),
  city: z.string().max(100).optional(),
  street: z.string().max(150).optional(),
  postalCode: z.string().max(20).optional(),
  jobTitle: z.string().max(150).optional(),
  currentCompany: z.string().max(150).optional(),
  source: z.string().max(100).optional(),
  trade: z.string().max(400).optional(),
  grade: candidateGradeEnum.optional().or(z.literal('')).transform((value) => (value === '' ? undefined : value)),
  employmentStatus: candidateEmploymentStatusEnum.optional().or(z.literal('')).transform((value) => (value === '' ? undefined : value)),
  experienceYears: z.coerce.number().int().min(0).max(70).optional().or(z.literal('')).transform((value) => (value === '' ? undefined : value)),
  experienceNotes: z.string().max(5_000).optional(),
  /** Comma- or line-separated in the form; the API stores them one by one. */
  skills: z.string().max(2_000).optional(),
  qualifications: z.string().max(2_000).optional(),
  lastContactedAt: z.string().optional().or(z.literal('')).transform((value) => (value === '' ? undefined : value)),
  smsConsent: consentStatusEnum.optional(),
  emailConsent: consentStatusEnum.optional(),
  callConsent: consentStatusEnum.optional(),
  status: candidateStatusEnum.optional(),
  manualStatus: z.enum(['AVAILABLE', 'ON_HOLD', 'NOT_AVAILABLE', 'DO_NOT_USE']).nullable().optional(),
  ownerId: optionalId,
  interestedJobId: z
    .string()
    .cuid()
    .optional()
    .or(z.literal(''))
    .transform((value) => (value === '' ? undefined : value)),
});

export const updateCandidateSchema = createCandidateSchema.partial();

export type CreateCandidateInput = z.infer<typeof createCandidateSchema>;
export type UpdateCandidateInput = z.infer<typeof updateCandidateSchema>;
