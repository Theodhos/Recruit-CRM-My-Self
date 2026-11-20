'use client';

import { TABLE_TONES } from '@/components/tables/data-table';
import { DollarSign as BannerIcon } from '@crm/ui/icons';
import { PageBanner } from '@/components/tables/page-banner';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, SearchSelect } from '@crm/ui';
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, FileText, ListChecks, Pencil, Plus, Receipt, Send, Table2, Trash2, Undo2, Wallet, X } from '@crm/ui/icons';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type ReactNode } from 'react';

import { confirmDialog } from '@/components/dialogs/confirm-dialog';
import { FEE_STATUS_LABEL, FeeFormDialog, RevenueTile, formatDate, formatMoney, moneyLines } from '@/features/revenue';
import { TodoGroup, TodoRow } from '@/features/revenue/todo-list';
import { useCompanies } from '@/hooks/use-companies';
import { useCreateFee, useDeleteFee, useFees, useFeesOverview, useUpdateFee } from '@/hooks/use-fees';
import { useOrganisation } from '@/hooks/use-organisation';
import { ApiClientError } from '@/lib/api-client';
import { FEE_STATUS_COLOUR } from '@/lib/status-colors';
import type { Fee, FeeInput, FeeStatus, FeeSuggestion } from '@/services/fees.service';

const STATUS_BADGE = FEE_STATUS_COLOUR;

const linkClass = 'font-medium hover:underline';

/** The filter pills above the table, in the order a fee goes through: Draft → Sent → (Overdue) → Paid. */
const FILTERS: { value: FeeStatus | ''; label: string; hint: string }[] = [
  { value: '', label: 'All', hint: 'Every fee' },
  { value: 'PENDING', label: 'Draft', hint: 'The invoice is not sent to the client yet' },
  { value: 'INVOICED', label: 'Sent', hint: 'The invoice is sent, waiting for payment' },
  { value: 'OVERDUE', label: 'Overdue', hint: 'The due date has passed and it is not paid' },
  { value: 'PAID', label: 'Paid', hint: 'The client has paid' },
  { value: 'CANCELLED', label: 'Cancelled', hint: 'Cancelled fees' },
];

/** "in 5 days" / "3 days overdue" / "today" — how far the due date is, for a fee that is not paid yet. */
function dueText(fee: Fee): { text: string; late: boolean } | null {
  if (!fee.dueDate || fee.status === 'PAID' || fee.status === 'CANCELLED') return null;
  const days = Math.round((new Date(fee.dueDate.slice(0, 10)).getTime() - new Date(new Date().toISOString().slice(0, 10)).getTime()) / 86_400_000);
  if (days === 0) return { text: 'due today', late: false };
  if (days > 0) return { text: `in ${days} day${days === 1 ? '' : 's'}`, late: false };
  return { text: `${-days} day${days === -1 ? '' : 's'} overdue`, late: true };
}

/** The two sections of the page: what is waiting for you, and every fee. The open one is kept in the address (#todo, #all). */
const SECTIONS = [
  { key: 'todo', label: 'To do', hint: 'What is waiting for you, in the order to do it', icon: ListChecks },
  { key: 'all', label: 'All fees', hint: 'Every fee, with filters', icon: Table2 },
] as const;
type Section = (typeof SECTIONS)[number]['key'];

/** What the person does next with a fee, in one button. */
const NEXT_STEP: Partial<Record<FeeStatus, { label: string; to: FeeStatus; done: string }>> = {
  PENDING: { label: 'Mark as sent', to: 'INVOICED', done: 'marked as sent' },
  INVOICED: { label: 'Mark as paid', to: 'PAID', done: 'marked as paid' },
  OVERDUE: { label: 'Mark as paid', to: 'PAID', done: 'marked as paid' },
};

