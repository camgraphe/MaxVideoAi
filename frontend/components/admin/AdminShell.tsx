'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { AdminNavBadgeMap, AdminNavGroup } from '@/lib/admin/navigation';
import { SidebarNav } from '@/components/admin/SidebarNav';
import { AdminTopbar } from '@/components/admin/AdminTopbar';

type AdminShellProps = {
  navGroups: AdminNavGroup[];
  navBadges?: AdminNavBadgeMap;
  children: ReactNode;
};

export function AdminShell({ navGroups, navBadges, children }: AdminShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    if (!mobileOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-bg">
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-text-primary/20 backdrop-blur-sm md:hidden"
        />
      ) : null}
      <div className="flex min-h-screen">
        <SidebarNav
          groups={navGroups}
          badges={navBadges}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <div className="flex min-h-screen flex-1 flex-col">
          <AdminTopbar navGroups={navGroups} onMenuOpen={() => setMobileOpen(true)} />
          <main className="flex-1 px-6 py-6">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
