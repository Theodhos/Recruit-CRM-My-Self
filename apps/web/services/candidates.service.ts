import type { Candidate, OffsetPaginatedResult } from '@crm/types';
import type { CreateCandidateInput, UpdateCandidateInput } from '@crm/validation';

import { apiClient, apiDownload, apiUpload } from '@/lib/api-client';

export interface ParsedResumeFields {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  location?: string;
  jobTitle?: string;
  currentCompany?: string;
  trade?: string;
}

export function parseResume(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiUpload<ParsedResumeFields>('/candidates/parse-resume', formData);
}

export interface ListCandidatesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  companyId?: string;
  /** Only the candidates this user added. */
  ownerId?: string;
  availability?: 'AVAILABLE' | 'ON_HOLD' | 'NOT_AVAILABLE' | 'DO_NOT_USE';
  /** WEBSITE = filled in the public application form; MANUAL = added in the CRM (typed or imported). */
  origin?: 'WEBSITE' | 'MANUAL';
  postcode?: string;
  trade?: string;
  /** 'A', 'A,B', ... */
  grade?: string;
  employmentStatus?: 'EMPLOYED' | 'SELF_EMPLOYED' | 'UNEMPLOYED';
  experienceMin?: number;
  /** Words found in the experience notes or job title (every word must match). */
  experience?: string;
  /** Has ALL of these (comma separated). */
  skills?: string;
  qualifications?: string;
  contactedFrom?: string;
  contactedTo?: string;
  /** Never contacted, or not since this date. */
  notContactedSince?: string;
  /** Per-column filters of the Candidates table. */
  name?: string;
  location?: string;
  /** With radiusKm: only the people within that many km of this street / city / post code … */
  nearLocation?: string;
  /** … or of this job's place. */
  nearJobId?: string;
  radiusKm?: number;
  phone?: string;
  jobTitle?: string;
  /** Rank/filter to candidates interested in this specific open Job — puts people competing for the same opening head to head. */
  interestedJobId?: string;
  /** Candidates with no Application yet — the unassigned applicant pool (see /candidates). */
  unassigned?: boolean;
  /** Candidates with at least one Application — the pipeline board's "Applicant" filter (see /pipeline). */
  hasApplications?: boolean;
  /** Where the applicant stands: PENDING (no application yet), ACTIVE (in progress or placed), REJECTED. */
  reviewStatus?: ReviewStatus;
  /** Only the candidates in this recruiting stage (the Stages view of /candidates). */
  recruitmentStage?: RecruitmentStage;
}

export type RecruitmentStage = 'NEW' | 'CV_SENT' | 'INTERVIEW_1' | 'PLACEMENT';

/** REAPPLIED = rejected once, live again on another job; SUGGESTED = rejected, and a similar job is open now. */
export type ReviewStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'REAPPLIED' | 'SUGGESTED';

export interface SuggestedJob {
  id: string;
  title: string;
  location: string | null;
  company: { id: string; name: string } | null;
  /** The job they were turned down for (or wanted) that this opening resembles. */
  matchedOn: string;
}

export type CandidateWithCompany = Candidate & {
  company: { id: string; name: string } | null;
  interestedJob: { id: string; title: string; location: string | null; company: { id: string; name: string } | null } | null;
  /** Computed from what's on file (experience, reachability, job fit) — see CandidatesService. Present on every list response, most meaningful for the unassigned pool, which is ranked by it. */
  potentialScore: number;
  potentialLabel: 'High' | 'Medium' | 'Low';
  /** Derived from their applications — see the API's candidates.service. */
  reviewStatus: ReviewStatus;
  /** The pipeline stage that status comes from: their live (else latest) application. Null while Pending. */
  currentApplication: { applicationId: string; pipelineId: string; jobId: string; jobTitle: string; stage: string; stageType: 'STANDARD' | 'PLACED' | 'REJECTED' } | null;
  /** How this person got into the CRM: the public website form, or added by someone (typed in or imported). */
  addedVia?: 'WEBSITE' | 'MANUAL';
  /** Terminated from Pipeline Jobs: the Status column says Do not use. */
  terminated?: boolean;
  /** What the Status column shows: the status chosen by hand, else the one read off the pipeline. */
  availability?: 'AVAILABLE' | 'ON_HOLD' | 'NOT_AVAILABLE' | 'DO_NOT_USE';
  /** True when that status was chosen by hand. */
  availabilityManual?: boolean;
  /** Only with the SUGGESTED filter: open jobs similar to the one they were rejected for. */
  suggestedJobs?: SuggestedJob[];
  /** With a distance search: how far this person is from the start point, in miles. */
  distanceMiles?: number;
};

