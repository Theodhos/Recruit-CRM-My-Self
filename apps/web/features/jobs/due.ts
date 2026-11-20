import type { JobWithCompany } from '@/services/jobs.service';

const DAY = 24 * 60 * 60 * 1000;

/** How many days before the "find candidates by" date a job starts to climb the list and turn colour (the API sorts with the same window). */
export const DUE_WINDOW_DAYS = 14;

/**
 * How close an open job is to its "find candidates by" date, day by day: 0 = not close, 1 = 14 days left … 14 = 1 day
 * left, 15 = the date has arrived (or passed). The row's colour follows this number, yellow to deep red.
 */
export function jobUrgency(job: Pick<JobWithCompany, 'status' | 'recruitEndDate'>): number {
  if (job.status !== 'OPEN' || !job.recruitEndDate) return 0;
  const left = new Date(job.recruitEndDate).getTime() - Date.now();
  if (left <= 0) return DUE_WINDOW_DAYS + 1;
  if (left > DUE_WINDOW_DAYS * DAY) return 0;
  return DUE_WINDOW_DAYS + 1 - Math.ceil(left / DAY);
}

/** The job is in the window: its date is within two weeks (or has passed). The closer the date, the redder the row. */
export const jobIsDue = (job: Pick<JobWithCompany, 'status' | 'recruitEndDate'>): boolean => jobUrgency(job) > 0;

/** Row colour per urgency level (written out in full so Tailwind keeps every class): pale yellow at 14 days, deep red on the day. */
export const URGENCY_ROW = [
  '',
  '!bg-yellow-50 hover:!bg-yellow-100',
  '!bg-yellow-100 hover:!bg-yellow-200',
  '!bg-amber-100 hover:!bg-amber-200',
  '!bg-amber-200 hover:!bg-amber-300',
  '!bg-orange-100 hover:!bg-orange-200',
  '!bg-orange-200 hover:!bg-orange-300',
  '!bg-orange-300 hover:!bg-orange-400',
  '!bg-red-100 hover:!bg-red-200',
  '!bg-red-200 hover:!bg-red-300',
  '!bg-red-300 hover:!bg-red-400',
  '!bg-red-300 hover:!bg-red-400',
  '!bg-red-400 hover:!bg-red-500',
  '!bg-red-400 hover:!bg-red-500',
  '!bg-red-500 hover:!bg-red-600',
  '!bg-red-500 hover:!bg-red-600',
] as const;
