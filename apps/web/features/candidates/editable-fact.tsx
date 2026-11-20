'use client';

import { Button, Input, Select } from '@crm/ui';
import { Check, Pencil, X } from '@crm/ui/icons';
import type { ComponentType, ReactNode } from 'react';
import { useState } from 'react';

/**
 * One value of the candidate's profile that can be filled in right there: a value that is already on file gets a
 * pencil to change it, an empty one an "Add" link. Saving sends just this field.
 */
export function EditableFact({
  label,
  icon: Icon,
  value,
  display,
  options,
  placeholder,
  onSave,
}: {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  /** What is stored ('' / null when empty). */
  value: string | null | undefined;
  /** How a stored value is shown when not editing (a link, for instance); defaults to the plain text. */
  display?: ReactNode;
  /** With options the box is a list to choose from instead of free text. */
  options?: readonly (string | { value: string; label: string })[];
  placeholder?: string;
  onSave: (next: string) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filled = Boolean(value);
  const choices = options?.map((option) => (typeof option === 'string' ? { value: option, label: option } : option));
  const shownValue = choices?.find((choice) => choice.value === value)?.label ?? value;

  function open() {
    setDraft(value ?? '');
    setError(null);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await onSave(draft.trim());
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-start gap-2">
      {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0 text-foreground/40" /> : null}
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-foreground/50">{label}</dt>
        <dd className="text-sm">
          {editing ? (
            <div className="flex items-center gap-1">
              {choices ? (
                <Select autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} className="h-8">
                  <option value="">—</option>
                  {choices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  autoFocus
                  value={draft}
                  placeholder={placeholder}
                  className="h-8"
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void save();
                    if (event.key === 'Escape') setEditing(false);
                  }}
                />
              )}
              <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => void save()} aria-label={`Save ${label}`}>
                <Check className="h-4 w-4" />
              </Button>
              <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => setEditing(false)} aria-label="Cancel">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : filled ? (
            <span className="inline-flex items-center gap-1">
              {display ?? shownValue}
              <button type="button" onClick={open} className="text-foreground/40 hover:text-foreground" aria-label={`Edit ${label}`}>
                <Pencil className="h-3 w-3" />
              </button>
            </span>
          ) : (
            <button type="button" onClick={open} className="text-primary hover:underline">
              + Add
            </button>
          )}
          {error ? <span className="block text-xs text-destructive">{error}</span> : null}
        </dd>
      </div>
    </div>
  );
}
