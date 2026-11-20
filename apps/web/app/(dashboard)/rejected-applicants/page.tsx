'use client';

import { Input } from '@crm/ui';
import { Search, UserX } from '@crm/ui/icons';
import { useState } from 'react';

import { DataTable } from '@/components/tables/data-table';
import { PageBanner } from '@/components/tables/page-banner';
import { StageNotesDialog } from '@/features/pipelines';
import { rejectedApplicantColumns } from '@/features/rejected-applicants';
import { AddedByFilter } from '@/features/users';
import { useAddedBy } from '@/hooks/use-added-by';
import { useApplications } from '@/hooks/use-applications';
import type { ApplicationWithRelations } from '@/services/applications.service';

/**
 * Every Application currently sitting in a Rejected-type stage, on any pipeline — the same cards the pipeline
 * board's Reject column holds (see /pipeline), gathered on one page so they can be scanned or searched without
 * opening each pipeline one by one. A card lands here the moment it reaches Reject and stays until it's either
 * reconsidered (back onto a pipeline) or the whole pipeline moves it elsewhere — Reject never drops a card on its
 * own.
 */
export default function RejectedApplicantsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [ownerId, setOwnerId] = useState('');
  // the card whose Rejected pop-up is open: nobody is on the pipeline again unless Reconsider is pressed in it
  const [opened, setOpened] = useState<ApplicationWithRelations | null>(null);

  const { data, isLoading } = useApplications({
    status: 'REJECTED',
    page,
    pageSize: 25,
    search: search || undefined,
    ownerId: ownerId || undefined,
  });
  const addedBy = useAddedBy();

  return (
    <div className="flex flex-col gap-6">
      <PageBanner
        tone="rose"
        icon={UserX}
        title="Rejected Applicants"
        description="Everyone currently in a Rejected stage, on any pipeline — the same candidates the pipeline board's Reject column holds."
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-72 max-w-md flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <Input
            placeholder="Search name or job…"
            className="pl-8"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <AddedByFilter
          value={ownerId}
          onChange={(next) => {
            setOwnerId(next);
            setPage(1);
          }}
        />
      </div>

      {data ? (
        <div className="rounded-lg border border-border px-4 py-2.5" data-testid="results-bar">
          <p className="text-sm" aria-live="polite">
            <strong>{data.totalItems.toLocaleString('en-GB')}</strong> rejected applicant{data.totalItems === 1 ? '' : 's'} {search || ownerId ? 'match your filters' : 'in total'}.
          </p>
        </div>
      ) : null}

      {data && data.totalItems === 0 && !search && !ownerId ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background px-6 py-24 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
            <UserX className="h-6 w-6 text-foreground/50" />
          </div>
          <h3 className="mt-4 text-sm font-semibold">No rejected applicants</h3>
          <p className="mt-1 max-w-sm text-sm text-foreground/50">Move a candidate to a Rejected stage on any pipeline to have them show up here.</p>
        </div>
      ) : (
        <DataTable
          tone="rose"
          columns={rejectedApplicantColumns({ addedBy, onOpen: setOpened })}
          data={data?.items ?? []}
          isLoading={isLoading}
          page={data?.page ?? page}
          pageSize={data?.pageSize ?? 25}
          totalItems={data?.totalItems ?? 0}
          totalPages={data?.totalPages ?? 1}
          onPageChange={setPage}
        />
      )}
      {opened ? <StageNotesDialog application={opened} onClose={() => setOpened(null)} /> : null}
    </div>
  );
}
