'use client';

import { Input } from '@crm/ui';
import { useQuery } from '@tanstack/react-query';
import { MapPin } from '@crm/ui/icons';
import { useEffect, useRef, useState } from 'react';

import { apiClient } from '@/lib/api-client';

import { useDebounced } from './use-debounced';

interface Suggestion {
  value: string;
  kind: 'postcode' | 'city' | 'street';
}

const KIND_LABEL: Record<Suggestion['kind'], string> = { postcode: 'Post code', city: 'City', street: 'Street' };

/** A text box for a street, city or post code that offers matching places in a drop-down as letters are typed. */
export function PlaceInput({ value, onChange, disabled }: { value: string; onChange: (next: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const root = useRef<HTMLDivElement>(null);
  const typed = useDebounced(value.trim(), 250);
  const { data } = useQuery({
    queryKey: ['geo', 'suggest', typed],
    enabled: typed.length >= 2 && !disabled,
    staleTime: 60_000,
    queryFn: () => apiClient<Suggestion[]>(`/geo/suggest?q=${encodeURIComponent(typed)}`),
  });
  // a suggestion that is exactly what is typed adds nothing
  const options = (data ?? []).filter((item) => item.value.toLowerCase() !== value.trim().toLowerCase());
  const shown = open && options.length > 0 && value.trim().length >= 2;

  // a click anywhere else closes the list
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const pick = (item: Suggestion) => {
    onChange(item.value);
    setOpen(false);
    setActive(-1);
  };

  return (
    <div ref={root} className="relative">
      <Input
        aria-label="Start point (street, city or post code)"
        aria-autocomplete="list"
        aria-expanded={shown}
        autoComplete="off"
        className="w-48 bg-background"
        placeholder="Street, city or post code"
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (!shown) return;
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive((index) => (index + 1) % options.length);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((index) => (index <= 0 ? options.length - 1 : index - 1));
          } else if (event.key === 'Enter' && active >= 0) {
            event.preventDefault();
            pick(options[active]!);
          } else if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {shown ? (
        <ul role="listbox" className="absolute z-30 mt-1 max-h-64 w-72 overflow-auto rounded-md border border-border bg-background py-1 shadow-md">
          {options.map((item, index) => (
            <li key={`${item.kind}-${item.value}`} role="option" aria-selected={index === active}>
              <button
                type="button"
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent ${index === active ? 'bg-accent' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(item)}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-foreground/40" />
                <span className="min-w-0 flex-1 truncate">{item.value}</span>
                <span className="shrink-0 text-xs text-foreground/45">{KIND_LABEL[item.kind]}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
