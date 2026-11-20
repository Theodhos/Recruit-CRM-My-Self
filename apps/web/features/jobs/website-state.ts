import type { Job } from '@crm/types';

export type WebsiteState = 'LIVE' | 'EXPIRED' | 'NOT_LIVE';

/** Is this vacancy on the public website right now? Same rule as the API: Published (OPEN), switched on, not expired. */
export function websiteState(job: Pick<Job, 'status' | 'publishedOnWebsite' | 'expiresAt'>, now = new Date()): WebsiteState {
  if (job.expiresAt && new Date(job.expiresAt) <= now) return job.publishedOnWebsite ? 'EXPIRED' : 'NOT_LIVE';
  return job.status === 'OPEN' && job.publishedOnWebsite ? 'LIVE' : 'NOT_LIVE';
}

export const WEBSITE_STATE_LABEL: Record<WebsiteState, string> = {
  LIVE: 'On website',
  EXPIRED: 'Expired',
  NOT_LIVE: 'Not on website',
};
