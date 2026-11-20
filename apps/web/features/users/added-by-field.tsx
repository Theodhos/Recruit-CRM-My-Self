'use client';

import { QuickField, quickFieldSelectClass, SearchSelect } from '@crm/ui';
import { UserRound } from '@crm/ui/icons';
import type { UseFormRegisterReturn } from 'react-hook-form';

import { useActiveUsers } from '@/hooks/use-users';

/**
 * The "Added by" dropdown of the Add forms (job, company, candidate): which instructor the new record goes to.
 * Left on the first option it is the person adding it; choosing someone else gives the record to them.
 * `registration` is the form's `register('ownerId')`.
 */
/** `required`: nobody is picked for the person — one of the users has to be chosen (error shows the red "Required"). */
export function AddedByField({ registration, required, error }: { registration: UseFormRegisterReturn; required?: boolean; error?: string }) {
  const { data: users } = useActiveUsers();

  return (
    <QuickField icon={UserRound} label={required ? 'Added by *' : 'Added by'} htmlFor="ownerId" error={error}>
      <SearchSelect id="ownerId" className={quickFieldSelectClass} {...registration}>
        <option value="">{required ? 'Choose who adds it' : 'Me (the one adding it)'}</option>
        {(users ?? []).map((user) => (
          <option key={user.id} value={user.id}>
            {user.firstName} {user.lastName}
          </option>
        ))}
      </SearchSelect>
      <p className="mt-1 text-xs text-foreground/50">The instructor this record is given to. They see it as their own and can change it.</p>
    </QuickField>
  );
}
