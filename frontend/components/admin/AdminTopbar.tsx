'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronRight, Command, PanelLeftOpen } from 'lucide-react';
import { TopbarSearch } from '@/components/admin/TopbarSearch';
import { AdminCommandPalette } from '@/components/admin/AdminCommandPalette';
import { findAdminNavMatch, type AdminNavGroup } from '@/lib/admin/navigation';

export function AdminTopbar({ navGroups, onMenuOpen }: { navGroups: AdminNavGroup[]; onMenuOpen: () => void }) {
  const [commandOpen, setCommandOpen] = useState(false);
  const match = findAdminNavMatch(usePathname(), navGroups);
  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-4 border-b border-border bg-surface px-4 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onMenuOpen}
        aria-label="Open navigation"
        className="rounded-md border border-border p-2 md:hidden"
      >
        <PanelLeftOpen size={18} />
      </button>
      <nav aria-label="Breadcrumbs" className="hidden min-w-0 items-center gap-2 text-sm text-text-secondary sm:flex">
        <span>{match?.group.label ?? 'Admin'}</span>
        {match && match.item.label !== match.group.label ? (
          <>
            <ChevronRight size={14} />
            <span className="truncate text-text-primary">{match.item.label}</span>
          </>
        ) : null}
      </nav>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none">
        <div className="min-w-0 max-w-[22rem] flex-1">
          <TopbarSearch />
        </div>
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          aria-label="Open command palette"
          className="flex h-9 shrink-0 items-center gap-1 rounded-md border border-border px-2 text-xs text-text-secondary"
        >
          <Command size={14} />
          <span>K</span>
        </button>
      </div>
      <AdminCommandPalette navGroups={navGroups} open={commandOpen} onOpenChange={setCommandOpen} />
    </header>
  );
}
