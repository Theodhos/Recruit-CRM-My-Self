'use client';

import { Button, Dialog, Label, Select, Textarea } from '@crm/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useCommunicationStatus, useTemplates } from '@/hooks/use-communications';
import { useSession } from '@/hooks/use-session';
import { listJobs } from '@/services/jobs.service';

import { MAX_SMS_LENGTH, STARTER_TEMPLATES } from './constants';
import { TemplatesManager } from './templates-manager';


/** What a text will say for one person — the same fill-in the server does, so the preview matches what is sent. */
export function renderPreview(text: string, values: Record<string, string | undefined>): string {
  return text.replace(/\{\{\s*([A-Za-z]+)\s*\}\}/g, (whole, key: string) => values[key] ?? whole);
}

export function smsParts(length: number): number {
  return length <= 160 ? 1 : Math.ceil(length / 153);
}

/**
 * The message box shared by the single text and the bulk text: pick a template, write or edit the message, insert
 * placeholders, and (only when the message uses a job title) choose which vacancy it is about.
 */
export function SmsComposer({
  text,
  onText,
  jobId,
  onJobId,
  idPrefix,
}: {
  text: string;
  onText: (value: string) => void;
  jobId: string;
  onJobId: (value: string) => void;
  idPrefix: string;
}) {
  const { data: templates } = useTemplates();
  const { data: status } = useCommunicationStatus();
  const usesJob = /\{\{\s*jobTitle\s*\}\}/.test(text);
  const { data: jobs } = useQuery({ queryKey: ['jobs', 'list', { pageSize: 100 }], queryFn: () => listJobs({ pageSize: 100 }), enabled: usesJob });
  const overLimit = text.length > MAX_SMS_LENGTH;
  const { data: session } = useSession();
  const canManage = Boolean(session?.permissions?.includes('template:manage'));
  const [manageOpen, setManageOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor={`${idPrefix}-template`}>Template</Label>
          {canManage ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setManageOpen(true)}>
              Manage templates
            </Button>
          ) : null}
        </div>
        <Select
          id={`${idPrefix}-template`}
          value=""
          onChange={(event) => {
            const picked = templates?.find((t) => t.id === event.target.value) ?? STARTER_TEMPLATES.find((t) => t.id === event.target.value);
            if (picked) onText(picked.body);
          }}
          data-testid="sms-template-select"
        >
          <option value="">Choose a template…</option>
          {(templates ?? []).length > 0 ? <optgroup label="Your templates">{(templates ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}</optgroup> : null}
          <optgroup label="Starter templates">
            {STARTER_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </optgroup>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-text`}>Message</Label>
        <Textarea id={`${idPrefix}-text`} rows={5} value={text} onChange={(event) => onText(event.target.value)} placeholder="Hi {{firstName}}, we have a new {{jobTitle}} vacancy…" data-testid="sms-text" />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-foreground/55">Insert:</span>
            {(status?.placeholders ?? []).map((p) => (
              <button key={p.key} type="button" className="rounded border border-border px-1.5 py-0.5 hover:bg-accent" onClick={() => onText(`${text}{{${p.key}}}`)} title={`e.g. ${p.example}`}>
                {p.label}
              </button>
            ))}
          </span>
          <span className={overLimit ? 'text-destructive' : 'text-foreground/55'} data-testid="sms-length">
            {text.length}/{MAX_SMS_LENGTH} · {smsParts(text.length)} text{smsParts(text.length) === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {manageOpen ? (
        <Dialog open onOpenChange={(open) => !open && setManageOpen(false)} title="Message templates" description="Saved texts anyone can pick. Placeholders are filled in for each person." className="max-w-xl">
          <TemplatesManager />
        </Dialog>
      ) : null}

      {usesJob ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-job`}>Vacancy for “Job title”</Label>
          <Select id={`${idPrefix}-job`} value={jobId} onChange={(event) => onJobId(event.target.value)}>
            <option value="">The job each person applied for</option>
            {(jobs?.items ?? []).map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
    </div>
  );
}
