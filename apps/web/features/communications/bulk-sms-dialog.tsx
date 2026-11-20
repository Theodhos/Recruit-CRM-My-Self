'use client';

import { Button, Dialog } from '@crm/ui';
import { Loader2, MessageSquare, ShieldAlert } from '@crm/ui/icons';
import { useEffect, useRef, useState } from 'react';

import { ApiClientError } from '@/lib/api-client';
import type { CandidateSelection } from '@/services/candidates.service';
import { getBatch, previewBulkSms, sendBulkSms, type BatchStatus, type BulkPreview } from '@/services/communications.service';

import { MAX_SMS_LENGTH } from './constants';
import { SmsComposer } from './sms-composer';

const messageOf = (error: unknown, fallback: string) => (error instanceof ApiClientError ? error.message : fallback);

/** A new key every time the dialog opens: one click sends once, however many times it is pressed or retried. */
const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k${Date.now()}${Math.random().toString(16).slice(2)}`);

/**
 * Bulk text through Dialpad: write (or pick a template), see the REAL number of people who will get it and why the
 * others are left out, check the preview, confirm — then watch it go out, person by person.
 */
export function BulkSmsDialog({ selection, count, onClose, onRecordConsent }: { selection: CandidateSelection; count: number; onClose: () => void; onRecordConsent?: () => void }) {
  const idempotencyKey = useRef(newKey());
  const [text, setText] = useState('');
  const [jobId, setJobId] = useState('');
  const [preview, setPreview] = useState<BulkPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batch, setBatch] = useState<BatchStatus | null>(null);

  // the server decides who may be texted: ask again (after a short pause) whenever the message or vacancy changes
  useEffect(() => {
    if (batch) return;
    if (!text.trim()) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    let current = true;
    setChecking(true);
    const timer = setTimeout(() => {
      previewBulkSms({ selection, text, jobId: jobId || undefined })
        .then((result) => {
          if (!current) return;
          setPreview(result);
          setPreviewError(null);
          setConfirmed(false);
        })
        .catch((e: unknown) => {
          if (!current) return;
          setPreview(null);
          setPreviewError(messageOf(e, 'Could not check the selection.'));
        })
        .finally(() => current && setChecking(false));
    }, 500);
    return () => {
      current = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, jobId, JSON.stringify(selection), Boolean(batch)]);

  // once sent, follow the batch until it is finished
  useEffect(() => {
    if (!batch || batch.status !== 'RUNNING') return;
    const timer = setInterval(() => {
      getBatch(batch.id)
        .then(setBatch)
        .catch(() => undefined);
    }, 3000);
    return () => clearInterval(timer);
  }, [batch]);

  const excludedTotal = preview ? Object.values(preview.excluded).reduce((a, b) => a + b, 0) : 0;
  const canSend = Boolean(preview?.connected) && (preview?.eligible ?? 0) > 0 && !preview?.tooMany && confirmed && !sending && !checking && text.length <= MAX_SMS_LENGTH;

  async function run() {
    setSending(true);
    setError(null);
    try {
      setBatch(await sendBulkSms({ selection, text, jobId: jobId || undefined, idempotencyKey: idempotencyKey.current }));
    } catch (e) {
      setError(messageOf(e, 'The messages were not sent.'));
    } finally {
      setSending(false);
    }
  }

  const done = batch ? batch.sent + batch.failed : 0;

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Text ${count.toLocaleString('en-GB')} candidate${count === 1 ? '' : 's'}`}
      description="Sent one by one from the company's Dialpad number. Only people who agreed to texts are included."
      className="max-w-2xl"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            {batch ? 'Close' : 'Cancel'}
          </Button>
          {!batch ? (
            <Button type="button" disabled={!canSend} onClick={() => void run()} data-testid="bulk-sms-send">
              {sending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-1.5 h-4 w-4" />}
              {preview ? `Send to ${preview.eligible.toLocaleString('en-GB')} ${preview.eligible === 1 ? 'person' : 'people'}` : 'Send'}
            </Button>
          ) : null}
        </>
      }
    >
      {batch ? (
        <div className="flex flex-col gap-3" data-testid="bulk-sms-progress" aria-live="polite">
          <p className="text-sm">
            {batch.status === 'RUNNING' ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Sending… {done.toLocaleString('en-GB')} of {batch.eligible.toLocaleString('en-GB')} done
              </span>
            ) : (
              <strong>{batch.status === 'COMPLETED' ? 'All messages were sent.' : 'Finished, with some that failed.'}</strong>
            )}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-accent">
            <div className="h-full bg-primary transition-all" style={{ width: `${batch.eligible ? Math.round((done / batch.eligible) * 100) : 0}%` }} />
          </div>
          <p className="text-sm text-foreground/75">
            {batch.sent.toLocaleString('en-GB')} sent · {batch.delivered.toLocaleString('en-GB')} delivered so far · {batch.failed.toLocaleString('en-GB')} failed · {batch.queued.toLocaleString('en-GB')} waiting
          </p>
          {batch.alreadySubmitted ? <p className="text-xs text-foreground/60">This message had already been submitted — nothing was sent twice.</p> : null}
          {batch.failures.length > 0 ? (
            <div className="rounded-lg border border-destructive/40 px-3 py-2 text-xs">
              <p className="mb-1 font-medium text-destructive">Not sent:</p>
              <ul className="flex max-h-40 flex-col gap-1 overflow-auto">
                {batch.failures.map((f) => (
                  <li key={f.id}>
                    {f.name ?? 'Unknown'} — {f.error ?? 'failed'}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-xs text-foreground/55">Every message is in the candidate’s Communication history. You can close this window; sending carries on.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <SmsComposer idPrefix="bulk" text={text} onText={setText} jobId={jobId} onJobId={setJobId} />

          <div className="rounded-lg border border-border bg-accent/20 px-3 py-2.5 text-sm" data-testid="bulk-sms-preview" aria-live="polite">
            {!text.trim() ? (
              <span className="text-foreground/60">Write the message to see who will receive it.</span>
            ) : checking && !preview ? (
              <span className="flex items-center gap-2 text-foreground/60">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking who may be texted…
              </span>
            ) : previewError ? (
              <span className="text-destructive">{previewError}</span>
            ) : preview ? (
              <>
                <p>
                  <strong data-testid="bulk-sms-eligible">{preview.eligible.toLocaleString('en-GB')}</strong> of {preview.matching.toLocaleString('en-GB')} will get this text
                  {preview.fromNumber ? ` from ${preview.fromNumber}` : ''}. About {preview.minutes} minute{preview.minutes === 1 ? '' : 's'} to send.
                </p>
                {excludedTotal > 0 ? (
                  <p className="mt-1 flex items-start gap-1.5 text-xs text-foreground/65">
                    <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Left out ({excludedTotal.toLocaleString('en-GB')}):{' '}
                      {Object.entries(preview.excluded)
                        .filter(([, n]) => n > 0)
                        .map(([reason, n]) => `${n.toLocaleString('en-GB')} — ${preview.excludedLabels[reason] ?? reason}`)
                        .join('; ')}
                      .
                    </span>
                  </p>
                ) : null}
                {(preview.excluded.NO_CONSENT ?? 0) > 0 ? (
                  <p className="mt-1 text-xs text-foreground/70" data-testid="bulk-sms-consent-hint">
                    {(preview.excluded.NO_CONSENT ?? 0).toLocaleString('en-GB')} people have no SMS consent recorded, so they cannot be texted yet.{' '}
                    {onRecordConsent ? (
                      <button type="button" className="font-semibold underline" onClick={onRecordConsent}>
                        Record their consent now
                      </button>
                    ) : (
                      'Ask an administrator to record it (Candidates → select → Record consent).'
                    )}
                  </p>
                ) : null}
                {!preview.connected ? <p className="mt-1 text-xs text-destructive">Dialpad is not connected — an administrator must connect it in Settings first.</p> : null}
                {preview.tooMany ? <p className="mt-1 text-xs text-destructive">Too many people for one message. Narrow the selection.</p> : null}
                {preview.eligible === 0 ? <p className="mt-1 text-xs text-destructive">Nobody in this selection can be texted.</p> : null}
              </>
            ) : null}
          </div>

          {preview?.sample ? (
            <div className="rounded-lg border border-border px-3 py-2 text-sm" data-testid="bulk-sms-sample">
              <p className="mb-1 text-xs font-medium text-foreground/60">Preview — as {preview.sample.name} will see it</p>
              <p className="whitespace-pre-wrap break-words">{preview.sample.text}</p>
            </div>
          ) : null}

          {preview && preview.eligible > 0 ? (
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} data-testid="bulk-sms-confirm" />
              <span>
                I checked the message. Send it to {preview.eligible.toLocaleString('en-GB')} {preview.eligible === 1 ? 'person' : 'people'} now — it cannot be recalled.
              </span>
            </label>
          ) : null}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </Dialog>
  );
}
