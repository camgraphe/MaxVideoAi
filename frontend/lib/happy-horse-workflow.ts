import type { Mode } from '@/types/engines';

type AssetKind = 'image' | 'video' | 'audio';
type AssetEntry = { kind?: AssetKind | null } | null | undefined;

export type HappyHorseAssetMap = Record<string, AssetEntry[] | undefined>;

export const HAPPY_HORSE_ENGINE_ID = 'happy-horse-1-0';
export const HAPPY_HORSE_START_IMAGE_FIELD_IDS = new Set(['image_url']);
export const HAPPY_HORSE_R2V_REFERENCE_IMAGE_FIELD_IDS = new Set(['image_urls']);
export const HAPPY_HORSE_EDIT_VIDEO_FIELD_IDS = new Set(['video_url']);
export const HAPPY_HORSE_EDIT_REFERENCE_IMAGE_FIELD_IDS = new Set(['reference_image_urls']);

function hasAssetKind(entries: AssetEntry[] | undefined, kind: AssetKind): boolean {
  return Boolean(entries?.some((entry) => entry?.kind === kind));
}

export function isHappyHorseEngineId(engineId?: string | null): boolean {
  return engineId === HAPPY_HORSE_ENGINE_ID;
}

export function getHappyHorseAssetState(inputAssets: HappyHorseAssetMap) {
  const hasStartImage = hasAssetKind(inputAssets.image_url, 'image');
  const hasR2vReferenceImage = hasAssetKind(inputAssets.image_urls, 'image');
  const hasEditVideo = hasAssetKind(inputAssets.video_url, 'video');
  const hasEditReferenceImage = hasAssetKind(inputAssets.reference_image_urls, 'image');

  return {
    hasStartImage,
    hasR2vReferenceImage,
    hasEditVideo,
    hasEditReferenceImage,
    hasEditInputs: hasEditVideo || hasEditReferenceImage,
    hasAnyInput: hasStartImage || hasR2vReferenceImage || hasEditVideo || hasEditReferenceImage,
  };
}

export function getUnifiedHappyHorseMode(inputAssets: HappyHorseAssetMap): Mode {
  const state = getHappyHorseAssetState(inputAssets);
  if (state.hasEditInputs) return 'v2v';
  if (state.hasR2vReferenceImage) return 'ref2v';
  if (state.hasStartImage) return 'i2v';
  return 't2v';
}
