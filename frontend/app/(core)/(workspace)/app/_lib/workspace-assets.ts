import type { ComposerAttachment, AssetFieldConfig } from '@/components/Composer';
import type { KlingElementAsset } from '@/components/KlingElementsBuilder';
import type { EngineInputField } from '@/types/engines';

export type ReferenceAsset = {
  id: string;
  fieldId: string;
  previewUrl: string;
  kind: 'image' | 'video' | 'audio';
  name: string;
  size: number;
  type: string;
  url?: string;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
  assetId?: string;
  status: 'uploading' | 'ready' | 'error';
  error?: string;
};

export type UserAsset = {
  id: string;
  url: string;
  kind: 'image' | 'video' | 'audio';
  width?: number | null;
  height?: number | null;
  size?: number | null;
  mime?: string | null;
  source?: string | null;
  createdAt?: string;
  canDelete?: boolean;
  jobId?: string | null;
  sourceOutputId?: string | null;
};

export type AssetLibrarySource = 'all' | 'upload' | 'generated' | 'recent' | 'character' | 'angle' | 'upscale';
export type AssetLibraryKind = 'image' | 'video';

export type AssetPickerTarget =
  | { kind: 'field'; field: EngineInputField; slotIndex?: number }
  | { kind: 'kling'; elementId: string; slot: 'frontal' | 'reference'; slotIndex?: number };

export const PRIMARY_IMAGE_SLOT_IDS = ['image_url', 'input_image', 'image'] as const;
export const PRIMARY_VIDEO_SLOT_IDS = ['video_url', 'input_video', 'video'] as const;

export function buildAssetLibraryCacheKey(kind: AssetLibraryKind, source: AssetLibrarySource): string {
  return `${kind}:${source}`;
}

export function buildAssetLibraryUrl(kind: AssetLibraryKind, source: AssetLibrarySource): string {
  if (source === 'recent') {
    return `/api/media-library/recent-outputs?limit=60&kind=${encodeURIComponent(kind)}`;
  }
  if (source === 'all') {
    return `/api/media-library/assets?limit=60&kind=${encodeURIComponent(kind)}`;
  }
  return `/api/media-library/assets?limit=60&kind=${encodeURIComponent(kind)}&source=${encodeURIComponent(source)}`;
}

export function normalizeAssetLibraryPayload(
  payload: unknown,
  source: AssetLibrarySource,
  kind: AssetLibraryKind
): UserAsset[] {
  const isRecentOutputSource = source === 'recent';
  const record =
    payload && typeof payload === 'object'
      ? (payload as { assets?: unknown; outputs?: unknown })
      : {};
  const rawItems = isRecentOutputSource ? record.outputs : record.assets;
  const assets = Array.isArray(rawItems)
    ? (rawItems as Array<Omit<UserAsset, 'canDelete'> & {
        thumbUrl?: string | null;
        sourceOutputId?: string | null;
        jobId?: string | null;
      }>).map((asset) => {
        const mime = asset.mime ?? null;
        return {
          id: asset.id,
          url: asset.url,
          kind: mime?.startsWith('video/') ? 'video' : 'image',
          width: asset.width ?? null,
          height: asset.height ?? null,
          size: asset.size ?? null,
          mime,
          source: isRecentOutputSource ? 'recent' : asset.source ?? null,
          createdAt: asset.createdAt,
          canDelete: !isRecentOutputSource,
          jobId: asset.jobId ?? null,
          sourceOutputId: asset.sourceOutputId ?? (isRecentOutputSource ? asset.id : null),
        } satisfies UserAsset;
      })
    : [];
  const filteredAssets = assets.filter((asset) =>
    kind === 'video'
      ? Boolean(asset.mime?.startsWith('video/'))
      : !asset.mime || asset.mime.startsWith('image/')
  );
  return filteredAssets.filter(
    (asset, index, list) => list.findIndex((entry) => entry.url === asset.url) === index
  );
}

export function revokeAssetPreview(asset: ReferenceAsset | null | undefined) {
  if (!asset) return;
  if (asset.previewUrl.startsWith('blob:')) {
    URL.revokeObjectURL(asset.previewUrl);
  }
}

export function revokeKlingAssetPreview(asset: Pick<KlingElementAsset, 'previewUrl'> | null | undefined) {
  if (!asset) return;
  if (asset.previewUrl && asset.previewUrl.startsWith('blob:')) {
    URL.revokeObjectURL(asset.previewUrl);
  }
}

export function getReferenceInputStatus(inputAssets: Record<string, (ReferenceAsset | null)[]>) {
  let hasImage = false;
  let hasVideo = false;
  let hasAudio = false;
  Object.values(inputAssets).forEach((entries) => {
    entries.forEach((asset) => {
      if (!asset) return;
      if (asset.kind === 'image') {
        hasImage = true;
      }
      if (asset.kind === 'video') {
        hasVideo = true;
      }
      if (asset.kind === 'audio') {
        hasAudio = true;
      }
    });
  });
  return { hasImage, hasVideo, hasAudio };
}

export function hasInputAssetInSlots(
  inputAssets: Record<string, (ReferenceAsset | null)[]>,
  slotIds: readonly string[],
  kind: ReferenceAsset['kind']
): boolean {
  return slotIds.some((fieldId) => (inputAssets[fieldId] ?? []).some((asset) => asset?.kind === kind));
}

export function buildAssetFieldIdSet(
  assetFields: AssetFieldConfig[],
  predicate: (entry: AssetFieldConfig) => boolean
): Set<string> {
  const ids = assetFields
    .filter((entry) => predicate(entry) && typeof entry.field.id === 'string')
    .map((entry) => entry.field.id as string);
  return new Set(ids);
}

export function buildReferenceAudioFieldIds(
  assetFields: AssetFieldConfig[],
  referenceAudioFieldIds: ReadonlySet<string>
): Set<string> {
  return buildAssetFieldIdSet(
    assetFields.filter((entry) => entry.field.type === 'audio' && referenceAudioFieldIds.has(entry.field.id)),
    () => true
  );
}

export function getPrimaryAssetFieldLabel(assetFields: AssetFieldConfig[]): string {
  const primaryField = assetFields.find((entry) => entry.role === 'primary')?.field;
  return primaryField?.label ?? 'Reference image';
}

export function buildComposerAttachments(
  inputAssets: Record<string, (ReferenceAsset | null)[]>
): Record<string, (ComposerAttachment | null)[]> {
  const map: Record<string, (ComposerAttachment | null)[]> = {};
  Object.entries(inputAssets).forEach(([fieldId, entries]) => {
    map[fieldId] = entries.map((asset) =>
      asset
        ? {
            kind: asset.kind,
            name: asset.name,
            size: asset.size,
            type: asset.type,
            previewUrl: asset.previewUrl,
            status: asset.status,
            error: asset.error,
          }
        : null
    );
  });
  return map;
}
