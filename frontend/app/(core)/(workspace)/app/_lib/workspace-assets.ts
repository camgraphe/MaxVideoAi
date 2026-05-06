import type { ComposerAttachment, AssetFieldConfig } from '@/components/Composer';
import type { KlingElementAsset, KlingElementState } from '@/components/KlingElementsBuilder';
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

export function getAssetLibrarySourceForField(field: EngineInputField): AssetLibrarySource {
  return field.type === 'video' ? 'recent' : 'all';
}

export function getLibraryAssetFieldMismatchMessage(field: EngineInputField, asset: UserAsset): string | null {
  if (field.type === 'video' && asset.kind !== 'video') {
    return 'This slot requires a video source. Pick a video from the video library or import an MP4/MOV clip.';
  }
  if (field.type === 'image' && asset.kind !== 'image') {
    return 'This slot requires an image source. Pick an image from the library or import one.';
  }
  return null;
}

export function shouldMirrorVideoLibraryAsset(asset: UserAsset): boolean {
  const host = new URL(asset.url).host.toLowerCase();
  return (
    asset.source === 'generated' ||
    asset.source === 'recent' ||
    host === 'fal.media' ||
    host.endsWith('.fal.media')
  );
}

export function shouldMirrorCharacterImageAsset(asset: UserAsset): boolean {
  if (asset.source !== 'character') return false;
  const host = new URL(asset.url).host.toLowerCase();
  return host === 'fal.media' || host.endsWith('.fal.media');
}

export function mergeMirroredLibraryAsset(
  asset: UserAsset,
  mirrored: {
    id: string;
    url: string;
    width?: number | null;
    height?: number | null;
    size?: number | null;
    mime?: string | null;
  }
): UserAsset {
  return {
    ...asset,
    id: mirrored.id,
    url: mirrored.url,
    width: mirrored.width ?? asset.width,
    height: mirrored.height ?? asset.height,
    size: mirrored.size ?? asset.size,
    mime: mirrored.mime ?? asset.mime,
    canDelete: true,
  };
}

export function buildReferenceAssetFromLibraryAsset(field: EngineInputField, asset: UserAsset): ReferenceAsset {
  return {
    id: asset.id || `library_${Date.now().toString(36)}`,
    fieldId: field.id,
    previewUrl: asset.url,
    kind: field.type === 'video' ? 'video' : field.type === 'audio' ? 'audio' : 'image',
    name: asset.url.split('/').pop() ?? (field.type === 'video' ? 'Video' : field.type === 'audio' ? 'Audio' : 'Image'),
    size: asset.size ?? 0,
    type: asset.mime ?? (field.type === 'video' ? 'video/*' : field.type === 'audio' ? 'audio/*' : 'image/*'),
    url: asset.url,
    width: asset.width ?? null,
    height: asset.height ?? null,
    assetId: asset.id,
    status: 'ready',
  };
}

export function insertReferenceAsset(
  previous: Record<string, (ReferenceAsset | null)[]>,
  field: EngineInputField,
  asset: ReferenceAsset,
  slotIndex?: number,
  options?: {
    release?: (asset: ReferenceAsset) => void;
    onMaxReached?: () => void;
  }
): Record<string, (ReferenceAsset | null)[]> {
  const maxCount = field.maxCount ?? 0;
  const current = previous[field.id] ? [...previous[field.id]] : [];

  if (maxCount > 0 && current.length < maxCount) {
    while (current.length < maxCount) {
      current.push(null);
    }
  }

  let targetIndex = typeof slotIndex === 'number' ? slotIndex : -1;
  if (maxCount > 0 && targetIndex >= maxCount) {
    targetIndex = -1;
  }
  if (targetIndex < 0) {
    targetIndex = current.findIndex((entry) => entry === null);
  }
  if (targetIndex < 0) {
    if (maxCount > 0 && current.length >= maxCount) {
      options?.onMaxReached?.();
      return previous;
    }
    current.push(asset);
  } else {
    const existing = current[targetIndex];
    if (existing) {
      options?.release?.(existing);
    }
    current[targetIndex] = asset;
  }

  return { ...previous, [field.id]: current };
}

export function removeReferenceAsset(
  previous: Record<string, (ReferenceAsset | null)[]>,
  field: EngineInputField,
  index: number,
  release?: (asset: ReferenceAsset) => void
): Record<string, (ReferenceAsset | null)[]> {
  const current = previous[field.id];
  if (!current || index < 0 || index >= current.length) return previous;
  const nextList = [...current];
  const toRelease = nextList[index];
  if (toRelease) {
    release?.(toRelease);
  }

  const maxCount = field.maxCount ?? 0;
  if (maxCount > 0) {
    nextList[index] = null;
  } else {
    nextList.splice(index, 1);
  }

  const nextState = { ...previous };
  const hasValues = nextList.some((asset) => asset !== null);

  if (hasValues || (maxCount > 0 && nextList.length)) {
    nextState[field.id] = nextList;
  } else {
    delete nextState[field.id];
  }

  return nextState;
}

export function buildKlingLibraryAsset(asset: UserAsset): KlingElementAsset {
  return {
    id: asset.id || `library_${Date.now().toString(36)}`,
    previewUrl: asset.url,
    kind: 'image',
    name: asset.url.split('/').pop() ?? 'Image',
    status: 'ready',
    url: asset.url,
  };
}

export function insertKlingLibraryAsset(
  elements: KlingElementState[],
  target: Extract<AssetPickerTarget, { kind: 'kling' }>,
  asset: KlingElementAsset,
  release?: (asset: KlingElementAsset | null | undefined) => void
): KlingElementState[] {
  return elements.map((element) => {
    if (element.id !== target.elementId) return element;

    if (target.slot === 'frontal') {
      release?.(element.frontal);
      return { ...element, frontal: asset };
    }

    const references = [...element.references];
    let targetIndex = typeof target.slotIndex === 'number' ? target.slotIndex : references.findIndex((entry) => entry === null);
    if (targetIndex < 0) {
      targetIndex = references.length > 0 ? references.length - 1 : 0;
    }
    if (targetIndex >= references.length) {
      return element;
    }
    release?.(references[targetIndex]);
    references[targetIndex] = asset;
    return { ...element, references };
  });
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