export type CandidateDetail = CandidateWithCompany & {
  candidateTags?: { tag: { id: string; name: string; color?: string | null } }[];
};

/** The plain-text filters, in one list so the table, the selection and the export always send the same ones. */
const FILTER_TEXT_FIELDS = ['name', 'location', 'phone', 'jobTitle', 'postcode', 'trade', 'experience', 'grade', 'skills', 'qualifications', 'contactedFrom', 'contactedTo', 'notContactedSince'] as const;

/** The filters of a list as the API's "everyone matching" selection takes them (no paging). */
export function filtersOf(params: ListCandidatesParams): Record<string, string | number | boolean> {
  const filters: Record<string, string | number | boolean> = {};
  for (const key of [...FILTER_TEXT_FIELDS, 'search', 'status', 'companyId', 'ownerId', 'availability', 'origin', 'employmentStatus', 'recruitmentStage', 'interestedJobId', 'reviewStatus', 'nearLocation', 'nearJobId'] as const) {
    const value = params[key as keyof ListCandidatesParams];
    if (value !== undefined && value !== '') filters[key] = value as string;
  }
  if (params.experienceMin !== undefined) filters.experienceMin = params.experienceMin;
  if (params.radiusKm) filters.radiusKm = params.radiusKm;
  if (params.unassigned) filters.unassigned = true;
  if (params.hasApplications) filters.hasApplications = true;
  return filters;
}

export function listCandidates(params: ListCandidatesParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  if (params.companyId) query.set('companyId', params.companyId);
  if (params.ownerId) query.set('ownerId', params.ownerId);
  if (params.availability) query.set('availability', params.availability);
  if (params.origin) query.set('origin', params.origin);
  for (const field of FILTER_TEXT_FIELDS) {
    if (params[field]) query.set(field, params[field]);
  }
  if (params.experienceMin !== undefined) query.set('experienceMin', String(params.experienceMin));
  if (params.nearLocation) query.set('nearLocation', params.nearLocation);
  if (params.nearJobId) query.set('nearJobId', params.nearJobId);
  if (params.radiusKm) query.set('radiusKm', String(params.radiusKm));
  if (params.employmentStatus) query.set('employmentStatus', params.employmentStatus);
  if (params.recruitmentStage) query.set('recruitmentStage', params.recruitmentStage);
  if (params.interestedJobId) query.set('interestedJobId', params.interestedJobId);
  if (params.unassigned) query.set('unassigned', 'true');
  if (params.hasApplications) query.set('hasApplications', 'true');
  if (params.reviewStatus) query.set('reviewStatus', params.reviewStatus);

  return apiClient<OffsetPaginatedResult<CandidateWithCompany>>(`/candidates?${query.toString()}`);
}

/** The longest distance from the start point to a candidate — where the distance slider ends. */
export function getCandidatesDistanceRange(params: Pick<ListCandidatesParams, 'nearLocation' | 'nearJobId'>) {
  const query = new URLSearchParams();
  if (params.nearJobId) query.set('nearJobId', params.nearJobId);
  else if (params.nearLocation) query.set('nearLocation', params.nearLocation);
  return apiClient<{ maxKm: number | null; unlocated?: number }>(`/candidates/distance-range?${query.toString()}`);
}

export function getCandidate(id: string) {
  return apiClient<CandidateDetail>(`/candidates/${id}`);
}

export function createCandidate(input: CreateCandidateInput) {
  // empty boxes are simply left out, so a candidate can be added with as little as nothing filled in
  const body = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== '' && value != null));
  return apiClient<Candidate>('/candidates', { method: 'POST', body });
}

export function updateCandidate(id: string, input: UpdateCandidateInput) {
  // an empty e-mail box is not an e-mail: the server refuses "" (it is left unchanged instead of failing the whole save)
  const body = input.email === '' ? Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'email')) : input;
  return apiClient<Candidate>(`/candidates/${id}`, { method: 'PATCH', body });
}

