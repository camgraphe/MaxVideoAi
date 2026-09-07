'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/authFetch';
import { AppGlyph } from '@/components/app/AppGlyph';
import { stageMediaHandoff, supportsMediaDestination, type MediaDestination } from '@/lib/media-handoff';
import { mediaActionCopy } from './media-action-copy';
import type { AssetBrowserAsset } from './AssetLibraryBrowser';
export function MediaDestinationActions({ asset, userId, locale, onNavigate }: { asset: AssetBrowserAsset; userId?: string | null; locale: string; onNavigate?: () => void }) {
  const router = useRouter();
  const copy = mediaActionCopy(locale);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const scope = JSON.stringify([userId, asset.id, asset.url]);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  if (!userId) return null;
  const open = async (destination: MediaDestination) => {
    setPending(true); setError(false);
    try {
      let original = asset;
      if (asset.source === 'gallery') {
        const params = new URLSearchParams({ kind: asset.kind, jobId: asset.jobId ?? '', limit: '60' });
        const response = await authFetch(`/api/media-library/recent-outputs?${params}`, { signal: AbortSignal.timeout(10_000) });
        const payload = await response.json();
        const found = response.ok && payload?.ok && Array.isArray(payload.outputs) ? payload.outputs.find((entry: AssetBrowserAsset & { status?: string }) => entry.url === asset.url && entry.kind === asset.kind && ['ready', 'completed', 'succeeded'].includes(entry.status ?? '')) : null;
        if (!found) throw new Error('Original is not ready');
        original = { ...asset, ...found, url: asset.url, sourceOutputId: found.id, source: 'recent' };
      }
      if (!active.current || scopeRef.current !== scope) return;
      router.push(stageMediaHandoff(window.sessionStorage, userId, original, destination, crypto.randomUUID())); onNavigate?.();
    } catch { if (active.current && scopeRef.current === scope) setError(true); }
    finally { if (active.current && scopeRef.current === scope) setPending(false); }
  };
  return <div className="app-media-destinations">
    {supportsMediaDestination(asset, 'image') ? <button type="button" disabled={pending} onClick={() => void open('image')}><AppGlyph name="image" /><span>{copy.image}</span><span aria-hidden>↗</span></button> : null}
    <button type="button" disabled={pending} onClick={() => void open('video')}><AppGlyph name="video" /><span>{asset.kind === 'image' ? copy.animate : copy.video}</span><span aria-hidden>↗</span></button>
    <p>{copy.next}</p>{error ? <p role="alert">{copy.error}</p> : null}
  </div>;
}
