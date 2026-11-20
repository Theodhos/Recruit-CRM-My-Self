import type { EmploymentType, JobStatus } from '../common';

import type { SoftDeletableEntity, TenantScopedEntity } from './base';

/** Temporary jobs: when the job runs and how each day of the week / of the pattern is staffed. */
export interface JobSchedule {
  startDate?: string;
  endDate?: string;
  timezone?: string;
  recurringType?: 'WEEKLY' | 'PATTERN';
  /** Pattern: how many days it repeats over. */
  patternDays?: number;
  /** Pattern: the weekday (mon…sun) the pattern starts on — today when it is set. */
  patternStartDay?: string;
  /** Pattern: how many places the job fills each day. */
  slots?: string;
  /** How many shifts (turns) the job runs; the calendar gives each of them its own days and hours. */
  shiftCount?: number;
  /** Per day column (mon…sun, or day1…dayN): start, stop, break (minutes) and open slots. */
  grid?: Record<string, { start?: string; stop?: string; breakMinutes?: string; slots?: string; status?: string; shift?: string }>;
  /** The weekdays (mon…sun) a person works. */
  workDays?: string[];
  /** The calendar of each shift (key = the shift number, 1…): the dates they work (YYYY-MM-DD) with the hours of each day. */
  people?: Record<string, Record<string, { start: string; stop: string; breakMinutes?: string; custom?: boolean }>>;
  /** Which shift (1…) each candidate of the job works: candidate id → shift number. */
  assignments?: Record<string, number>;
}

export interface Job extends TenantScopedEntity, SoftDeletableEntity {
  companyId: string | null;
  title: string;
  description: string | null;
  responsibilities: string | null;
  requirements: string | null;
  skills: string | null;
  qualifications: string | null;
  applicationInstructions: string | null;
  experienceYearsMin: number | null;
  experienceYearsMax: number | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  street: string | null;
  postcode: string | null;
  employmentType: EmploymentType;
  salaryMin: string | null;
  salaryMax: string | null;
  currency: string;
  compensationPackage: string | null;
  status: JobStatus;
  /** Shown on the public careers website while OPEN ("Published") and before expiresAt. */
  publishedOnWebsite: boolean;
  websitePublishedAt: string | null;
  expiresAt: string | null;
  showSalary: boolean;
  /** How many candidates the job needs filled. */
  candidatesNeeded: number | null;
  /** Temporary jobs: working hours, days off, and one shift per person (first person first). */
  workingHours: string | null;
  daysOff: string | null;
  shifts: string[];
  schedule: JobSchedule | null;
  /** The date range in which candidates have to be found; when the end date arrives the job turns red and moves to the top. */
  recruitStartDate: string | null;
  recruitEndDate: string | null;
  ownerId: string | null;
  coRecruiterIds: string[];
  openedAt: string;
  closedAt: string | null;
}
