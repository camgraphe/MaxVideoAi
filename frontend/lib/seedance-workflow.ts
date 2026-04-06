import type { Mode } from '@/types/engines';

type AssetKind = 'image' | 'video' | 'audio';
type AssetEntry = { kind?: AssetKind | null } | null | undefined;

export type SeedanceAssetMap = Record<string, AssetEntry[] | undefined>;
export type SeedanceFieldBlockKey = 'clearReferences' | 'clearStartEnd' | null;

export const UNIFIED_SEEDANCE_ENGINE_IDS = new Set(['seedance-2-0', 'seedance-2-0-fast']);
export const SEEDANCE_START_END_FIELD_IDS = new Set(['image_url', 'input_image', 'image', 'end_image_url']);
export const SEEDANCE_REFERENCE_IMAGE_FIELD_IDS = new Set(['image_urls']);
export const SEEDANCE_REFERENCE_VIDEO_FIELD_IDS = new Set(['video_urls']);
export const SEEDANCE_REFERENCE_AUDIO_FIELD_IDS = new Set(['audio_urls']);
export const SEEDANCE_REFERENCE_FIELD_IDS = new Set([
  ...SEEDANCE_REFERENCE_IMAGE_FIELD_IDS,
  ...SEEDANCE_REFERENCE_VIDEO_FIELD_IDS,
  ...SEEDANCE_REFERENCE_AUDIO_FIELD_IDS,
]);

function hasAssetKind(entries: AssetEntry[] | undefined, kind: AssetKind): boolean {
  return Boolean(entries?.some((entry) => entry?.kind === kind));
}

export function isUnifiedSeedanceEngineId(engineId?: string | null): boolean {
  return typeof engineId === 'string' && UNIFIED_SEEDANCE_ENGINE_IDS.has(engineId);
}

export function getSeedanceAssetState(inputAssets: SeedanceAssetMap) {
  const hasStartImage =
    hasAssetKind(inputAssets.image_url, 'image') ||
    hasAssetKind(inputAssets.input_image, 'image') ||
    hasAssetKind(inputAssets.image, 'image');
  const hasEndImage = hasAssetKind(inputAssets.end_image_url, 'image');
  const hasReferenceImage = hasAssetKind(inputAssets.image_urls, 'image');
  const hasReferenceVideo = hasAssetKind(inputAssets.video_urls, 'video');
  const hasReferenceAudio = hasAssetKind(inputAssets.audio_urls, 'audio');

  return {
    hasStartImage,
    hasEndImage,
    hasStartOrEndImage: hasStartImage || hasEndImage,
    hasReferenceImage,
    hasReferenceVideo,
    hasReferenceAudio,
    hasReferenceMedia: hasReferenceImage || hasReferenceVideo,
    hasReferenceInputs: hasReferenceImage || hasReferenceVideo || hasReferenceAudio,
  };
}

export function getUnifiedSeedanceMode(inputAssets: SeedanceAssetMap): Mode {
  const state = getSeedanceAssetState(inputAssets);
  if (state.hasReferenceInputs) return 'ref2v';
  if (state.hasStartOrEndImage) return 'i2v';
  return 't2v';
}

export function getSeedanceFieldBlockKey(
  fieldId: string | null | undefined,
  inputAssets: SeedanceAssetMap,
  fieldHasOwnAssets = false
): SeedanceFieldBlockKey {
  if (!fieldId || fieldHasOwnAssets) return null;
  const state = getSeedanceAssetState(inputAssets);

  if (SEEDANCE_START_END_FIELD_IDS.has(fieldId) && state.hasReferenceInputs) {
    return 'clearReferences';
  }
  if (SEEDANCE_REFERENCE_FIELD_IDS.has(fieldId) && state.hasStartOrEndImage) {
    return 'clearStartEnd';
  }
  return null;
}
