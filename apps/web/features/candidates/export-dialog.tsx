'use client';

import { Button, Dialog, Label, Select, Textarea } from '@crm/ui';
import { Download, Loader2, ShieldAlert } from '@crm/ui/icons';
import { useEffect, useState } from 'react';

import {
  EXPORT_FIELD_OPTIONS,
  exportCandidates,
  previewExport,
  setCandidateConsent,
  type CandidateSelection,
  type ContactPurpose,
  type ExclusionReason,
  type ExportFormat,
  type ExportPreview,
} from '@/services/candidates.service';

const PURPOSES: { value: ContactPurpose; label: string; hint: string }[] = [
  { value: 'SMS', label: 'Text messages (SMS)', hint: 'Everyone with a valid mobile number except people who opted out of SMS.' },
  { value: 'EMAIL', label: 'Email', hint: 'Everyone with an email address except people who opted out of email.' },
  { value: 'CALL', label: 'Phone calls', hint: 'Everyone who has not opted out of calls, with a valid mobile number.' },
];

const REASON_LABEL: Record<ExclusionReason, string> = {
  DO_NOT_CONTACT: 'marked “Do not use”',
  OPTED_OUT: 'opted out of this',
  NO_CONSENT: 'no consent recorded',
  NO_PHONE: 'no valid mobile number',
  NO_EMAIL: 'no email address',
};

const DEFAULT_FIELDS = ['firstName', 'lastName', 'mobile', 'email'];

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Export a contact list from the candidates that are selected. The purpose comes first because it decides WHO may be
 * on the list: people who opted out, or never agreed, are left out by the server and counted here, so what the
 * dialog promises is what the file holds.
 */
