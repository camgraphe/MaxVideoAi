import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import type { AdminNavBadgeMap } from '@/lib/admin/navigation';
import { buildAdminBadges } from '@/lib/admin/badges';
import { AdminAuthError, requireAdmin } from '@/server/admin';
import { fetchAdminHealth } from '@/server/admin-metrics';
import { AdminLayout as AdminShellLayout } from '@/components/admin/AdminLayout';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

type AdminLayoutProps = {
  children: ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  try {
    await requireAdmin();
  } catch (error) {
    console.warn('[admin/layout] access denied', error);
    if (error instanceof AdminAuthError && error.status === 401) {
      redirect(`/login?next=${encodeURIComponent('/generate')}`);
    }
    notFound();
  }

  const navBadges = await loadAdminBadges();

  return <AdminShellLayout navBadges={navBadges}>{children}</AdminShellLayout>;
}

async function loadAdminBadges(): Promise<AdminNavBadgeMap | undefined> {
  try {
    const health = await fetchAdminHealth();
    return buildAdminBadges(health);
  } catch (error) {
    console.warn('[admin/layout] failed to load badge snapshot', error);
    return undefined;
  }
}
