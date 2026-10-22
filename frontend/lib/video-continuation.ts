import type { AssetBrowserAsset } from '@/components/library/AssetLibraryBrowser';
import type { EngineCaps } from '@/types/engines';
import { isEngineModeRuntimeAvailable } from '@/lib/engine-mode-availability';
import { resolveEngineMediaFieldConstraint, validateMediaFileAgainstConstraint } from '@/lib/media-field-constraints';

export type VideoContinuationMode = 'extend' | 'v2v';

/** Use only the account-visible catalog. This chooses a destination, not generation approval. */
export function getVideoContinuationEngine(
  engines: readonly EngineCaps[], asset: AssetBrowserAsset, mode: VideoContinuationMode, sourceEngineId?: string | null,
): EngineCaps | null {
  if (asset.kind !== 'video' || !asset.url) return null;
  const available = engines.filter(engine => {
    if (!engine.modes.includes(mode) || !['available', 'limited'].includes(engine.availability)
      || engine.status === 'maintenance' || !isEngineModeRuntimeAvailable(engine, mode)) return false;
    // Veo extension requires a Veo source; other editors need not match the source generator.
    if (mode === 'extend' && engine.id.startsWith('veo-') && !sourceEngineId?.startsWith('veo-')) return false;
    return [...engine.inputSchema?.required ?? [], ...engine.inputSchema?.optional ?? []].some(field => {
      if (field.type !== 'video' || (field.modes?.length && !field.modes.includes(mode))) return false;
      if (typeof asset.durationSec === 'number' && Number.isFinite(asset.durationSec) && asset.durationSec > 0
        && ((field.minDurationSec != null && asset.durationSec < field.minDurationSec)
          || (field.maxDurationSec != null && asset.durationSec > field.maxDurationSec))) return false;
      const constraint = resolveEngineMediaFieldConstraint({ engine, field });
      // Missing facts are qualified at the destination. Do not infer a codec from an opaque read URL.
      return validateMediaFileAgainstConstraint({ name: asset.url, mimeType: asset.mime ?? '', sizeBytes: asset.size ?? 0,
        constraint: asset.mime ? constraint : { ...constraint, acceptedMimeTypes: [], acceptedFileExtensions: [] },
      }).ok;
    });
  });
  return available.find(engine => engine.id === sourceEngineId)
    ?? available.find(engine => engine.id === 'seedance-2-5') ?? available[0] ?? null;
}

type OriginalFetcher = (url: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'json'>>;

/** Resolve the clicked output, never the first render, its poster or its playback derivative. */
export async function resolveMediaContinuationOriginal(asset: AssetBrowserAsset, fetcher: OriginalFetcher): Promise<AssetBrowserAsset> {
  if (asset.source !== 'gallery') return asset;
  if (!asset.jobId) throw new Error('Original job is missing');
  const params = new URLSearchParams({ kind: asset.kind, jobId: asset.jobId, limit: '60' });
  const response = await fetcher(`/api/media-library/recent-outputs?${params}`, { signal: AbortSignal.timeout(10_000) });
  const payload = await response.json();
  const found = response.ok && payload?.ok && Array.isArray(payload.outputs)
    ? payload.outputs.find((entry: AssetBrowserAsset & { status?: string }) => entry.id && entry.url === asset.url
      && entry.kind === asset.kind && ['ready', 'completed', 'succeeded'].includes(entry.status ?? '')) : null;
  if (!found) throw new Error('Original is not ready');
  return { ...asset, ...found, url: asset.url, sourceOutputId: found.id, source: 'recent' };
}
