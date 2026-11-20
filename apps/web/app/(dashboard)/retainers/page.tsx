'use client';

import { TABLE_TONES } from '@/components/tables/data-table';
import { Wallet as BannerIcon } from '@crm/ui/icons';
import { PageBanner } from '@/components/tables/page-banner';
import { Badge, Button } from '@crm/ui';
import { CalendarClock, CheckCircle2, ClipboardList, Handshake, Hourglass, ListChecks, Pencil, Plus, Receipt, RefreshCw, Table2, Trash2, TrendingUp, Undo2, X } from '@crm/ui/icons';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { confirmDialog } from '@/components/dialogs/confirm-dialog';
import { RETAINER_STATUS_LABEL, RenewRetainerDialog, RetainerFormDialog, RevenueTile, formatDate, formatMoney, moneyLines } from '@/features/revenue';
import { TodoGroup, TodoRow } from '@/features/revenue/todo-list';
import { useOrganisation } from '@/hooks/use-organisation';
import { useCreateRetainer, useDeleteRetainer, useRenewRetainer, useRetainers, useRetainersOverview, useUpdateRetainer } from '@/hooks/use-retainers';
import { ApiClientError } from '@/lib/api-client';
import { RETAINER_STATUS_COLOUR } from '@/lib/status-colors';
import type { Retainer, RetainerInput, RetainerStatus } from '@/services/retainers.service';

const STATUS_BADGE = RETAINER_STATUS_COLOUR;

/** The filter pills above the table. */
const FILTERS: { value: RetainerStatus | ''; label: string; hint: string }[] = [
  { value: '', label: 'All', hint: 'Every retainer' },
  { value: 'ACTIVE', label: 'Active', hint: 'The agreement is running' },
  { value: 'EXPIRED', label: 'Expired', hint: 'The end date has passed: renew it or close it' },
  { value: 'CANCELLED', label: 'Cancelled', hint: 'Cancelled agreements' },
];

/** The two sections of the page: what is waiting for you, and every retainer. The open one is kept in the address (#todo, #all). */
const SECTIONS = [
  { key: 'todo', label: 'To do', hint: 'What is waiting for you, in the order to do it', icon: ListChecks },
  { key: 'all', label: 'All retainers', hint: 'Every retainer, with filters', icon: Table2 },
] as const;
type Section = (typeof SECTIONS)[number]['key'];

const endsText = (retainer: Retainer) =>
  retainer.endDate === null ? 'open-ended' : retainer.daysLeft === null ? '' : retainer.daysLeft < 0 ? `ended ${-retainer.daysLeft} day${retainer.daysLeft === -1 ? '' : 's'} ago` : retainer.daysLeft === 0 ? 'ends today' : `ends in ${retainer.daysLeft} day${retainer.daysLeft === 1 ? '' : 's'}`;

/**
 * Retainers: the standing agreement with a client company — what it pays every month so the agency keeps recruiting
 * for it. It is the money side of a company that was won (Pipeline Companies → Win), next to the fees charged per
 * person placed there (the Fees page). The page has two sections: To do (set up a retainer for won clients, renew the
 * ones about to end, deal with the expired) and All retainers.
 */
