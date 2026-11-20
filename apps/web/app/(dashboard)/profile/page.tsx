'use client';

import { PageSkeleton } from '@/components/layout/page-skeleton';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@crm/ui';
import { initials } from '@crm/utils';
import { BadgeCheck, KeyRound, Mail, Pencil, ShieldCheck, UserCircle } from '@crm/ui/icons';
import { useState, type FormEvent } from 'react';

import { isAdminSession } from '@/components/navigation';
import { UsersDirectory } from '@/features/users';
import { useInvalidateSession, useSession } from '@/hooks/use-session';
import { ApiClientError } from '@/lib/api-client';
import { roleLabel } from '@/lib/role-label';
import { roleColour } from '@/lib/status-colors';
import { requestMyPasswordReset, updateMyAccount, type PasswordResetRequest } from '@/services/auth.service';

/**
 * The signed-in person's own account: who they are and their role (the badge next to the name). For the admin it is
 * also where the organisation's users are: every account, "Add Instructor", edit, password and deactivate
 * (UsersDirectory). Members see their own account only.
 */
export default function ProfilePage() {
  const { data: session, isLoading } = useSession();
  const [reset, setReset] = useState<PasswordResetRequest | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  // the personal details, changed here by the person themself
  const invalidateSession = useInvalidateSession();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsSaved, setDetailsSaved] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  function startEditing() {
    setFirstName(session?.firstName ?? '');
    setLastName(session?.lastName ?? '');
    setDetailsError(null);
    setDetailsSaved(false);
    setEditing(true);
  }

  async function saveDetails(event: FormEvent) {
    event.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return setDetailsError('First name and last name are both needed.');
    setSavingDetails(true);
    setDetailsError(null);
    try {
      await updateMyAccount({ firstName: firstName.trim(), lastName: lastName.trim() });
      await invalidateSession();
      setEditing(false);
      setDetailsSaved(true);
    } catch (e) {
      setDetailsError(e instanceof ApiClientError ? e.message : 'Could not save your details. Please try again.');
    } finally {
      setSavingDetails(false);
    }
  }

  async function sendReset() {
    setResetting(true);
    setResetError(null);
    try {
      setReset(await requestMyPasswordReset());
    } catch (e) {
      setResetError(e instanceof ApiClientError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setResetting(false);
    }
  }

  if (isLoading || !session) {
    return <PageSkeleton />;
  }
  const isAdmin = isAdminSession(session);

  return (
    <div className="flex flex-col gap-6">
      {/* the person: a coloured strip, the avatar sitting on it, the name, the role and the e-mail */}
      <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm" data-testid="profile-card">
        <div className="h-24 bg-gradient-to-r from-slate-900 to-slate-700" />
        <div className="flex flex-wrap items-end gap-4 px-6 pb-5">
          <div className="-mt-12 flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-4 border-background bg-primary text-2xl font-semibold text-primary-foreground shadow-md ring-2 ring-cyan-500">
            {initials(session.firstName, session.lastName)}
          </div>
          <div className="min-w-0 flex-1 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">
                {session.firstName} {session.lastName}
              </h2>
              <Badge variant={roleColour(session.role.name)}>{roleLabel(session.role.name)}</Badge>
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-foreground/60">
              <Mail className="h-3.5 w-3.5" /> {session.email}
            </p>
          </div>
        </div>
        <p className="border-t border-border bg-accent/30 px-6 py-3 text-sm text-foreground/60">
          {isAdmin
            ? 'Your admin account. You see everything in the organisation and manage its users below.'
            : 'Your instructor account. You see and manage the candidates, companies and jobs you add yourself.'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-t-2 border-t-cyan-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2.5 text-base">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-foreground/70">
                <UserCircle className="h-4 w-4" />
              </span>
              Personal details
            </CardTitle>
            {editing ? null : (
              <Button type="button" variant="outline" size="sm" onClick={startEditing} data-testid="profile-edit">
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {detailsSaved && !editing ? (
              <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">
                Your details were saved.
              </p>
            ) : null}
            {editing ? (
              <form noValidate onSubmit={(event) => void saveDetails(event)} className="mb-5 flex flex-col gap-4 rounded-lg border border-border bg-accent/20 p-4" data-testid="profile-edit-form">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="profile-first-name">First name</Label>
                    <Input id="profile-first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} autoFocus />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="profile-last-name">Last name</Label>
                    <Input id="profile-last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label htmlFor="profile-email">Email (you sign in with it)</Label>
                    <Input id="profile-email" value={session.email} disabled readOnly />
                    <p className="text-xs text-foreground/50">The e-mail, the role and the status are changed by the administrator.</p>
                  </div>
                </div>
                {detailsError ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{detailsError}</p> : null}
                <div className="flex gap-2">
                  <Button type="submit" disabled={savingDetails}>
                    {savingDetails ? 'Saving…' : 'Save'}
                  </Button>
                  <Button type="button" variant="ghost" disabled={savingDetails} onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : null}
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-foreground/50">First name</dt>
                <dd className="mt-0.5 text-sm font-medium">{session.firstName}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-foreground/50">Last name</dt>
                <dd className="mt-0.5 text-sm font-medium">{session.lastName}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-foreground/50">Email</dt>
                <dd className="mt-0.5 text-sm font-medium">{session.email}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-foreground/50">Role</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-medium">
                  <ShieldCheck className="h-4 w-4 text-foreground/60" /> {roleLabel(session.role.name)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-foreground/50">Status</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-medium">
                  <BadgeCheck className="h-4 w-4 text-foreground/60" /> {session.status}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card data-testid="profile-password" className="border-t-2 border-t-cyan-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-base">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-foreground/70">
                <KeyRound className="h-4 w-4" />
              </span>
              Password
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-foreground/60">
              Forgot it, or want a new one? We e-mail a link to {session.email} where you choose a new password. The link works once and expires in
              30 minutes.
            </p>
            {reset ? (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">
                The link is on its way to {session.email}.
                {reset.devLink ? (
                  <span className="mt-2 block rounded-md border border-amber-400 bg-amber-50 p-2 text-xs text-amber-950">
                    E-mail is not set up on this server, so nothing was sent. Development link:{' '}
                    <a href={reset.devLink} className="break-all font-medium underline" data-testid="dev-reset-link">
                      {reset.devLink}
                    </a>
                  </span>
                ) : null}
              </p>
            ) : null}
            {resetError ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{resetError}</p> : null}
            <div>
              <Button type="button" disabled={resetting} onClick={() => void sendReset()}>
                {resetting ? 'Sending…' : reset ? 'Send the link again' : 'Send password reset e-mail'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {isAdmin ? (
        <section className="flex flex-col gap-4 border-t border-border pt-6" data-testid="profile-users">
          <UsersDirectory />
        </section>
      ) : null}
    </div>
  );
}
