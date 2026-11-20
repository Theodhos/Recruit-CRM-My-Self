'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@crm/ui';
import { ArrowUpRight, Award, Briefcase, Building2, CalendarDays, Filter, GitBranch, Handshake, Percent, TrendingUp, UserCheck, UserCog, Users } from '@crm/ui/icons';
import type { AppIcon } from '@crm/ui/icons';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { isAdminSession } from '@/components/navigation';
import { PageBanner } from '@/components/tables/page-banner';
import type { UserComparisonRow } from '@/features/analytics';
import { WebsiteApplicationsButton } from '@/features/applications';
import { useAnalyticsOverview } from '@/hooks/use-analytics-overview';
import { usePlacements } from '@/hooks/use-placements';
import { useReportsOverview } from '@/hooks/use-reports-overview';
import { useSession } from '@/hooks/use-session';
import { useUsers, useUsersWorkload } from '@/hooks/use-users';

// The charts (recharts) only render after the overview data below has loaded,
// never on the first render, so they are split out of this route's entry chunk.
// The chunk is requested as soon as this route loads (see the import() below),
// so it downloads in parallel with the analytics requests rather than after.
const TrendLineChart = dynamic(() => import('@/features/analytics').then((m) => m.TrendLineChart), {
  ssr: false,
});
const RankingColumnChart = dynamic(() => import('@/features/analytics').then((m) => m.RankingColumnChart), {
  ssr: false,
});
const RateRingsChart = dynamic(() => import('@/features/analytics').then((m) => m.RateRingsChart), {
  ssr: false,
});
const StageBoard = dynamic(() => import('@/features/analytics').then((m) => m.StageBoard), {
  ssr: false,
});
const UserComparison = dynamic(() => import('@/features/analytics').then((m) => m.UserComparison), {
  ssr: false,
});
if (typeof window !== 'undefined') {
  void import('@/features/analytics');
}

const cardLinkClass = 'block rounded-lg transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function ChartTitle({ icon: Icon, title, subtitle }: { icon: AppIcon; tone?: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <CardTitle className="text-base">{title}</CardTitle>
        {subtitle ? <p className="mt-0.5 text-xs text-foreground/50">{subtitle}</p> : null}
      </div>
    </div>
  );
}

/** A ring that fills as much as `value` is of `total`: the figure of a tile, seen at a glance. */
function Ring({ value, total, color, children }: { value: number; total: number; color: string; children: ReactNode }) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const share = total > 0 ? Math.min(1, Math.max(0, value / total)) : 0;
  return (
    <span className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center" aria-hidden="true">
      <svg viewBox="0 0 72 72" className="absolute inset-0 -rotate-90">
        <circle cx="36" cy="36" r={radius} fill="none" strokeWidth="7" className="stroke-accent" />
        <circle cx="36" cy="36" r={radius} fill="none" strokeWidth="7" strokeLinecap="round" stroke={color} strokeDasharray={`${share * circumference} ${circumference}`} style={{ transition: 'stroke-dasharray 600ms ease' }} />
      </svg>
      <span className="relative">{children}</span>
    </span>
  );
}

/** The picture on the right of the banner: bars growing and a few people — drawn, so it needs no image file. */
function BannerArt() {
  return (
    <svg viewBox="0 0 220 96" className="hidden h-24 w-auto shrink-0 lg:block" aria-hidden="true">
      <rect x="6" y="58" width="22" height="32" rx="5" className="fill-accent" />
      <rect x="38" y="42" width="22" height="48" rx="5" className="fill-accent" />
      <rect x="70" y="26" width="22" height="64" rx="5" className="fill-primary/80" />
      <rect x="102" y="10" width="22" height="80" rx="5" className="fill-green-500" />
      <path d="M8 52 L48 36 L80 22 L112 6" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="2 6" className="stroke-foreground/30" />
      <circle cx="112" cy="6" r="5" className="fill-green-500" />
      <g transform="translate(150 16)">
        <circle cx="16" cy="12" r="10" className="fill-primary" />
        <path d="M0 52 C0 36 32 36 32 52 L32 60 L0 60 Z" className="fill-primary" />
        <circle cx="52" cy="22" r="8" className="fill-foreground/25" />
        <path d="M38 58 C38 46 66 46 66 58 L66 62 L38 62 Z" className="fill-foreground/25" />
      </g>
    </svg>
  );
}

