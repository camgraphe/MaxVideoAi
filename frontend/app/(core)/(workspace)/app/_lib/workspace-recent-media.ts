import type { AssetFieldConfig } from '@/components/Composer';
import { resolveEngineMediaFieldConstraint, validateMediaFileAgainstConstraint } from '@/lib/media-field-constraints';
import type { EngineCaps, EngineInputSchema, Mode } from '@/types/engines';
import type { RecentOutputsResponse, LibraryKind } from '../library/_lib/library-page-helpers';
import { buildReferenceAssetFromLibraryAsset, getLibraryAssetFieldMismatchMessage, tryInsertReferenceAsset, type ReferenceAsset, type UserAsset } from './workspace-assets';

export const RECENT_MEDIA_LIMIT = 12;
export const RECENT_MEDIA_DRAG_TYPE = 'application/x-maxvideoai-recent-reference';

/** SWR key identity belongs to the authenticated account, kind and exact first page. */
export function recentMediaScope(key: readonly [string, string] | null): string | null {
  return key ? JSON.stringify(key) : null;
}

export function projectRecentMedia(data: RecentOutputsResponse | undefined, kind: LibraryKind): UserAsset[] {
  if (!data?.ok) return [];
  const seen = new Set<string>();
  return data.outputs.filter((output) => {
    if (!output.id || !output.url || output.kind !== kind || seen.has(output.id)) return false;
    try { if (!['https:', 'http:'].includes(new URL(output.url).protocol)) return false; } catch { return false; }
    // An output may be persisted while its job is still preparing. Only ready originals are reusable.
    if (output.status !== 'ready' && output.status !== 'completed' && output.status !== 'succeeded') return false;
    seen.add(output.id);
    return true;
  }).slice(0, RECENT_MEDIA_LIMIT).map((output) => ({
    ...output,
    source: 'recent',
    sourceOutputId: output.id,
    canDelete: false,
  }));
}

export function resolveCurrentRecentAsset(
  selection: { scope: string; id: string; url: string } | null,
  scope: string | null,
  assets: UserAsset[]
): UserAsset | null {
  if (!scope || selection?.scope !== scope) return null;
  return assets.find((asset) => asset.id === selection.id && asset.url === selection.url) ?? null;
}

export type RecentReferenceIssue = 'kind' | 'metadata' | 'duration' | 'size' | 'format' | 'field_limit' | 'reference_budget';
export function getRecentReferenceIssue(
  asset: UserAsset, entry: AssetFieldConfig, inputAssets: Record<string, (ReferenceAsset | null)[]>,
  schema: EngineInputSchema | null | undefined, mode: Mode, slotIndex?: number, engine?: EngineCaps,
): RecentReferenceIssue | null {
  const { field } = entry;
  if (getLibraryAssetFieldMismatchMessage(field, asset) || !['image', 'video', 'audio'].includes(field.type)) return 'kind';
  if (asset.mime && !asset.mime.toLowerCase().startsWith(`${asset.kind}/`)) return 'format';
  if (field.minDurationSec != null || field.maxDurationSec != null) {
    if (!(typeof asset.durationSec === 'number' && Number.isFinite(asset.durationSec) && asset.durationSec > 0)) return 'metadata';
    if ((field.minDurationSec != null && asset.durationSec < field.minDurationSec) || (field.maxDurationSec != null && asset.durationSec > field.maxDurationSec)) return 'duration';
  }
  const constraint = engine ? resolveEngineMediaFieldConstraint({ engine, field }) : {
    maxSizeMB: field.maxSizeMB,
    acceptedMimeTypes: field.acceptedMimeTypes ?? [],
    acceptedFileExtensions: field.acceptedFileExtensions ?? [],
  };
  if (constraint.maxSizeMB != null && !(typeof asset.size === 'number' && Number.isFinite(asset.size) && asset.size > 0)) return 'metadata';
  if (constraint.acceptedMimeTypes.length && !asset.mime) return 'metadata';
  const validation = validateMediaFileAgainstConstraint({ name: asset.url, mimeType: asset.mime ?? '', sizeBytes: asset.size ?? 0, constraint });
  if (!validation.ok) return validation.reason;
  const insertion = tryInsertReferenceAsset(inputAssets, field, buildReferenceAssetFromLibraryAsset(field, asset), slotIndex, { inputSchema: schema, preferredMode: mode });
  return insertion.accepted ? null : insertion.reason;
}

/** Metadata may enrich only the exact owned original that is still selected. */
export function mergeRecentMetadata(asset: UserAsset, userId: string | null | undefined, metadata: unknown): UserAsset | null {
  if (!userId || !metadata || typeof metadata !== 'object') return null;
  const value = metadata as Record<string, unknown>;
  if (value.userId !== userId || value.id !== asset.id || value.url !== asset.url || value.kind !== asset.kind) return null;
  if (!(typeof value.size === 'number' && Number.isFinite(value.size) && value.size > 0)) return null;
  const mime = typeof value.mime === 'string' ? value.mime : asset.mime;
  if (mime && !mime.toLowerCase().startsWith(`${asset.kind}/`)) return null;
  return { ...asset, size: value.size, mime };
}
