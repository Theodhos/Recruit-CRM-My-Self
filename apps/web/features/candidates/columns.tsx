import { Badge, Button } from '@crm/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { GitBranch, Pencil, Trash2 } from '@crm/ui/icons';
import Link from 'next/link';

import type { AddedBy } from '@/hooks/use-added-by';
import { CANDIDATE_STATUS_COLOUR, POTENTIAL_COLOUR, REVIEW_STATUS_COLOUR } from '@/lib/status-colors';
import type { CandidateWithCompany, SuggestedJob } from '@/services/candidates.service';

import { whatsappLink } from '@/features/communications/whatsapp';

import { normalizeSource } from './sources';
import { splitTrades } from './trades-input';

const STATUS_VARIANT = CANDIDATE_STATUS_COLOUR;

// The table shows the three real states; REAPPLIED / SUGGESTED are filters whose rows are Active / Rejected people.
const REVIEW_VARIANT = REVIEW_STATUS_COLOUR;
const REVIEW_LABEL: Record<CandidateWithCompany['reviewStatus'], string> = {
  PENDING: 'Pending',
  ACTIVE: 'Active',
  REJECTED: 'Rejected',
  REAPPLIED: 'Active',
  SUGGESTED: 'Rejected',
};

const POTENTIAL_VARIANT = POTENTIAL_COLOUR;

export type StatusChoice = 'AVAILABLE' | 'ON_HOLD' | 'NOT_AVAILABLE' | 'DO_NOT_USE';
const STATUS_CHOICES: { value: StatusChoice; label: string; className: string }[] = [
  { value: 'AVAILABLE', label: 'Available', className: 'border-green-300 bg-green-50 text-green-800' },
  { value: 'ON_HOLD', label: 'On hold', className: 'border-blue-300 bg-blue-50 text-blue-800' },
  { value: 'NOT_AVAILABLE', label: 'Not available', className: 'border-slate-300 bg-slate-100 text-slate-700' },
  { value: 'DO_NOT_USE', label: 'Do not use', className: 'border-red-300 bg-red-50 text-red-800' },
];

