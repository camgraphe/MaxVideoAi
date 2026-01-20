'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import type { AdminNavBadgeMap, AdminNavGroup } from '@/lib/admin/navigation';
import { buildAdminBadges } from '@/lib/admin/badges';
import type { AdminHealthSnapshot } from '@/lib/admin/types';
import { SidebarNav } from '@/components/admin/SidebarNav';
import { AdminTopbar } from '@/components/admin/AdminTopbar';

type AdminHealthResponse =
  | {
      ok: true;
      health: AdminHealthSnapshot;
    }
  | {
      ok: false;
      error?: string;
    };

const fetchJson = async (url: string): Promise<AdminHealthResponse> => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    return { ok: false, error: res.statusText };
  }
  return (await res.json()) as AdminHealthResponse;
};

type AdminShellProps = {
  navGroups: AdminNavGroup[];
  navBadges?: AdminNavBadgeMap;
  children: ReactNode;
};

export function AdminShell({ navGroups, navBadges, children }: AdminShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { data } = useSWR<AdminHealthResponse>('/api/admin/health', fetchJson, {
    refreshInterval: 30000,
    revalidateOnFocus: false,
  });
  const liveBadges = data?.ok ? buildAdminBadges(data.health) : undefined;
  const mergedBadges = useMemo(() => liveBadges ?? navBadges, [liveBadges, navBadges]);

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
          badges={mergedBadges}
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
