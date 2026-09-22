'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { AdminNavGroup } from '@/lib/admin/navigation';
import { SidebarNav } from '@/components/admin/SidebarNav';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { AdminFrame } from '@/components/admin-system/shell/AdminFrame';

type AdminShellProps = {
  navGroups: AdminNavGroup[];
  children: ReactNode;
};

export function AdminShell({ navGroups, children }: AdminShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const closeNavigation = useCallback(() => setMobileOpen(false), []);
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

  const sidebar = (
    <SidebarNav groups={navGroups} mobileOpen={mobileOpen} onMobileClose={closeNavigation} />
  );

  const topbar = <AdminTopbar navGroups={navGroups} onMenuOpen={() => setMobileOpen(true)} />;

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-overlay-bg/60 backdrop-blur-sm md:hidden"
        />
      ) : null}
      <AdminFrame sidebar={sidebar} topbar={topbar}>
        {children}
      </AdminFrame>
    </>
  );
}
