import type { Placement } from '@crm/types';
import { Badge, Button } from '@crm/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Trash2, UserPlus, Users } from '@crm/ui/icons';
import Link from 'next/link';

import type { AddedBy } from '@/hooks/use-added-by';
import { PLACEMENT_STATUS_COLOUR, employmentTypeColour } from '@/lib/status-colors';
import type { PlacementWithRelations } from '@/services/placements.service';

const STATUS_VARIANT = PLACEMENT_STATUS_COLOUR;

// CANCELLED is how the employment ended, but "Terminated" is what every button and filter calls it
const STATUS_LABEL: Record<Placement['status'], string> = {
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  CANCELLED: 'Terminated',
};

export function placementColumns(options: {
  /** Admin tables: names who added the record (see useAddedBy). Left out, the column is not shown. */
  addedBy?: AddedBy;
  /** Clicking the person's name opens their documents instead of their candidate page. */
  onOpen?: (placement: PlacementWithRelations) => void;
  onEdit: (placement: PlacementWithRelations) => void;
  onDelete: (placement: PlacementWithRelations) => void;
  /** Administrators: the Resourcers column and the button that opens the allocation (temporary placements only). */
  onAllocate?: (placement: PlacementWithRelations) => void;
  /** Active Employees is always ACTIVE — showing it on every row says nothing, so it's left out there. */
  showStatus?: boolean;
  /** Left out when the table itself is already split by employment type (one table of Permanent, one of Temporary) — repeating it on every row would say nothing. */
  showType?: boolean;
}): ColumnDef<PlacementWithRelations, unknown>[] {
  return [
    {
      header: 'Candidate',
      accessorKey: 'candidate',
      cell: ({ row }) =>
        options.onOpen ? (
          <button type="button" className="font-medium hover:underline" onClick={() => options.onOpen?.(row.original)}>
            {row.original.candidate.firstName} {row.original.candidate.lastName}
          </button>
        ) : (
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
        <Link href={`/companies/${row.original.company.id}`} className="hover:underline">
          {row.original.company.name}
        </Link>
      ),
    },
    {
      header: 'Start date',
      accessorKey: 'startDate',
      cell: ({ row }) => new Date(row.original.startDate).toLocaleDateString(),
    },
    ...(options.showType === false
      ? []
      : [
          {
            header: 'Type',
            accessorKey: 'employmentType',
            cell: ({ row }: { row: { original: PlacementWithRelations } }) => (
              <Badge variant={employmentTypeColour(row.original.employmentType)}>
                {row.original.employmentType === 'TEMPORARY' ? 'Temporary' : 'Permanent'}
              </Badge>
            ),
          },
        ]),
    ...(options.showStatus === false
      ? []
      : [
          {
            header: 'Status',
            accessorKey: 'status',
            cell: ({ row }: { row: { original: PlacementWithRelations } }) => (
              <Badge variant={STATUS_VARIANT[row.original.status]}>{STATUS_LABEL[row.original.status]}</Badge>
            ),
          },
        ]),
    ...(options.onAllocate
      ? [
          {
            id: 'resourcers',
            header: 'Resourcers',
            cell: ({ row }: { row: { original: PlacementWithRelations } }) => {
              const p = row.original;
              const list = p.resourcers ?? [];
              return (
                <button type="button" className="flex flex-col items-start gap-0.5 rounded text-left text-sm hover:underline" onClick={() => options.onAllocate?.(p)} data-testid="allocate-resourcers" title="Choose who is responsible for this placement">
                  {list.length === 0 ? (
                    <span className="inline-flex items-center gap-1 text-primary">
                      <UserPlus className="h-3.5 w-3.5" /> Choose resourcer
                    </span>
                  ) : (
                    list.map((r) => (
                      <span key={r.userId} className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3 text-foreground/40" />
                        {r.user.firstName} {r.user.lastName}
                        {list.length > 1 ? <span className="text-xs text-foreground/55">{Number(r.splitPercent)}%</span> : null}
                      </span>
                    ))
                  )}
                </button>
              );
            },
          },
        ]
      : []),
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
