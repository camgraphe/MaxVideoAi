'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronRight, Command, Dot, PanelLeftOpen } from 'lucide-react';
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
    <header className="sticky top-0 z-20 border-b border-border bg-bg/92 backdrop-blur">
      <div className="mx-auto w-full max-w-[1520px] px-4 py-3 sm:px-6 lg:px-8">
        <div className="md:hidden">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onMenuOpen}
              className="h-11 w-11 min-h-0 rounded-xl border border-border bg-surface p-0 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
            >
              <UIIcon icon={PanelLeftOpen} size={18} />
              <span className="sr-only">Open navigation</span>
            </Button>

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{match?.group.label ?? 'Admin'}</p>
              <Link href={activeHref} aria-current="page" className="mt-1 block truncate text-base font-semibold text-text-primary">
                {match?.item.label ?? 'Admin'}
              </Link>
            </div>

            <CommandTrigger compact onClick={() => setCommandOpen(true)} />
          </div>

          <div className="mt-3">
            <TopbarSearch compact />
          </div>
        </div>

        <div className="hidden min-h-[72px] items-center gap-3 md:flex">
          <div className="min-w-0 flex-1">
            <nav aria-label="Breadcrumbs">
              <ol className="flex items-center gap-1.5 text-xs text-text-muted">
                <li>
                  <Link href="/admin" className="font-medium text-text-secondary hover:text-text-primary">
                    Admin
                  </Link>
                </li>
                {match ? (
                  <li className="flex items-center gap-1.5">
                    <UIIcon icon={ChevronRight} size={13} />
                    <span>{match.group.label}</span>
                  </li>
                ) : null}
              </ol>
            </nav>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
              <Link href={activeHref} aria-current="page" className="block truncate text-base font-semibold text-text-primary">
                {match?.item.label ?? 'Admin'}
              </Link>
              <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface px-2.5 py-1 text-[11px] font-medium text-text-secondary">
                <UIIcon icon={Dot} size={18} className="-ml-1 -mr-1 text-success" />
                Live sync 30s
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-[22rem] lg:w-[24rem]">
              <TopbarSearch />
            </div>
            <CommandTrigger onClick={() => setCommandOpen(true)} />
          </div>
        </div>
      </div>

      <AdminCommandPalette navGroups={navGroups} open={commandOpen} onOpenChange={setCommandOpen} />
    </header>
  );
}

function CommandTrigger({
  onClick,
  compact = false,
}: {
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex items-center rounded-xl border border-border bg-surface text-text-secondary transition hover:bg-surface-hover hover:text-text-primary',
        compact ? 'h-11 w-11 justify-center p-0' : 'h-10 gap-2 px-3 text-[11px] font-medium',
      ].join(' ')}
      aria-label="Open command palette"
    >
      <UIIcon icon={Command} size={14} />
      {compact ? null : (
        <>
          <span>Command</span>
          <span className="rounded-md border border-hairline px-1.5 py-0.5 text-[10px] text-text-muted">Cmd+K</span>
        </>
      )}
    </button>
  );
}