export function candidateColumns(options: {
  onEdit: (candidate: CandidateWithCompany) => void;
  onDelete: (candidate: CandidateWithCompany) => void;
}): ColumnDef<CandidateWithCompany, unknown>[] {
  return [
    {
      header: 'Name',
      accessorKey: 'firstName',
      cell: ({ row }) => (
        <Link href={`/candidates/${row.original.id}`} className="font-medium hover:underline">
          {`${row.original.firstName} ${row.original.lastName}`.trim() || "Unnamed candidate"}
        </Link>
      ),
    },
    { header: 'Job Title', accessorKey: 'jobTitle', cell: ({ row }) => row.original.jobTitle ?? '—' },
    {
      header: 'Company',
      accessorKey: 'currentCompany',
      cell: ({ row }) =>
        row.original.company ? (
          <Link href={`/companies/${row.original.company.id}`} className="hover:underline">
            {row.original.company.name}
          </Link>
        ) : (
          (row.original.currentCompany ?? '—')
        ),
    },
    { header: 'Email', accessorKey: 'email', cell: ({ row }) => row.original.email ?? '—' },
    { header: 'Location', accessorKey: 'location', cell: ({ row }) => row.original.location ?? '—' },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => (
        <Badge variant={STATUS_VARIANT[row.original.status]}>
          {row.original.status.replaceAll('_', ' ')}
        </Badge>
      ),
    },
    {
      header: 'Added',
      accessorKey: 'createdAt',
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    },
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

/**
 * The Candidates directory — everyone who applied (website form or added by hand). New arrivals go straight onto
 * the pipeline of the job they want, so there is no "add to pipeline" action here: the Status column reads their
 * pipeline stage, and the row links to that pipeline.
 */
export function unassignedCandidateColumns(options: {
  /** Shows an Edit (pencil) button on each row: every detail of the row can be filled in or changed. */
  onEdit?: (candidate: CandidateWithCompany) => void;
  /** With the "Suggested for open jobs" filter: show the openings and let one click put the person on that pipeline. */
  suggestions?: { onApply: (candidate: CandidateWithCompany, job: SuggestedJob) => void; pendingKey: string | null };
  /** Admin tables: names who added the record (see useAddedBy). Left out, the column is not shown. */
  /** Shows a Delete button on each row. */
  onDelete?: (candidate: CandidateWithCompany) => void;
  addedBy?: AddedBy;
  /**
   * The "Add to pipeline" button of a row: puts that one candidate on Pipeline Jobs at Job Applicants, for a job to be
   * chosen (nobody goes there automatically). It stays usable for a candidate who is already there: the same person
   * can be put on the pipeline of as many different jobs as wanted, just not twice on the same one.
   */
  onPutOnPipeline?: (candidate: CandidateWithCompany) => void;
  /**
   * Makes the Status cell a drop-down: the status can be changed by hand (null = back to the automatic one, read off the
   * pipeline). A status chosen by hand carries its logic everywhere — contact lists, exports, filters.
   */
  onStatusChange?: (candidate: CandidateWithCompany, status: StatusChoice | null) => void;
  /** The candidate whose card is being created right now. */
  puttingOnPipelineId?: string | null;
  /**
   * The checkbox before the name only selects (nothing is added by a click); the one in the header ticks the whole
   * page. The ticked candidates are then given a job together — the same for all, or one each.
   */
  selection?: {
    selectedIds: Set<string>;
    onToggle: (candidate: CandidateWithCompany) => void;
    onTogglePage: (on: boolean) => void;
    pageIds: string[];
  };
} = {}): ColumnDef<CandidateWithCompany, unknown>[] {
  const selection = options.selection;
  const selectColumn: ColumnDef<CandidateWithCompany, unknown>[] = selection
    ? [
        {
          id: "select",
          header: () => (
            <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap">
              <input
                type="checkbox"
                className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
                checked={selection.pageIds.length > 0 && selection.pageIds.every((id) => selection.selectedIds.has(id))}
                aria-label="Select all on this page"
                title="Select everyone on this page"
                onChange={(event) => selection.onTogglePage(event.target.checked)}
              />
              <span className="text-xs font-medium">Select all</span>
            </label>
          ),
          cell: ({ row }) => (
            <input
              type="checkbox"
              className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
              checked={selection.selectedIds.has(row.original.id)}
              aria-label={`Tick ${row.original.firstName} ${row.original.lastName}`}
              onClick={(event) => event.stopPropagation()}
              onChange={() => selection.onToggle(row.original)}
            />
          ),
        },
      ]
    : [];
  const pipelineColumn: ColumnDef<CandidateWithCompany, unknown> = {
    id: 'pipeline',
    header: 'Status',
    // The four statuses, each by its own rule (and colour):
    //   Do not use    red    — terminated from Pipeline Jobs
    //   Not available grey   — an Active Employee on a job right now
    //   On hold       blue   — at the Interview stage of Pipeline Jobs
    //   Available     green  — everyone else: not on Pipeline Jobs, or at a stage that gives none of the above
    cell: ({ row }) => {
      const choose = options.onStatusChange;
      if (choose && row.original.availability) {
        const shown = row.original.availability;
        const style = STATUS_CHOICES.find((choice) => choice.value === shown)?.className ?? '';
        return (
          <select
            aria-label="Status"
            title={row.original.availabilityManual ? 'Set by hand — choose “Back to automatic” to read it off the pipeline again' : 'Read off the pipeline — choose a status to set it by hand'}
            className={`h-7 cursor-pointer rounded-full border px-2 text-xs font-semibold ${style}`}
            value={shown}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => choose(row.original, event.target.value === 'AUTO' ? null : (event.target.value as StatusChoice))}
          >
            {STATUS_CHOICES.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
                {choice.value === shown && row.original.availabilityManual ? ' (manual)' : ''}
              </option>
            ))}
            {row.original.availabilityManual ? <option value="AUTO">↺ Back to automatic</option> : null}
          </select>
        );
      }
      const current = row.original.currentApplication;
      if (row.original.terminated) return <Badge variant="destructive">Do not use</Badge>;
      if (current?.stageType === "PLACED") {
        return (
          <Badge variant="slate" title={current.jobTitle ?? undefined}>
            Not available
          </Badge>
        );
      }
      if (current && /interview/i.test(current.stage)) {
        return (
          <Badge variant="default" title={current.jobTitle ?? undefined}>
            On hold
          </Badge>
        );
      }
      // everyone else — not on Pipeline Jobs, or at a stage that gives none of the other three
      return (
        <Badge variant="green" title={current ? `On the pipeline · ${current.stage}` : undefined}>
          Available
        </Badge>
      );
    },
  };
  const suggestionColumn: ColumnDef<CandidateWithCompany, unknown>[] = options.suggestions
    ? [
        {
          id: 'suggestions',
          header: 'Suggested openings',
          cell: ({ row }) => (
            <ul className="flex flex-col gap-1.5">
              {(row.original.suggestedJobs ?? []).map((job) => {
                const key = `${row.original.id}:${job.id}`;
                return (
                  <li key={job.id} className="flex flex-wrap items-center gap-2 text-xs">
                    <span>
                      <Link href={`/jobs/${job.id}`} className="font-medium hover:underline">
                        {job.title}
                      </Link>
                      {job.company ? <span className="text-foreground/50"> · {job.company.name}</span> : null}
                      <span className="block text-foreground/40">similar to “{job.matchedOn}”</span>
                    </span>
                    <Button type="button" size="sm" variant="outline" disabled={options.suggestions!.pendingKey === key} onClick={() => options.suggestions!.onApply(row.original, job)}>
                      <GitBranch className="mr-1 h-3 w-3" /> {options.suggestions!.pendingKey === key ? 'Adding…' : 'Put on pipeline'}
                    </Button>
                  </li>
                );
              })}
            </ul>
          ),
        },
      ]
    : [];
  return [
    ...selectColumn,
    {
      header: 'Name',
      accessorKey: 'firstName',
      cell: ({ row }) => (
        <Link href={`/candidates/${row.original.id}`} className="font-medium hover:underline">
          {`${row.original.firstName} ${row.original.lastName}`.trim() || "Unnamed candidate"}
        </Link>
      ),
    },
    {
      header: 'Phone',
      accessorKey: 'phone',
      cell: ({ row }) =>
        row.original.phone ? (
          // opens a WhatsApp chat to write (not a tel: link: that offers a voice call)
          <a href={whatsappLink(row.original.phone) ?? undefined} target="_blank" rel="noopener noreferrer" title="Write on WhatsApp" className="hover:underline" onClick={(event) => event.stopPropagation()}>
            {row.original.phone}
          </a>
        ) : (
          '—'
        ),
    },
    {
      // one column: the address, then the post code
      header: 'Location',
      accessorKey: 'location',
      cell: ({ row }) => [row.original.location, row.original.postalCode].filter(Boolean).join(', ') || '—',
    },
    { header: 'Job Title', accessorKey: 'jobTitle', cell: ({ row }) => row.original.jobTitle ?? '—' },
    {
      // the trades of the person: the main one first, then the other jobs they can do
      header: 'Trades',
      accessorKey: 'trade',
      cell: ({ row }) => {
        const trades = splitTrades(row.original.trade);
        if (trades.length === 0) return '—';
        return (
          <div className="flex flex-nowrap items-center gap-1 whitespace-nowrap" title={trades.join(', ')}>
            {trades.slice(0, 2).map((trade, index) => (
              <span key={trade} className={`max-w-[120px] truncate rounded-full px-2 py-0.5 text-xs font-medium ${index === 0 ? 'bg-primary/10 text-primary' : 'bg-accent'}`}>
                {trade}
              </span>
            ))}
            {trades.length > 2 ? <span className="rounded-full bg-accent px-1.5 py-0.5 text-xs font-medium text-foreground/60">+{trades.length - 2}</span> : null}
          </div>
        );
      },
    },
    {
      // Where the candidate came from: CV-Library, LinkedIn, Indeed, WhatsApp, Website, Referral, Adzuna
      header: 'Source',
      accessorKey: 'source',
      cell: ({ row }) => (normalizeSource(row.original.source) ? <Badge variant="outline">{normalizeSource(row.original.source)}</Badge> : '—'),
    },
    {
      // Told apart at a glance: the public website form, or added by someone in the CRM
      header: 'Added',
      id: 'addedVia',
      cell: ({ row }) =>
        row.original.addedVia === 'WEBSITE' ? (
          <Badge variant="sky" data-testid="added-via-website">Website</Badge>
        ) : (
          <Badge variant="outline" data-testid="added-via-manual">Manual</Badge>
        ),
    },
    pipelineColumn,
    ...suggestionColumn,
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
      cell: ({ row }) => {
        if (!options.onDelete && !options.onPutOnPipeline && !options.onEdit) return null;
        return (
          <div className="flex items-center justify-end gap-2">
            {options.onEdit ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Edit candidate"
                title="Edit candidate"
                onClick={(event) => {
                  event.stopPropagation();
                  options.onEdit!(row.original);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            ) : null}
            {options.onPutOnPipeline ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={options.puttingOnPipelineId === row.original.id}
                onClick={(event) => {
                  event.stopPropagation();
                  options.onPutOnPipeline!(row.original);
                }}
              >
                <GitBranch className="mr-1 h-3.5 w-3.5" /> Add to pipeline
              </Button>
            ) : null}
            {options.onDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Delete candidate"
                onClick={(event) => {
                  event.stopPropagation();
                  options.onDelete!(row.original);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];
}
