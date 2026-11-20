'use client';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select } from '@crm/ui';
import { CheckCircle2, Loader2, MessageSquare, PhoneCall, XCircle } from '@crm/ui/icons';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';

import { useAssignUnmatched, useDialpad, useDialpadMutations, useDialpadNumbers, useUnmatched } from '@/hooks/use-communications';
import { ApiClientError } from '@/lib/api-client';

import { TemplatesManager } from './templates-manager';

const messageOf = (error: unknown, fallback: string) => (error instanceof ApiClientError ? error.message : fallback);
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

function Panel({ icon: Icon, title, description, testId, children }: { icon: typeof PhoneCall; title: string; description: string; testId: string; children: React.ReactNode }) {
  return (
    <Card data-testid={testId}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-foreground/50" /> {title}
        </CardTitle>
        <p className="mt-0.5 text-xs text-foreground/50">{description}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Settings → Dialpad: connect with the company's API key, choose the business number, check health, disconnect. */
export function DialpadSettings() {
  const { data: status, isLoading } = useDialpad();
  const { connect, setNumber, health, disconnect } = useDialpadMutations();
  const [apiKey, setApiKey] = useState('');
  const [fromNumber, setFromNumber] = useState('');
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const connected = Boolean(status?.connected);
  const { data: owned } = useDialpadNumbers(connected);

  useEffect(() => {
    if (status?.fromNumber) setFromNumber(status.fromNumber);
  }, [status?.fromNumber]);

  async function submitConnect(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const result = await connect.mutateAsync({ apiKey: apiKey.trim(), fromNumber: fromNumber.trim() || undefined });
      setApiKey('');
      setReplacing(false);
      setNotice(result.receivingError ? `Connected. Incoming texts and calls are not on: ${result.receivingError}` : 'Connected to Dialpad.');
    } catch (e) {
      setError(messageOf(e, 'Could not connect to Dialpad.'));
    }
  }

  async function run<T>(action: () => Promise<T>, success: string, fallback: string) {
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
    } catch (e) {
      setError(messageOf(e, fallback));
    }
  }

  const showForm = !connected || replacing;

  return (
    <Panel
      icon={PhoneCall}
      title="Dialpad"
      description="Recruiters call and text candidates from the CRM through the company's own Dialpad account and business number. The API key is stored encrypted on the server and is never shown again."
      testId="settings-dialpad"
    >
      {isLoading || !status ? (
        <p className="text-sm text-foreground/50">Loading…</p>
      ) : (
        <div className="flex flex-col gap-4">
          {!connected ? (
            <div className="rounded-lg border border-border bg-accent/20 p-3 text-xs text-foreground/70" data-testid="dialpad-needs">
              <p className="mb-1 font-semibold text-foreground">What you need to connect Dialpad (calls and texts)</p>
              <ol className="list-decimal space-y-0.5 pl-4">
                <li>
                  <b>The API key</b> — Dialpad admin console → Company settings → Authentication → API keys → create one (an admin-level key).
                </li>
                <li>
                  <b>The business number</b> — the company number already in Dialpad, in the form +442071234567, assigned to a Dialpad user or group.
                </li>
                <li>
                  <b>Nothing else</b> — the platform registers the link for incoming texts and calls itself. It needs the server’s public address (API_URL), which is already set up if the notice below does not appear.
                </li>
              </ol>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={connected ? 'success' : status.status === 'ERROR' ? 'destructive' : 'warning'} data-testid="dialpad-status">
              {connected ? 'Connected' : status.status === 'ERROR' ? 'Needs attention' : 'Not connected'}
            </Badge>
            {status.companyName ? <span className="text-sm">{status.companyName}</span> : null}
            {status.fromNumber ? <span className="text-sm text-foreground/70">· business number {status.fromNumber}</span> : null}
            {status.connectedAt ? <span className="text-xs text-foreground/50">· connected {when(status.connectedAt)}</span> : null}
          </div>

          {connected ? (
            <p className="text-xs text-foreground/65">
              {status.receiving
                ? `Incoming texts and calls are being received${status.lastWebhookAt ? ` (last one ${when(status.lastWebhookAt)})` : ''}.`
                : `Incoming texts and calls are not being received. ${status.receivingError ?? ''}`}
            </p>
          ) : null}

          {status.lastHealth ? (
            <ul className="flex flex-col gap-1 rounded-lg border border-border px-3 py-2 text-xs" data-testid="dialpad-health">
              {status.lastHealth.checks.map((check) => (
                <li key={check.key} className="flex items-start gap-1.5">
                  {check.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />}
                  <span>{check.message}</span>
                </li>
              ))}
              <li className="text-foreground/50">Checked {when(status.lastHealth.at)}</li>
            </ul>
          ) : null}

          {connected && !showForm ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5 sm:max-w-md">
                <Label htmlFor="dialpad-number">Business number</Label>
                <div className="flex gap-2">
                  {owned && owned.numbers.length > 0 ? (
                    <Select id="dialpad-number" value={fromNumber} onChange={(event) => setFromNumber(event.target.value)}>
                      <option value="">Choose…</option>
                      {owned.numbers.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input id="dialpad-number" value={fromNumber} onChange={(event) => setFromNumber(event.target.value)} placeholder="+442071234567" />
                  )}
                  <Button type="button" variant="outline" disabled={!fromNumber.trim() || fromNumber === status.fromNumber || setNumber.isPending} onClick={() => void run(() => setNumber.mutateAsync(fromNumber.trim()), 'Business number saved.', 'Could not save the number.')}>
                    Save
                  </Button>
                </div>
                {owned?.note ? <p className="text-xs text-foreground/55">{owned.note}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={health.isPending} onClick={() => void run(() => health.mutateAsync(), 'Health check finished.', 'The health check failed.')} data-testid="dialpad-health-check">
                  {health.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                  Check connection
                </Button>
                <Button type="button" variant="outline" onClick={() => setReplacing(true)}>
                  Reconnect with a new key
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={disconnect.isPending}
                  onClick={() => {
                    if (window.confirm('Disconnect Dialpad? Calling and texting from the CRM stop until it is connected again. The history stays.')) {
                      void run(() => disconnect.mutateAsync(), 'Dialpad disconnected.', 'Could not disconnect.');
                    }
                  }}
                  data-testid="dialpad-disconnect"
                >
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <form noValidate onSubmit={(event) => void submitConnect(event)} className="flex flex-col gap-3 sm:max-w-md">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dialpad-key">Dialpad API key</Label>
                <Input id="dialpad-key" type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Paste the key from the Dialpad admin console" data-testid="dialpad-key" />
                <p className="text-xs text-foreground/55">Dialpad admin console → Company settings → Authentication → API keys. An admin-level key also lets the CRM list and check your numbers.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dialpad-from">Business number</Label>
                <Input id="dialpad-from" value={fromNumber} onChange={(event) => setFromNumber(event.target.value)} placeholder="+442071234567" />
                <p className="text-xs text-foreground/55">The number the company already uses in Dialpad; it must be assigned to a Dialpad user or group.</p>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={apiKey.trim().length < 10 || connect.isPending} data-testid="dialpad-connect">
                  {connect.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                  {connected ? 'Reconnect' : 'Connect Dialpad'}
                </Button>
                {replacing ? (
                  <Button type="button" variant="ghost" onClick={() => setReplacing(false)}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </form>
          )}

          {!status.webhookUrlConfigured ? <p className="text-xs text-destructive">The server has no public address (API_URL) configured, so incoming texts and calls cannot be received.</p> : null}
          {notice ? (
            <p className="text-sm text-emerald-700" role="status">
              {notice}
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </Panel>
  );
}

export function TemplatesSettings() {
  return (
    <Panel icon={MessageSquare} title="Message templates" description="Reusable texts. Use {{firstName}}, {{lastName}}, {{fullName}}, {{jobTitle}} and {{recruiterName}} to personalise each message." testId="settings-templates">
      <TemplatesManager />
    </Panel>
  );
}

/** Calls and texts from numbers that match no candidate. They are kept here, not attached to anyone, until a person decides. */
export function UnmatchedSettings({ enabled }: { enabled: boolean }) {
  const { data, isLoading } = useUnmatched(enabled);
  const assign = useAssignUnmatched();
  const [target, setTarget] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  return (
    <Panel icon={PhoneCall} title="Unknown numbers" description="Incoming calls and texts from numbers that are not on any candidate. Nothing is attached to anyone until you choose." testId="settings-unmatched">
      {isLoading ? (
        <p className="text-sm text-foreground/50">Loading…</p>
      ) : data && data.length > 0 ? (
        <ul className="divide-y divide-border">
          {data.map((item) => (
            <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="font-medium tabular-nums">
                  {item.externalNumber} <span className="text-xs font-normal text-foreground/55">· {item.type === 'CALL' ? 'call' : 'text'} · {item.direction === 'INBOUND' ? 'incoming' : 'outgoing'} · {when(item.createdAt)}</span>
                </p>
                {item.body ? <p className="break-words text-xs text-foreground/70">{item.body}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                <Input className="w-56" placeholder="Candidate ID (from the profile URL)" value={target[item.id] ?? ''} onChange={(event) => setTarget((now) => ({ ...now, [item.id]: event.target.value }))} />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!target[item.id]?.trim() || assign.isPending}
                  onClick={() => {
                    setError(null);
                    assign.mutate({ id: item.id, candidateId: target[item.id]!.trim() }, { onError: (e) => setError(messageOf(e, 'Could not attach it.')) });
                  }}
                >
                  Attach
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-foreground/50">Nothing here. Every call and text so far matched a candidate (or none has come in yet).</p>
      )}
      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <p className="mt-3 text-xs text-foreground/55">
        To find a candidate’s ID, open them in{' '}
        <Link href="/candidates" className="text-primary hover:underline">
          Candidates
        </Link>{' '}
        — the ID is the last part of the page address.
      </p>
    </Panel>
  );
}
