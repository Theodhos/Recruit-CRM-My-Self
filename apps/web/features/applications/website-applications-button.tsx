'use client';

import { Badge, Button, Dialog } from '@crm/ui';
import { ArrowRight, Globe, Inbox, Mail, MapPin, Phone } from '@crm/ui/icons';
import Link from 'next/link';
import { useState } from 'react';

import { useCandidates } from '@/hooks/use-candidates';

const NEW_FOR_MS = 48 * 60 * 60 * 1000;

/** "5 minutes ago", "3 hours ago", "Yesterday", or the date once it is older than a week. */
function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const initials = (first: string, last: string) => `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || '?';

/**
 * The people who applied through the careers website, as a small button instead of a block of the page: "Website applications"
 * with how many are new. It opens a dialog with the list, newest first — each row says who applied, for which vacancy, how to
 * reach them and when, and opens the candidate. (Applicants are only recorded in Candidates; nobody is put on the pipeline by
 * the form.) A recruiter sees the applications for their own vacancies, the admin sees all of them.
 */
export function WebsiteApplicationsButton() {
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError, refetch } = useCandidates({ origin: 'WEBSITE', page: 1, pageSize: 20 });
  const items = data?.items ?? [];
  const now = Date.now();
  const fresh = items.filter((candidate) => now - new Date(candidate.createdAt).getTime() < NEW_FOR_MS).length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
        data-testid="dashboard-website-applications"
        aria-haspopup="dialog"
      >
        <Globe className="h-4 w-4 text-foreground/60" />
        Website applications
        {fresh > 0 ? (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-green-600 px-1.5 text-[11px] font-semibold text-white">{fresh} new</span>
        ) : data ? (
          <span className="text-xs text-foreground/50">{data.totalItems}</span>
        ) : null}
        {fresh > 0 ? <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-green-500 ring-2 ring-background" aria-hidden="true" /> : null}
      </button>

      {open ? (
        <Dialog
          open
          onOpenChange={(next) => !next && setOpen(false)}
          title="New applications from the website"
          description={
            data
              ? data.totalItems === 0
                ? 'Nobody has applied yet. New applications appear here by themselves.'
                : `${fresh > 0 ? `${fresh} new in the last 2 days · ` : ''}${data.totalItems.toLocaleString('en-GB')} in total`
              : 'People who applied through your careers page.'
          }
          className="max-w-2xl"
          footer={
            data && data.totalItems > 0 ? (
              <Link href="/candidates?origin=WEBSITE" onClick={() => setOpen(false)} className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-accent">
                View all in Candidates <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            ) : undefined
          }
        >
          {isLoading ? (
            <ul className="flex flex-col gap-2" aria-busy="true" aria-label="Loading applications">
              {[0, 1, 2].map((i) => (
                <li key={i} className="h-14 animate-pulse rounded-lg bg-accent/50" />
              ))}
            </ul>
          ) : isError ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center" role="alert">
              <p className="text-sm text-destructive">The applications could not be loaded.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
                Try again
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
                <Inbox className="h-5 w-5 text-foreground/50" />
              </span>
              <p className="text-sm font-medium">No website applications yet</p>
              <p className="max-w-sm text-xs text-foreground/55">When someone applies for a vacancy, they appear here with their CV, and you get an email.</p>
            </div>
          ) : (
            <ul className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto pr-1" tabIndex={0} aria-label="Website applications, scrollable">
              {items.map((candidate) => {
                const isNew = now - new Date(candidate.createdAt).getTime() < NEW_FOR_MS;
                const job = candidate.interestedJob;
                return (
                  <li key={candidate.id}>
                    <Link
                      href={`/candidates/${candidate.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-accent/40"
                      data-testid="website-application-row"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{initials(candidate.firstName, candidate.lastName)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold">
                            {candidate.firstName} {candidate.lastName}
                          </span>
                          {isNew ? <Badge variant="success">New</Badge> : null}
                        </span>
                        <span className="block truncate text-xs text-foreground/65">
                          Applied for <span className="font-medium text-foreground/80">{job?.title ?? 'a vacancy'}</span>
                          {job?.company?.name ? ` · ${job.company.name}` : ''}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-foreground/50">
                          {candidate.phone ? (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {candidate.phone}
                            </span>
                          ) : null}
                          {candidate.email ? (
                            <span className="inline-flex items-center gap-1 truncate">
                              <Mail className="h-3 w-3" />
                              {candidate.email}
                            </span>
                          ) : null}
                          {candidate.location ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {candidate.location}
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-xs text-foreground/55">
                        <span className="block font-medium text-foreground/70">{ago(candidate.createdAt)}</span>
                        <span className="block">{candidate.currentApplication?.stage ?? 'Not on a pipeline'}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Dialog>
      ) : null}
    </>
  );
}
