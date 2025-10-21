import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AdminAuthError, requireAdmin } from '@/server/admin';

export const dynamic = 'force-dynamic';

type AdminLayoutProps = {
  children: ReactNode;
};

const NAV_SECTIONS: Array<{ title: string; items: Array<{ label: string; href: string }> }> = [
  {
    title: 'Curation',
    items: [
      { label: 'Overview', href: '/admin' },
      { label: 'Moderation', href: '/admin/moderation' },
      { label: 'Playlists', href: '/admin/playlists' },
      { label: 'Homepage', href: '/admin/home' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Users', href: '/admin/users' },
      { label: 'Engines', href: '/admin/engines' },
      { label: 'Pricing', href: '/admin/pricing' },
      { label: 'Payouts', href: '/admin/payouts' },
      { label: 'Transactions', href: '/admin/transactions' },
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
          <nav className="flex items-center gap-6 text-sm text-text-secondary">
            {NAV_SECTIONS.map((section) => (
              <div key={section.title} className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">
                  {section.title}
                </span>
                <div className="flex items-center gap-2">
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="rounded-pill px-3 py-1 font-medium transition hover:bg-accentSoft/10 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
