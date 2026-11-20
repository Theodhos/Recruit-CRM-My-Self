'use client';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@crm/ui';
import { initials } from '@crm/utils';
import { ArrowLeft, Briefcase, Building2, KeyRound, Trophy, Users } from '@crm/ui/icons';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { confirmDialog } from '@/components/dialogs/confirm-dialog';
import { PageSkeleton } from '@/components/layout/page-skeleton';
import { InstructorRecords, PasswordDialog } from '@/features/users';
import { useUpdateUser, useUser, useUsersWorkload } from '@/hooks/use-users';
import { generatePassword } from '@/lib/password';
import { roleLabel } from '@/lib/role-label';
import { USER_STATUS_COLOUR } from '@/lib/status-colors';
import type { UserWorkload } from '@/services/users.service';

const EMPTY: Omit<UserWorkload, 'userId'> = { companies: 0, jobs: 0, candidates: 0, activeEmployees: 0 };

/** Each figure has the thin line of the page it counts: Companies indigo, Jobs sky, Candidates teal, Active Employees violet. */
const METRICS: { key: keyof typeof EMPTY; label: string; icon: typeof Users; line: string; href: string }[] = [
  { key: 'companies', label: 'Companies', icon: Building2, line: 'border-t-indigo-500', href: '/companies' },
  { key: 'jobs', label: 'Jobs', icon: Briefcase, line: 'border-t-sky-500', href: '/jobs' },
  { key: 'candidates', label: 'Candidates', icon: Users, line: 'border-t-teal-500', href: '/candidates' },
  { key: 'activeEmployees', label: 'Active employees', icon: Trophy, line: 'border-t-violet-500', href: '/applications' },
];

/**
 * One instructor, for the admin: their account details, the CRM categories they were given, what they have built in
 * their own account (and nothing about anyone else), and a way to set (and see, once) a new password.
 */
export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: user, isLoading } = useUser(params.id);
  const { data: workloadRows } = useUsersWorkload();
  const updateUser = useUpdateUser();
  const [shownPassword, setShownPassword] = useState<{ password: string } | null>(null);

  const workload = useMemo(() => new Map((workloadRows ?? []).map((w) => [w.userId, w])), [workloadRows]);
  const mine = (user && workload.get(user.id)) ?? EMPTY;

  async function handleResetPassword() {
    if (!user || !await confirmDialog(`Set a new password for ${user.firstName} ${user.lastName}? Their current password stops working.`)) return;
    const password = generatePassword();
    await updateUser.mutateAsync({ id: user.id, input: { password } });
    setShownPassword({ password });
  }

  if (isLoading || !user) {
    return <PageSkeleton />;
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/profile" className="inline-flex w-fit items-center gap-1 text-sm text-foreground/60 hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to users
      </Link>

      {/* the person: the same card as My Profile — the navy strip, the avatar on it, the name, the role, the e-mail */}
      <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm" data-testid="user-card">
        <div className="h-24 bg-gradient-to-r from-slate-900 to-slate-700" />
        <div className="flex flex-wrap items-end gap-4 px-6 pb-5">
          <div className="-mt-12 flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-4 border-background bg-primary text-2xl font-semibold text-primary-foreground shadow-md ring-2 ring-cyan-500">
            {initials(user.firstName, user.lastName)}
          </div>
          <div className="min-w-0 flex-1 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">
                {user.firstName} {user.lastName}
              </h2>
              <Badge variant="success">{roleLabel(user.role.name)}</Badge>
              <Badge variant={USER_STATUS_COLOUR[user.status]}>{user.status}</Badge>
            </div>
            <p className="mt-0.5 text-sm text-foreground/60">{user.email}</p>
          </div>
          <Button type="button" variant="outline" onClick={() => void handleResetPassword()}>
            <KeyRound className="mr-1.5 h-4 w-4" /> Set new password &amp; show
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {METRICS.map(({ key, label, icon: Icon, line, href }) => (
          <Link key={key} href={href} className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Open ${label}`}>
            <Card className={`h-full rounded-xl border-t-2 ${line} transition-all group-hover:-translate-y-0.5 group-hover:shadow-md`}>
              <CardContent className="flex items-center gap-4 p-5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent">
                  <Icon className="h-5 w-5 text-foreground/70" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">{label}</p>
                  <p className="mt-0.5 text-3xl font-bold leading-none tabular-nums">{mine[key].toLocaleString()}</p>
                  <p className="mt-1.5 text-xs text-foreground/50">added by {user.firstName}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <InstructorRecords user={user} />

      <Card className="border-t-2 border-t-cyan-500">
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-foreground/50">Email</dt>
              <dd className="text-sm">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-foreground/50">Role</dt>
              <dd className="text-sm">{roleLabel(user.role.name)}</dd>
            </div>
            <div>
              <dt className="text-xs text-foreground/50">Status</dt>
              <dd className="text-sm">{user.status}</dd>
            </div>
            <div>
              <dt className="text-xs text-foreground/50">Password</dt>
              <dd className="text-sm text-foreground/60">Stored encrypted — set a new one to see it once.</dd>
            </div>
            <div>
              <dt className="text-xs text-foreground/50">Account created</dt>
              <dd className="text-sm">{new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</dd>
            </div>
            <div>
              <dt className="text-xs text-foreground/50">Sees</dt>
              <dd className="text-sm">Only the records they added themselves</dd>
            </div>
          </dl>
        </CardContent>
      </Card>


      {shownPassword ? (
        <PasswordDialog
          title="New password set"
          email={user.email}
          password={shownPassword.password}
          note="Their previous password no longer works"
          onClose={() => setShownPassword(null)}
        />
      ) : null}
    </div>
  );
}
