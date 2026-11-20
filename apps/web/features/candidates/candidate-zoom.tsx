'use client';

import { Button, Input, Label, Select, Textarea } from '@crm/ui';
import { Copy, ExternalLink, Mail, Video } from '@crm/ui/icons';
import { useState } from 'react';

import { useCreateCandidateZoom, useSendCandidateZoomInvite } from '@/hooks/use-candidates';
import { useInterviewCapabilities } from '@/hooks/use-interviews';
import type { CandidateWithCompany, ZoomInviteDelivery } from '@/services/candidates.service';

const DURATIONS = ['30', '45', '60', '90'] as const;

/** Tomorrow at 10:00 local time, as a datetime-local value. */
function defaultSlot(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const when = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' });

/**
 * The Interview stage's Zoom meeting: pick the date and time, and the platform creates the Zoom link (no pipeline
 * card needed). Once there is a link, one click e-mails the candidate the invitation with the date, the time and the
 * link; or tick the box to send it the moment the link is made.
 */
export function CandidateZoom({ candidate }: { candidate: CandidateWithCompany }) {
  const { data: caps } = useInterviewCapabilities();
  const create = useCreateCandidateZoom();
  const invite = useSendCandidateZoomInvite();
  const [slot, setSlot] = useState(defaultSlot);
  const [duration, setDuration] = useState<string>('45');
  const [message, setMessage] = useState('');
  const [sendNow, setSendNow] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<ZoomInviteDelivery | null>(null);
  const [copied, setCopied] = useState(false);

  const saved = candidate.stageData?.INTERVIEW_1 ?? {};
  const url = saved.zoomUrl;
  const email = candidate.email;
  const zoomAuto = caps?.zoomConfigured ?? false;

  async function submit() {
    setError(null);
    setDelivery(null);
    try {
      const res = await create.mutateAsync({
        id: candidate.id,
        input: {
          scheduledAt: new Date(slot).toISOString(),
          durationMinutes: Number(duration),
          timezone: 'Europe/London',
          notes: message.trim() || undefined,
          sendInvite: sendNow && Boolean(email),
        },
      });
      setDelivery(res.email);
      setMessage('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the Zoom meeting.');
    }
  }

  async function send() {
    setError(null);
    try {
      setDelivery(await invite.mutateAsync(candidate.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the invitation.');
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url!);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the link is visible to select */
    }
  }

  return (
    <div className="rounded-lg border border-border p-3" data-testid="candidate-zoom">
      <h4 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Video className="h-4 w-4 text-foreground/50" /> Zoom meeting
      </h4>

      {zoomAuto || !caps ? (
        <p className="mb-3 text-xs text-foreground/50">Choose the date and time — the link is created for you, under your own Zoom account (the one with your CRM e-mail).</p>
      ) : (
        <p className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-900" data-testid="zoom-not-connected">
          Zoom is not connected to the platform yet, so a link cannot be created. An administrator connects it once with
          the Account ID, Client ID and Client Secret of a Zoom Server-to-Server OAuth app (Settings → Integrations → Zoom).
        </p>
      )}

      {url ? (
        <div className="mb-3 rounded-md bg-accent/40 p-3 text-xs" data-testid="candidate-zoom-link">
          <p className="font-medium">
            {saved.zoomAt ? when(saved.zoomAt) : 'Zoom meeting'}
            {saved.zoomDuration ? ` · ${saved.zoomDuration} min` : ''}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2">
            <a className="break-all text-primary underline" href={url} target="_blank" rel="noreferrer">
              {url}
            </a>
            <Button type="button" size="sm" variant="outline" onClick={() => void copy()}>
              <Copy className="mr-1 h-3 w-3" /> {copied ? 'Copied' : 'Copy link'}
            </Button>
          </p>
          <p className="mt-1 text-foreground/50">
            {saved.zoomHostedBy === 'user' ? 'Hosted under the Zoom account of whoever created it.' : 'Hosted under the platform’s Zoom account (the creator has no Zoom user with their CRM e-mail).'}
          </p>
          {saved.zoomHostUrl ? (
            <a href={saved.zoomHostUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-primary hover:underline">
              <ExternalLink className="h-3 w-3" /> Start as host
            </a>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" disabled={!email || invite.isPending} onClick={() => void send()}>
              <Mail className="mr-1 h-3 w-3" />
              {invite.isPending ? 'Sending…' : saved.zoomInviteSentAt ? 'Send again' : 'Send to e-mail'}
            </Button>
            <span className="text-foreground/60">
              {!email
                ? 'No e-mail on file for this candidate — add it on the candidate’s page.'
                : saved.zoomInviteSentAt
                  ? `Sent to ${saved.zoomInviteTo || email} on ${new Date(saved.zoomInviteSentAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`
                  : `Sends the date, time and link to ${email}`}
            </span>
          </div>
          {delivery ? (
            <p className={delivery.sent ? 'mt-2 font-medium text-green-700' : 'mt-2 text-red-600'} role="status">
              {delivery.sent ? `Invitation sent to ${delivery.to}` : delivery.error}
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="mb-2 text-xs font-medium text-foreground/70">{url ? 'Make another meeting' : 'New meeting'}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2 flex flex-col gap-1">
          <Label htmlFor="zoom-slot">Date &amp; time</Label>
          <Input id="zoom-slot" type="datetime-local" value={slot} onChange={(e) => setSlot(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="zoom-duration">Duration</Label>
          <Select id="zoom-duration" value={duration} onChange={(e) => setDuration(e.target.value)}>
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d} min
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Send to</Label>
          <p className="truncate rounded-md border border-border bg-accent/30 px-2 py-2 text-xs" title={email ?? ''}>
            {email ?? 'No e-mail on file'}
          </p>
        </div>
        <div className="col-span-2 flex flex-col gap-1 sm:col-span-4">
          <Label htmlFor="zoom-message">Message in the invitation (optional)</Label>
          <Textarea
            id="zoom-message"
            rows={2}
            className="min-h-0"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Who they will meet, what to prepare…"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-foreground/70">
          <input type="checkbox" checked={sendNow && Boolean(email)} disabled={!email} onChange={(e) => setSendNow(e.target.checked)} />
          E-mail the invitation as soon as the link is made
        </label>
        <Button type="button" onClick={() => void submit()} disabled={!slot || !zoomAuto || create.isPending}>
          {create.isPending ? 'Creating…' : 'Create Zoom link'}
        </Button>
      </div>

      {error ? (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
