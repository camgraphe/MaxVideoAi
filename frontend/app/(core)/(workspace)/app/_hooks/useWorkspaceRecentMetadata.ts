'use client';

import { useEffect, useState } from 'react';
import { authFetch } from '@/lib/authFetch';
import type { UserAsset } from '../_lib/workspace-assets';
import { mergeRecentMetadata } from '../_lib/workspace-recent-media';

/** Runs only for an explicitly selected original; closing/changing the selection aborts its read. */
export function useWorkspaceRecentMetadata(asset: UserAsset | null, userId: string | null | undefined, required: boolean) {
  const key = required && asset && userId ? JSON.stringify([userId, asset.id, asset.url]) : null;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; attempt: number; asset: unknown; failed: boolean } | null>(null);
  const assetId = asset?.id;
  const assetUrl = asset?.url;
  useEffect(() => {
    if (!key || !assetId || !assetUrl || !userId) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    let active = true;
    void (async () => {
      try {
        const response = await authFetch(`/api/media-library/recent-outputs/metadata?outputId=${encodeURIComponent(assetId)}`, { signal: controller.signal });
        const payload = await response.json();
        const resolved = response.ok && payload?.ok ? payload.asset : null;
        if (active) setResult({ key, attempt, asset: resolved, failed: !resolved });
      } catch {
        if (active) setResult({ key, attempt, asset: null, failed: true });
      } finally { window.clearTimeout(timeout); }
    })();
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [key, assetId, assetUrl, userId, attempt]);
  const current = key && result?.key === key && result.attempt === attempt ? result : null;
  const merged = asset && current?.asset ? mergeRecentMetadata(asset, userId, current.asset) : null;
  return {
    asset: merged ?? asset,
    loading: Boolean(key && !current),
    error: Boolean(key && current && (current.failed || !merged)),
    retry: () => setAttempt((value) => value + 1),
  };
}
