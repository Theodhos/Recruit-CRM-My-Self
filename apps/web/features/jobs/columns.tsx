import { Badge, Button } from '@crm/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { Eye, Pencil, Trash2 } from '@crm/ui/icons';
import Link from 'next/link';

import { selectColumn, type RowSelection } from '@/components/tables/row-selection';
import type { AddedBy } from '@/hooks/use-added-by';
import { employmentTypeColour } from '@/lib/status-colors';
import type { JobWithCompany } from '@/services/jobs.service';

import { jobIsDue } from './due';
import { WEBSITE_STATE_LABEL, websiteState } from './website-state';

function baseJobColumns(options: {
  /** Admin tables: names who added the record (see useAddedBy). Left out, the column is not shown. */
  addedBy?: AddedBy;
  onEdit: (job: JobWithCompany) => void;
  onDelete: (job: JobWithCompany) => void;
}): ColumnDef<JobWithCompany, unknown>[] {
  return [
    {
      id: 'profile',
      header: '',
      // opens the job's own profile page
      cell: ({ row }) => (
        <Link
          href={`/jobs/${row.original.id}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
          title="Open job profile"
          aria-label="Open job profile"
        >
          <Eye className="h-4 w-4" />
        </Link>
      ),
    },
    {
      header: 'Job title',
      accessorKey: 'title',
      // the title opens Pipeline Jobs showing only this job's cards; the job's own page is Preview in the Edit panel
      cell: ({ row }) => (
        <Link
          href={`/pipeline?jobId=${row.original.id}&scheme=${row.original.employmentType === 'PERMANENT' ? 'PERMANENT' : 'TEMPORARY'}${row.original.company ? `&companyId=${row.original.company.id}` : ''}`}
          className="font-medium hover:underline"
          title="Open this job in Pipeline Jobs"
        >
          {row.original.title}
        </Link>
      ),
    },
    {
      header: 'Client',
      accessorKey: 'company',
      cell: ({ row }) =>
        row.original.company ? (
          <Link href={`/companies/${row.original.company.id}`} className="hover:underline">
            {row.original.company.name}
          </Link>
        ) : (
          <span className="text-foreground/40">No company linked</span>
        ),
    },
    { header: 'Location', accessorKey: 'location', cell: ({ row }) => row.original.location ?? '—' },
    {
      header: 'Website',
      id: 'website',
      cell: ({ row }) => {
        const state = websiteState(row.original);
        return (
          <Badge variant={state === 'LIVE' ? 'success' : state === 'EXPIRED' ? 'warning' : 'outline'}>
            {WEBSITE_STATE_LABEL[state]}
          </Badge>
        );
      },
    },
    {
      header: 'Type',
      accessorKey: 'employmentType',
      cell: ({ row }) => (
        <Badge variant={employmentTypeColour(row.original.employmentType)}>{row.original.employmentType.replaceAll('_', ' ')}</Badge>
      ),
    },
    {
      header: 'Candidates needed',
      id: 'candidatesNeeded',
      // places filled: contracts Completed from Active Employees, out of how many the job needs, e.g. 3/5
      cell: ({ row }) => {
        const needed = row.original.candidatesNeeded;
        const filled = row.original._count?.filled ?? 0;
        if (needed === null || needed === undefined) return filled > 0 ? filled : <span className="text-foreground/40">—</span>;
        return (
          <span className={filled >= needed ? 'font-semibold text-emerald-700' : undefined} title={`${filled} of ${needed} places filled`}>
            {filled}/{needed}
          </span>
        );
      },
    },
    {
      header: 'Find candidates by',
      id: 'recruitEndDate',
      cell: ({ row }) =>
        row.original.recruitEndDate ? (
          <span className={jobIsDue(row.original) ? 'font-semibold text-red-700' : undefined}>{new Date(row.original.recruitEndDate).toLocaleDateString()}</span>
        ) : (
          <span className="text-foreground/40">—</span>
        ),
    },
    { header: 'CV Sent', id: 'cvSent', cell: ({ row }) => row.original._count?.applications ?? 0 },
    { header: 'Interview', id: 'interview', cell: ({ row }) => row.original._count?.interviews ?? 0 },
    { header: 'Placement', id: 'placement', cell: ({ row }) => row.original._count?.placements ?? 0 },
    ...(options.addedBy
      ? [
          {
            id: 'addedBy',
            header: 'Added by',
            cell: ({ row }: { row: { original: { ownerId: string | null; coRecruiterIds?: string[] } } }) => options.addedBy!(row.original.ownerId, row.original.coRecruiterIds),
          },
        ]
      : []),
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => options.onEdit(row.original)}
            aria-label="Edit"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => options.onDelete(row.original)}
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];
}

/** The Jobs columns; with `selection` the first column is a tick per row and "Select all" in the header. */
export function jobColumns(options: Parameters<typeof baseJobColumns>[0] & { selection?: RowSelection<JobWithCompany> }): ColumnDef<JobWithCompany, unknown>[] {
  const { selection, ...rest } = options;
  const columns = baseJobColumns(rest);
  return selection ? [selectColumn(selection, 'jobs', (job) => job.title), ...columns] : columns;
}
