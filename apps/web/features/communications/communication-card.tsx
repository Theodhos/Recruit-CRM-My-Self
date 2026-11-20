'use client';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog } from '@crm/ui';
import { ArrowDownLeft, ArrowUpRight, Loader2, MessageCircle, MessageSquare, Phone, PhoneCall } from '@crm/ui/icons';
import Link from 'next/link';
import { useState } from 'react';

import { useCandidateCommunications, useCommunicationStatus, useSendSms } from '@/hooks/use-communications';
import { useSession } from '@/hooks/use-session';
import { ApiClientError } from '@/lib/api-client';
import type { Communication, CommunicationStatusValue } from '@/services/communications.service';

import { renderPreview, SmsComposer } from './sms-composer';
import { whatsappLink } from './whatsapp';

const STATUS: Record<CommunicationStatusValue, { label: string; variant: 'success' | 'warning' | 'destructive' | 'slate' | 'sky' | 'outline' }> = {
  QUEUED: { label: 'Queued', variant: 'slate' },
  SENDING: { label: 'Sending', variant: 'slate' },
  SENT: { label: 'Sent', variant: 'sky' },
  DELIVERED: { label: 'Delivered', variant: 'success' },
  UNDELIVERED: { label: 'Not delivered', variant: 'destructive' },
  FAILED: { label: 'Failed', variant: 'destructive' },
  RECEIVED: { label: 'Received', variant: 'success' },
  RINGING: { label: 'Ringing', variant: 'sky' },
  CONNECTED: { label: 'In progress', variant: 'sky' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  MISSED: { label: 'Missed', variant: 'warning' },
  NO_ANSWER: { label: 'No answer', variant: 'warning' },
};

const dateTime = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const messageOf = (error: unknown, fallback: string) => (error instanceof ApiClientError ? error.message : fallback);

function minutes(seconds: number) {
  const m = Math.floor(seconds / 60);
  return m > 0 ? `${m} min ${seconds % 60} s` : `${seconds} s`;
}

function HistoryRow({ item }: { item: Communication }) {
  const status = STATUS[item.status];
  const Icon = item.type === 'CALL' ? Phone : MessageSquare;
  const who = item.user ? `${item.user.firstName} ${item.user.lastName}` : item.direction === 'INBOUND' ? 'Incoming' : 'Dialpad';
  return (
    <li className="flex gap-3 py-3" data-testid="communication-row">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-foreground/70">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1 font-medium">
            {item.direction === 'INBOUND' ? <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600" /> : <ArrowUpRight className="h-3.5 w-3.5 text-sky-600" />}
            {item.type === 'CALL' ? (item.direction === 'INBOUND' ? 'Incoming call' : 'Outgoing call') : item.direction === 'INBOUND' ? 'Text received' : 'Text sent'}
          </span>
          <Badge variant={status.variant}>{status.label}</Badge>
          {item.durationSeconds ? <span className="text-xs text-foreground/60">{minutes(item.durationSeconds)}</span> : null}
          {item.batchId ? <Badge variant="outline">Bulk</Badge> : null}
        </div>
        {item.type === 'SMS' ? (
          item.body ? (
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground/85">{item.body}</p>
          ) : (
            <p className="mt-1 text-xs italic text-foreground/50">The text of this message is not available from Dialpad.</p>
          )
        ) : null}
        {item.errorMessage ? <p className="mt-1 text-xs text-destructive">{item.errorMessage}</p> : null}
        <p className="mt-1 text-xs text-foreground/55">
          {dateTime(item.createdAt)} · {who}
          {item.fromNumber && item.direction === 'OUTBOUND' ? ` · from ${item.fromNumber}` : ''}
        </p>
      </div>
    </li>
  );
}

function SmsDialog({ candidateId, firstName, lastName, onClose }: { candidateId: string; firstName: string; lastName: string; onClose: () => void }) {
  const { data: session } = useSession();
  const send = useSendSms(candidateId);
  const [text, setText] = useState('');
  const [jobId, setJobId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const preview = renderPreview(text, { firstName, lastName, fullName: `${firstName} ${lastName}`, recruiterName: session ? `${session.firstName} ${session.lastName}` : undefined });

  async function run() {
    setError(null);
    try {
      await send.mutateAsync({ text, jobId: jobId || undefined });
      setSent(true);
    } catch (e) {
      setError(messageOf(e, 'The message was not sent.'));
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Text ${firstName} ${lastName}`}
      description="Sent from the company's Dialpad business number. The reply arrives in the history below."
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            {sent ? 'Close' : 'Cancel'}
          </Button>
          {!sent ? (
            <Button type="button" disabled={send.isPending || !text.trim()} onClick={() => void run()} data-testid="sms-send">
              {send.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-1.5 h-4 w-4" />}
              Send text
            </Button>
          ) : null}
        </>
      }
    >
      {sent ? (
        <p className="text-sm text-emerald-700" role="status">
          Sent through Dialpad. Its delivery status will update in the history.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <SmsComposer idPrefix="single" text={text} onText={setText} jobId={jobId} onJobId={setJobId} />
          {text.trim() ? (
            <div className="rounded-lg border border-border bg-accent/20 px-3 py-2 text-sm">
              <p className="mb-1 text-xs font-medium text-foreground/60">Preview</p>
              <p className="whitespace-pre-wrap break-words">{preview}</p>
            </div>
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

/**
 * Communication on the candidate's profile: write on WhatsApp, text through the company's Dialpad, and every call and text
 * with this person — who handled it, when, and how it ended.
 */
export function CommunicationCard({ candidateId, firstName, lastName, phone }: { candidateId: string; firstName: string; lastName: string; phone: string | null }) {
  const { data: session } = useSession();
  const { data: status } = useCommunicationStatus();
  const { data: history, isLoading } = useCandidateCommunications(candidateId);
  const [smsOpen, setSmsOpen] = useState(false);

  const canSend = Boolean(session?.permissions?.includes('communication:send'));
  const connected = Boolean(status?.connected);
  const disabledReason = !canSend ? 'Your account may not text candidates.' : !connected ? 'Dialpad is not connected yet.' : !phone ? 'This candidate has no phone number.' : undefined;
  // writing on WhatsApp: opens the chat with the candidate's number (no voice calls from the CRM for now)
  const whatsapp = whatsappLink(phone);
  const whatsappReason = !canSend ? 'Your account may not message candidates.' : !phone ? 'This candidate has no phone number.' : !whatsapp ? 'This phone number cannot be opened in WhatsApp.' : undefined;

  return (
    <Card id="communication" className="scroll-mt-20" data-testid="candidate-communication">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <PhoneCall className="h-4 w-4 text-foreground/50" /> Communication
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={Boolean(whatsappReason)}
            title={whatsappReason ?? 'Open a WhatsApp chat with this candidate'}
            onClick={() => whatsapp && window.open(whatsapp, '_blank', 'noopener,noreferrer')}
            data-testid="candidate-whatsapp"
          >
            <MessageCircle className="mr-1.5 h-4 w-4" />
            WhatsApp
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={Boolean(disabledReason)} title={disabledReason} onClick={() => setSmsOpen(true)} data-testid="candidate-text">
            <MessageSquare className="mr-1.5 h-4 w-4" />
            Text
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {status && !connected ? (
          <p className="mb-3 rounded-lg border border-border bg-accent/20 px-3 py-2 text-xs text-foreground/70">
            Dialpad is not connected, so calls and texts are off. An administrator can connect it in{' '}
            <Link href="/settings" className="font-medium text-primary hover:underline">
              Settings → Integrations
            </Link>
            .
          </p>
        ) : status?.fromNumber ? (
          <p className="mb-2 text-xs text-foreground/55">Texts use the company number {status.fromNumber}. WhatsApp opens the chat in WhatsApp.</p>
        ) : null}
        {isLoading ? (
          <p className="text-sm text-foreground/50">Loading…</p>
        ) : history && history.length > 0 ? (
          <ul className="divide-y divide-border">
            {history.map((item) => (
              <HistoryRow key={item.id} item={item} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-foreground/50">No calls or texts with {firstName} yet.</p>
        )}
      </CardContent>
      {smsOpen ? <SmsDialog candidateId={candidateId} firstName={firstName} lastName={lastName} onClose={() => setSmsOpen(false)} /> : null}
    </Card>
  );
}
