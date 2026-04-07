'use client';

import Link from 'next/link';
import { useId } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import {
  BadgeDollarSign,
  Bell,
  ClipboardList,
  Cpu,
  FileDown,
  FileText,
  Globe,
  Home,
  LayoutDashboard,
  LineChart,
  ListChecks,
  ListVideo,
  MailCheck,
  Palette,
  Receipt,
  Scale,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { UIIcon } from '@/components/ui/UIIcon';
import type { AdminNavBadge, AdminNavBadgeMap, AdminNavBadgeTone, AdminNavGroup, AdminNavItem } from '@/lib/admin/navigation';
import { isAdminNavMatch } from '@/lib/admin/navigation';

const ADMIN_ICON_MAP: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  bell: Bell,
  users: Users,
  jobs: ListChecks,
  transactions: Receipt,
  audit: ClipboardList,
  engines: Cpu,
  pricing: BadgeDollarSign,
  moderation: FileText,
  playlists: ListVideo,
  homepage: Home,
  insights: LineChart,
  legal: Scale,
  marketing: MailCheck,
  consents: FileDown,
  palette: Palette,
  globe: Globe,
  examples: ListVideo,
  workflows: ListChecks,
  models: Cpu,
  docs: FileText,
  blog: FileText,
  changelog: FileText,
  about: FileText,
  contact: MailCheck,
  status: Bell,
};

type SidebarNavProps = {
  groups: AdminNavGroup[];
  badges?: AdminNavBadgeMap;
  mobileOpen: boolean;
  onMobileClose: () => void;
};

const BADGE_TONE_CLASS: Record<AdminNavBadgeTone, string> = {
  info: 'border-[var(--admin-sidebar-border)] bg-[var(--admin-sidebar-surface)] text-[var(--admin-sidebar-text-muted)]',
  warn: 'border-warning-border bg-warning-bg text-warning',
};

