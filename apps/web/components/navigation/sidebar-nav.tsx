'use client';

import { cn } from '@crm/ui';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Fragment, Suspense, useEffect, useRef, type ReactNode, type RefObject } from 'react';

import { useSession } from '@/hooks/use-session';

import { isAdminSession, visibleNavGroups, type NavItem } from './nav-config';

function ItemLink({
  item,
  Icon,
  isPointed,
  pointed,
  active,
}: {
  item: NavItem;
  Icon: NavItem['icon'];
  isPointed: boolean;
  pointed: RefObject<HTMLAnchorElement>;
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      ref={isPointed ? pointed : undefined}
      data-pointed={isPointed ? 'true' : undefined}
      className={cn(
        'flex items-center gap-2.5 border-l-2 px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none',
        active ? 'border-primary bg-background font-semibold text-foreground' : 'border-transparent text-foreground/70 hover:bg-accent hover:text-accent-foreground',
        isPointed ? 'font-bold ring-2 ring-primary' : '',
        isPointed && !active ? 'bg-accent text-foreground' : '',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

/** The page, and under it its sub-items (e.g. Jobs → Jobs Permanent, Jobs Temporary); `?type=` says which one is open. */
function ItemWithSubItems({
  item,
  isActive,
  renderLink,
}: {
  item: NavItem;
  isActive: boolean;
  renderLink: (active: boolean) => ReactNode;
}) {
  const type = useSearchParams().get('type');
  const known = item.subItems!.some((sub) => sub.type === type);
  return (
    <>
      {renderLink(isActive && !known)}
      <div className="ml-5 flex flex-col gap-0.5 border-l border-border pl-2">
        {item.subItems!.map((sub) => {
          const active = isActive && type === sub.type;
          return (
            <Link
              key={sub.type}
              href={`${item.href}?type=${sub.type}`}
              className={cn(
                'border-l-2 px-3 py-1 text-[13px] font-medium transition-colors focus-visible:outline-none',
                active ? 'border-primary bg-background font-semibold text-foreground' : 'border-transparent text-foreground/60 hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <span className="truncate">{sub.label}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}

/**
 * Open: every category with its pages (icon + name). `collapsed` (the desktop sidebar when closed): ONE icon per
 * category and nothing else — a click on it opens the sidebar (`onExpand`) and points at that category's first
 * page (`pointAt`): it is shown in bold with the keyboard focus on it, without going there.
 */
export function SidebarNav({
  collapsed = false,
  onExpand,
  pointAt,
}: {
  collapsed?: boolean;
  onExpand?: (category: string) => void;
  /** The category whose first page is pointed at. */
  pointAt?: string | null;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const groups = visibleNavGroups(isAdminSession(session), session?.allowedSections, session?.permissions);
  const isActive = (href: string) => pathname === href || Boolean(pathname?.startsWith(`${href}/`));

  const pointed = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (collapsed || !pointAt) return;
    pointed.current?.focus({ preventScroll: true });
    pointed.current?.scrollIntoView({ block: 'nearest' });
  }, [collapsed, pointAt]);

  if (collapsed) {
    return (
      <nav className="flex flex-col gap-1 overflow-y-auto px-2 py-4" data-testid="nav-categories">
        {groups.map((group) => {
          const Icon = group.icon;
          const active = group.items.some((item) => isActive(item.href));
          return (
            <button
              key={group.label}
              type="button"
              onClick={() => onExpand?.(group.label)}
              title={group.label}
              aria-label={`${group.label} — open the menu`}
              className={cn(
                'flex h-10 items-center justify-center border-l-2 transition-colors',
                active ? 'border-primary bg-background text-primary' : 'border-transparent text-foreground/70 hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-5 overflow-y-auto px-3 py-4">
      {groups.map((group) => {
        const GroupIcon = group.icon;
        return (
          <div key={group.label}>
            <p className="mb-1.5 flex items-center gap-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-foreground/40">
              <GroupIcon className="h-3.5 w-3.5 shrink-0" />
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item, index) => {
                const Icon = item.icon;
                const isPointed = pointAt === group.label && index === 0;
                const link = (active: boolean) => (
                  <ItemLink item={item} Icon={Icon} isPointed={isPointed} pointed={pointed} active={active} />
                );
                // a page with sub-items is lit up for itself only while it shows all of them together
                return item.subItems ? (
                  <Suspense key={item.href} fallback={link(isActive(item.href))}>
                    <ItemWithSubItems item={item} isActive={isActive(item.href)} renderLink={link} />
                  </Suspense>
                ) : (
                  <Fragment key={item.href}>{link(isActive(item.href))}</Fragment>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
