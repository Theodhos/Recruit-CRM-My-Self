import { Badge } from '@crm/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { GitBranch } from '@crm/ui/icons';
import Link from 'next/link';

import type { AddedBy } from '@/hooks/use-added-by';
import type { ApplicationWithRelations } from '@/services/applications.service';

/**
 * Everyone currently sitting in a Rejected-type pipeline stage (see /pipeline) — one row per Application, same as
 * the pipeline board's Reject column, gathered here for a quick scan or search across every pipeline at once.
 * Rejected is not a column of the pipeline board: these people live here. Reconsidering one happens from its pop-up
 * (see ReconsiderControl) — "Open in pipeline" below opens it.
 */
export function rejectedApplicantColumns(options: {
  /** Opens the card's pop-up (its Rejected stage, with the Reconsider button) right on this page. */
  onOpen: (application: ApplicationWithRelations) => void;
  /** Admin tables: names who added the record (see useAddedBy). Left out, the column is not shown. */
  addedBy?: AddedBy;
}): ColumnDef<ApplicationWithRelations, unknown>[] {
  return [
    {
      header: 'Candidate',
      accessorKey: 'candidate',
      cell: ({ row }) => (
        <Link href={`/candidates/${row.original.candidate.id}`} className="font-medium hover:underline">
          {row.original.candidate.firstName} {row.original.candidate.lastName}
        </Link>
      ),
    },
    {
      header: 'Job',
      accessorKey: 'job',
      cell: ({ row }) => (
        <Link href={`/jobs/${row.original.job.id}`} className="hover:underline">
          {row.original.job.title}
        </Link>
      ),
    },
    {
      header: 'Company',
      accessorKey: 'company',
      cell: ({ row }) => (
        <Link href={`/companies/${row.original.job.company.id}`} className="hover:underline">
          {row.original.job.company.name}
        </Link>
      ),
    },
    {
      // The mandatory note written in the Reject pop-up (see StageTransitionDialog) — the actual reason, in the
      // recruiter's own words. "Terminated" (from Active Employees) is the one reject that isn't free text.
      header: 'Reason',
      id: 'reason',
      cell: ({ row }) => {
        const application = row.original;
        const record = application.stageNotes?.find((n) => n.pipelineStageId === application.pipelineStageId);
        const isTerminated = record?.fields?.reason === 'Terminated';
        const isNoShow = record?.fields?.reason === 'No Show';
        return (
          <div className="flex max-w-xs flex-col gap-1">
            {isTerminated ? (
              <Badge variant="slate" className="w-fit">
                Terminated
              </Badge>
            ) : null}
            {isNoShow ? (
              <Badge variant="warning" className="w-fit">
                No Show
              </Badge>
            ) : null}
            <span className="truncate text-sm text-foreground/70">{record?.notes?.trim() || '—'}</span>
          </div>
        );
      },
    },
    {
      header: 'Applied on',
      accessorKey: 'appliedAt',
      cell: ({ row }) => new Date(row.original.appliedAt).toLocaleDateString(),
    },
    ...(options.addedBy
      ? [
          {
            id: 'addedBy',
            header: 'Added by',
            cell: ({ row }: { row: { original: { ownerId: string | null } } }) => options.addedBy!(row.original.ownerId),
          },
        ]
      : []),
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end">
          <button type="button" className="inline-flex items-center text-xs font-medium text-primary hover:underline" onClick={() => options.onOpen(row.original)}>
            <GitBranch className="mr-1 h-3.5 w-3.5" /> Open in pipeline
          </button>
        </div>
      ),
    },
  ];
}