export function SidebarNav({ groups, badges, mobileOpen, onMobileClose }: SidebarNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tooltipBaseId = useId();

  const showCompact = false;
  const primaryGroups = groups.filter((group) => !group.secondary);
  const secondaryGroups = groups.filter((group) => group.secondary);
  const activeSearch = searchParams?.toString();

  const renderNavItem = (item: AdminNavItem, groupId: string) => {
    const isActive = isAdminNavMatch(pathname, item.href);
    const href = isActive && activeSearch ? `${item.href}?${activeSearch}` : item.href;
    const tooltipId = `${tooltipBaseId}-${groupId}-${item.id}`;
    const IconComponent = ADMIN_ICON_MAP[item.icon] ?? LayoutDashboard;
    const itemBadges = badges?.[item.id] ?? [];

    return (
      <li key={item.id} className="relative">
        <Link
          href={href}
          prefetch={false}
          onClick={mobileOpen ? onMobileClose : undefined}
          className={clsx(
            'group relative flex w-full items-center rounded-xl px-3 py-2.5 text-[13px] font-medium leading-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            showCompact ? 'justify-center px-2' : 'gap-2',
            isActive
              ? 'bg-[var(--admin-sidebar-surface-hover)] text-[var(--admin-sidebar-text)]'
              : 'text-[var(--admin-sidebar-text-muted)] hover:bg-[var(--admin-sidebar-surface)] hover:text-[var(--admin-sidebar-text)]'
          )}
          aria-current={isActive ? 'page' : undefined}
          aria-describedby={showCompact ? tooltipId : undefined}
        >
          <span
            className={clsx(
              'pointer-events-none absolute left-1 top-1/2 h-[60%] w-[3px] -translate-y-1/2 rounded-full bg-brand transition-opacity',
              isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'
            )}
            aria-hidden
          />
          <span
            className={clsx(
              'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
              isActive
                ? 'bg-[var(--admin-sidebar-surface-hover)] text-[var(--admin-sidebar-text)]'
                : 'bg-transparent text-[var(--admin-sidebar-text-faint)] group-hover:bg-[var(--admin-sidebar-surface)] group-hover:text-[var(--admin-sidebar-text)]'
            )}
            aria-hidden
          >
            <UIIcon icon={IconComponent} size={16} />
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate">{item.label}</span>
            {itemBadges.length ? (
              <span className="ml-auto flex items-center gap-1">
                {itemBadges.map((badge: AdminNavBadge, index) => {
                  const tone = badge.tone ?? 'info';
                  return (
                    <span
                      key={`${item.id}-badge-${index}`}
                      className={clsx(
                        'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold',
                        BADGE_TONE_CLASS[tone]
                      )}
                    >
                      {badge.label}
                    </span>
                  );
                })}
              </span>
            ) : null}
          </span>
        </Link>
        {showCompact ? (
          <div
            id={tooltipId}
            role="tooltip"
            className="pointer-events-none absolute left-full top-1/2 z-50 hidden -translate-y-1/2 whitespace-nowrap rounded-card border border-border bg-surface px-3 py-1 text-xs font-semibold text-text-secondary opacity-0 shadow-card transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 md:block"
          >
            {item.label}
          </div>
        ) : null}
      </li>
    );
  };

  const renderGroup = (group: AdminNavGroup, index: number) => {
    const headerClass = clsx(
      'flex w-full items-center justify-between px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]',
      group.secondary ? 'text-[var(--admin-sidebar-text-faint)]' : 'text-[var(--admin-sidebar-text-faint)]'
    );
    const wrapperClass = 'space-y-1';

    return (
      <section key={group.id} className={wrapperClass}>
        <h2 className="sr-only">{group.label}</h2>
        {index > 0 ? <div className="my-1 h-px w-full bg-surface-on-media-25" /> : null}
        <div className={headerClass}>
          <span>{group.label}</span>
        </div>
        <ul id={`admin-group-${group.id}`} className="space-y-1">
          {group.items.map((item) => renderNavItem(item, group.id))}
        </ul>
      </section>
    );
  };

  return (
    <aside
      className={clsx(
        'fixed inset-y-0 left-0 z-40 flex w-[18rem] flex-col border-r border-[var(--admin-sidebar-border)] bg-[var(--admin-sidebar-bg)] text-[var(--admin-sidebar-text)] transition-transform duration-200 md:sticky md:top-0 md:bottom-auto md:h-screen md:w-[17rem] md:translate-x-0 md:shadow-none',
        mobileOpen ? 'translate-x-0 shadow-float' : '-translate-x-full',
        'md:translate-x-0'
      )}
      aria-label="Admin navigation"
    >
      <div className="border-b border-[var(--admin-sidebar-border)] px-4 pb-4 pt-4">
        <div className="flex items-center justify-between gap-3">
          <Link href="/admin" className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-xs font-semibold text-on-brand">
              MV
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-semibold text-[var(--admin-sidebar-text)]">MaxVideo Admin</span>
              <span className="text-xs text-[var(--admin-sidebar-text-faint)]">Operations control</span>
            </span>
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onMobileClose}
            className="h-9 w-9 min-h-0 rounded-lg border border-[var(--admin-sidebar-border)] bg-[var(--admin-sidebar-surface)] p-0 text-[var(--admin-sidebar-text-muted)] hover:bg-[var(--admin-sidebar-surface-hover)] hover:text-[var(--admin-sidebar-text)] md:hidden"
          >
            <UIIcon icon={X} size={18} />
            <span className="sr-only">Close navigation</span>
          </Button>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--admin-sidebar-border)] bg-[var(--admin-sidebar-surface)] px-3 py-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--admin-sidebar-text-faint)]">Workspace</p>
            <p className="mt-1 text-sm font-medium text-[var(--admin-sidebar-text)]">Admin</p>
          </div>
          <span className="inline-flex items-center gap-2 text-xs text-[var(--admin-sidebar-text-faint)]">
            <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
            Live
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {primaryGroups.map((group, index) => renderGroup(group, index))}
        </div>
        {secondaryGroups.length ? (
          <div className="mt-4 border-t border-[var(--admin-sidebar-border)] pt-4">
            <div className="space-y-1">
              {secondaryGroups.map((group, index) => renderGroup(group, index))}
            </div>
          </div>
        ) : null}
      </nav>
    </aside>
  );
}
