'use client';

import { Button, Input, Label, Textarea } from '@crm/ui';
import { Pencil, Plus, Trash2 } from '@crm/ui/icons';
import { useState } from 'react';

import { useCommunicationStatus, useTemplateMutations, useTemplates } from '@/hooks/use-communications';
import { useSession } from '@/hooks/use-session';
import { ApiClientError } from '@/lib/api-client';
import type { MessageTemplate } from '@/services/communications.service';

import { MAX_SMS_LENGTH } from './constants';

const messageOf = (error: unknown, fallback: string) => (error instanceof ApiClientError ? error.message : fallback);

/** Create, edit and delete reusable text messages. Everyone who can text may use them; changing them needs the template permission. */
export function TemplatesManager() {
  const { data: session } = useSession();
  const { data: status } = useCommunicationStatus();
  const { data: templates, isLoading } = useTemplates();
  const { create, update, remove } = useTemplateMutations();
  const canManage = Boolean(session?.permissions?.includes('template:manage'));

  const [editing, setEditing] = useState<MessageTemplate | 'new' | null>(null);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  function open(target: MessageTemplate | 'new') {
    setEditing(target);
    setName(target === 'new' ? '' : target.name);
    setBody(target === 'new' ? '' : target.body);
    setError(null);
  }

  async function save() {
    setError(null);
    try {
      if (editing === 'new') await create.mutateAsync({ name, body });
      else if (editing) await update.mutateAsync({ id: editing.id, name, body });
      setEditing(null);
    } catch (e) {
      setError(messageOf(e, 'Could not save the template.'));
    }
  }

  async function confirmRemove(template: MessageTemplate) {
    if (!window.confirm(`Delete the template “${template.name}”?`)) return;
    setError(null);
    try {
      await remove.mutateAsync(template.id);
    } catch (e) {
      setError(messageOf(e, 'Could not delete the template.'));
    }
  }

  return (
    <div className="flex flex-col gap-3" data-testid="templates-manager">
      {isLoading ? (
        <p className="text-sm text-foreground/50">Loading…</p>
      ) : templates && templates.length > 0 ? (
        <ul className="divide-y divide-border">
          {templates.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">{t.name}</p>
                <p className="whitespace-pre-wrap break-words text-xs text-foreground/65">{t.body}</p>
              </div>
              {canManage ? (
                <div className="flex shrink-0 gap-1">
                  <Button type="button" size="sm" variant="ghost" onClick={() => open(t)} aria-label={`Edit ${t.name}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => void confirmRemove(t)} aria-label={`Delete ${t.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-foreground/50">No templates yet.</p>
      )}

      {canManage && !editing ? (
        <div>
          <Button type="button" size="sm" variant="outline" onClick={() => open('new')} data-testid="template-new">
            <Plus className="mr-1.5 h-4 w-4" /> New template
          </Button>
        </div>
      ) : null}
      {!canManage ? <p className="text-xs text-foreground/55">Changing templates needs the “manage templates” permission.</p> : null}

      {editing ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tpl-name">Name</Label>
            <Input id="tpl-name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="New vacancy — electricians" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tpl-body">Message</Label>
            <Textarea id="tpl-body" rows={4} value={body} onChange={(event) => setBody(event.target.value)} />
            <p className="text-xs text-foreground/55">
              You can use: {(status?.placeholders ?? []).map((p) => `{{${p.key}}}`).join('  ')} · {body.length}/{MAX_SMS_LENGTH}
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={!name.trim() || !body.trim() || create.isPending || update.isPending} onClick={() => void save()} data-testid="template-save">
              Save template
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
