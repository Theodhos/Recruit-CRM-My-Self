import { PageSkeleton } from '@/components/layout/page-skeleton';

/** Shown at once while the next page of the CRM is on its way (Next.js uses it for every page under the dashboard). */
export default function Loading() {
  return <PageSkeleton />;
}
