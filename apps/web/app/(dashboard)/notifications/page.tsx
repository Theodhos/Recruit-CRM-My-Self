'use client';

import { Button } from '@crm/ui';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BellOff,
  CalendarClock,
  Check,
  CheckCheck,
  Inbox,
  ListChecks,
  X,
  UserCheck,
  UserPlus,
  Wallet,
  type AppIcon,
} from '@crm/ui/icons';
import { useMemo, useState } from 'react';

import { PageBanner } from '@/components/tables/page-banner';
import {
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useOpenNotification,
} from '@/hooks/use-notifications';

/**
 * The notifications are sorted by what they are about, so every one can be understood at a glance: a list of subjects on the left
 * (with how many are waiting in each), and on the right the notifications of the chosen subject by day, newest first. Every row
 * says what happened (a short label), who or what it is about, when, and where it leads. A type that is not known yet lands in
 * "Other" rather than being lost.
 */
type CategoryKey = 'candidates' | 'hires' | 'tasks' | 'calendar' | 'attention' | 'money' | 'other';

const CATEGORIES: { key: CategoryKey; label: string; hint: string; icon: AppIcon; match: RegExp }[] = [
  { key: 'candidates', label: 'Candidates', hint: 'New and returning applicants', icon: UserPlus, match: /CANDIDATE_(CREATED|REAPPLIED)|NEW_CANDIDATE|APPLICA|APPLIED|WEBSITE|REAPPLIED/ },
  { key: 'hires', label: 'Hires & placements', hint: 'People placed or started work', icon: UserCheck, match: /PLACED|PLACEMENT|HIRED|CONTRACT|ACTIVE_EMPLOYEE/ },
  { key: 'tasks', label: 'Tasks', hint: 'Work assigned to you', icon: ListChecks, match: /TASK/ },
  { key: 'calendar', label: 'Calendar & reminders', hint: 'Interviews, meetings, reminders', icon: CalendarClock, match: /CALENDAR|REMINDER|INTERVIEW|MEETING|EVENT/ },
  { key: 'attention', label: 'Needs attention', hint: 'Missing data and warnings', icon: AlertTriangle, match: /INCOMPLETE|MISSING|EXPIR|FAIL|REJECT|TERMINAT|WARNING|OVERDUE/ },
  { key: 'money', label: 'Pay & fees', hint: 'Payroll, timesheets, fees, commission', icon: Wallet, match: /PAY|FEE|INVOICE|TIMESHEET|COMMISSION|RETAINER/ },
  { key: 'other', label: 'Other', hint: 'Everything else', icon: Inbox, match: /.*/ },
];

// "Needs attention" is checked before the others only for the words that mean trouble, so a REJECTED application is
// not shown as a candidate event
const ORDER: CategoryKey[] = ['attention', 'money', 'tasks', 'calendar', 'hires', 'candidates', 'other'];

function categoryOf(type: string): (typeof CATEGORIES)[number] {
  const upper = type.toUpperCase();
  const key = ORDER.find((k) => CATEGORIES.find((c) => c.key === k)!.match.test(upper)) ?? 'other';
  return CATEGORIES.find((c) => c.key === key)!;
}

