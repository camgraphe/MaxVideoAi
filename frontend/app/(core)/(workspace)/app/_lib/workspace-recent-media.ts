import type { AssetFieldConfig } from '@/components/Composer';
import { getMediaInputEligibility } from '@/lib/media-input-eligibility';
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

export type RecentReferenceIssue = 'kind' | 'mode' | 'metadata' | 'duration' | 'size' | 'format' | 'aspect_ratio' | 'dimensions' | 'field_limit' | 'reference_budget';
export function getRecentReferenceIssue(
  asset: UserAsset, entry: AssetFieldConfig, inputAssets: Record<string, (ReferenceAsset | null)[]>,
  schema: EngineInputSchema | null | undefined, mode: Mode, slotIndex?: number, engine?: EngineCaps,
): RecentReferenceIssue | null {
  const { field } = entry;
  if (getLibraryAssetFieldMismatchMessage(field, asset) || !['image', 'video', 'audio'].includes(field.type)) return 'kind';
  const eligibility = getMediaInputEligibility({ asset, field, engine, mode });
  if (eligibility.status === 'blocked') return eligibility.issue ?? 'format';
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
