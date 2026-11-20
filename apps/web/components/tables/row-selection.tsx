'use client';

import { Button } from '@crm/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { useCallback, useMemo, useState, type ReactNode } from 'react';

/** Ticked rows of a list. They stay ticked while moving between pages, and are cleared with "Clear selection". */
export interface RowSelection<T extends { id: string }> {
  selectedIds: Set<string>;
  count: number;
  pageIds: string[];
  toggle: (row: T) => void;
  togglePage: (on: boolean) => void;
  clear: () => void;
}

export function useRowSelection<T extends { id: string }>(items: T[]): RowSelection<T> {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const pageIds = useMemo(() => items.map((item) => item.id), [items]);

  const toggle = useCallback((row: T) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(row.id)) next.delete(row.id);
      else next.add(row.id);
      return next;
    });
  }, []);

  const togglePage = useCallback(
    (on: boolean) => {
      setSelected((current) => {
        const next = new Set(current);
        for (const id of pageIds) {
          if (on) next.add(id);
          else next.delete(id);
        }
        return next;
      });
    },
    [pageIds],
  );

  const clear = useCallback(() => setSelected(new Set()), []);

  return { selectedIds: selected, count: selected.size, pageIds, toggle, togglePage, clear };
}

/** The first column of a list: a tick per row, and "Select all" in the header for the rows on this page. */
export function selectColumn<T extends { id: string }>(selection: RowSelection<T>, noun: string, nameOf: (row: T) => string): ColumnDef<T, unknown> {
  return {
    id: 'select',
    header: () => (
      <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap">
        <input
          type="checkbox"
          className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
          checked={selection.pageIds.length > 0 && selection.pageIds.every((id) => selection.selectedIds.has(id))}
          aria-label={`Select all ${noun} on this page`}
          title={`Select every ${noun.replace(/s$/, '')} on this page`}
          onChange={(event) => selection.togglePage(event.target.checked)}
        />
        <span className="text-xs font-medium">Select all</span>
      </label>
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
        checked={selection.selectedIds.has(row.original.id)}
        aria-label={`Select ${nameOf(row.original)}`}
        onClick={(event) => event.stopPropagation()}
        onChange={() => selection.toggle(row.original)}
      />
    ),
  };
}

/** "3 selected · Clear selection" — shown only while something is selected. */
export function SelectionBar({ count, noun, onClear, children }: { count: number; noun: string; onClear: () => void; children?: ReactNode }) {
  if (count === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-accent/20 px-4 py-3" data-testid="selection-bar">
      <p className="text-sm font-semibold" data-testid="selection-count">
        {count.toLocaleString('en-GB')} {count === 1 ? noun.replace(/s$/, '') : noun} selected
      </p>
      {children}
      <Button type="button" variant="ghost" onClick={onClear}>
        Clear selection
      </Button>
    </div>
  );
}
