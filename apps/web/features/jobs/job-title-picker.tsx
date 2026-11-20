'use client';

import { ChevronDown, Search, X } from '@crm/ui/icons';
import { useEffect, useRef, useState } from 'react';

/** One job title in the list can carry several names for the same job, written together as "Electrician / Electrical engineer". */
export const NAME_SEPARATOR = ' / ';
export const splitNames = (title: string | undefined | null) => (title ?? '').split(NAME_SEPARATOR).map((part) => part.trim()).filter(Boolean);
export const joinNames = (names: string[]) => names.join(NAME_SEPARATOR);

/** A job given several titles from the list keeps them in one text, in this form: "Electrician / Plumber | Welder". */
export const TITLE_SEPARATOR = ' | ';
export const splitTitles = (value: string | undefined | null) => (value ?? '').split(TITLE_SEPARATOR).map((part) => part.trim()).filter(Boolean);
export const joinTitles = (titles: string[]) => titles.join(TITLE_SEPARATOR);

/**
 * Choose the job's titles from the saved list: a box with what is chosen (each with an x), and under it a search
 * and the list with a checkbox on each title, as many as needed. `value` / `onChange` carry the titles as one text.
 */
export function JobTitlePicker({ value, onChange, titles, id }: { value: string | undefined; onChange: (value: string) => void; titles: string[]; id?: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const chosen = splitTitles(value);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  // a title the job already has but the list does not (an older job) stays a choice
  const options = [...titles, ...chosen.filter((title) => !titles.includes(title))];
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = options.filter((title) => words.every((word) => title.toLowerCase().includes(word)));
  const toggle = (title: string) => onChange(joinTitles(chosen.includes(title) ? chosen.filter((item) => item !== title) : [...chosen, title]));

  return (
    <div ref={box} className="relative w-full">
      <div
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        tabIndex={0}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen((current) => !current);
          }
          if (event.key === 'Escape') setOpen(false);
        }}
        className="flex min-h-9 w-full cursor-pointer flex-wrap items-center gap-1.5 py-1 text-sm"
        data-testid="job-title-picker"
      >
        {chosen.length === 0 ? <span className="text-foreground/40">{titles.length === 0 ? 'No job titles yet: use Add job title' : 'Choose one or more job titles'}</span> : null}
        {chosen.map((title) => (
          <span key={title} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {title}
            <button
              type="button"
              aria-label={`Remove ${title}`}
              className="rounded-full hover:bg-primary/20"
              onClick={(event) => {
                event.stopPropagation();
                toggle(title);
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-foreground/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-lg border border-border bg-background p-2 shadow-lg">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search job titles…"
              className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <ul role="listbox" aria-multiselectable="true" className="max-h-56 overflow-y-auto">
            {shown.length === 0 ? <li className="px-2 py-3 text-center text-sm text-foreground/50">{options.length === 0 ? 'No job titles yet' : 'No job title matches'}</li> : null}
            {shown.map((title) => {
              const selected = chosen.includes(title);
              return (
                <li key={title} role="option" aria-selected={selected}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent/60">
                    <input type="checkbox" className="h-4 w-4 shrink-0 rounded border-border accent-primary" checked={selected} onChange={() => toggle(title)} />
                    {title}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
