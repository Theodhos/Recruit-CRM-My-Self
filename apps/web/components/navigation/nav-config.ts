import {
  Bell,
  Briefcase,
  CalendarClock,
  Building2,
  DollarSign,
  FileCheck,
  GitBranch,
  Handshake,
  Kanban,
  Percent,
  ReceiptText,
  LayoutDashboard,
  List,
  ClipboardCheck,
  Settings,
  ShieldCheck,
  Trophy,
  UserCircle,
  Users,
  UserX,
  Wallet,
  type AppIcon,
} from '@crm/ui/icons';

export interface NavItem {
  label: string;
  href: string;
  icon: AppIcon;
  /** Shown to organisation admins only (see `visibleNavGroups`). */
  adminOnly?: boolean;
  /** Shown to non-admin users only. */
  memberOnly?: boolean;
  /**
   * Narrower views of the same page, listed under it in the sidebar. The page itself (no `type`) shows all of them
   * together; each sub-item opens it as `href?type=<type>`. They follow the page's permission.
   */
  subItems?: { label: string; type: string }[];
}

export interface NavGroup {
  label: string;
  /** Stands for the whole category while the sidebar is closed. */
  icon: AppIcon;
  items: NavItem[];
  adminOnly?: boolean;
}

/** Admins hold this permission; everyone else is a regular member working in their own book of business. */
export const ADMIN_PERMISSION = 'users:manage';

/** Pages only an admin may open. A member who navigates here directly is sent to their dashboard. */
export const ADMIN_ONLY_PATHS = ['/users'];

/**
 * Single source of truth for sidebar navigation — add a route, add it here. Two levels of access:
 *   - admin  : everything, including Revenue; My Profile also holds the organisation's users (create, list, edit);
 *   - member : My Profile shows their own account only, and of the rest exactly the pages the admin ticked for
 *              them (`allowedSections` on the user; an empty list = all of them except Revenue, which is theirs
 *              only when it is ticked).
 * A user's page (/users/[id]) is reached from My Profile and has no entry of its own.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    icon: LayoutDashboard,
    items: [{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'CRM',
    icon: Kanban,
    items: [
      { label: 'Pipeline Jobs', href: '/pipeline', icon: GitBranch },
      { label: 'Pipeline Companies', href: '/pipeline-companies', icon: Handshake },
    ],
  },
  {
    label: 'Lists',
    icon: List,
    items: [
      { label: 'Companies', href: '/companies', icon: Building2 },
      {
        label: 'Jobs',
        href: '/jobs',
        icon: Briefcase,
        subItems: [
          { label: 'Jobs Permanent', type: 'PERMANENT' },
          { label: 'Jobs Temporary', type: 'TEMPORARY' },
        ],
      },
      { label: 'Candidates', href: '/candidates', icon: Users },
      { label: 'Active Jobs Temporary', href: '/active-jobs-temporary', icon: Briefcase },
      { label: 'Completed Jobs', href: '/completed-contracts', icon: FileCheck },
      { label: 'Active Employees', href: '/applications', icon: Trophy },
      { label: 'Rejected Applicants', href: '/rejected-applicants', icon: UserX },
    ],
  },
  {
    label: 'Revenue',
    icon: DollarSign,
    adminOnly: true,
    items: [
      { label: 'Fees', href: '/fees', icon: DollarSign },
      { label: 'Retainers', href: '/retainers', icon: Wallet },
      { label: 'Timesheets', href: '/timesheets', icon: ClipboardCheck },
      { label: 'Weekly payroll', href: '/payroll', icon: CalendarClock },
      { label: 'Payslips', href: '/payslips', icon: ReceiptText },
      { label: 'Commission', href: '/commissions', icon: Percent },
    ],
  },
  {
    label: 'Administration',
    icon: ShieldCheck,
    items: [
      { label: 'My Profile', href: '/profile', icon: UserCircle },
      { label: 'Notifications', href: '/notifications', icon: Bell },
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

export function isAdminSession(session: { permissions?: string[] } | undefined): boolean {
  return Boolean(session?.permissions?.includes(ADMIN_PERMISSION));
}

/** The categories (and their pages) an admin can give to a user: all of them, without exception. */
export const ASSIGNABLE_NAV_GROUPS: NavGroup[] = NAV_GROUPS;

/** Pages that are the admin's unless they are ticked for a user: an empty list never includes them. */
export const RESTRICTED_SECTIONS: string[] = NAV_GROUPS.flatMap((group) => group.items.filter((item) => group.adminOnly || item.adminOnly).map((item) => item.href));

/**
 * Whether a member with these `allowedSections` may open the page. An empty list means no restriction — except for
 * the admin's pages (Revenue), which have to be ticked.
 */
/** Pages that follow another page's permission: whoever may open the parent may open these too (no need to tick them again). */
const FOLLOWS_PAGE: Record<string, string> = { '/active-jobs-temporary': '/applications' };

/** Pages a role opens by its permissions (the same rule as the API's section guard). */
export const SECTION_PERMISSIONS: Record<string, string[]> = {
  '/timesheets': ['payroll:view', 'payroll:approve'],
  '/payroll': ['payroll:view', 'payroll:approve'],
  '/commissions': ['commission:manage'],
};

export function isSectionAllowed(href: string, allowedSections: string[] | undefined, permissions?: string[]): boolean {
  href = FOLLOWS_PAGE[href] ?? href;
  if (SECTION_PERMISSIONS[href]?.some((key) => permissions?.includes(key))) return true;
  if (RESTRICTED_SECTIONS.includes(href)) return Boolean(allowedSections?.includes(href));
  if (!allowedSections || allowedSections.length === 0) return true;
  return allowedSections.includes(href);
}

/**
 * The groups/items the current user may see. Until the session is known, only items visible to everyone are
 * shown. `allowedSections` narrows a member's menu to the pages the admin chose; it never applies to admins.
 */
export function visibleNavGroups(isAdmin: boolean, allowedSections?: string[], permissions?: string[]): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => (isAdmin ? !item.memberOnly : isSectionAllowed(item.href, allowedSections, permissions))),
  }))
    .filter((group) => group.items.length > 0);
}

/** The sidebar page a path belongs to ("/candidates/abc" -> "/candidates"), if any. */
export function navHrefOf(pathname: string | null): string | null {
  if (!pathname) return null;
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return item.href;
    }
  }
  return null;
}
