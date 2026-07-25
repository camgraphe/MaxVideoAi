import type { ComposerAttachment, AssetFieldConfig } from '@/components/Composer';
import type { KlingElementAsset, KlingElementState } from '@/components/KlingElementsBuilder';
import {
  evaluateReferenceBudget,
  resolveEngineReferenceBudgetForValues,
  type ResolvedEngineReferenceBudget,
} from '@/lib/reference-budget';
import type { EngineInputField, EngineInputSchema, Mode } from '@/types/engines';

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

type InputAssetState = Record<string, (ReferenceAsset | null)[]>;

export type ReferenceAssetInsertionResult =
  | {
      accepted: true;
      state: InputAssetState;
      replacedAsset: ReferenceAsset | null;
    }
  | {
      accepted: false;
      state: InputAssetState;
      reason: 'field_limit' | 'reference_budget';
      maxTotal?: number;
      replacedAsset?: undefined;
    };

export type UserAsset = {
  id: string;
  url: string;
  thumbUrl?: string | null;
  previewUrl?: string | null;
  kind: 'image' | 'video' | 'audio';
  width?: number | null;
  height?: number | null;
  size?: number | null;
  durationSec?: number | null;
  mime?: string | null;
  source?: string | null;
  createdAt?: string;
  canDelete?: boolean;
  jobId?: string | null;
  sourceOutputId?: string | null;
};

export type AssetLibrarySource =
  | 'all'
  | 'upload'
  | 'generated'
  | 'recent'
  | 'storyboard'
  | 'character'
  | 'angle'
  | 'upscale';
export type AssetLibraryKind = 'image' | 'video';

export type AssetPickerTarget =
  | { kind: 'field'; field: EngineInputField; slotIndex?: number }
  | { kind: 'kling'; elementId: string; slot: 'frontal' | 'reference' | 'video'; slotIndex?: number };

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
        previewUrl?: string | null;
        durationSec?: number | null;
      }>).map((asset) => {
        const mime = asset.mime ?? null;
        return {
          id: asset.id,
          url: asset.url,
          thumbUrl: asset.thumbUrl ?? null,
          previewUrl: asset.previewUrl ?? null,
          kind: mime?.startsWith('video/') ? 'video' : 'image',
          width: asset.width ?? null,
          height: asset.height ?? null,
          size: asset.size ?? null,
          durationSec: typeof asset.durationSec === 'number' ? asset.durationSec : null,
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
    durationSec?: number | null;
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
    durationSec: mirrored.durationSec ?? asset.durationSec,
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
    durationSec: asset.durationSec ?? null,
    assetId: asset.id,
    status: 'ready',
  };
}

export function tryInsertReferenceAsset(
  previous: InputAssetState,
  field: EngineInputField,
  asset: ReferenceAsset,
  slotIndex?: number,
  options?: {
    inputSchema?: EngineInputSchema | null;
    preferredMode?: Mode;
  }
): ReferenceAssetInsertionResult {
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
    targetIndex = current.findIndex(
      (entry, index) => entry === null && (maxCount <= 0 || index < maxCount)
    );
  }
  if (targetIndex < 0 && maxCount > 0 && current.length >= maxCount) {
    return { accepted: false, state: previous, reason: 'field_limit' };
  }

  const candidate = [...current];
  const replacedAsset = targetIndex >= 0 ? candidate[targetIndex] ?? null : null;
  if (targetIndex < 0) candidate.push(asset);
  else candidate[targetIndex] = asset;
  const candidateState = { ...previous, [field.id]: candidate };
  const budget = resolveEngineReferenceBudgetForValues(
    options?.inputSchema,
    options?.preferredMode ?? 't2v',
    candidateState,
    (entry) => entry?.url ?? entry?.previewUrl ?? null,
    field.id
  );
  if (budget) {
    const evaluation = evaluateReferenceBudget({
      budget,
      valuesByField: candidateState,
      getIdentity: (entry) => entry?.url ?? entry?.previewUrl ?? null,
    });
    if (!evaluation.ok) {
      return {
        accepted: false,
        state: previous,
        reason: 'reference_budget',
        maxTotal: evaluation.maxTotal,
      };
    }
  }
  return {
    accepted: true,
    state: candidateState,
    replacedAsset,
  };
}

