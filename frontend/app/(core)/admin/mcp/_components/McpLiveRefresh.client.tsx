'use client';

import { useCallback, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';

const ADMIN_LIVE_SYNC_INTERVAL_MS = 30_000;

export function McpLiveRefresh() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    if (document.visibilityState !== 'visible' || isPending) return;
    startTransition(() => router.refresh());
  }, [isPending, router]);

  useEffect(() => {
    const timer = window.setInterval(refresh, ADMIN_LIVE_SYNC_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return null;
}
