'use client';

import { PageSkeleton } from '@/components/layout/page-skeleton';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@crm/ui';
import { BookOpen, Building2, KeyRound, Phone, Settings, UserCircle, type AppIcon } from '@crm/ui/icons';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

import { isAdminSession } from '@/components/navigation';
import { PageBanner } from '@/components/tables/page-banner';
import { DialpadSettings } from '@/features/communications';
import { StorageConnection, ZoomConnection } from '@/features/connections/connection-forms';
import { UserManual } from '@/features/manual';
import { formatDate } from '@/features/revenue';
import { useOrganisation, useUpdateOrganisation } from '@/hooks/use-organisation';
import { useInvalidateSession, useSession } from '@/hooks/use-session';
import { ApiClientError } from '@/lib/api-client';
import { requestMyPasswordReset, updateMyAccount, type PasswordResetRequest } from '@/services/auth.service';

const messageOf = (error: unknown, fallback: string) => (error instanceof ApiClientError ? error.message : fallback);

/** The cards of Settings are neutral: one thin line on top, the icon in the light grey of the CRM. */
function Section({ icon: Icon, title, description, testId, children }: { icon: typeof UserCircle; title: string; description: string; testId: string; children: ReactNode }) {
  return (
    <Card data-testid={testId} className="border-t-2 border-t-slate-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-base">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-foreground/70">
            <Icon className="h-4 w-4" />
          </span>
          {title}
        </CardTitle>
        <p className="mt-1 text-xs text-foreground/50">{description}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Feedback({ saved, error }: { saved: boolean; error: string | null }) {
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  return saved ? (
    <p className="text-sm text-emerald-700" role="status">
      Saved.
    </p>
  ) : null;
}

/** The signed-in user's own name. The e-mail is what they sign in with: the admin changes it, under My Profile. */
function AccountSection() {
  const { data: session } = useSession();
  const invalidateSession = useInvalidateSession();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    setFirstName(session.firstName);
    setLastName(session.lastName);
  }, [session]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return setError('First and last name are both needed.');
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await updateMyAccount({ firstName: firstName.trim(), lastName: lastName.trim() });
      await invalidateSession();
      setSaved(true);
    } catch (e) {
      setError(messageOf(e, 'Could not save your account.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section icon={UserCircle} title="My account" description="Your own name, as the rest of the team sees it." testId="settings-account">
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="account-first-name">First name</Label>
            <Input id="account-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="account-last-name">Last name</Label>
            <Input id="account-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="account-email">E-mail (sign-in)</Label>
            <Input id="account-email" value={session?.email ?? ''} disabled readOnly />
          </div>
        </div>
        <Feedback saved={saved} error={error} />
        <div>
          <Button type="submit" disabled={saving || !session}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Section>
  );
}

function PasswordSection() {
  const { data: session } = useSession();
  const [sent, setSent] = useState<PasswordResetRequest | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendLink() {
    setSending(true);
    setError(null);
    try {
      setSent(await requestMyPasswordReset());
    } catch (e) {
      setError(messageOf(e, 'Could not send the e-mail. Please try again.'));
    } finally {
      setSending(false);
    }
  }

  return (
    <Section
      icon={KeyRound}
      title="Change password"
      description="A link is e-mailed to you; the password is chosen on the page it opens. Only the owner of the e-mail address can change it."
      testId="settings-password"
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-foreground/60">
          The link goes to {session?.email ?? 'your e-mail address'}. It works once and expires in 30 minutes.
        </p>
        {sent ? (
          <p className="text-sm" role="status">
            The link is on its way to {session?.email}. Open it from that inbox to choose the new password.
            {sent.devLink ? (
              <span className="mt-2 block rounded-md border border-amber-400 bg-amber-50 p-2 text-xs text-amber-950">
                E-mail is not set up on this server, so nothing was sent. Development link:{' '}
                <a href={sent.devLink} className="break-all font-medium underline" data-testid="dev-reset-link">
                  {sent.devLink}
                </a>
              </span>
            ) : null}
          </p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div>
          <Button type="button" disabled={sending || !session} onClick={() => void sendLink()}>
            {sending ? 'Sending…' : sent ? 'Send the link again' : 'Change password'}
          </Button>
        </div>
      </div>
    </Section>
  );
}

function OrganisationSection() {
  const { data: organisation } = useOrganisation();
  const update = useUpdateOrganisation();
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (organisation) setName(organisation.name);
  }, [organisation]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2) return setError('The name needs at least 2 characters.');
    setSaved(false);
    setError(null);
    try {
      await update.mutateAsync({ name: name.trim() });
      setSaved(true);
    } catch (e) {
      setError(messageOf(e, 'Could not save the organisation.'));
    }
  }

  return (
    <Section icon={Building2} title="Organisation" description="The agency this platform belongs to." testId="settings-organisation">
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="organisation-name">Name</Label>
            <Input id="organisation-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="organisation-slug">Identifier</Label>
            <Input id="organisation-slug" value={organisation?.slug ?? ''} disabled readOnly />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="organisation-created">On the platform since</Label>
            <Input id="organisation-created" value={organisation ? formatDate(organisation.createdAt) : ''} disabled readOnly />
          </div>
        </div>
        <Feedback saved={saved} error={error} />
        <div>
          <Button type="submit" disabled={update.isPending || !organisation}>
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Section>
  );
}

type ConnectionKey = 'dialpad' | 'zoom' | 'storage';
const CONNECTIONS: { key: ConnectionKey; label: string }[] = [
  { key: 'dialpad', label: 'Dialpad' },
  { key: 'zoom', label: 'Zoom' },
  { key: 'storage', label: 'File storage' },
];

/** Connections & API: a filter on top switches between the three connections; only the chosen one is shown. */
function ConnectionsTab({ dialpadOnly }: { dialpadOnly?: boolean }) {
  const [connection, setConnection] = useState<ConnectionKey>('dialpad');
  // a recruiter's Connections & API is only Dialpad: no list of connections to choose from
  if (dialpadOnly) return <DialpadSettings />;
  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-lg border border-border bg-accent/30 p-1" role="tablist" aria-label="Connection">
        {CONNECTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={connection === item.key}
            onClick={() => setConnection(item.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${connection === item.key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground/70 hover:bg-accent'}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {connection === 'dialpad' ? <DialpadSettings /> : null}
      {connection === 'zoom' ? <ZoomConnection /> : null}
      {connection === 'storage' ? <StorageConnection /> : null}
    </div>
  );
}

type TabKey = 'account' | 'organisation' | 'connections' | 'manual';
/** `adminOnly`: only the administrator has it. `connections` is for everyone — an administrator sees every connection, a recruiter only Dialpad. */
const TABS: { key: TabKey; label: string; hint: string; icon: AppIcon; adminOnly: boolean }[] = [
  { key: 'account', label: 'My account', hint: 'Your name and password', icon: UserCircle, adminOnly: true },
  { key: 'organisation', label: 'Organisation', hint: 'The agency and its details', icon: Building2, adminOnly: true },
  { key: 'connections', label: 'Connections & API', hint: 'Dialpad calls and texts, and every other API key', icon: Phone, adminOnly: false },
  { key: 'manual', label: 'Manual përdorimi', hint: 'Si funksionon çdo seksion, me video', icon: BookOpen, adminOnly: false },
];

/**
 * Settings, in three tabs: My account (everyone), and for the admin the Organisation and Connections & API — Dialpad
 * (calls and texts) with the other connections that need an API key. The open tab is kept in the address (#connections).
 */
export default function SettingsPage() {
  const { data: session, isLoading } = useSession();
  const [tab, setTab] = useState<TabKey | null>(null);

  useEffect(() => {
    const fromAddress = window.location.hash.replace('#', '') as TabKey;
    if (TABS.some((item) => item.key === fromAddress)) setTab(fromAddress);
  }, []);

  if (isLoading || !session) return <PageSkeleton />;
  const isAdmin = isAdminSession(session);
  const tabs = TABS.filter((item) => isAdmin || !item.adminOnly);
  // the first section of the person: the account for the administrator, Connections & API (Dialpad) for a recruiter
  const open = tab && tabs.some((item) => item.key === tab) ? tab : tabs[0]!.key;

  return (
    <div className="flex flex-col gap-6">
      <PageBanner
        tone="slate"
        icon={Settings}
        title="Settings"
        description={isAdmin ? 'Your account, the organisation, and the connections the platform needs.' : 'Your Dialpad connection, and the user manual.'}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        {tabs.length > 1 ? (
          <nav className="flex gap-2 overflow-x-auto lg:sticky lg:top-4 lg:flex-col lg:self-start lg:overflow-visible" role="tablist" aria-label="Settings sections">
            {tabs.map((item) => {
              const Icon = item.icon;
              const active = open === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setTab(item.key);
                    window.history.replaceState(null, '', `#${item.key}`);
                  }}
                  className={`flex shrink-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors lg:w-full ${active ? 'border-primary/40 bg-accent/50 shadow-sm' : 'border-border bg-background hover:bg-accent/40'}`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-primary text-primary-foreground' : 'bg-accent text-foreground/60'}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block whitespace-nowrap text-sm font-semibold">{item.label}</span>
                    <span className="hidden text-xs text-foreground/50 lg:block">{item.hint}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        ) : null}

        <div className="flex min-w-0 flex-col gap-6">
          {open === 'account' ? (
            <>
              <AccountSection />
              <PasswordSection />
            </>
          ) : null}
          {open === 'organisation' ? <OrganisationSection /> : null}
          {open === 'connections' ? <ConnectionsTab dialpadOnly={!isAdmin} /> : null}
          {open === 'manual' ? <UserManual /> : null}
        </div>
      </div>
    </div>
  );
}
