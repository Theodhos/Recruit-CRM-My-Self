import { z } from 'zod';

import { optionalId } from './optional-id';

export const jobStatusEnum = z.enum(['DRAFT', 'OPEN', 'ON_HOLD', 'CLOSED', 'ARCHIVED']);
export const employmentTypeEnum = z.enum(['PERMANENT', 'TEMPORARY']);

/** Years of experience: an empty input means "not set" (null clears a saved value), never 0. */
const experienceYears = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.coerce.number().int().min(0).max(60).nullable().optional(),
);

/** How many candidates the job needs: an empty input means "not set" (null clears a saved value), never 0. */
const candidatesNeeded = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.coerce.number().int().min(1).max(1000).nullable().optional(),
);

/** A date typed in a date box: an empty input means "not set" (null clears a saved value). */
const optionalDate = z.preprocess((value) => (value === '' || value === undefined ? null : value), z.string().nullable().optional());

const jobSchedule = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  timezone: z.string().optional(),
  recurringType: z.enum(['WEEKLY', 'PATTERN']).optional(),
  patternDays: z.number().int().min(1).max(31).optional(),
  patternStartDay: z.string().optional(),
  slots: z.string().optional(),
  shiftCount: z.number().int().min(1).max(10).optional(),
  assignments: z.record(z.string(), z.number().int().min(1).max(10)).optional(),
  grid: z
    .record(z.string(), z.object({ start: z.string().optional(), stop: z.string().optional(), breakMinutes: z.string().optional(), slots: z.string().optional(), status: z.string().optional(), shift: z.string().optional() }))
    .optional(),
  workDays: z.array(z.string()).optional(),
  people: z.record(z.string(), z.record(z.string(), z.object({ start: z.string(), stop: z.string(), breakMinutes: z.string().optional(), custom: z.boolean().optional() }))).optional(),
});

const jobFields = z.object({
  companyId: optionalId,
  companyName: z.string().max(200).optional(),
  // optional like the rest: a job with only some of the details is still created (a missing title reads "Untitled job")
  title: z.string().max(200).optional(),
  description: z.string().max(10_000).optional(),
  responsibilities: z.string().max(10_000).optional(),
  requirements: z.string().max(10_000).optional(),
  skills: z.string().max(5_000).optional(),
  qualifications: z.string().max(5_000).optional(),
  applicationInstructions: z.string().max(5_000).optional(),
  experienceYearsMin: experienceYears,
  experienceYearsMax: experienceYears,
  location: z.string().max(150).optional(),
  city: z.string().max(100).optional(),
  street: z.string().max(150).optional(),
  postcode: z.string().max(20).optional(),
  employmentType: employmentTypeEnum.optional(),
  salaryMin: z.coerce.number().nonnegative().optional(),
  salaryMax: z.coerce.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  compensationPackage: z.string().max(10_000).optional(),
  status: jobStatusEnum.optional(),
  candidatesNeeded,
  workingHours: z.string().max(200).optional(),
  daysOff: z.string().max(200).optional(),
  shifts: z.array(z.string().max(100)).max(1000).optional(),
  schedule: jobSchedule.optional(),
  recruitStartDate: optionalDate,
  recruitEndDate: optionalDate,
  publishedOnWebsite: z.boolean().optional(),
  showSalary: z.boolean().optional(),
  expiresAt: optionalDate,
  ownerId: optionalId,
  coRecruiterIds: z.array(z.string()).max(50).optional(),
});

function experienceRangeInOrder(
  value: { experienceYearsMin?: number | null; experienceYearsMax?: number | null },
  ctx: z.RefinementCtx,
) {
  const { experienceYearsMin: min, experienceYearsMax: max } = value;
  if (typeof min === 'number' && typeof max === 'number' && max < min) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['experienceYearsMax'],
      message: 'Must not be less than the minimum',
    });
  }
}

export const createJobSchema = jobFields.superRefine(experienceRangeInOrder);

export const updateJobSchema = jobFields.partial().superRefine(experienceRangeInOrder);

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
