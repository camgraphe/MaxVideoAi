import { canonicalMediaAssetFields } from '@/lib/media-identity';
import type { ToolAssetRef } from '@/lib/toolbox/contract';
import type { ToolMediaKind } from '@/lib/toolbox/catalogue';

export type CreatorSource = {
  ref: ToolAssetRef;
  url: string;
  name: string;
  thumbnailUrl?: string | null;
  durationSec?: number;
};

/** UI identity only; the operation service re-resolves ownership and media facts. */
export function selectCreatorSource(value: unknown, kind: ToolMediaKind, name = ''): CreatorSource {
  if (!value || typeof value !== 'object') throw new Error('Source unavailable.');
  const asset = value as Record<string, unknown>;
  let { ref } = canonicalMediaAssetFields(asset.assetId ?? asset.id, kind) as { ref: ToolAssetRef | null };
  if (!ref && typeof asset.jobId === 'string' && asset.jobId.length > 0 && asset.jobId.length <= 256
    && typeof asset.sourceOutputId === 'string' && asset.sourceOutputId.length > 0 && asset.sourceOutputId.length <= 256) {
    ref = { type: 'job-output', jobId: asset.jobId, outputId: asset.sourceOutputId, kind };
  }
  if (!ref || typeof asset.url !== 'string' || !['https:', 'http:'].includes(new URL(asset.url).protocol)) throw new Error('Source unavailable.');
  if ((asset.kind && asset.kind !== kind) || (typeof asset.mime === 'string' && !asset.mime.startsWith(`${kind}/`))) throw new Error('Incompatible source.');
  return {
    ref, url: asset.url, name: name || (typeof asset.name === 'string' ? asset.name : ''),
    thumbnailUrl: typeof asset.thumbUrl === 'string' ? asset.thumbUrl : null,
    ...(typeof asset.durationSec === 'number' && Number.isFinite(asset.durationSec) && asset.durationSec > 0 ? { durationSec: asset.durationSec } : {}),
  };
}
