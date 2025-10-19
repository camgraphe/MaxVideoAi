import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Admin Dashboard — MaxVideoAI',
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-50">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">MaxVideoAI Admin</p>
            <h1 className="text-lg font-semibold text-white">Control Center</h1>
          </div>
          <nav className="flex gap-4 text-sm">
            <Link className="text-slate-200 transition hover:text-white" href="/admin/users">
              Users
            </Link>
            <Link className="text-slate-200 transition hover:text-white" href="/admin/engines">
              Engines
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