export function CandidateExportDialog({ selection, count, onClose }: { selection: CandidateSelection; count: number; onClose: () => void }) {
  const [purpose, setPurpose] = useState<ContactPurpose>('SMS');
  const [format, setFormat] = useState<ExportFormat>('CSV');
  const [fields, setFields] = useState<string[]>(DEFAULT_FIELDS);
  const [part, setPart] = useState(1);
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // the count is asked from the server again whenever the purpose changes: it is the server that decides who may be on the list
  useEffect(() => {
    let current = true;
    setLoading(true);
    setPreviewError(null);
    setPart(1);
    previewExport(purpose, selection)
      .then((result) => current && setPreview(result))
      .catch((e: unknown) => current && setPreviewError(e instanceof Error ? e.message : 'Could not check the selection.'))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purpose, JSON.stringify(selection)]);

  const toggleField = (key: string) => setFields((now) => (now.includes(key) ? now.filter((k) => k !== key) : [...now, key]));
  const excludedTotal = preview ? Object.values(preview.excluded).reduce((a, b) => a + b, 0) : 0;
  const canExport = !loading && !exporting && !previewError && (preview?.included ?? 0) > 0 && (format === 'DIALPAD' || fields.length > 0);

  async function run() {
    setExporting(true);
    setError(null);
    setDone(null);
    try {
      const file = await exportCandidates({ purpose, format, fields, selection, part: format === 'DIALPAD' ? part : undefined });
      save(file.blob, file.filename);
      setDone(`Downloaded ${file.filename} — ${file.rows.toLocaleString('en-GB')} contact${file.rows === 1 ? '' : 's'}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Export ${count.toLocaleString('en-GB')} candidate${count === 1 ? '' : 's'}`}
      description="Choose what the list is for, the format and the columns. People who opted out of that way of being contacted, or are marked “Do not use”, are always left out."
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button type="button" disabled={!canExport} onClick={() => void run()} data-testid="export-run">
            {exporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
            {exporting ? 'Preparing…' : 'Download'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">What is the list for?</legend>
          {PURPOSES.map((option) => (
            <label key={option.value} className="flex cursor-pointer items-start gap-2 text-sm">
              <input type="radio" name="purpose" className="mt-1" checked={purpose === option.value} onChange={() => setPurpose(option.value)} />
              <span>
                <span className="font-medium">{option.label}</span>
                <span className="block text-xs text-foreground/55">{option.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="rounded-lg border border-border bg-accent/20 px-3 py-2.5 text-sm" data-testid="export-preview" aria-live="polite">
          {loading ? (
            <span className="flex items-center gap-2 text-foreground/60">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking who may be contacted…
            </span>
          ) : previewError ? (
            <span className="text-destructive">{previewError}</span>
          ) : preview ? (
            <>
              <p>
                <strong>{preview.included.toLocaleString('en-GB')}</strong> of {preview.matching.toLocaleString('en-GB')} can be contacted this way and will be in the file.
              </p>
              {excludedTotal > 0 ? (
                <p className="mt-1 flex items-start gap-1.5 text-xs text-foreground/65">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Left out ({excludedTotal.toLocaleString('en-GB')}):{' '}
                    {(Object.entries(preview.excluded) as [ExclusionReason, number][])
                      .filter(([, n]) => n > 0)
                      .map(([reason, n]) => `${n.toLocaleString('en-GB')} ${REASON_LABEL[reason]}`)
                      .join(', ')}
                    .
                  </span>
                </p>
              ) : null}
              {preview.included === 0 ? (
                <p className="mt-1 text-xs text-destructive">
                  No one in this selection may be contacted this way, so there is nothing to export.
                  {(preview.excluded.NO_CONSENT ?? 0) > 0 ? ' Consent has not been recorded for them yet: an administrator can record it (Record consent), or choose “Phone calls” which does not need it.' : ''}
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="export-format">Format</Label>
          <Select id="export-format" value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)}>
            <option value="CSV">CSV (opens in Excel, works everywhere)</option>
            <option value="XLSX">Excel (.xlsx)</option>
            <option value="DIALPAD">Dialpad contacts (CSV)</option>
          </Select>
        </div>

        {format === 'DIALPAD' ? (
          <div className="rounded-lg border border-border px-3 py-2.5 text-xs text-foreground/70">
            <p>
              Dialpad file: first name, last name, phone in international format (+44…), email, employer and job title. Dialpad accepts 500 contacts per
              file — upload it in Dialpad under Admin Settings → My Company → Shared Contacts. If Dialpad’s own template uses other column names, tell us and
              we will match them.
            </p>
            {preview && preview.dialpadParts > 1 ? (
              <div className="mt-2 flex items-center gap-2">
                <Label htmlFor="export-part">File</Label>
                <Select id="export-part" className="w-44" value={String(part)} onChange={(event) => setPart(Number(event.target.value))}>
                  {Array.from({ length: preview.dialpadParts }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1} of {preview.dialpadParts}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
          </div>
        ) : (
          <fieldset>
            <legend className="mb-1.5 flex w-full items-center justify-between text-sm font-medium">
              <span>Columns ({fields.length})</span>
              <span className="flex gap-3 text-xs font-normal">
                <button type="button" className="underline" onClick={() => setFields(EXPORT_FIELD_OPTIONS.map((f) => f.key))}>
                  All
                </button>
                <button type="button" className="underline" onClick={() => setFields(DEFAULT_FIELDS)}>
                  Name, mobile, email
                </button>
                <button type="button" className="underline" onClick={() => setFields([])}>
                  None
                </button>
              </span>
            </legend>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
              {EXPORT_FIELD_OPTIONS.map((field) => (
                <label key={field.key} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={fields.includes(field.key)} onChange={() => toggleField(field.key)} />
                  {field.label}
                </label>
              ))}
            </div>
            {fields.length === 0 ? <p className="mt-1 text-xs text-destructive">Choose at least one column.</p> : null}
          </fieldset>
        )}

        {error ? (
          <p role="alert" className="text-sm text-destructive" data-testid="export-error">
            {error}
          </p>
        ) : null}
        {done ? (
          <p role="status" className="text-sm text-emerald-700" data-testid="export-done">
            {done}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

/** Admin: records what people agreed to (or opted out of) for everyone selected. */
export function CandidateConsentDialog({ selection, count, onClose }: { selection: CandidateSelection; count: number; onClose: () => void }) {
  const [channels, setChannels] = useState<ContactPurpose[]>(['SMS']);
  const [status, setStatus] = useState<'GRANTED' | 'OPTED_OUT' | 'UNKNOWN'>('GRANTED');
  const [evidence, setEvidence] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const toggle = (channel: ContactPurpose) => setChannels((now) => (now.includes(channel) ? now.filter((c) => c !== channel) : [...now, channel]));
  const valid = channels.length > 0 && (status !== 'GRANTED' || evidence.trim().length > 0);

  async function run() {
    setSaving(true);
    setError(null);
    try {
      const { updated } = await setCandidateConsent({ selection, channels, status, evidence: evidence.trim() || undefined });
      setResult(`${updated.toLocaleString('en-GB')} candidate${updated === 1 ? '' : 's'} updated.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Record consent for ${count.toLocaleString('en-GB')} candidate${count === 1 ? '' : 's'}`}
      description="Only record consent you can prove. Someone who opted out is never switched back to “agreed” here — they must agree again themselves."
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result ? (
            <Button type="button" disabled={!valid || saving} onClick={() => void run()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <fieldset className="flex gap-4 text-sm">
          <legend className="mb-1 font-medium">Applies to</legend>
          {(['SMS', 'EMAIL', 'CALL'] as const).map((channel) => (
            <label key={channel} className="flex items-center gap-1.5">
              <input type="checkbox" checked={channels.includes(channel)} onChange={() => toggle(channel)} />
              {channel === 'SMS' ? 'SMS' : channel === 'EMAIL' ? 'Email' : 'Calls'}
            </label>
          ))}
        </fieldset>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="consent-status">Set to</Label>
          <Select id="consent-status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
            <option value="GRANTED">Agreed (consent given)</option>
            <option value="OPTED_OUT">Opted out</option>
            <option value="UNKNOWN">Nothing recorded</option>
          </Select>
        </div>
        {status === 'GRANTED' ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="consent-evidence">Where does the consent come from?</Label>
            <Textarea id="consent-evidence" rows={2} placeholder="e.g. Signed consent form, 3 Nov 2026" value={evidence} onChange={(event) => setEvidence(event.target.value)} />
          </div>
        ) : null}
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        {result ? <p role="status" className="text-sm text-emerald-700">{result}</p> : null}
      </div>
    </Dialog>
  );
}