/** A fee in a To do group: who and how much, when it is due, and the one button for the next step. */
function FeeTodoRow({ fee, onNext, onEdit, busy }: { fee: Fee; onNext: (fee: Fee, to: FeeStatus, done: string) => void; onEdit: () => void; busy: boolean }) {
  const next = NEXT_STEP[fee.status];
  const due = dueText(fee);
  return (
    <TodoRow
      title={
        <Link href={`/candidates/${fee.placement.candidate.id}`} className={linkClass}>
          {fee.placement.candidate.firstName} {fee.placement.candidate.lastName}
        </Link>
      }
      detail={
        <>
          {fee.placement.job.title} · {fee.placement.company.name}
          {fee.invoiceNumber ? ` · invoice ${fee.invoiceNumber}` : ''}
        </>
      }
      aside={
        <span className="text-right">
          <span className="block text-sm font-semibold tabular-nums">{formatMoney(fee.amount, fee.currency)}</span>
          {due ? <span className={`block text-xs ${due.late ? 'font-medium text-red-600' : 'text-foreground/50'}`}>{due.text}</span> : null}
        </span>
      }
      action={
        <span className="flex items-center gap-1.5">
          {next ? (
            <Button type="button" size="sm" disabled={busy} onClick={() => onNext(fee, next.to, next.done)}>
              {next.label}
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="ghost" aria-label="Edit fee" title="Edit the fee" className="h-8 w-8 p-0" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
        </span>
      }
    />
  );
}

/**
 * Fees: what the agency charges a client company for a person it placed there — the money side of Active Employees.
 * The page reads in the order the work is done: what still needs a fee (to set up) → draft invoices to send → sent and
 * waiting → overdue → paid. Each fee has ONE next step on its row (Mark as sent, then Mark as paid), and every change
 * can be undone from the message that confirms it.
 */
function FeesView() {
  const router = useRouter();
  const companyId = useSearchParams().get('companyId') ?? '';
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<FeeStatus | ''>('');
  const [dialog, setDialog] = useState<{ fee?: Fee; suggestion?: FeeSuggestion } | null>(null);
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

  const { data: overview } = useFeesOverview();
  // the three queues of the To do section: invoices to send, money to collect (sent + overdue)
  const { data: drafts } = useFees({ page: 1, pageSize: 50, status: 'PENDING' });
  const { data: sent } = useFees({ page: 1, pageSize: 50, status: 'INVOICED' });
  const { data: overdue } = useFees({ page: 1, pageSize: 50, status: 'OVERDUE' });
  const { data, isLoading } = useFees({ page, pageSize: 25, status: status || undefined, companyId: companyId || undefined });
  const { data: companies } = useCompanies({ page: 1, pageSize: 100 });
  const { data: organisation } = useOrganisation();
  const createFee = useCreateFee();
  const updateFee = useUpdateFee();
  const deleteFee = useDeleteFee();

  const defaults = { currency: organisation?.payDefaults.currency ?? 'GBP', paymentTermDays: organisation?.payDefaults.paymentTermDays ?? 30 };

  // a message goes away by itself
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), notice.tone === 'error' ? 12_000 : 8_000);
    return () => clearTimeout(timer);
  }, [notice]);

  function filterBy(next: FeeStatus | '') {
    setStatus(next);
    setPage(1);
  }

  function filterByCompany(id: string) {
    router.replace(id ? `/fees?companyId=${id}` : '/fees');
    setPage(1);
  }

  /** Moves a fee one step on and says what happened, with an Undo that puts it back. */
  async function setFeeStatus(fee: Fee, next: FeeStatus, done: string) {
    const before: FeeStatus = fee.status === 'OVERDUE' ? 'INVOICED' : fee.status;
    try {
      await updateFee.mutateAsync({ id: fee.id, input: { status: next } });
      setNotice({
        tone: 'ok',
        text: `${fee.placement.candidate.firstName} ${fee.placement.candidate.lastName}: the fee of ${formatMoney(fee.amount, fee.currency)} is ${done}.`,
        undo: () => {
          void updateFee
            .mutateAsync({ id: fee.id, input: { status: before } })
            .then(() => setNotice({ tone: 'ok', text: 'Put back as it was.' }))
            .catch((error) => setNotice({ tone: 'error', text: error instanceof ApiClientError ? error.message : 'Could not undo.' }));
        },
      });
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof ApiClientError ? error.message : 'Could not update the fee. Please try again.' });
    }
  }

  async function handleDelete(fee: Fee) {
    if (await confirmDialog(`Delete the fee of ${formatMoney(fee.amount, fee.currency)} for ${fee.placement.candidate.firstName} ${fee.placement.candidate.lastName}? This cannot be undone.`)) {
      deleteFee.mutate(fee.id, { onSuccess: () => setNotice({ tone: 'ok', text: 'The fee was deleted.' }) });
    }
  }

  function handleSubmit(input: FeeInput) {
    return dialog?.fee ? updateFee.mutateAsync({ id: dialog.fee.id, input }) : createFee.mutateAsync(input);
  }

  const fees = data?.items ?? [];
  const toSetUp = overview?.suggestions.length ?? 0;
  const filtered = Boolean(status || companyId);
  const toCollect = [...(overdue?.items ?? []), ...(sent?.items ?? [])];
  const todoCount = toSetUp + (drafts?.totalItems ?? 0) + (overdue?.totalItems ?? 0) + (sent?.totalItems ?? 0);
  // nothing was chosen yet: open To do when there is something to do, otherwise the list of fees
  const shown: Section = sectionChosen ? section : todoCount === 0 && overview && drafts && sent && overdue ? 'all' : section;

  return (
    <div className="flex flex-col gap-6">
      <PageBanner
        tone="lime"
        icon={BannerIcon}
        title="Fees"
        description={
          <>
            What a client company pays for a person you placed there. Each fee goes <b>Draft → Sent → Paid</b>. Every fee belongs to one{' '}
            <Link href="/applications" className="text-primary hover:underline">
              active employee
            </Link>
            ; the monthly agreements are under{' '}
            <Link href="/retainers" className="text-primary hover:underline">
              Retainers
            </Link>
            .
          </>
        }
      >
        <Button type="button" className="shrink-0 whitespace-nowrap" onClick={() => setDialog({})}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add fee
        </Button>
      </PageBanner>

      {/* the money, in the order it moves: to set up → draft → sent → overdue → paid. A tile filters the table. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <RevenueTile
          label="1 · To set up"
          icon={ClipboardList}
          lines={overview ? [String(toSetUp)] : undefined}
          note={overview ? (toSetUp === 0 ? 'every hire has its fee' : `permanent hire${toSetUp === 1 ? '' : 's'} without a fee`) : undefined}
          tone="var(--chart-series-1)"
          active={false}
          onClick={() => openSection('todo')}
        />
        <RevenueTile
          label="2 · Draft"
          icon={FileText}
          lines={overview ? moneyLines(overview.toInvoice, defaults.currency) : undefined}
          note="to send to the client"
          tone="#b7791f"
          active={status === 'PENDING'}
          onClick={() => { filterBy(status === 'PENDING' && shown === 'all' ? '' : 'PENDING'); openSection('all'); }}
        />
        <RevenueTile
          label="3 · Sent"
          icon={CalendarClock}
          lines={overview ? moneyLines(overview.awaitingPayment, defaults.currency) : undefined}
          note="waiting for payment"
          tone="#2d5a73"
          active={status === 'INVOICED'}
          onClick={() => { filterBy(status === 'INVOICED' && shown === 'all' ? '' : 'INVOICED'); openSection('all'); }}
        />
        <RevenueTile
          label="Overdue"
          icon={AlertTriangle}
          lines={overview ? moneyLines(overview.overdue, defaults.currency) : undefined}
          note={overview ? (overview.overdueCount === 0 ? 'nothing late' : `${overview.overdueCount} fee${overview.overdueCount === 1 ? '' : 's'} past the due date`) : undefined}
          tone="#b42318"
          active={status === 'OVERDUE'}
          onClick={() => { filterBy(status === 'OVERDUE' && shown === 'all' ? '' : 'OVERDUE'); openSection('all'); }}
        />
        <RevenueTile
          label="4 · Paid this year"
          icon={CheckCircle2}
          lines={overview ? moneyLines(overview.paidThisYear, defaults.currency) : undefined}
          note={overview ? `${overview.permanentPlacements} permanent placement${overview.permanentPlacements === 1 ? '' : 's'} in total` : undefined}
          tone="#2f6b3b"
          active={status === 'PAID'}
          onClick={() => { filterBy(status === 'PAID' && shown === 'all' ? '' : 'PAID'); openSection('all'); }}
        />
      </div>

      {/* the two sections of the page */}
      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-background p-1 shadow-sm" role="tablist" aria-label="Sections of Fees">
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

      {/* TO DO: the work in the order it is done — set up the fee, send the invoice, collect the payment */}
      {shown === 'todo' ? (
        <div className="flex flex-col gap-5" data-testid="fees-todo">
          {overview && drafts && sent && overdue && todoCount === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </span>
              <p className="text-sm font-semibold">Nothing to do</p>
              <p className="max-w-sm text-sm text-foreground/55">Every hire has its fee, every invoice is sent and nothing is waiting for payment.</p>
              <Button type="button" size="sm" variant="outline" onClick={() => openSection('all')}>
                See all fees
              </Button>
            </div>
          ) : null}

          {toSetUp > 0 && overview ? (
            <TodoGroup
              testId="fee-suggestions"
              step={1}
              icon={ClipboardList}
              title={`Set up the fee for ${toSetUp} ${toSetUp === 1 ? 'person' : 'people'}`}
              help="These people are working now and no fee has been set for them. Enter the salary and the agreed percentage (or a fixed fee): the total is worked out for you."
            >
              {overview.suggestions.map((suggestion) => (
                <TodoRow
                  key={suggestion.placementId}
                  title={
                    <Link href={`/candidates/${suggestion.candidate.id}`} className={linkClass}>
                      {suggestion.candidate.firstName} {suggestion.candidate.lastName}
                    </Link>
                  }
                  detail={
                    <>
                      {suggestion.job.title} ·{' '}
                      <Link href={`/companies/${suggestion.company.id}`} className="hover:underline">
                        {suggestion.company.name}
                      </Link>{' '}
                      · working since {formatDate(suggestion.startDate)}
                    </>
                  }
                  action={
                    <Button type="button" size="sm" onClick={() => setDialog({ suggestion })}>
                      Set up fee
                    </Button>
                  }
                />
              ))}
            </TodoGroup>
          ) : null}

          {(drafts?.items.length ?? 0) > 0 ? (
            <TodoGroup step={2} icon={Send} title={`Send ${drafts!.totalItems} invoice${drafts!.totalItems === 1 ? '' : 's'} to the client`} help="The fee is ready but the invoice has not been sent. After you send it, press Mark as sent.">
              {drafts!.items.map((fee) => (
                <FeeTodoRow key={fee.id} fee={fee} onNext={setFeeStatus} onEdit={() => setDialog({ fee })} busy={updateFee.isPending} />
              ))}
            </TodoGroup>
          ) : null}

          {toCollect.length > 0 ? (
            <TodoGroup step={3} icon={Wallet} title={`Collect ${(overdue?.totalItems ?? 0) + (sent?.totalItems ?? 0)} payment${(overdue?.totalItems ?? 0) + (sent?.totalItems ?? 0) === 1 ? '' : 's'}`} help="The invoice is sent. When the client pays, press Mark as paid. The late ones are first.">
              {toCollect.map((fee) => (
                <FeeTodoRow key={fee.id} fee={fee} onNext={setFeeStatus} onEdit={() => setDialog({ fee })} busy={updateFee.isPending} />
              ))}
            </TodoGroup>
          ) : null}
        </div>
      ) : null}

      {shown === 'all' ? (
        <div className="flex flex-col gap-4" data-testid="fees-all">
      {/* the filters: the state of the fee as pills, and the client */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Fee status">
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
        <div className="flex items-center gap-2">
          <SearchSelect id="fee-company-filter" aria-label="Company" className="w-56" value={companyId} onChange={(event) => filterByCompany(event.target.value)}>
            <option value="">All companies</option>
            {(companies?.items ?? []).map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </SearchSelect>
          {filtered ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatus('');
                filterByCompany('');
              }}
            >
              <X className="mr-1 h-4 w-4" /> Clear
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className={`overflow-x-auto border bg-background ${TABLE_TONES.lime.box}`}>
          <table className="w-full text-sm" data-testid="fees-table">
            <thead className={`text-left text-xs uppercase tracking-wide ${TABLE_TONES.lime.head}`}>
              <tr>
                {['Candidate', 'Client', 'Fee', 'Invoice', 'Status', 'Due', 'Next step'].map((heading) => (
                  <th key={heading} className="whitespace-nowrap px-4 py-2.5">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-foreground/50">
                    Loading…
                  </td>
                </tr>
              ) : fees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent">
                      <Receipt className="h-5 w-5 text-foreground/50" />
                    </span>
                    {filtered ? (
                      <p className="text-sm text-foreground/60">No fees match this filter.</p>
                    ) : (
                      <>
                        <p className="text-sm font-medium">No fees yet</p>
                        <p className="mx-auto mt-1 max-w-sm text-sm text-foreground/55">
                          {toSetUp > 0 ? 'Start with the people above: press “Set up fee” next to a name.' : 'When a permanent hire starts working, its fee is set up from here, or add one yourself.'}
                        </p>
                        <Button type="button" size="sm" className="mt-3" onClick={() => setDialog({})}>
                          <Plus className="mr-1.5 h-4 w-4" /> Add fee
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                fees.map((fee) => {
                  const due = dueText(fee);
                  const next = NEXT_STEP[fee.status];
                  const resourcers = fee.placement.resourcers ?? [];
                  return (
                    <tr key={fee.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <Link href={`/candidates/${fee.placement.candidate.id}`} className={linkClass}>
                          {fee.placement.candidate.firstName} {fee.placement.candidate.lastName}
                        </Link>
                        <p className="text-xs text-foreground/50">{fee.placement.job.title}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <Link href={`/companies/${fee.placement.company.id}`} className="hover:underline">
                          {fee.placement.company.name}
                        </Link>
                        {resourcers.length > 0 ? (
                          <p className="text-xs text-foreground/50" title="Resourcers (who earns commission)">
                            {resourcers.map((r) => `${r.user.firstName} ${r.user.lastName}${resourcers.length > 1 ? ` ${Number(r.splitPercent)}%` : ''}`).join(', ')}
                          </p>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <span className="font-semibold tabular-nums">{formatMoney(fee.amount, fee.currency)}</span>
                        <p className="text-xs text-foreground/50">
                          {fee.feeType === 'FIXED' ? 'Fixed fee' : fee.feeType === 'PERCENTAGE' ? `${fee.feePercent}% of ${fee.annualSalary != null ? formatMoney(fee.annualSalary, fee.currency) : 'salary'}` : ''}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs">
                        {fee.invoiceNumber ?? <span className="text-foreground/40">no number yet</span>}
                        {fee.invoiceDate ? <span className="block text-foreground/55">{formatDate(fee.invoiceDate)}</span> : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <Badge variant={STATUS_BADGE[fee.status]} data-testid="fee-status">
                          {FEE_STATUS_LABEL[fee.status]}
                        </Badge>
                        {fee.status === 'PAID' && fee.paidAt ? <p className="mt-0.5 text-xs text-foreground/50">on {formatDate(fee.paidAt)}</p> : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        {fee.dueDate ? formatDate(fee.dueDate) : <span className="text-foreground/40">—</span>}
                        {due ? <p className={`text-xs ${due.late ? 'font-medium text-red-600' : 'text-foreground/50'}`}>{due.text}</p> : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {next ? (
                            <Button type="button" size="sm" disabled={updateFee.isPending} onClick={() => void setFeeStatus(fee, next.to, next.done)}>
                              {next.label}
                            </Button>
                          ) : (
                            <span className="px-2 text-xs text-foreground/40">{fee.status === 'PAID' ? 'Done' : '—'}</span>
                          )}
                          <Button type="button" size="sm" variant="ghost" aria-label="Edit fee" title="Edit the fee" className="h-8 w-8 p-0" onClick={() => setDialog({ fee })}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button type="button" size="sm" variant="ghost" aria-label="Delete fee" title="Delete the fee" className="h-8 w-8 p-0" onClick={() => handleDelete(fee)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {data && data.totalItems > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-foreground/60">
            <span>
              <strong className="text-foreground">{data.totalItems.toLocaleString('en-GB')}</strong> fee{data.totalItems === 1 ? '' : 's'}
              {status ? ` · ${FEE_STATUS_LABEL[status].toLowerCase()}` : ''}
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

      {dialog ? <FeeFormDialog fee={dialog.fee} suggestion={dialog.suggestion} defaults={defaults} onSubmit={handleSubmit} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}

export default function FeesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-foreground/60">Loading…</p>}>
      <FeesView />
    </Suspense>
  );
}