/** One figure of the dashboard: its ring or icon, the number, what it is, and where it opens. */
function KpiTile({ label, value, note, href, icon: Icon, color, ring }: { label: string; value: number | undefined; note?: string; href: string; icon: AppIcon; color: string; ring?: { value: number; total: number } }) {
  const shown = value === undefined ? '—' : value.toLocaleString();
  return (
    <Link href={href} className={`group ${cardLinkClass} rounded-xl`} aria-label={`Open ${label}`}>
      <Card className="h-full overflow-hidden rounded-xl border-t-2 transition-all group-hover:-translate-y-0.5 group-hover:shadow-md" style={{ borderTopColor: color }} data-testid="dashboard-number">
        <CardContent className="flex items-center gap-4 p-5">
          {ring ? (
            <Ring value={ring.value} total={ring.total} color={color}>
              <Icon className="h-5 w-5 text-foreground/70" />
            </Ring>
          ) : (
            <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-accent" aria-hidden="true">
              <Icon className="h-7 w-7 text-foreground/70" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">{label}</p>
            <p className="mt-0.5 text-3xl font-bold leading-none tabular-nums">{shown}</p>
            <p className="mt-1.5 truncate text-xs text-foreground/55">{note ?? 'in total'}</p>
          </div>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-foreground/25 transition-colors group-hover:text-foreground/70" aria-hidden="true" />
        </CardContent>
      </Card>
    </Link>
  );
}

/**
 * Deliberately short: a handful of the most decision-relevant numbers,
 * computed precisely from live data — not a dump of every chart the
 * platform can produce (that's what the raw endpoints under /reports and
 * /analytics data are for). Every number here is a live query, nothing
 * hard-coded.
 */
export default function DashboardPage() {
  const { data: analytics, isLoading: analyticsLoading } = useAnalyticsOverview();
  const { data: reports, isLoading: reportsLoading } = useReportsOverview();
  const { data: session } = useSession();
  const router = useRouter();

  const isLoading = analyticsLoading || reportsLoading;

  // Admin only: the users next to each other. Active accounts, in a fixed (alphabetical) order so a user keeps
  // their colour from one visit to the next.
  const isAdmin = isAdminSession(session);
  const { data: users } = useUsers({ page: 1, pageSize: 100 }, { enabled: isAdmin });
  const { data: workload } = useUsersWorkload({ enabled: isAdmin });
  const comparison: UserComparisonRow[] = (users?.items ?? [])
    .filter((user) => user.status !== 'DEACTIVATED')
    .map((user) => {
      const built = workload?.find((w) => w.userId === user.id);
      return {
        userId: user.id,
        name: `${user.firstName} ${user.lastName}`,
        companies: built?.companies ?? 0,
        jobs: built?.jobs ?? 0,
        candidates: built?.candidates ?? 0,
        activeEmployees: built?.activeEmployees ?? 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // The figures that are shown as plain numbers; everything else on this page is a chart.
  const { data: activeEmployees } = usePlacements({ status: 'ACTIVE', page: 1, pageSize: 1 });
  const total = (rows: { count: number }[] | undefined) => rows?.reduce((sum, row) => sum + row.count, 0);
  const summary = analytics?.summary;
  const jobsTotal = total(analytics?.jobsByStatus) ?? 0;
  const companiesTotal = total(analytics?.companiesByStatus) ?? 0;
  const activeClients = analytics?.companiesByStatus.find((row) => row.status === 'ACTIVE_CLIENT')?.count ?? 0;
  const candidatesTotal = summary?.candidateCount ?? 0;
  const onPipeline = Math.max(0, candidatesTotal - (analytics?.unassignedCandidateCount ?? 0));
  const tiles: { label: string; icon: AppIcon; value: number | undefined; note?: string; href: string; color: string; ring?: { value: number; total: number } }[] = [
    { label: 'Companies', icon: Building2, value: companiesTotal || undefined, note: analytics ? `${activeClients.toLocaleString()} active client${activeClients === 1 ? '' : 's'}` : undefined, href: '/companies', color: '#2d5a73', ring: analytics ? { value: activeClients, total: companiesTotal } : undefined },
    { label: 'Jobs', icon: Briefcase, value: jobsTotal || undefined, note: summary ? `${summary.openJobCount.toLocaleString()} open` : undefined, href: '/jobs', color: '#3f7b88', ring: summary ? { value: summary.openJobCount, total: jobsTotal } : undefined },
    { label: 'Candidates', icon: Users, value: summary?.candidateCount, note: summary ? `${onPipeline.toLocaleString()} on a pipeline` : undefined, href: '/candidates', color: '#336658', ring: summary ? { value: onPipeline, total: candidatesTotal } : undefined },
    { label: 'Active Employees', icon: UserCheck, value: activeEmployees?.totalItems, note: 'working now', href: '/applications', color: '#7a3b6e' },
    // organisation-wide, so the admin's only: a user's dashboard holds their own records and nothing else
    ...(isAdmin
      ? [
          {
            label: 'Users on the platform',
            icon: UserCog,
            value: summary?.activeUserCount,
            note: summary ? `${summary.activeEmployeeCount} instructor${summary.activeEmployeeCount === 1 ? '' : 's'} · ${summary.adminCount} admin${summary.adminCount === 1 ? '' : 's'}` : undefined,
            href: '/profile',
            color: '#3f7b88',
          },
        ]
      : []),
  ];

  const topCompaniesByConversion = reports
    ? [...reports.companyPerformance].sort((a, b) => b.conversionRate - a.conversionRate).slice(0, 5)
    : [];

  const topCompaniesByHires = reports
    ? [...reports.companyPerformance].sort((a, b) => b.placements - a.placements).slice(0, 5)
    : [];

  const topJobsByApplicants = reports ? reports.jobPerformance.slice(0, 5) : [];

  return (
    <div className="flex flex-col gap-6">
      <PageBanner
        singleRow
        tone="green"
        icon={TrendingUp}
        title={`Welcome back${session ? `, ${isAdmin ? 'Admin' : session.firstName}` : ''}`}
        description={
          <>
            <span className="flex items-center gap-1.5" suppressHydrationWarning>
              <CalendarDays className="h-3.5 w-3.5" /> {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <span className="mt-1 block">{isAdmin ? 'The whole organisation: every user’s records together.' : 'Your own records: what you added yourself.'}</span>
          </>
        }
      >
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-6 gap-y-3 lg:flex-1 lg:flex-nowrap">
          <div className="flex flex-wrap items-center justify-end gap-2 lg:flex-1" aria-label="Quick links">
            <WebsiteApplicationsButton />
            {[
              { href: '/pipeline', label: 'Pipeline Jobs', icon: GitBranch },
              { href: '/candidates', label: 'Candidates', icon: Users },
              { href: '/jobs', label: 'Jobs', icon: Briefcase },
              { href: '/pipeline-companies', label: 'Pipeline Companies', icon: Handshake },
            ].map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent">
                <Icon className="h-4 w-4 text-foreground/60" /> {label}
              </Link>
            ))}
          </div>
          <BannerArt />
        </div>
      </PageBanner>

      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${isAdmin ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
        {tiles.map((tile) => (
          <KpiTile key={tile.label} {...tile} />
        ))}
      </div>

      {isLoading || !analytics || !reports ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading the charts">
          <div className="h-72 animate-pulse rounded-xl border border-border bg-background" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="h-64 animate-pulse rounded-xl border border-border bg-background" />
            <div className="h-64 animate-pulse rounded-xl border border-border bg-background" />
          </div>
        </div>
      ) : (
        <>
          <Card className="rounded-xl border-t-2 border-t-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <ChartTitle
                icon={Filter}
                tone="var(--chart-series-1)"
                title="Pipeline funnel"
                subtitle="Every application currently moving through a recruitment process, in stage order."
              />
              <Link
                href="/candidates"
                className="whitespace-nowrap text-xs font-medium text-primary hover:underline"
              >
                {analytics.unassignedCandidateCount.toLocaleString()} unassigned →
              </Link>
            </CardHeader>
            <CardContent>
              {analytics.applicationsByPipelineStage.length > 0 ? (
                <StageBoard data={analytics.applicationsByPipelineStage} onSelect={() => router.push('/pipeline')} />
              ) : (
                <p className="py-10 text-center text-sm text-foreground/50">No applications recorded yet.</p>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="rounded-xl border-t-2 border-t-teal-500">
              <CardHeader>
                <ChartTitle icon={TrendingUp} tone="var(--chart-series-3)" title="Placements — last 6 months" subtitle="New placements month by month." />
              </CardHeader>
              <CardContent>
                <TrendLineChart data={analytics.placementsByMonth} />
              </CardContent>
            </Card>

            <Card className="rounded-xl border-t-2 border-t-indigo-500">
              <CardHeader>
                <ChartTitle icon={Percent} tone="var(--chart-series-2)" title="Top companies by placement rate" subtitle="Share of applications that became a placement." />
              </CardHeader>
              <CardContent>
                <RateRingsChart
                  data={topCompaniesByConversion.map((c) => ({ label: c.company, value: c.conversionRate }))}
                  valueLabel="Placement rate"
                  emptyMessage="No applications recorded yet."
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="rounded-xl border-t-2 border-t-sky-500">
              <CardHeader>
                <ChartTitle icon={Briefcase} tone="var(--chart-series-7)" title="Applicants by job" subtitle="How many people have applied to each open role." />
              </CardHeader>
              <CardContent>
                <RankingColumnChart
                  data={topJobsByApplicants.map((j) => ({ label: j.job, value: j.applications }))}
                  valueLabel="Applicants"
                  emptyMessage="No applications recorded yet."
                />
              </CardContent>
            </Card>

            <Card className="rounded-xl border-t-2 border-t-violet-500">
              <CardHeader>
                <ChartTitle icon={Award} tone="var(--chart-series-5)" title="Hires by company" subtitle="Placements made at each client company, all time." />
              </CardHeader>
              <CardContent>
                <RankingColumnChart
                  data={topCompaniesByHires.map((c) => ({ label: c.company, value: c.placements }))}
                  valueLabel="Hires"
                  emptyMessage="No placements recorded yet."
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {isAdmin ? (
        <Card className="rounded-xl border-t-2 border-t-cyan-500" data-testid="dashboard-user-comparison">
          <CardHeader>
            <ChartTitle
              icon={UserCog}
              tone="var(--chart-series-5)"
              title="Users compared"
              subtitle="What each user has added: companies, jobs, candidates, and the employees of theirs who are working now."
            />
          </CardHeader>
          <CardContent>
            {workload && users ? <UserComparison rows={comparison} /> : <div className="h-40 animate-pulse rounded-lg bg-accent/50" aria-busy="true" />}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
