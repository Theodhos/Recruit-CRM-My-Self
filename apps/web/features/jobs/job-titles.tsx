'use client';

import { Button, Dialog, Input } from '@crm/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Plus, Search, Trash2, X } from '@crm/ui/icons';
import { useState, type FormEvent } from 'react';

import { confirmDialog } from '@/components/dialogs/confirm-dialog';
import { ApiClientError, apiClient } from '@/lib/api-client';

import { joinNames, splitNames } from './job-title-picker';

export interface JobTitle {
  id: string;
  name: string;
}

const KEY = ['job-titles'] as const;
const BASE = '/organisations/current/job-titles';

/** The list a job's title is chosen from (kept on the organisation, shared by everyone). */
export function useJobTitles() {
  return useQuery({ queryKey: KEY, queryFn: () => apiClient<JobTitle[]>(BASE), staleTime: 60_000 });
}

function useTitleMutations() {
  const queryClient = useQueryClient();
  const done = (titles: JobTitle[]) => queryClient.setQueryData(KEY, titles);
  return {
    add: useMutation({ mutationFn: (name: string) => apiClient<JobTitle[]>(BASE, { method: 'POST', body: { name } }), onSuccess: done }),
    rename: useMutation({ mutationFn: (input: { id: string; name: string }) => apiClient<JobTitle[]>(`${BASE}/${input.id}`, { method: 'PATCH', body: { name: input.name } }), onSuccess: done }),
    remove: useMutation({ mutationFn: (id: string) => apiClient<JobTitle[]>(`${BASE}/${id}`, { method: 'DELETE' }), onSuccess: done }),
  };
}

const messageOf = (error: unknown, fallback: string) => (error instanceof ApiClientError || error instanceof Error ? error.message : fallback);

/**
 * The names of one job title: type a name and press Enter (or +) to add it, as many as the job is known by. They
 * show as chips; each has an x. The names are kept together as one title ("Electrician / Electrical engineer").
 */
