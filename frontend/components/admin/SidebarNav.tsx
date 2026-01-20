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
  Receipt,
  Scale,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { UIIcon } from '@/components/ui/UIIcon';
import type { AdminNavGroup, AdminNavItem } from '@/lib/admin/navigation';
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
  mobileOpen: boolean;
  onMobileClose: () => void;
};

export function SidebarNav({ groups, mobileOpen, onMobileClose }: SidebarNavProps) {
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

    return (
      <li key={item.id} className="relative">
        <Link
          href={href}
          prefetch={false}
          onClick={mobileOpen ? onMobileClose : undefined}
          className={clsx(
            'group relative flex w-full items-center rounded-card px-2 py-1 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            showCompact ? 'justify-center px-2' : 'gap-2',
            isActive
              ? 'bg-surface-2 text-text-primary'
              : 'text-text-muted hover:bg-surface-2 hover:text-text-primary'
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
              'flex h-8 w-8 items-center justify-center rounded-card border transition-colors',
              isActive
                ? 'border-brand/30 bg-surface-3 text-text-primary'
                : 'border-transparent bg-surface/70 text-text-muted group-hover:bg-surface-2 group-hover:text-text-primary'
            )}
            aria-hidden
          >
            <UIIcon icon={IconComponent} size={18} />
          </span>
          <span className={clsx('flex-1 truncate', showCompact ? 'md:hidden' : '')}>{item.label}</span>
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
      'flex w-full items-center justify-between px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.2em]',
      group.secondary ? 'text-text-muted' : 'text-text-tertiary'
    );
    const wrapperClass = 'space-y-0.5';

    return (
      <section key={group.id} className={wrapperClass}>
        <h2 className="sr-only">{group.label}</h2>
        {index > 0 ? <div className="my-1 h-px w-full bg-hairline/80" /> : null}
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
        'fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-surface/95 backdrop-blur transition-transform duration-200 md:sticky md:top-0 md:bottom-auto md:h-screen md:w-64 md:translate-x-0 md:shadow-none',
        mobileOpen ? 'translate-x-0 shadow-float' : '-translate-x-full',
        'md:translate-x-0'
      )}
      aria-label="Admin navigation"
    >
      <div className="flex items-center justify-between gap-3 px-4 pb-4 pt-5">
        <Link href="/admin" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-card border border-hairline bg-surface-2 text-xs font-semibold text-text-primary">
            MV
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-text-primary">Admin</span>
            <span className="text-xs text-text-muted">MaxVideoAI</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onMobileClose}
            className="h-9 w-9 min-h-0 rounded-input border border-hairline bg-surface/70 p-0 text-text-secondary hover:bg-surface-2 hover:text-text-primary md:hidden"
          >
            <UIIcon icon={X} size={18} />
            <span className="sr-only">Close navigation</span>
          </Button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-6">
        <div className="space-y-1">
          {primaryGroups.map((group, index) => renderGroup(group, index))}
        </div>
        {secondaryGroups.length ? (
          <div className="mt-2 border-t border-hairline/80 pt-2">
            <div className="space-y-1">
              {secondaryGroups.map((group, index) => renderGroup(group, index))}
            </div>
          </div>
        ) : null}
      </nav>
    </aside>
  );
}
