import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getUserIdFromCookies, isUserAdmin } from '@/server/admin';

export const metadata = {
  title: 'Admin Dashboard — MaxVideoAI',
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const userId = await getUserIdFromCookies();
  if (!userId) {
    redirect(`/login?next=${encodeURIComponent('/admin')}`);
  }
  const admin = await isUserAdmin(userId);
  if (!admin) {
    redirect('/');
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text-primary">
      <header className="border-b border-hairline bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-text-tertiary">MaxVideoAI Admin</p>
            <h1 className="text-lg font-semibold text-text-primary">Control Center</h1>
          </div>
          <nav className="flex gap-4 text-sm">
            <Link className="text-text-secondary transition hover:text-text-primary" href="/admin/users">
              Users
            </Link>
            <Link className="text-text-secondary transition hover:text-text-primary" href="/admin/engines">
              Engines
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:py-12">{children}</main>
    </div>
  );
}
