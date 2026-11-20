'use client';

import { Label, Select } from '@crm/ui';

export type CandidateStatusFilterValue = 'AVAILABLE' | 'ON_HOLD' | 'NOT_AVAILABLE' | 'DO_NOT_USE';

/** The Status filter of the Candidates list: the same four statuses as the Status column (Available, On hold, Not available, Do not use). */
export function CandidateStatusFilter({ value, onChange }: { value: CandidateStatusFilterValue | ''; onChange: (next: CandidateStatusFilterValue | '') => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="candidate-status-filter">Status</Label>
      <Select id="candidate-status-filter" className="w-40" value={value} onChange={(event) => onChange(event.target.value as CandidateStatusFilterValue | '')}>
        <option value="">All</option>
        <option value="AVAILABLE">Available</option>
        <option value="ON_HOLD">On hold</option>
        <option value="NOT_AVAILABLE">Not available</option>
        <option value="DO_NOT_USE">Do not use</option>
      </Select>
    </div>
  );
}
