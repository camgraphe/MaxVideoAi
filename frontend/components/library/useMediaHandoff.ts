'use client';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { consumeMediaHandoff, type MediaDestination } from '@/lib/media-handoff';
import type { AssetBrowserAsset } from './AssetLibraryBrowser';

/** One pending original per tab and exact navigation scope; arrival never mutates a draft. */
export function useMediaHandoff(userId: string | null | undefined, destination: MediaDestination) {
  const params = useSearchParams();
  const token = params?.get('media');
  const scope = userId && token ? JSON.stringify([userId, destination, token]) : null;
  const [pending, setPending] = useState<{ scope: string; asset: AssetBrowserAsset } | null>(null);
  // StrictMode replays effects after the storage value has already been consumed.
  const attemptedScope = useRef<string | null>(null);
  useEffect(() => {
    if (attemptedScope.current === scope) return;
    attemptedScope.current = scope;
    setPending(null);
    if (!scope || !userId || !token) return;
    try {
      const asset = consumeMediaHandoff(window.sessionStorage, userId, destination, token);
      if (asset) setPending({ scope, asset });
    } catch { /* Storage can be unavailable; no media is inserted. */ }
  }, [scope, userId, destination, token]);
  return {
    // Hide stale media during render, before the invalidating effect runs.
    asset: pending?.scope === scope ? pending?.asset ?? null : null,
    close: () => setPending((current) => current?.scope === scope ? null : current),
  };
}
