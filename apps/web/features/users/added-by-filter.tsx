'use client';

import { Label, SearchSelect } from '@crm/ui';

import { useActiveUsers } from '@/hooks/use-users';

/**
 * Narrows a list to what one user added ("Added by"). Everyone sees all the records, so everyone gets the filter.
 * `value` is the chosen user's id, '' = everyone.
 */
export function AddedByFilter({ value, onChange, className }: { value: string; onChange: (ownerId: string) => void; className?: string }) {
  const { data: users } = useActiveUsers();

  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <Label htmlFor="added-by-filter">Added by</Label>
      <SearchSelect id="added-by-filter" data-testid="added-by-filter" className="w-48" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">All users</option>
        {(users ?? []).map((user) => (
            <option key={user.id} value={user.id}>
              {user.firstName} {user.lastName}
            </option>
          ))}
      </SearchSelect>
    </div>
  );
}
