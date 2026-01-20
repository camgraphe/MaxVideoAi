import type { ReactNode } from 'react';
import type { AdminNavBadgeMap } from '@/lib/admin/navigation';
import { ADMIN_NAV_GROUPS } from '@/lib/admin/navigation';
import { AdminShell } from '@/components/admin/AdminShell';

type AdminLayoutProps = {
  children: ReactNode;
  navBadges?: AdminNavBadgeMap;
};

export function AdminLayout({ children, navBadges }: AdminLayoutProps) {
  return (
    <AdminShell navGroups={ADMIN_NAV_GROUPS} navBadges={navBadges}>
      {children}
    </AdminShell>
  );
}