function NamesEditor({ names, onChange, autoFocus, id }: { names: string[]; onChange: (names: string[]) => void; autoFocus?: boolean; id?: string }) {
  const [draft, setDraft] = useState('');

  function addDraft() {
    const clean = draft.trim().replaceAll('/', '-').replaceAll('|', '-');
    if (clean.length < 2) return;
    if (!names.some((name) => name.toLowerCase() === clean.toLowerCase())) onChange([...names, clean]);
    setDraft('');
  }

  return (
    <div className="flex flex-col gap-2">
      {names.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" data-testid="job-title-names">
          {names.map((name) => (
            <span key={name} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              {name}
              <button type="button" aria-label={`Remove ${name}`} className="rounded-full hover:bg-primary/20" onClick={() => onChange(names.filter((item) => item !== name))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addDraft();
            }
          }}
          placeholder={names.length === 0 ? 'e.g. Electrician' : 'Another name for the same job…'}
          autoFocus={autoFocus}
        />
        <Button type="button" variant="outline" onClick={addDraft} disabled={draft.trim().length < 2} aria-label="Add this name">
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </div>
    </div>
  );
}

/**
 * Changing a saved title: each of its names is a text box with the name already in it — type over it to rename it right
 * there. The x takes a name off; the last box adds another name for the same job.
 */
function NamesRename({ names, onChange }: { names: string[]; onChange: (names: string[]) => void }) {
  const [extra, setExtra] = useState('');
  const clean = (value: string) => value.replaceAll('/', '-').replaceAll('|', '-');
  function addExtra() {
    const value = clean(extra).trim();
    if (value.length < 2) return;
    if (!names.some((name) => name.trim().toLowerCase() === value.toLowerCase())) onChange([...names, value]);
    setExtra('');
  }
  return (
    <div className="flex flex-col gap-2" data-testid="job-title-rename">
      {names.map((name, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input aria-label={`Name ${index + 1}`} value={name} autoFocus={index === 0} onChange={(event) => onChange(names.map((item, at) => (at === index ? clean(event.target.value) : item)))} />
          {names.length > 1 ? (
            <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${name}`} onClick={() => onChange(names.filter((_, at) => at !== index))}>
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      ))}
      <div className="flex gap-2">
        <Input
          value={extra}
          placeholder="Another name for the same job…"
          onChange={(event) => setExtra(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addExtra();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={addExtra} disabled={extra.trim().length < 2} aria-label="Add this name">
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </div>
    </div>
  );
}

/** "Add job title": add one or more names for the same job and save; below, every saved title, each one can be changed or deleted. */
export function JobTitlesDialog({ onClose }: { onClose: () => void }) {
  const { data: titles, isLoading } = useJobTitles();
  const { add, rename, remove } = useTitleMutations();
  const [names, setNames] = useState<string[]>([]);
  const [editing, setEditing] = useState<{ id: string; names: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = (titles ?? []).filter((title) => words.every((word) => title.name.toLowerCase().includes(word)));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (names.length === 0) return setError('Add at least one name for the job title.');
    setError(null);
    try {
      await add.mutateAsync(joinNames(names));
      setNames([]);
    } catch (e) {
      setError(messageOf(e, 'Could not save the job title.'));
    }
  }

  async function saveEdit() {
    if (!editing) return;
    // a name emptied while renaming is dropped; the same name twice counts once
    const names = editing.names.map((name) => name.trim()).filter((name, index, all) => name.length >= 2 && all.findIndex((other) => other.toLowerCase() === name.toLowerCase()) === index);
    if (names.length === 0) return setError('A job title needs at least one name (two letters or more).');
    setError(null);
    try {
      await rename.mutateAsync({ id: editing.id, name: joinNames(names) });
      setEditing(null);
    } catch (e) {
      setError(messageOf(e, 'Could not change the job title.'));
    }
  }

  async function deleteTitle(title: JobTitle) {
    if (!(await confirmDialog(`Delete “${title.name}” from the list? Jobs that already have this title keep it.`))) return;
    setError(null);
    try {
      await remove.mutateAsync(title.id);
    } catch (e) {
      setError(messageOf(e, 'Could not delete the job title.'));
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title="Job titles" className="max-h-[90vh] max-w-lg overflow-y-auto">
      <div className="flex flex-col gap-4">
        <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-2">
          <label htmlFor="new-job-title" className="text-sm font-medium">
            Add job title
          </label>
          <p className="text-xs text-foreground/55">Write a name and press Enter. Add as many names as this job is known by — they stay together as one job title.</p>
          <NamesEditor id="new-job-title" names={names} onChange={setNames} autoFocus />
          <div>
            <Button type="submit" disabled={add.isPending || names.length === 0}>
              {add.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">Saved job titles {titles ? `(${titles.length})` : ''}</p>
          {titles && titles.length > 0 ? (
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
              <Input className="pl-8" aria-label="Search job titles" placeholder="Search job titles…" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
          ) : null}
          {isLoading ? (
            <p className="text-sm text-foreground/50">Loading…</p>
          ) : !titles || titles.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-foreground/50">No job titles yet. Add the first one above.</p>
          ) : shown.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-foreground/50">No job title matches “{search}”.</p>
          ) : (
            <ul className="flex max-h-[40vh] flex-col divide-y divide-border overflow-y-scroll rounded-lg border border-border" data-testid="job-titles-list">
              {shown.map((title) => (
                <li key={title.id} className="px-3 py-2 text-sm">
                  {editing?.id === title.id ? (
                    <div className="flex flex-col gap-2">
                      <NamesRename names={editing.names} onChange={(next) => setEditing({ id: title.id, names: next })} />
                      <div className="flex gap-2">
                        <Button type="button" size="sm" disabled={rename.isPending} onClick={() => void saveEdit()}>
                          <Check className="mr-1 h-4 w-4" /> Save
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                        {splitNames(title.name).map((name) => (
                          <span key={name} className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium">
                            {name}
                          </span>
                        ))}
                      </span>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing({ id: title.id, names: splitNames(title.name) })} aria-label={`Edit ${title.name}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="sm" variant="ghost" disabled={remove.isPending} onClick={() => void deleteTitle(title)} aria-label={`Delete ${title.name}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Dialog>
  );
}
