import type { ReactNode } from 'react';
import { ADMIN_NAV_GROUPS } from '@/lib/admin/navigation';
import { AdminShell } from '@/components/admin/AdminShell';

type AdminLayoutProps = {
  children: ReactNode;
};

export function AdminLayout({ children }: AdminLayoutProps) {
  return <AdminShell navGroups={ADMIN_NAV_GROUPS}>{children}</AdminShell>;
}