/** What happened, in two or three words: the label on every row. */
const TYPE_LABEL: Record<string, string> = {
  NEW_CANDIDATE: 'New candidate',
  CANDIDATE_REAPPLIED: 'Returning applicant',
  CANDIDATE_INCOMPLETE: 'Missing details',
  TASK_ASSIGNED: 'Task assigned',
  APPLICATION_STATUS_CHANGED: 'Status changed',
  INTERVIEW_SCHEDULED: 'Interview scheduled',
};
function typeLabel(type: string): string {
  if (TYPE_LABEL[type]) return TYPE_LABEL[type];
  const words = type.toLowerCase().replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Where a notification leads, said on its button. */
function linkLabel(link: string | null | undefined): string {
  if (!link) return '';
  const path = link.split('?')[0]!;
  if (path.startsWith('/candidates')) return 'Open candidate';
  if (path.startsWith('/jobs')) return 'Open job';
  if (path.startsWith('/companies')) return 'Open company';
  if (path.startsWith('/pipeline')) return 'Open pipeline';
  if (path.startsWith('/applications')) return 'Open employee';
  if (path.startsWith('/timesheets')) return 'Open timesheet';
  if (path.startsWith('/payroll') || path.startsWith('/payslips')) return 'Open payroll';
  if (path.startsWith('/commissions') || path.startsWith('/fees') || path.startsWith('/retainers')) return 'Open';
  if (path.startsWith('/calendar')) return 'Open calendar';
  return 'Open';
}

function dayGroup(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((start(today) - start(date)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return 'Earlier this week';
  if (days < 31) return 'Earlier this month';
  return 'Older';
}
const GROUP_ORDER = ['Today', 'Yesterday', 'Earlier this week', 'Earlier this month', 'Older'];

function timeLabel(iso: string): string {
  const date = new Date(iso);
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24 && dayGroup(iso) === 'Today') return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const PAGE_SIZE = 100; // the most the API gives at once

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [category, setCategory] = useState<CategoryKey | 'all'>('all');

  // the whole recent list is loaded and sorted by subject here, so every subject can be counted and opened at once
  const { data, isLoading } = useNotifications({ page, pageSize: PAGE_SIZE, unreadOnly });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();
  // marks it read at once and goes to the exact place it is about; hovering a row gets that place ready
  const { warm, open: handleOpen } = useOpenNotification();

  const items = data?.items ?? [];
  const counts = useMemo(() => {
    const map = new Map<CategoryKey, { total: number; unread: number }>();
    for (const item of items) {
      const key = categoryOf(item.type).key;
      const entry = map.get(key) ?? { total: 0, unread: 0 };
      entry.total += 1;
      if (!item.readAt) entry.unread += 1;
      map.set(key, entry);
    }
    return map;
  }, [items]);
  const unreadTotal = items.filter((item) => !item.readAt).length;

  const shown = category === 'all' ? items : items.filter((item) => categoryOf(item.type).key === category);
  const groups = GROUP_ORDER.map((name) => ({ name, rows: shown.filter((item) => dayGroup(item.createdAt) === name) })).filter((group) => group.rows.length > 0);
  const activeCategory = CATEGORIES.find((c) => c.key === category);

  const subjects: { key: CategoryKey | 'all'; label: string; hint: string; icon: AppIcon }[] = [{ key: 'all', label: 'All notifications', hint: 'Everything, newest first', icon: Bell }, ...CATEGORIES];

  return (
    <div className="flex flex-col gap-6">
      <PageBanner
        tone="amber"
        icon={Bell}
        title="Notifications"
        description={unreadTotal > 0 ? `${unreadTotal} waiting for you — choose a subject on the left, press a notification to open what it is about.` : 'You are all caught up. New applicants, hires, tasks and reminders appear here.'}
      >
        <Button type="button" variant="outline" size="sm" disabled={unreadTotal === 0 || markAllRead.isPending} onClick={() => markAllRead.mutate()}>
          <CheckCheck className="mr-1.5 h-4 w-4" /> Mark all as read
        </Button>
      </PageBanner>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* 1. the subjects, with what is waiting in each */}
        <nav className="flex gap-2 overflow-x-auto pb-1 lg:sticky lg:top-4 lg:flex-col lg:gap-1 lg:self-start lg:overflow-visible lg:rounded-xl lg:border lg:border-border lg:bg-background lg:p-2 lg:shadow-sm" role="tablist" aria-label="Notification subjects">
          {subjects.map((entry) => {
            const stat = entry.key === 'all' ? { total: items.length, unread: unreadTotal } : (counts.get(entry.key) ?? { total: 0, unread: 0 });
            const active = category === entry.key;
            const Icon = entry.icon;
            return (
              <button
                key={entry.key}
                type="button"
                role="tab"
                aria-selected={active}
                title={entry.hint}
                onClick={() => setCategory(entry.key)}
                className={`flex shrink-0 items-center gap-3 rounded-lg border-l-4 px-3 py-2 text-left transition-colors lg:w-full ${
                  active ? 'border-l-amber-500 bg-accent' : 'border-l-transparent hover:bg-accent/50'
                }`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-primary text-primary-foreground' : 'bg-accent text-foreground/70'}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block whitespace-nowrap text-sm font-semibold leading-tight">{entry.label}</span>
                  <span className="hidden text-xs text-foreground/50 lg:block">{stat.total} in total</span>
                </span>
                {stat.unread > 0 ? <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-white">{stat.unread}</span> : null}
              </button>
            );
          })}
        </nav>

        {/* 2. the notifications of the chosen subject, by day */}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold">{activeCategory ? activeCategory.label : 'All notifications'}</h3>
              <p className="text-xs text-foreground/50">{activeCategory ? activeCategory.hint : 'Everything, newest first'}</p>
            </div>
            <div className="inline-flex rounded-lg border border-border bg-accent/30 p-0.5" role="group" aria-label="Which notifications">
              {([
                [false, 'All'],
                [true, `Unread${unreadTotal > 0 ? ` (${unreadTotal})` : ''}`],
              ] as const).map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={unreadOnly === value}
                  onClick={() => {
                    setUnreadOnly(value);
                    setPage(1);
                  }}
                  className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${unreadOnly === value ? 'bg-background shadow-sm' : 'text-foreground/60 hover:text-foreground'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-2" aria-busy="true">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-lg bg-accent/50" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background px-6 py-20 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
                <BellOff className="h-6 w-6 text-foreground/50" />
              </div>
              <h3 className="mt-4 text-sm font-semibold">
                {unreadOnly ? 'Nothing unread' : category === 'all' ? 'No notifications yet' : `No ${activeCategory?.label.toLowerCase()} notifications`}
              </h3>
              <p className="mt-1 max-w-sm text-sm text-foreground/50">New applicants, hires, tasks, reminders and other events will show up here as they happen.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {groups.map((group) => (
                <section key={group.name} aria-label={group.name}>
                  <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">
                    {group.name}
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal">{group.rows.length}</span>
                  </h4>
                  <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                    {group.rows.map((notification) => {
                      const kind = categoryOf(notification.type);
                      const Icon = kind.icon;
                      const unread = !notification.readAt;
                      const goes = linkLabel(notification.link);
                      return (
                        <li
                          key={notification.id}
                          role={notification.link ? 'button' : undefined}
                          tabIndex={notification.link ? 0 : undefined}
                          onClick={() => handleOpen(notification)}
                          onMouseEnter={() => warm(notification)}
                          onFocus={() => warm(notification)}
                          data-testid="notification-row"
                          onKeyDown={(event) => {
                            if (notification.link && (event.key === 'Enter' || event.key === ' ')) {
                              event.preventDefault();
                              handleOpen(notification);
                            }
                          }}
                          className={`group flex items-start gap-3 border-l-4 px-4 py-3.5 ${unread ? 'border-l-amber-500 bg-amber-50/40' : 'border-l-transparent'} ${notification.link ? 'cursor-pointer hover:bg-accent/50' : ''}`}
                        >
                          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-foreground/70">
                            <Icon className="h-4 w-4" />
                          </span>

                          <div className="min-w-0 flex-1">
                            {/* what happened */}
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/60">{typeLabel(notification.type)}</span>
                              {unread ? <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">New</span> : null}
                            </div>
                            {/* who or what it is about */}
                            <p className={`mt-1 text-sm leading-snug ${unread ? 'font-semibold' : 'font-medium text-foreground/80'}`}>{notification.title}</p>
                            {notification.message ? <p className="mt-0.5 text-sm leading-snug text-foreground/60">{notification.message}</p> : null}
                            {/* when */}
                            <p className="mt-1 text-xs text-foreground/40">
                              {kind.label} · {timeLabel(notification.createdAt)}
                            </p>
                          </div>

                          {/* where it leads, and the two things that can be done with it */}
                          <div className="flex shrink-0 items-center gap-1.5">
                            {goes ? (
                              <span className="hidden items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground/70 group-hover:border-foreground/30 group-hover:text-foreground sm:inline-flex">
                                {goes} <ArrowRight className="h-3.5 w-3.5" />
                              </span>
                            ) : null}
                            {unread ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                title="Mark as read"
                                aria-label="Mark as read"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  markRead.mutate(notification.id);
                                }}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              title="Dismiss"
                              aria-label="Dismiss"
                              onClick={(event) => {
                                event.stopPropagation();
                                deleteNotification.mutate(notification.id);
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {data && data.totalPages > 1 ? (
            <div className="flex items-center justify-between text-sm text-foreground/60">
              <span>
                Page {page} of {data.totalPages} · {data.totalItems} notifications
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Newer
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>
                  Older
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
