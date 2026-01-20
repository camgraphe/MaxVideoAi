import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import type { AdminNavBadgeMap } from '@/lib/admin/navigation';
import { AdminAuthError, requireAdmin } from '@/server/admin';
import { fetchAdminHealth } from '@/server/admin-metrics';
import type { AdminHealthSnapshot } from '@/lib/admin/types';
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

function buildAdminBadges(health: AdminHealthSnapshot): AdminNavBadgeMap {
  const badges: AdminNavBadgeMap = {};
  const jobBadges = [];

  if (health.failedRenders24h > 0) {
    jobBadges.push({ label: `Failed ${health.failedRenders24h}`, tone: 'warn' });
  }

  if (health.stalePendingJobs > 0) {
    jobBadges.push({ label: `Pending ${health.stalePendingJobs}`, tone: 'info' });
  }

  if (jobBadges.length) {
    badges.jobs = jobBadges;
  }

  if (health.serviceNotice.active) {
    badges['service-notice'] = [{ label: 'Active', tone: 'warn' }];
  }

  return badges;
}
