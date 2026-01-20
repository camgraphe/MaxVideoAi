import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { AdminAuthError, requireAdmin } from '@/server/admin';
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

  return <AdminShellLayout>{children}</AdminShellLayout>;
}
