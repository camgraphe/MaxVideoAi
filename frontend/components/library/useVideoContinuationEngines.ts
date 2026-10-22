'use client';

import useSWR from 'swr';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { authFetch } from '@/lib/authFetch';
import type { EngineCaps } from '@/types/engines';

const EMPTY_ENGINES: EngineCaps[] = [];

/** Shared by media dialogs and card shortcuts; no static fallback can expose a private canary. */
export function useVideoContinuationEngines(userId: string | null | undefined, enabled: boolean) {
  const { user, session, loading } = useRequireAuth({ redirectIfLoggedOut: false });
  const accessToken = session?.access_token;
  const ready = enabled && !loading && userId && user?.id === userId && accessToken;
  const { data } = useSWR<EngineCaps[]>(ready ? ['video-continuation-engines', userId] : null, async () => {
    const response = await authFetch('/api/engines', {
      cache: 'no-store', credentials: 'include', headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await response.json();
    if (!response.ok || !payload?.ok || payload.degraded || !Array.isArray(payload.engines)) throw new Error('Destinations unavailable');
    return payload.engines;
  }, { dedupingInterval: 5 * 60_000, keepPreviousData: false, shouldRetryOnError: false });
  return ready ? data ?? EMPTY_ENGINES : EMPTY_ENGINES;
}
