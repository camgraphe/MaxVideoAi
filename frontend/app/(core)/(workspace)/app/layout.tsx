import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { decodeImpersonationTargetCookie, impersonationCookieNames } from '@/lib/admin/impersonation';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function WorkspaceAppLayout({ children }: { children: ReactNode }) {
  const cookieStore = cookies();
  const impersonation = decodeImpersonationTargetCookie(cookieStore.get(impersonationCookieNames.target)?.value ?? null);

  return (
    <>
      {impersonation ? <ImpersonationBanner userId={impersonation.userId} email={impersonation.email} /> : null}
      {children}
    </>
  );
}

function ImpersonationBanner({ userId, email }: { userId: string; email: string | null }) {
  const label = email ?? userId;
  return (
    <div className="bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p>
          You&apos;re currently viewing MaxVideoAI as <span className="font-semibold">{label}</span>. All actions run under their account
          until you exit impersonation.
        </p>
        <form action="/api/admin/impersonate/exit" method="post">
          <button
            type="submit"
            className="rounded-full border border-amber-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-amber-800 transition hover:bg-amber-100"
          >
            Exit impersonation
          </button>
        </form>
      </div>
    </div>
  );
}
