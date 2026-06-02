import type { KlingElementAsset, KlingElementState } from '@/components/KlingElementsBuilder';
import type { EngineCaps, Mode } from '@/types/engines';
import type { ReferenceAsset } from './workspace-assets';

export const KLING_O3_SOURCE_VIDEO_UNSUPPORTED_MESSAGE =
  'Kling 3.0 Omni 4K does not support source video yet. Remove the source video or switch back to Standard/Pro.';

export const KLING_O3_VIDEO_FRAME_IGNORED_MESSAGE =
  'Source video controls this Omni workflow. Opening and end frames are ignored for video-to-video.';

const OPENING_FRAME_FIELD_IDS = new Set(['image_url', 'start_image_url', 'first_frame_url']);
const END_FRAME_FIELD_IDS = new Set(['end_image_url', 'last_frame_url']);
const REFERENCE_IMAGE_FIELD_IDS = new Set(['image_urls', 'reference_image_urls', 'reference_images']);
const SOURCE_VIDEO_FIELD_IDS = new Set([
  'video_url',
  'video_urls',
  'reference_video_url',
  'reference_video_urls',
  'source_video',
  'input_video',
]);

export type KlingO3AssetState = {
  hasOpeningFrame: boolean;
  hasEndFrame: boolean;
  hasReferenceImages: boolean;
  hasSourceVideo: boolean;
  hasSubjectImageReferences: boolean;
  hasSubjectVideoReference: boolean;
  hasAnyVideoInput: boolean;
};

function hasAssetInSlots(
  inputAssets: Record<string, (ReferenceAsset | null)[]>,
  fieldIds: ReadonlySet<string>,
  kind: ReferenceAsset['kind']
): boolean {
  for (const [fieldId, assets] of Object.entries(inputAssets)) {
    if (!fieldIds.has(fieldId)) continue;
    if (assets.some((asset) => asset?.kind === kind)) return true;
  }
  return false;
}

function isImageElementAsset(asset: KlingElementAsset | null | undefined): boolean {
  return asset?.kind === 'image';
}

function isVideoElementAsset(asset: KlingElementAsset | null | undefined): boolean {
  return asset?.kind === 'video';
}

export function isKlingO3EngineId(engineId: string | null | undefined): boolean {
  return Boolean(engineId?.startsWith('kling-o3-'));
}

export function supportsKlingO3VideoToVideo(engine: Pick<EngineCaps, 'id' | 'modes'> | null | undefined): boolean {
  return Boolean(engine && isKlingO3EngineId(engine.id) && engine.modes.includes('v2v'));
}

export function getKlingO3AssetState({
  inputAssets,
  klingElements,
}: {
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  klingElements: KlingElementState[];
}): KlingO3AssetState {
  const hasSubjectImageReferences = klingElements.some((element) => {
    if (isImageElementAsset(element.frontal)) return true;
    return element.references.some((asset) => isImageElementAsset(asset));
  });
  const hasSubjectVideoReference = klingElements.some((element) => isVideoElementAsset(element.video));
  const hasSourceVideo = hasAssetInSlots(inputAssets, SOURCE_VIDEO_FIELD_IDS, 'video');
  return {
    hasOpeningFrame: hasAssetInSlots(inputAssets, OPENING_FRAME_FIELD_IDS, 'image'),
    hasEndFrame: hasAssetInSlots(inputAssets, END_FRAME_FIELD_IDS, 'image'),
    hasReferenceImages: hasAssetInSlots(inputAssets, REFERENCE_IMAGE_FIELD_IDS, 'image'),
    hasSourceVideo,
    hasSubjectImageReferences,
    hasSubjectVideoReference,
    hasAnyVideoInput: hasSourceVideo || hasSubjectVideoReference,
  };
}

export function resolveKlingO3UnifiedMode({
  engine,
  inputAssets,
  klingElements,
}: {
  engine: Pick<EngineCaps, 'id' | 'modes'> | null | undefined;
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  klingElements: KlingElementState[];
}): Mode {
  if (!engine || !isKlingO3EngineId(engine.id)) return 't2v';
  const assetState = getKlingO3AssetState({ inputAssets, klingElements });
  if (assetState.hasAnyVideoInput) {
    return supportsKlingO3VideoToVideo(engine) ? 'v2v' : 't2v';
  }
  if (assetState.hasReferenceImages || assetState.hasSubjectImageReferences) {
    return engine.modes.includes('ref2v') ? 'ref2v' : engine.modes[0] ?? 't2v';
  }
  if (assetState.hasOpeningFrame || assetState.hasEndFrame) {
    return engine.modes.includes('i2v') ? 'i2v' : engine.modes[0] ?? 't2v';
  }
  return engine.modes.includes('t2v') ? 't2v' : engine.modes[0] ?? 't2v';
}

export function getKlingO3UnsupportedVideoReason({
  engine,
  inputAssets,
  klingElements,
}: {
  engine: Pick<EngineCaps, 'id' | 'modes'> | null | undefined;
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  klingElements: KlingElementState[];
}): string | null {
  if (!engine || !isKlingO3EngineId(engine.id)) return null;
  const assetState = getKlingO3AssetState({ inputAssets, klingElements });
  if (!assetState.hasAnyVideoInput) return null;
  return supportsKlingO3VideoToVideo(engine) ? null : KLING_O3_SOURCE_VIDEO_UNSUPPORTED_MESSAGE;
}

export function getKlingO3DisabledEngineReasons({
  engines,
  inputAssets,
  klingElements,
}: {
  engines: Array<Pick<EngineCaps, 'id' | 'modes'>>;
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  klingElements: KlingElementState[];
}): Record<string, string> {
  const assetState = getKlingO3AssetState({ inputAssets, klingElements });
  if (!assetState.hasAnyVideoInput) return {};
  return engines.reduce<Record<string, string>>((acc, engine) => {
    if (isKlingO3EngineId(engine.id) && !supportsKlingO3VideoToVideo(engine)) {
      acc[engine.id] = KLING_O3_SOURCE_VIDEO_UNSUPPORTED_MESSAGE;
    }
    return acc;
  }, {});
}

export function shouldIgnoreKlingO3FrameAssets(engineId: string, submissionMode: Mode | string): boolean {
  return isKlingO3EngineId(engineId) && submissionMode === 'v2v';
}

export function isKlingO3FrameFieldId(fieldId: string): boolean {
  return OPENING_FRAME_FIELD_IDS.has(fieldId) || END_FRAME_FIELD_IDS.has(fieldId);
}
