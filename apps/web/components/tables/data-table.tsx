'use client';

import { Button } from '@crm/ui';
import { useEffect, useRef, useState } from 'react';

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';

/**
 * One table design for every page, with one accent each. Everything is neutral (white, the light grey of the CRM, its navy)
 * and the page's own colour appears only in small places: the thin line on top of the table and the small marks. Pages and
 * their accent: Companies indigo, Jobs sky, Candidates teal, Active Jobs Temporary orange, Completed Jobs emerald,
 * Active Employees violet, Rejected Applicants rose, Notifications amber, My Profile cyan, Settings slate; Pipeline Jobs blue,
 * Pipeline Companies fuchsia, Fees lime, Retainers yellow, Timesheets purple, Weekly payroll pink, Payslips stone, Commission red.
 */
export const TABLE_TONES = {
  indigo: {
    box: 'rounded-xl border-border border-t-2 border-t-indigo-500 shadow-sm',
    head: 'border-b border-border bg-accent/40 font-semibold text-foreground/70',
    row: 'border-border hover:bg-accent/40',
    foot: 'text-foreground/60',
    bar: 'bg-indigo-500',
    badge: 'bg-indigo-600 text-white',
    soft: 'bg-indigo-50 text-indigo-700',
  },
  sky: {
    box: 'rounded-xl border-border border-t-2 border-t-sky-500 shadow-sm',
    head: 'border-b border-border bg-accent/40 font-semibold text-foreground/70',
    row: 'border-border hover:bg-accent/40',
    foot: 'text-foreground/60',
    bar: 'bg-sky-500',
    badge: 'bg-sky-600 text-white',
    soft: 'bg-sky-50 text-sky-700',
  },
  teal: {
    box: 'rounded-xl border-border border-t-2 border-t-teal-500 shadow-sm',
    head: 'border-b border-border bg-accent/40 font-semibold text-foreground/70',
    row: 'border-border hover:bg-accent/40',
    foot: 'text-foreground/60',
    bar: 'bg-teal-500',
    badge: 'bg-teal-600 text-white',
    soft: 'bg-teal-50 text-teal-700',
  },
  orange: {
    box: 'rounded-xl border-border border-t-2 border-t-orange-500 shadow-sm',
    head: 'border-b border-border bg-accent/40 font-semibold text-foreground/70',
    row: 'border-border hover:bg-accent/40',
    foot: 'text-foreground/60',
    bar: 'bg-orange-500',
    badge: 'bg-orange-600 text-white',
    soft: 'bg-orange-50 text-orange-700',
  },
  emerald: {
    box: 'rounded-xl border-border border-t-2 border-t-emerald-500 shadow-sm',
    head: 'border-b border-border bg-accent/40 font-semibold text-foreground/70',
    row: 'border-border hover:bg-accent/40',
    foot: 'text-foreground/60',
    bar: 'bg-emerald-500',
    badge: 'bg-emerald-600 text-white',
    soft: 'bg-emerald-50 text-emerald-700',
  },
  violet: {
    box: 'rounded-xl border-border border-t-2 border-t-violet-500 shadow-sm',
    head: 'border-b border-border bg-accent/40 font-semibold text-foreground/70',
    row: 'border-border hover:bg-accent/40',
    foot: 'text-foreground/60',
    bar: 'bg-violet-500',
    badge: 'bg-violet-600 text-white',
    soft: 'bg-violet-50 text-violet-700',
  },
  rose: {
    box: 'rounded-xl border-border border-t-2 border-t-rose-500 shadow-sm',
    head: 'border-b border-border bg-accent/40 font-semibold text-foreground/70',
    row: 'border-border hover:bg-accent/40',
    foot: 'text-foreground/60',
    bar: 'bg-rose-500',
    badge: 'bg-rose-600 text-white',
    soft: 'bg-rose-50 text-rose-700',
  },
  amber: {
    box: 'rounded-xl border-border border-t-2 border-t-amber-500 shadow-sm',
    head: 'border-b border-border bg-accent/40 font-semibold text-foreground/70',
    row: 'border-border hover:bg-accent/40',
    foot: 'text-foreground/60',
    bar: 'bg-amber-500',
    badge: 'bg-amber-600 text-white',
    soft: 'bg-amber-50 text-amber-700',
  },
  cyan: {
    box: 'rounded-xl border-border border-t-2 border-t-cyan-500 shadow-sm',
    head: 'border-b border-border bg-accent/40 font-semibold text-foreground/70',
    row: 'border-border hover:bg-accent/40',
    foot: 'text-foreground/60',
    bar: 'bg-cyan-500',
    badge: 'bg-cyan-600 text-white',
    soft: 'bg-cyan-50 text-cyan-700',
  },
  slate: {
    box: 'rounded-xl border-border border-t-2 border-t-slate-500 shadow-sm',
    head: 'border-b border-border bg-accent/40 font-semibold text-foreground/70',
    row: 'border-border hover:bg-accent/40',
    foot: 'text-foreground/60',
    bar: 'bg-slate-500',
    badge: 'bg-slate-600 text-white',
    soft: 'bg-slate-50 text-slate-700',
  },
  blue: {
    box: 'rounded-xl border-border border-t-2 border-t-blue-500 shadow-sm',
    head: 'border-b border-border bg-accent/40 font-semibold text-foreground/70',
    row: 'border-border hover:bg-accent/40',
    foot: 'text-foreground/60',
    bar: 'bg-blue-500',
    badge: 'bg-blue-600 text-white',
    soft: 'bg-blue-50 text-blue-700',
  },
  fuchsia: {
    box: 'rounded-xl border-border border-t-2 border-t-fuchsia-500 shadow-sm',
    head: 'border-b border-border bg-accent/40 font-semibold text-foreground/70',
    row: 'border-border hover:bg-accent/40',
    foot: 'text-foreground/60',
    bar: 'bg-fuchsia-500',
    badge: 'bg-fuchsia-600 text-white',
    soft: 'bg-fuchsia-50 text-fuchsia-700',
  },
  lime: {
    box: 'rounded-xl border-border border-t-2 border-t-lime-500 shadow-sm',
    head: 'border-b border-border bg-accent/40 font-semibold text-foreground/70',
    row: 'border-border hover:bg-accent/40',
    foot: 'text-foreground/60',
    bar: 'bg-lime-500',
    badge: 'bg-lime-600 text-white',
    soft: 'bg-lime-50 text-lime-700',
  },
  yellow: {
    box: 'rounded-xl border-border border-t-2 border-t-yellow-500 shadow-sm',
    head: 'border-b border-border bg-accent/40 font-semibold text-foreground/70',
    row: 'border-border hover:bg-accent/40',
    foot: 'text-foreground/60',
    bar: 'bg-yellow-500',
    badge: 'bg-yellow-600 text-white',
    soft: 'bg-yellow-50 text-yellow-700',
  },
  purple: {
    box: 'rounded-xl border-border border-t-2 border-t-purple-500 shadow-sm',
    head: 'border-b border-border bg-accent/40 font-semibold text-foreground/70',
    row: 'border-border hover:bg-accent/40',
    foot: 'text-foreground/60',
    bar: 'bg-purple-500',
    badge: 'bg-purple-600 text-white',
    soft: 'bg-purple-50 text-purple-700',
  },
  pink: {
    box: 'rounded-xl border-border border-t-2 border-t-pink-500 shadow-sm',
    head: 'border-b border-border bg-accent/40 font-semibold text-foreground/70',
    row: 'border-border hover:bg-accent/40',
    foot: 'text-foreground/60',
    bar: 'bg-pink-500',
    badge: 'bg-pink-600 text-white',
    soft: 'bg-pink-50 text-pink-700',
  },
  stone: {
    box: 'rounded-xl border-border border-t-2 border-t-stone-500 shadow-sm',
    head: 'border-b border-border bg-accent/40 font-semibold text-foreground/70',
    row: 'border-border hover:bg-accent/40',
    foot: 'text-foreground/60',
    bar: 'bg-stone-500',
    badge: 'bg-stone-600 text-white',
    soft: 'bg-stone-50 text-stone-700',
  },
  red: {
    box: 'rounded-xl border-border border-t-2 border-t-red-500 shadow-sm',
    head: 'border-b border-border bg-accent/40 font-semibold text-foreground/70',
    row: 'border-border hover:bg-accent/40',
    foot: 'text-foreground/60',
    bar: 'bg-red-500',
    badge: 'bg-red-600 text-white',
    soft: 'bg-red-50 text-red-700',
  },
  green: {
    box: 'rounded-xl border-border border-t-2 border-t-green-500 shadow-sm',
    head: 'border-b border-border bg-accent/40 font-semibold text-foreground/70',
    row: 'border-border hover:bg-accent/40',
    foot: 'text-foreground/60',
    bar: 'bg-green-500',
    badge: 'bg-green-600 text-white',
    soft: 'bg-green-50 text-green-700',
  },
} as const;
export type TableTone = keyof typeof TABLE_TONES;

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  isLoading?: boolean;
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  emptyMessage?: string;
  /** Makes the whole row a click target (clicks on links, buttons and form controls inside the row keep their own behaviour). */
  onRowClick?: (row: TData) => void;
  /** Extra classes for a row (e.g. a coloured background). */
  rowClassName?: (row: TData) => string | undefined;
  /** The page's own colour for the table (see TABLE_TONES). Left out, the plain design. */
  tone?: TableTone;
  /** Called when the mouse (or the keyboard) reaches a row: gets what the row opens ready, so the click is instant. */
  onRowHover?: (row: TData) => void;
}

