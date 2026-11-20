import type { ColumnDef } from '@tanstack/react-table';
import { MapPin } from '@crm/ui/icons';

/** "Distance" column of a list that is being searched by distance: how far each result is from the start point, nearest first. */
export function distanceColumn<T extends { distanceMiles?: number }>(): ColumnDef<T, unknown> {
  return {
    id: 'distance',
    header: 'Distance',
    cell: ({ row }) => {
      const miles = row.original.distanceMiles;
      if (miles == null || !Number.isFinite(miles)) return '—';
      return (
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-xs font-medium tabular-nums">
          <MapPin className="h-3 w-3 text-foreground/50" /> {miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi
        </span>
      );
    },
  };
}
