import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AdminAuthError, requireAdmin } from '@/server/admin';
import { AdminNavigation } from '@/components/admin/AdminNavigation';

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

const NAV_SECTIONS: Array<{
  title: string;
  items: Array<{ label: string; href: string }>;
}> = [
  {
    title: 'Curation',
    items: [
      { label: 'Overview', href: '/admin' },
      { label: 'Moderation queue', href: '/admin/moderation' },
      { label: 'Playlists', href: '/admin/playlists' },
      { label: 'Homepage programming', href: '/admin/home' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Users', href: '/admin/users' },
      { label: 'Engines', href: '/admin/engines' },
      { label: 'Pricing rules', href: '/admin/pricing' },
      { label: 'Job audit', href: '/admin/jobs' },
      { label: 'Transactions', href: '/admin/transactions' },
      { label: 'Audit log', href: '/admin/audit' },
    ],
  },
  {
    title: 'Analytics',
    items: [{ label: 'Insights', href: '/admin/insights' }],
  },
  {
    title: 'Compliance',
    items: [
      { label: 'Legal center', href: '/admin/legal' },
      { label: 'Marketing opt-ins', href: '/admin/marketing' },
      { label: 'Consent exports (CSV)', href: '/admin/consents.csv' },
    ],
  },
  {
    title: 'Site',
    items: [
      { label: 'Marketing homepage', href: '/' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Examples gallery', href: '/examples' },
      { label: 'Workflows', href: '/workflows' },
      { label: 'Models catalog', href: '/models' },
      { label: 'Docs', href: '/docs' },
      { label: 'Blog', href: '/blog' },
      { label: 'Changelog', href: '/changelog' },
      { label: 'AI video engines', href: '/ai-video-engines' },
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Status page', href: '/status' },
    ],
  },
];

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

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/admin" className="text-lg font-semibold text-text-primary">
            Admin · MaxVideoAI
          </Link>
          <AdminNavigation sections={NAV_SECTIONS} />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
