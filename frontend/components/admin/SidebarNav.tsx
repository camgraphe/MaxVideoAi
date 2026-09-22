'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { LayoutDashboard, Users, Receipt, ListVideo, FolderOpen, Settings, ExternalLink, X } from 'lucide-react';
import type { AdminNavBadgeMap, AdminNavGroup } from '@/lib/admin/navigation';
import { ADMIN_EXTERNAL_LINKS, findAdminNavMatch, isAdminNavMatch } from '@/lib/admin/navigation';

const icons = { overview: LayoutDashboard, users: Users, transactions: Receipt, generations: ListVideo, content: FolderOpen, settings: Settings };

type SidebarNavProps = { groups: AdminNavGroup[]; badges?: AdminNavBadgeMap; mobileOpen: boolean; onMobileClose: () => void };

export function SidebarNav({ groups, mobileOpen, onMobileClose }: SidebarNavProps) {
  const pathname = usePathname();
  const match = findAdminNavMatch(pathname, groups);
  function renderGroup(group: AdminNavGroup) {
    const active = match?.group.id === group.id;
    const Icon = icons[group.id as keyof typeof icons] ?? FolderOpen;
    return <div key={group.id}>
      <Link href={group.items[0].href} prefetch={false} onClick={onMobileClose}
        aria-current={active && group.items.length === 1 ? 'page' : undefined}
        className={clsx('flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors', active ? 'bg-brand/10 text-brand' : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary')}>
        <Icon size={18} aria-hidden="true" /><span>{group.label}</span>
      </Link>
      {active && group.items.length > 1 && !group.secondary ? <ul className="mb-3 ml-5 mt-1 border-l border-border pl-3">
        {group.items.map(item => <li key={item.id}><Link href={item.href} prefetch={false} onClick={onMobileClose}
          aria-current={isAdminNavMatch(pathname, item.href) ? 'page' : undefined}
          className={clsx('block rounded-md px-3 py-2 text-[13px] hover:bg-surface-2', isAdminNavMatch(pathname, item.href) ? 'font-semibold text-brand' : 'text-text-secondary')}>
          {item.label}
        </Link></li>)}
      </ul> : null}
    </div>;
  }
  return <aside aria-label="Admin navigation" className={clsx('fixed inset-y-0 left-0 z-40 flex w-56 shrink-0 flex-col border-r border-border bg-[#f8f9fc] transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0', mobileOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full max-md:invisible')}>
    <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5">
      <Link href="/admin" className="text-base font-semibold tracking-tight text-text-primary">MaxVideoAI<span className="ml-2 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">ADMIN</span></Link>
      <button type="button" onClick={onMobileClose} aria-label="Close navigation" className="rounded p-2 md:hidden"><X size={18} /></button>
    </div>
    <nav aria-label="Workspace" className="flex-1 space-y-1 overflow-y-auto p-3 pt-6">{groups.filter(g => !g.secondary).map(renderGroup)}</nav>
    <div className="space-y-1 border-t border-border p-3">
      {groups.filter(g => g.secondary).map(renderGroup)}
      {ADMIN_EXTERNAL_LINKS.map(link => <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className="flex h-10 items-center justify-between rounded-md px-3 text-sm text-text-secondary hover:bg-surface-2">{link.label}<ExternalLink size={14} aria-hidden="true" /></a>)}
    </div>
  </aside>;
}