/** The Stages view: the candidate's own data, the recruiting stage and/or what was written per stage. */
export interface SaveCandidateStageInput {
  recruitmentStage?: RecruitmentStage;
  stageData?: Record<string, Record<string, string>>;
  /** ACTIVE = Available, ARCHIVED = Not available, DO_NOT_CONTACT = Do not use. */
  status?: 'ACTIVE' | 'ARCHIVED' | 'DO_NOT_CONTACT';
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  location?: string;
  postalCode?: string;
  jobTitle?: string;
  currentCompany?: string;
  source?: string;
}

export function saveCandidateStage(id: string, input: SaveCandidateStageInput) {
  return apiClient<Candidate>(`/candidates/${id}`, { method: 'PATCH', body: input });
}

export function deleteCandidate(id: string) {
  return apiClient<void>(`/candidates/${id}`, { method: 'DELETE' });
}

export interface CandidateZoomInput {
  scheduledAt: string;
  durationMinutes: number;
  timezone?: string;
  notes?: string;
  /** E-mail the invitation (date, time, link) at once. */
  sendInvite?: boolean;
}

export interface ZoomInviteDelivery {
  sent: boolean;
  to: string | null;
  error: string | null;
}

/** Interview stage: the Zoom meeting of a candidate, made without a pipeline card. */
export function createCandidateZoom(id: string, input: CandidateZoomInput) {
  return apiClient<{ meetingUrl: string; hostUrl: string; email: ZoomInviteDelivery | null }>(`/candidates/${id}/zoom-meeting`, { method: 'POST', body: input });
}

export function sendCandidateZoomInvite(id: string) {
  return apiClient<ZoomInviteDelivery>(`/candidates/${id}/zoom-invite`, { method: 'POST' });
}

// ---- contact lists (export) -----------------------------------------------------------------------------------------
export type ContactPurpose = 'SMS' | 'EMAIL' | 'CALL';
export type ExportFormat = 'CSV' | 'XLSX' | 'DIALPAD';
export type ExclusionReason = 'DO_NOT_CONTACT' | 'OPTED_OUT' | 'NO_CONSENT' | 'NO_PHONE' | 'NO_EMAIL';

/** Either exactly these people, or everyone matching the filters (minus the ones taken out by hand). */
export type CandidateSelection =
  | { mode: 'IDS'; ids: string[] }
  | { mode: 'FILTER'; filters: Record<string, string | number | boolean>; excludeIds?: string[] };

export interface ExportPreview {
  matching: number;
  included: number;
  excluded: Record<ExclusionReason, number>;
  dialpadParts: number;
}

export const EXPORT_FIELD_OPTIONS = [
  { key: 'firstName', label: 'First name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'mobile', label: 'Mobile number' },
  { key: 'email', label: 'Email' },
  { key: 'location', label: 'Location' },
  { key: 'postalCode', label: 'Postcode' },
  { key: 'jobTitle', label: 'Job title' },
  { key: 'trade', label: 'Trade' },
  { key: 'currentCompany', label: 'Current employer' },
  { key: 'grade', label: 'Grade' },
  { key: 'employmentStatus', label: 'Employment status' },
  { key: 'experienceYears', label: 'Years of experience' },
  { key: 'skills', label: 'Skills' },
  { key: 'qualifications', label: 'Qualifications' },
  { key: 'lastContactedAt', label: 'Last contacted' },
  { key: 'status', label: 'Status' },
  { key: 'source', label: 'Source' },
  { key: 'addedOn', label: 'Added on' },
  { key: 'smsConsent', label: 'SMS consent' },
  { key: 'emailConsent', label: 'Email consent' },
] as const;

export function previewExport(purpose: ContactPurpose, selection: CandidateSelection) {
  return apiClient<ExportPreview>('/candidates/export/preview', { method: 'POST', body: { purpose, selection } });
}

export function exportCandidates(input: { purpose: ContactPurpose; format: ExportFormat; fields: string[]; selection: CandidateSelection; part?: number }) {
  return apiDownload('/candidates/export', input);
}

export function setCandidateConsent(input: { selection: CandidateSelection; channels: ContactPurpose[]; status: 'GRANTED' | 'OPTED_OUT' | 'UNKNOWN'; evidence?: string }) {
  return apiClient<{ updated: number }>('/candidates/consent', { method: 'POST', body: input });
}
