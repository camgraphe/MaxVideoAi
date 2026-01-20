'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronRight, PanelLeftOpen } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { UIIcon } from '@/components/ui/UIIcon';
import type { AdminNavGroup } from '@/lib/admin/navigation';
import { findAdminNavMatch } from '@/lib/admin/navigation';

type AdminTopbarProps = {
  navGroups: AdminNavGroup[];
  onMenuOpen: () => void;
};

export function AdminTopbar({ navGroups, onMenuOpen }: AdminTopbarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const match = useMemo(() => findAdminNavMatch(pathname, navGroups), [pathname, navGroups]);
  const activeSearch = searchParams?.toString();
  const activeHref = match ? (activeSearch ? `${match.item.href}?${activeSearch}` : match.item.href) : '/admin';

  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-surface/90 backdrop-blur">
      <div className="mx-auto flex min-h-[64px] w-full max-w-6xl items-center gap-3 px-6 py-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onMenuOpen}
          className="h-9 w-9 min-h-0 rounded-input p-0 text-text-secondary hover:bg-surface-2 hover:text-text-primary md:hidden"
        >
          <UIIcon icon={PanelLeftOpen} size={18} />
          <span className="sr-only">Open navigation</span>
        </Button>
        <nav aria-label="Breadcrumbs" className="flex-1">
          <ol className="flex items-center gap-2 text-sm text-text-muted">
            <li>
              <Link href="/admin" className="font-semibold text-text-primary hover:text-text-primary">
                Admin
              </Link>
            </li>
            {match ? (
              <>
                <li className="flex items-center gap-2 text-text-tertiary">
                  <UIIcon icon={ChevronRight} size={14} />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">
                    {match.group.label}
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <UIIcon icon={ChevronRight} size={14} className="text-text-tertiary" />
                  <Link
                    href={activeHref}
                    aria-current="page"
                    className="font-semibold text-text-primary hover:text-text-primary"
                  >
                    {match.item.label}
                  </Link>
                </li>
              </>
            ) : null}
          </ol>
        </nav>
      </div>
    </header>
  );
}
