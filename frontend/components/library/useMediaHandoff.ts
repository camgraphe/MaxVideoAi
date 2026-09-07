'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { consumeMediaHandoff, type MediaDestination } from '@/lib/media-handoff';
import type { AssetBrowserAsset } from './AssetLibraryBrowser';

/** One pending original per tab, account and destination; no draft mutation until confirmation. */
export function useMediaHandoff(userId: string | null | undefined, destination: MediaDestination) {
  const params = useSearchParams();
  const token = params?.get('media');
  const [pending, setPending] = useState<{ userId: string; asset: AssetBrowserAsset } | null>(null);
  useEffect(() => {
    if (!userId || !token) return;
    try {
      const asset = consumeMediaHandoff(window.sessionStorage, userId, destination, token);
      if (asset) setPending({ userId, asset });
    } catch { /* Storage can be unavailable; no media is inserted. */ }
  }, [userId, destination, token]);
  return { asset: pending && pending.userId === userId ? pending.asset : null, close: () => setPending(null) };
}
