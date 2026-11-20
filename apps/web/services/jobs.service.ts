import type { Job, OffsetPaginatedResult } from '@crm/types';
import type { CreateJobInput, UpdateJobInput } from '@crm/validation';

import { apiClient } from '@/lib/api-client';

export interface ListJobsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  companyId?: string;
  title?: string;
  company?: string;
  location?: string;
  /** A place or postcode, with radiusKm: only the jobs within that many km of it. */
  nearLocation?: string;
  /** … or the place of this candidate. */
  nearCandidateId?: string;
  radiusKm?: number;
  /** Years of experience; matches jobs whose asked-for range covers it. */
  experience?: number;
  status?: string;
  /** Only the jobs this user added. */
  ownerId?: string;
  availability?: 'AVAILABLE' | 'NOT_AVAILABLE' | 'DO_NOT_USE';
  /** PERMANENT = permanent jobs; TEMPORARY = every other kind (temporary, contract, part-time). */
  employmentGroup?: 'PERMANENT' | 'TEMPORARY';
  /** COMPLETED = every place of the job is filled (Completed Jobs); OPEN = jobs that still have places to fill. */
  completion?: 'COMPLETED' | 'OPEN';
}

export type JobWithCompany = Job & {
  /** With a distance search: how far this job is from the start point, in miles. */
  distanceMiles?: number;
  company:
    | {
        id: string;
        name: string;
        // the detail endpoint adds the company's own details
        industry?: string | null;
        website?: string | null;
        email?: string | null;
        phone?: string | null;
        city?: string | null;
        country?: string | null;
        status?: string;
      }
    | null;
  /** The list adds when the last place was filled (Completed Jobs). */
  completedOn?: string | null;
  /** Detail endpoint only. */
  owner?: { id: string; firstName: string; lastName: string; email: string } | null;
  /** The list adds `interviews` (people with an interview); the detail endpoint adds interestedCandidates and documents. */
  _count?: { applications: number; placements: number; interviews?: number; filled?: number; interestedCandidates?: number; documents?: number };
};

export function listJobs(params: ListJobsParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.search) query.set('search', params.search);
  if (params.title) query.set('title', params.title);
  if (params.company) query.set('company', params.company);
  if (params.location) query.set('location', params.location);
  if ((params.nearLocation || params.nearCandidateId) && params.radiusKm) {
    if (params.nearCandidateId) query.set('nearCandidateId', params.nearCandidateId);
    else query.set('nearLocation', params.nearLocation ?? '');
    query.set('radiusKm', String(params.radiusKm));
  }
  if (params.experience !== undefined) query.set('experience', String(params.experience));
  if (params.companyId) query.set('companyId', params.companyId);
  if (params.status) query.set('status', params.status);
  if (params.ownerId) query.set('ownerId', params.ownerId);
  if (params.availability) query.set('availability', params.availability);
  if (params.employmentGroup) query.set('employmentGroup', params.employmentGroup);
  if (params.completion) query.set('completion', params.completion);

  return apiClient<OffsetPaginatedResult<JobWithCompany>>(`/jobs?${query.toString()}`);
}

/** The longest distance from the start point to a job — where the distance slider ends. */
export function getJobsDistanceRange(params: Pick<ListJobsParams, 'nearLocation' | 'nearCandidateId' | 'employmentGroup'>) {
  const query = new URLSearchParams();
  if (params.nearCandidateId) query.set('nearCandidateId', params.nearCandidateId);
  else if (params.nearLocation) query.set('nearLocation', params.nearLocation);
  if (params.employmentGroup) query.set('employmentGroup', params.employmentGroup);
  return apiClient<{ maxKm: number | null; unlocated?: number }>(`/jobs/distance-range?${query.toString()}`);
}

export function getJob(id: string) {
  return apiClient<JobWithCompany>(`/jobs/${id}`);
}

export function createJob(input: CreateJobInput) {
  return apiClient<Job>('/jobs', { method: 'POST', body: input });
}

export function updateJob(id: string, input: UpdateJobInput) {
  return apiClient<Job>(`/jobs/${id}`, { method: 'PATCH', body: input });
}

export type JobPublicationAction = 'publish' | 'unpublish' | 'close' | 'archive';

/** Publish / Unpublish / Close / Archive a vacancy (the website reads the CRM live, so this is all it takes). */
export function changeJobPublication(id: string, action: JobPublicationAction) {
  return apiClient<Job>(`/jobs/${id}/${action}`, { method: 'POST' });
}

/** Frees filled places: the `count` people who filled the job last lose their place. `dryRun` only names them. */
export function releaseJobPlaces(id: string, input: { count: number; dryRun?: boolean }) {
  return apiClient<{ released: { id: string; name: string }[] }>(`/jobs/${id}/release-places`, { method: 'POST', body: input });
}

/** Another candidate takes the place of one who works the job: same contract, same card stage, same shift. */
export function replaceJobCandidate(id: string, input: { fromCandidateId: string; toCandidateId: string }) {
  return apiClient<{ replaced: boolean }>(`/jobs/${id}/replace-candidate`, { method: 'POST', body: input });
}

export interface JobCandidateEvent {
  at: string;
  candidate: string;
  event: string;
  by: string | null;
}

/** The history of the people on the job, newest first. */
export function getJobCandidateHistory(id: string) {
  return apiClient<{ items: JobCandidateEvent[] }>(`/jobs/${id}/candidate-history`);
}

export function deleteJob(id: string) {
  return apiClient<void>(`/jobs/${id}`, { method: 'DELETE' });
}
