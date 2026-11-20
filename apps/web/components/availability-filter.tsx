'use client';

import { Label, Select } from '@crm/ui';

export type Availability = 'AVAILABLE' | 'NOT_AVAILABLE' | 'DO_NOT_USE';

/** All / Available / Not available / Do not use — shared by the Candidates, Companies and Jobs lists. */
export function AvailabilityFilter({ value, onChange }: { value: Availability | ''; onChange: (next: Availability | '') => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="availability">Availability</Label>
      <Select id="availability" className="w-40" value={value} onChange={(event) => onChange(event.target.value as Availability | '')}>
        <option value="">All</option>
        <option value="AVAILABLE">Available</option>
        <option value="NOT_AVAILABLE">Not available</option>
        <option value="DO_NOT_USE">Do not use</option>
      </Select>
    </div>
  );
}
