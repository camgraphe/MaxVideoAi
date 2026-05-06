'use client';

import { useEffect } from 'react';
import { writeLastKnownUserId } from '@/lib/last-known';
import { readBrowserSession, refreshBrowserSession } from '@/lib/supabase-auth-cleanup';

const RETRY_DELAYS_MS = [0, 100, 250, 500, 1000, 1500, 2000, 2500];

function wait(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function AuthFinishClient({ target }: { target: string }) {
  useEffect(() => {
    let cancelled = false;

    async function finish() {
      for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
        await wait(RETRY_DELAYS_MS[attempt] ?? 0);
        if (cancelled) return;

        const session = await readBrowserSession();
        if (cancelled) return;
        if (session?.access_token) {
          writeLastKnownUserId(session.user?.id ?? null);
          window.dispatchEvent(new Event('wallet:invalidate'));
          window.location.replace(target);
          return;
        }

        if (attempt >= 2) {
          const refreshed = await refreshBrowserSession();
          if (cancelled) return;
          if (refreshed?.access_token) {
            writeLastKnownUserId(refreshed.user?.id ?? null);
            window.dispatchEvent(new Event('wallet:invalidate'));
            window.location.replace(target);
            return;
          }
        }
      }

      if (!cancelled) {
        window.location.replace(`/login?mode=signin&next=${encodeURIComponent(target)}`);
      }
    }

    void finish();

    return () => {
      cancelled = true;
    };
  }, [target]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6 text-sm text-text-secondary">
      Completing sign-in...
    </main>
  );
}