/**
 * Server-paginated table shared by every entity list page (Candidates,
 * Companies, Jobs). Sorting/filtering happen server-side via each
 * page's search/status query params — this component only renders the
 * current page and drives page navigation, it never re-derives pagination
 * from client-held data (see spec §39: all lists must be server-paginated).
 */
export function DataTable<TData>({
  columns,
  data,
  isLoading,
  page,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
  emptyMessage = 'No records found.',
  onRowClick,
  rowClassName,
  tone,
  onRowHover,
}: DataTableProps<TData>) {
  const look = tone ? TABLE_TONES[tone] : null;
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // Pressing on any row and pulling sideways scrolls the table, like the scroll bar does — on every row, not only on the bar.
  // A click on a link, button or field still works; a drag never counts as a click on the row.
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; startLeft: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const move = (event: MouseEvent) => {
      const state = drag.current;
      const box = scroller.current;
      if (!state || !box) return;
      const delta = event.clientX - state.startX;
      if (!state.moved && Math.abs(delta) < 5) return;
      if (!state.moved) {
        state.moved = true;
        window.getSelection()?.removeAllRanges();
        setDragging(true);
      }
      box.scrollLeft = state.startLeft - delta;
    };
    const up = () => {
      if (drag.current?.moved) justDragged.current = true;
      drag.current = null;
      setDragging(false);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, []);

  const rangeStart = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={scroller}
        className={`overflow-x-auto border bg-background ${look ? look.box : 'rounded-lg border-border'}${dragging ? ' cursor-grabbing select-none' : ''}`}
        data-testid="table-scroll"
        onMouseDown={(event) => {
          const box = scroller.current;
          if (event.button !== 0 || !box || box.scrollWidth <= box.clientWidth) return;
          if ((event.target as HTMLElement).closest('a,button,input,select,textarea,label')) return;
          justDragged.current = false;
          drag.current = { startX: event.clientX, startLeft: box.scrollLeft, moved: false };
        }}
        // the click that ends a drag is not a click on the row
        onClickCapture={(event) => {
          if (justDragged.current) {
            justDragged.current = false;
            event.stopPropagation();
            event.preventDefault();
          }
        }}
      >
        <table className="w-full text-sm">
          <thead className={`text-left text-xs uppercase tracking-wide ${look ? look.head : 'border-b border-border bg-accent/40 font-medium text-foreground/60'}`}>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="whitespace-nowrap px-4 py-2.5">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-foreground/50">
                  Loading…
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-foreground/50">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b last:border-0 ${look ? look.row : 'border-border hover:bg-accent/30'}${onRowClick ? ' cursor-pointer' : ''}${rowClassName?.(row.original) ? ` ${rowClassName(row.original)}` : ''}`}
                  onMouseEnter={onRowHover ? () => onRowHover(row.original) : undefined}
                  onFocus={onRowHover ? () => onRowHover(row.original) : undefined}
                  onClick={
                    onRowClick
                      ? (event) => {
                          if ((event.target as HTMLElement).closest('a,button,input,select,textarea,label')) return;
                          onRowClick(row.original);
                        }
                      : undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="whitespace-nowrap px-4 py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={`flex items-center justify-between text-sm ${look ? look.foot : 'text-foreground/60'}`}>
        <span>
          {totalItems === 0 ? 'No results' : `Showing ${rangeStart}–${rangeEnd} of ${totalItems}`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span>
            Page {page} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
