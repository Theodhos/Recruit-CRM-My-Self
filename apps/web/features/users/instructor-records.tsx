'use client';

import type { User } from '@crm/types';
import { Badge, Card, CardContent, Input } from '@crm/ui';
import { Briefcase, Building2, ChevronRight, Search, Users, type AppIcon } from '@crm/ui/icons';
import Link from 'next/link';
import { useState } from 'react';

import { useCandidates } from '@/hooks/use-candidates';
import { useCompanies } from '@/hooks/use-companies';
import { useJobs } from '@/hooks/use-jobs';

type TabKey = 'companies' | 'jobs' | 'candidates';
interface Row {
  id: string;
  href: string;
  name: string;
  detail: string;
  tag?: string;
}

const TABS: { key: TabKey; label: string; icon: AppIcon; tone: string }[] = [
  { key: 'companies', label: 'Companies', icon: Building2, tone: 'bg-accent text-foreground/70' },
  { key: 'jobs', label: 'Jobs', icon: Briefcase, tone: 'bg-accent text-foreground/70' },
  { key: 'candidates', label: 'Candidates', icon: Users, tone: 'bg-accent text-foreground/70' },
];

/**
 * On the admin's page of one instructor: everything that instructor added, in one card — Companies, Jobs and
 * Candidates as tabs with their counts, a search box, and a list of fixed height that scrolls inside.
 */
export function InstructorRecords({ user }: { user: User }) {
  const { data: companies, isLoading: loadingCompanies } = useCompanies({ ownerId: user.id, pageSize: 100 });
  const { data: candidates, isLoading: loadingCandidates } = useCandidates({ ownerId: user.id, pageSize: 100 });
  const { data: jobs, isLoading: loadingJobs } = useJobs({ ownerId: user.id, pageSize: 100 });
  const [tab, setTab] = useState<TabKey>('companies');
  const [search, setSearch] = useState('');

  const lists: Record<TabKey, { total: number; loading: boolean; rows: Row[]; empty: string }> = {
    companies: {
      total: companies?.totalItems ?? 0,
      loading: loadingCompanies,
      empty: `${user.firstName} has not added a company yet.`,
      rows: (companies?.items ?? []).map((c) => ({ id: c.id, href: `/companies/${c.id}`, name: c.name, detail: [c.industry, c.city].filter(Boolean).join(' · ') || 'No details yet' })),
    },
    jobs: {
      total: jobs?.totalItems ?? 0,
      loading: loadingJobs,
      empty: `${user.firstName} has not added a job yet.`,
      rows: (jobs?.items ?? []).map((j) => ({ id: j.id, href: `/jobs/${j.id}`, name: j.title, detail: [j.company?.name, j.location].filter(Boolean).join(' · ') || 'No company yet', tag: j.employmentType === 'PERMANENT' ? 'Permanent' : j.employmentType ? 'Temporary' : undefined })),
    },
    candidates: {
      total: candidates?.totalItems ?? 0,
      loading: loadingCandidates,
      empty: `${user.firstName} has not added a candidate yet.`,
      rows: (candidates?.items ?? []).map((c) => ({
        id: c.id,
        href: `/candidates/${c.id}`,
        name: `${c.firstName} ${c.lastName}`,
        detail: c.currentApplication ? `${c.currentApplication.jobTitle} · ${c.currentApplication.stage}` : (c.jobTitle ?? 'Not on a pipeline'),
      })),
    },
  };

  const current = lists[tab];
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const rows = current.rows.filter((row) => words.every((word) => `${row.name} ${row.detail}`.toLowerCase().includes(word)));
  const active = TABS.find((item) => item.key === tab)!;
  const ActiveIcon = active.icon;

  return (
    <Card data-testid="instructor-records" className="border-t-2 border-t-cyan-500">
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="tablist" aria-label="What this recruiter added">
          {TABS.map((item) => {
            const Icon = item.icon;
            const selected = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={selected}
                data-testid={`records-${item.key}`}
                onClick={() => {
                  setTab(item.key);
                  setSearch('');
                }}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${selected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:bg-accent/40'}`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${item.tone}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-2xl font-semibold leading-none tabular-nums">{lists[item.key].total}</span>
                  <span className="text-xs text-foreground/60">{item.label} added by {user.firstName}</span>
                </span>
              </button>
            );
          })}
        </div>

        {current.total > 5 ? (
          <div className="relative sm:max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
            <Input className="pl-8" placeholder={`Search ${active.label.toLowerCase()}…`} value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
        ) : null}

        {current.loading ? (
          <p className="py-6 text-center text-sm text-foreground/50">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent">
              <ActiveIcon className="h-5 w-5 text-foreground/50" />
            </span>
            <p className="text-sm text-foreground/60">{search ? `No ${active.label.toLowerCase()} match “${search}”.` : current.empty}</p>
          </div>
        ) : (
          <ul className="flex max-h-[28rem] flex-col divide-y divide-border overflow-y-auto rounded-xl border border-border">
            {rows.map((row) => (
              <li key={row.id}>
                <Link href={row.href} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-accent/40">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${active.tone}`}>
                    <ActiveIcon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{row.name}</span>
                    <span className="block truncate text-xs text-foreground/55">{row.detail}</span>
                  </span>
                  {row.tag ? <Badge variant="outline">{row.tag}</Badge> : null}
                  <ChevronRight className="h-4 w-4 shrink-0 text-foreground/30 group-hover:text-foreground/60" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