export default function RetainersPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<RetainerStatus | ''>('');
  const [form, setForm] = useState<{ retainer?: Retainer; company?: { id: string; name: string } } | null>(null);
  const [renewing, setRenewing] = useState<Retainer | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string; undo?: () => void } | null>(null);
  const [section, setSection] = useState<Section>('todo');
  const [sectionChosen, setSectionChosen] = useState(false);
  useEffect(() => {
    const fromAddress = window.location.hash.replace('#', '') as Section;
    if (SECTIONS.some((item) => item.key === fromAddress)) {
      setSection(fromAddress);
      setSectionChosen(true);
    }
  }, []);
  function openSection(next: Section) {
    setSection(next);
    setSectionChosen(true);
    window.history.replaceState(null, '', `#${next}`);
  }

  const { data: overview } = useRetainersOverview();
  const { data, isLoading } = useRetainers({ page, pageSize: 25, status: status || undefined });
  // the To do lists: the running ones (the ones about to end are picked from them) and the expired ones
  const { data: running } = useRetainers({ page: 1, pageSize: 100, status: 'ACTIVE' });
  const { data: expired } = useRetainers({ page: 1, pageSize: 50, status: 'EXPIRED' });
  const { data: organisation } = useOrganisation();
  const createRetainer = useCreateRetainer();
  const updateRetainer = useUpdateRetainer();
  const renewRetainer = useRenewRetainer();
  const deleteRetainer = useDeleteRetainer();

  const currency = organisation?.payDefaults.currency ?? 'GBP';

  // a message goes away by itself
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), notice.tone === 'error' ? 12_000 : 8_000);
    return () => clearTimeout(timer);
  }, [notice]);

  function filterBy(next: RetainerStatus | '') {
    setStatus(next);
    setPage(1);
  }

  function handleSubmit(input: RetainerInput) {
    return form?.retainer ? updateRetainer.mutateAsync({ id: form.retainer.id, input }) : createRetainer.mutateAsync(input);
  }

  async function handleCancel(retainer: Retainer) {
    if (!(await confirmDialog(`Cancel the retainer with ${retainer.company.name}? It stays in the list as cancelled.`))) return;
    try {
      await updateRetainer.mutateAsync({ id: retainer.id, input: { status: 'CANCELLED' } });
      setNotice({
        tone: 'ok',
        text: `The retainer with ${retainer.company.name} is cancelled.`,
        undo: () => {
          void updateRetainer
            .mutateAsync({ id: retainer.id, input: { status: 'ACTIVE' } })
            .then(() => setNotice({ tone: 'ok', text: 'Put back as it was.' }))
            .catch((error) => setNotice({ tone: 'error', text: error instanceof ApiClientError ? error.message : 'Could not undo.' }));
        },
      });
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof ApiClientError ? error.message : 'Could not cancel the retainer. Please try again.' });
    }
  }

  async function handleDelete(retainer: Retainer) {
    if (await confirmDialog(`Delete the retainer with ${retainer.company.name} and its renewals? This cannot be undone.`)) {
      deleteRetainer.mutate(retainer.id, { onSuccess: () => setNotice({ tone: 'ok', text: 'The retainer was deleted.' }) });
    }
  }

  const retainers = data?.items ?? [];
  const withoutRetainer = overview?.withoutRetainer ?? [];
  const endingSoon = (running?.items ?? []).filter((retainer) => retainer.endsSoon).sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
  const expiredItems = expired?.items ?? [];
  const todoCount = withoutRetainer.length + endingSoon.length + expiredItems.length;
  const loadedTodo = Boolean(overview && running && expired);
  // nothing was chosen yet: open To do when there is something to do, otherwise the list
  const shown: Section = sectionChosen ? section : loadedTodo && todoCount === 0 ? 'all' : section;
  const filtered = Boolean(status);

  const renewAction = (retainer: Retainer) => (
    <span className="flex items-center gap-1.5">
      <Button type="button" size="sm" onClick={() => setRenewing(retainer)}>
        <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Renew
      </Button>
      <Button type="button" size="sm" variant="ghost" aria-label="Edit retainer" title="Edit the retainer" className="h-8 w-8 p-0" onClick={() => setForm({ retainer })}>
        <Pencil className="h-4 w-4" />
      </Button>
    </span>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageBanner
        tone="yellow"
        icon={BannerIcon}
        title="Retainers"
        description={
          <>
            The monthly agreements with client companies — for the companies won on{' '}
            <Link href="/pipeline-companies" className="text-primary hover:underline">
              Pipeline Companies
            </Link>
            . What is charged per person placed is under{' '}
            <Link href="/fees" className="text-primary hover:underline">
              Fees
            </Link>
            .
          </>
        }
      >
        <Button type="button" className="shrink-0 whitespace-nowrap" onClick={() => setForm({})}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add retainer
        </Button>
      </PageBanner>

      {/* the agreements at a glance: what to set up, what is running, what it brings, what is ending, what ended */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <RevenueTile
          label="1 · To set up"
          icon={ClipboardList}
          lines={overview ? [String(withoutRetainer.length)] : undefined}
          note={overview ? (withoutRetainer.length === 0 ? 'every won client has one' : `won client${withoutRetainer.length === 1 ? '' : 's'} without a retainer`) : undefined}
          tone="var(--chart-series-1)"
          onClick={() => openSection('todo')}
        />
        <RevenueTile
          label="Active agreements"
          icon={Handshake}
          lines={overview ? [overview.active.toLocaleString()] : undefined}
          tone="#2f6b3b"
          active={status === 'ACTIVE' && shown === 'all'}
          onClick={() => {
            filterBy(status === 'ACTIVE' && shown === 'all' ? '' : 'ACTIVE');
            openSection('all');
          }}
        />
        <RevenueTile label="Income per month" icon={TrendingUp} lines={overview ? moneyLines(overview.perMonth, currency) : undefined} note="from active agreements" tone="#2d5a73" />
        <RevenueTile
          label="2 · Ending within 30 days"
          icon={CalendarClock}
          lines={overview ? [overview.endingSoon.toLocaleString()] : undefined}
          note="time to talk about renewing"
          tone="#b7791f"
          onClick={() => openSection('todo')}
        />
        <RevenueTile
          label="3 · Expired"
          icon={Hourglass}
          lines={overview ? [overview.expired.toLocaleString()] : undefined}
          note="renew them or close them"
          tone="#b42318"
          active={status === 'EXPIRED' && shown === 'all'}
          onClick={() => {
            filterBy(status === 'EXPIRED' && shown === 'all' ? '' : 'EXPIRED');
            openSection('all');
          }}
        />
      </div>

      {/* the two sections of the page */}
      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-background p-1 shadow-sm" role="tablist" aria-label="Sections of Retainers">
        {SECTIONS.map(({ key, label, hint, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={shown === key}
            title={hint}
            onClick={() => openSection(key)}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${shown === key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground/70 hover:bg-accent'}`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {key === 'todo' && todoCount > 0 ? <span className={`rounded-full px-1.5 text-[11px] font-semibold ${shown === key ? 'bg-primary-foreground/20' : 'bg-accent'}`}>{todoCount}</span> : null}
            {key === 'all' && data ? <span className={`rounded-full px-1.5 text-[11px] font-semibold ${shown === key ? 'bg-primary-foreground/20' : 'bg-accent'}`}>{data.totalItems}</span> : null}
          </button>
        ))}
      </nav>

      {/* what just happened, with a way back */}
      {notice ? (
        <div
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-sm ${notice.tone === 'error' ? 'border-red-300 bg-red-50 text-red-800' : 'border-emerald-300 bg-emerald-50 text-emerald-900'}`}
        >
          <span>{notice.text}</span>
          <span className="flex shrink-0 items-center gap-2">
            {notice.undo ? (
              <button type="button" onClick={notice.undo} className="inline-flex items-center gap-1 font-semibold underline">
                <Undo2 className="h-3.5 w-3.5" /> Undo
              </button>
            ) : null}
            <button type="button" aria-label="Close" onClick={() => setNotice(null)} className="text-current/60 hover:text-current">
              <X className="h-4 w-4" />
            </button>
          </span>
        </div>
      ) : null}

      {/* TO DO: set up a retainer for won clients, renew the ones about to end, deal with the expired */}
      {shown === 'todo' ? (
        <div className="flex flex-col gap-5" data-testid="retainers-todo">
          {loadedTodo && todoCount === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </span>
              <p className="text-sm font-semibold">Nothing to do</p>
              <p className="max-w-sm text-sm text-foreground/55">Every won client has a retainer and none is about to end or has expired.</p>
              <Button type="button" size="sm" variant="outline" onClick={() => openSection('all')}>
                See all retainers
              </Button>
            </div>
          ) : null}

          {withoutRetainer.length > 0 ? (
            <TodoGroup
              testId="retainer-suggestions"
              step={1}
              icon={ClipboardList}
              title={`Set up a retainer for ${withoutRetainer.length} won client${withoutRetainer.length === 1 ? '' : 's'}`}
              help="These companies are in the Signed stage and have no agreement running. Enter what they pay per month and the period."
            >
              {withoutRetainer.map((company) => (
                <TodoRow
                  key={company.id}
                  title={
                    <Link href={`/companies/${company.id}`} className="text-sm font-medium hover:underline">
                      {company.name}
                    </Link>
                  }
                  detail={
                    <>
                      {company.jobs} job{company.jobs === 1 ? '' : 's'} · {company.employees} placed
                    </>
                  }
                  action={
                    <Button type="button" size="sm" onClick={() => setForm({ company: { id: company.id, name: company.name } })}>
                      Set up retainer
                    </Button>
                  }
                />
              ))}
            </TodoGroup>
          ) : null}

          {endingSoon.length > 0 ? (
            <TodoGroup step={2} icon={CalendarClock} title={`Renew ${endingSoon.length} retainer${endingSoon.length === 1 ? '' : 's'} ending within 30 days`} help="Talk to the client now. Press Renew to set the new period — the old one stays in the history.">
              {endingSoon.map((retainer) => (
                <TodoRow
                  key={retainer.id}
                  title={
                    <Link href={`/companies/${retainer.company.id}`} className="text-sm font-medium hover:underline">
                      {retainer.company.name}
                    </Link>
                  }
                  detail={`${formatDate(retainer.startDate)} → ${retainer.endDate ? formatDate(retainer.endDate) : 'open-ended'}`}
                  aside={
                    <span className="text-right">
                      <span className="block text-sm font-semibold tabular-nums">{formatMoney(retainer.amount, retainer.currency)}</span>
                      <span className="block text-xs font-medium text-amber-700">{endsText(retainer)}</span>
                    </span>
                  }
                  action={renewAction(retainer)}
                />
              ))}
            </TodoGroup>
          ) : null}

          {expiredItems.length > 0 ? (
            <TodoGroup step={3} icon={Hourglass} title={`${expiredItems.length} expired retainer${expiredItems.length === 1 ? '' : 's'}`} help="The end date has passed. Renew the agreement if the client continues, or cancel it if it is over.">
              {expiredItems.map((retainer) => (
                <TodoRow
                  key={retainer.id}
                  title={
                    <Link href={`/companies/${retainer.company.id}`} className="text-sm font-medium hover:underline">
                      {retainer.company.name}
                    </Link>
                  }
                  detail={`${formatDate(retainer.startDate)} → ${retainer.endDate ? formatDate(retainer.endDate) : 'open-ended'}`}
                  aside={
                    <span className="text-right">
                      <span className="block text-sm font-semibold tabular-nums">{formatMoney(retainer.amount, retainer.currency)}</span>
                      <span className="block text-xs font-medium text-red-600">{endsText(retainer)}</span>
                    </span>
                  }
                  action={
                    <span className="flex items-center gap-1.5">
                      {renewAction(retainer)}
                      <Button type="button" size="sm" variant="outline" onClick={() => void handleCancel(retainer)}>
                        Close
                      </Button>
                    </span>
                  }
                />
              ))}
            </TodoGroup>
          ) : null}
        </div>
      ) : null}

      {/* ALL RETAINERS: the status pills and the table */}
      {shown === 'all' ? (
        <div className="flex flex-col gap-4" data-testid="retainers-all">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Retainer status">
              {FILTERS.map((filter) => (
                <button
                  key={filter.value || 'all'}
                  type="button"
                  role="tab"
                  aria-selected={status === filter.value}
                  title={filter.hint}
                  onClick={() => filterBy(filter.value)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${status === filter.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground/70 hover:bg-accent'}`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            {filtered ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => filterBy('')}>
                <X className="mr-1 h-4 w-4" /> Clear
              </Button>
            ) : null}
          </div>

          <div className="flex flex-col gap-3">
            <div className={`overflow-x-auto border bg-background ${TABLE_TONES.yellow.box}`}>
              <table className="w-full text-sm" data-testid="retainers-table">
                <thead className={`text-left text-xs uppercase tracking-wide ${TABLE_TONES.yellow.head}`}>
                  <tr>
                    {['Company', 'Per month', 'Period', 'Status', 'Renewals', 'Next step'].map((heading) => (
                      <th key={heading} className="whitespace-nowrap px-4 py-2.5">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-foreground/50">
                        Loading…
                      </td>
                    </tr>
                  ) : retainers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent">
                          <Receipt className="h-5 w-5 text-foreground/50" />
                        </span>
                        {filtered ? (
                          <p className="text-sm text-foreground/60">No retainers match this filter.</p>
                        ) : (
                          <>
                            <p className="text-sm font-medium">No retainers yet</p>
                            <p className="mx-auto mt-1 max-w-sm text-sm text-foreground/55">A retainer is what a client pays every month so you keep recruiting for it.</p>
                            <Button type="button" size="sm" className="mt-3" onClick={() => setForm({})}>
                              <Plus className="mr-1.5 h-4 w-4" /> Add retainer
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ) : (
                    retainers.map((retainer) => (
                      <tr key={retainer.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                        <td className="whitespace-nowrap px-4 py-2.5">
                          <Link href={`/companies/${retainer.company.id}`} className="font-medium hover:underline">
                            {retainer.company.name}
                          </Link>
                          <p className="text-xs text-foreground/50">
                            {retainer.company._count.placements} placed ·{' '}
                            <Link href={`/fees?companyId=${retainer.company.id}`} className="text-primary hover:underline">
                              fees
                            </Link>
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 font-semibold tabular-nums">{formatMoney(retainer.amount, retainer.currency)}</td>
                        <td className="whitespace-nowrap px-4 py-2.5">
                          {formatDate(retainer.startDate)} → {retainer.endDate ? formatDate(retainer.endDate) : 'open-ended'}
                          {retainer.status === 'ACTIVE' && retainer.endDate ? <p className={`text-xs ${retainer.endsSoon ? 'font-medium text-amber-700' : 'text-foreground/50'}`}>{endsText(retainer)}</p> : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5">
                          <Badge variant={STATUS_BADGE[retainer.status]} data-testid="retainer-status">
                            {RETAINER_STATUS_LABEL[retainer.status]}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5">{retainer.renewals.length}</td>
                        <td className="whitespace-nowrap px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1.5">
                            {retainer.status !== 'CANCELLED' ? (
                              <Button type="button" size="sm" variant={retainer.endsSoon || retainer.status === 'EXPIRED' ? 'default' : 'outline'} onClick={() => setRenewing(retainer)}>
                                Renew
                              </Button>
                            ) : (
                              <span className="px-2 text-xs text-foreground/40">Cancelled</span>
                            )}
                            <Button type="button" size="sm" variant="ghost" aria-label="Edit retainer" title="Edit the retainer" className="h-8 w-8 p-0" onClick={() => setForm({ retainer })}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {retainer.status === 'ACTIVE' ? (
                              <Button type="button" size="sm" variant="ghost" aria-label="Cancel retainer" title="Cancel the retainer" className="h-8 w-8 p-0" onClick={() => void handleCancel(retainer)}>
                                <X className="h-4 w-4" />
                              </Button>
                            ) : null}
                            <Button type="button" size="sm" variant="ghost" aria-label="Delete retainer" title="Delete the retainer" className="h-8 w-8 p-0" onClick={() => void handleDelete(retainer)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {data && data.totalItems > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-foreground/60">
                <span>
                  <strong className="text-foreground">{data.totalItems.toLocaleString('en-GB')}</strong> retainer{data.totalItems === 1 ? '' : 's'}
                  {status ? ` · ${RETAINER_STATUS_LABEL[status].toLowerCase()}` : ''}
                </span>
                {data.totalPages > 1 ? (
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                      Previous
                    </Button>
                    <span>
                      Page {data.page} of {data.totalPages}
                    </span>
                    <Button type="button" variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>
                      Next
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {form ? <RetainerFormDialog retainer={form.retainer} company={form.company} defaultCurrency={currency} onSubmit={handleSubmit} onClose={() => setForm(null)} /> : null}
      {renewing ? (
        <RenewRetainerDialog retainer={renewing} onSubmit={(input) => renewRetainer.mutateAsync({ id: renewing.id, input })} onClose={() => setRenewing(null)} />
      ) : null}
    </div>
  );
}
