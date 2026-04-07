'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronRight, Command, PanelLeftOpen } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { UIIcon } from '@/components/ui/UIIcon';
import { TopbarSearch } from '@/components/admin/TopbarSearch';
import { AdminCommandPalette } from '@/components/admin/AdminCommandPalette';
import type { AdminNavGroup } from '@/lib/admin/navigation';
import { findAdminNavMatch } from '@/lib/admin/navigation';

type AdminTopbarProps = {
  navGroups: AdminNavGroup[];
  onMenuOpen: () => void;
};

export function AdminTopbar({ navGroups, onMenuOpen }: AdminTopbarProps) {
  const [commandOpen, setCommandOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const match = useMemo(() => findAdminNavMatch(pathname, navGroups), [pathname, navGroups]);
  const activeSearch = searchParams?.toString();
  const activeHref = match ? (activeSearch ? `${match.item.href}?${activeSearch}` : match.item.href) : '/admin';

  return (
    <header className="sticky top-0 z-20 border-b border-surface-on-media-25 bg-bg/95 backdrop-blur">
      <div className="mx-auto flex min-h-[64px] w-full max-w-[1480px] flex-wrap items-center gap-3 px-4 py-2 sm:px-6 lg:px-8">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onMenuOpen}
          className="h-9 w-9 min-h-0 rounded-lg border border-surface-on-media-25 bg-surface p-0 text-text-secondary hover:bg-bg hover:text-text-primary md:hidden"
        >
          <UIIcon icon={PanelLeftOpen} size={18} />
          <span className="sr-only">Open navigation</span>
        </Button>
        <div className="min-w-0 flex-1">
          <nav aria-label="Breadcrumbs" className="hidden sm:block">
            <ol className="flex items-center gap-2 text-xs text-text-muted">
              <li>
                <Link href="/admin" className="font-medium text-text-secondary hover:text-text-primary">
                  Admin
                </Link>
              </li>
              {match ? (
                <>
                  <li className="flex items-center gap-2 text-text-tertiary">
                    <UIIcon icon={ChevronRight} size={13} />
                    <span className="uppercase tracking-[0.18em]">{match.group.label}</span>
                  </li>
                </>
              ) : null}
            </ol>
          </nav>
          <div className="mt-0.5 min-w-0">
            <Link
              href={activeHref}
              aria-current="page"
              className="block truncate text-base font-semibold text-text-primary hover:text-text-primary"
            >
              {match?.item.label ?? 'Admin'}
            </Link>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
          <TopbarSearch />
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-surface-on-media-25 bg-surface px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted transition hover:bg-bg"
          >
            <UIIcon icon={Command} size={14} />
            Command
            <span className="rounded-full border border-surface-on-media-25 px-1.5 py-0.5 text-[9px] font-semibold text-text-tertiary">
              Cmd+K
            </span>
          </button>
        </div>
      </div>
      <AdminCommandPalette navGroups={navGroups} open={commandOpen} onOpenChange={setCommandOpen} />
    </header>
  );
}