export function insertReferenceAsset(
  previous: InputAssetState,
  field: EngineInputField,
  asset: ReferenceAsset,
  slotIndex?: number,
  options?: {
    release?: (asset: ReferenceAsset) => void;
    onMaxReached?: () => void;
    inputSchema?: EngineInputSchema | null;
    preferredMode?: Mode;
    onBudgetReached?: (maxTotal: number) => void;
  }
): InputAssetState {
  const result = tryInsertReferenceAsset(previous, field, asset, slotIndex, {
    inputSchema: options?.inputSchema,
    preferredMode: options?.preferredMode,
  });
  if (!result.accepted) {
    if (result.reason === 'field_limit') options?.onMaxReached?.();
    else options?.onBudgetReached?.(result.maxTotal ?? 0);
    return previous;
  }
  if (result.replacedAsset) options?.release?.(result.replacedAsset);
  return result.state;
}

function inputAssetStatesAreIdentical(
  left: InputAssetState,
  right: InputAssetState
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    const leftItems = left[key];
    const rightItems = right[key];
    if (!rightItems || leftItems.length !== rightItems.length) return false;
    if (leftItems.some((asset, index) => asset !== rightItems[index])) return false;
  }
  return true;
}

export function reconcileReferenceAssets(
  previous: InputAssetState,
  fields: EngineInputField[],
  referenceBudget: ResolvedEngineReferenceBudget | null,
  release?: (asset: ReferenceAsset) => void
): InputAssetState {
  const fieldsById = new Map(fields.map((field) => [field.id, field]));

  if (!referenceBudget) {
    const next: InputAssetState = {};
    for (const [fieldId, items] of Object.entries(previous)) {
      if (fieldsById.has(fieldId)) {
        next[fieldId] = items;
      } else {
        items.forEach((asset) => {
          if (asset) release?.(asset);
        });
      }
    }
    return inputAssetStatesAreIdentical(previous, next) ? previous : next;
  }

  const next: InputAssetState = {};
  const counted = new Set<string>();
  let aggregateCount = 0;
  const seenFieldIds = new Set<string>();

  for (const field of fields) {
    if (seenFieldIds.has(field.id)) continue;
    seenFieldIds.add(field.id);
    const items = previous[field.id];
    if (!items) continue;

    const retained = [...items];
    const maxCount = field.maxCount ?? 0;
    const shouldCount = referenceBudget.fieldIds.includes(field.id);
    for (let index = 0; index < retained.length; index += 1) {
      const asset = retained[index];
      if (!asset) continue;
      if (maxCount > 0 && index >= maxCount) {
        release?.(asset);
        retained[index] = null;
        continue;
      }
      if (!shouldCount) continue;

      const identity = (asset.url ?? asset.previewUrl).trim();
      const consumesUnit = !referenceBudget.countUniqueUrls || !counted.has(identity);
      if (consumesUnit && aggregateCount >= referenceBudget.maxTotal) {
        release?.(asset);
        retained[index] = null;
        continue;
      }
      if (consumesUnit) {
        aggregateCount += 1;
        counted.add(identity);
      }
    }
    if (retained.some((asset) => asset !== null)) {
      next[field.id] = retained;
    }
  }

  for (const [fieldId, items] of Object.entries(previous)) {
    if (!fieldsById.has(fieldId)) {
      items.forEach((asset) => {
        if (asset) release?.(asset);
      });
    }
  }

  return inputAssetStatesAreIdentical(previous, next) ? previous : next;
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
  const isVideo = asset.kind === 'video';
  return {
    id: asset.id || `library_${Date.now().toString(36)}`,
    assetId: asset.id,
    previewUrl: asset.previewUrl ?? asset.thumbUrl ?? asset.url,
    kind: isVideo ? 'video' : 'image',
    name: asset.url.split('/').pop() ?? (isVideo ? 'Video' : 'Image'),
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
    if (target.slot === 'video') {
      release?.(element.video);
      return { ...element, video: asset };
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
