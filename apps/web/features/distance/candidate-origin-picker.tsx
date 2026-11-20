'use client';

import { SearchSelect } from '@crm/ui';
import { useQuery } from '@tanstack/react-query';

import { listCandidates } from '@/services/candidates.service';

const PAGE = 100;
const MAX_PAGES = 5; // up to 500 people in the list; type a name in the box to find one

/** The people to start from: newest first, a page at a time. */
function useCandidateOptions() {
  return useQuery({
    queryKey: ['candidates', 'distance-origin-options'],
    staleTime: 60_000,
    queryFn: async () => {
      const first = await listCandidates({ page: 1, pageSize: PAGE });
      const items = [...first.items];
      for (let page = 2; page <= (first.totalPages ?? 1) && page <= MAX_PAGES; page += 1) {
        items.push(...(await listCandidates({ page, pageSize: PAGE })).items);
      }
      return items;
    },
  });
}

/** "Or start from a candidate": a list of people with a search box; the distance is measured from the place of the one chosen. */
export function CandidateOriginSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { data: people } = useCandidateOptions();
  return (
    <SearchSelect aria-label="Start from a candidate" className="w-56 bg-background" searchPlaceholder="Search candidates…" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">…or start from a candidate</option>
      {(people ?? []).map((person) => {
        const place = [person.street, person.city, person.postalCode].filter(Boolean).join(', ') || person.location;
        return (
          <option key={person.id} value={person.id}>
            {`${person.firstName} ${person.lastName}`.trim() || 'Unnamed'}
            {place ? ` — ${place}` : ''}
          </option>
        );
      })}
    </SearchSelect>
  );
}
