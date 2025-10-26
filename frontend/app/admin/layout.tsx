import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AdminAuthError, requireAdmin } from '@/server/admin';

export const dynamic = 'force-dynamic';

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
      { label: 'Payouts', href: '/admin/payouts' },
    ],
  },
  {
    title: 'Compliance',
    items: [
      { label: 'Legal center', href: '/admin/legal' },
      { label: 'Consent exports (CSV)', href: '/admin/consents.csv' },
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
          <nav className="flex items-center gap-4 text-sm text-text-secondary">
            {NAV_SECTIONS.map((section) => (
              <details key={section.title} className="relative">
                <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-micro text-text-muted transition hover:text-text-primary [&::-webkit-details-marker]:hidden">
                  {section.title}
                </summary>
                <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-card border border-border bg-white shadow-card">
                  <ul className="divide-y divide-border">
                    {section.items.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className="flex items-center justify-between px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-accentSoft/10 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span>{item.label}</span>
                          <span aria-hidden className="text-xs text-text-muted">→</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
