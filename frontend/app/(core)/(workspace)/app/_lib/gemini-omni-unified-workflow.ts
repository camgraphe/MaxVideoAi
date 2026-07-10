import type { EngineCaps, Mode } from '@/types/engines';
import type { ReferenceAsset } from './workspace-assets';

const SOURCE_IMAGE_FIELD_IDS = new Set(['image_url']);
const REFERENCE_IMAGE_FIELD_IDS = new Set(['reference_images']);
const SOURCE_VIDEO_FIELD_IDS = new Set(['video_url']);

export const GEMINI_OMNI_SOURCE_IMAGE_ACTIVE_MESSAGE =
  'Source image controls this Omni workflow. Remove it to use references, video edit, or refine.';

export const GEMINI_OMNI_REFERENCE_IMAGES_ACTIVE_MESSAGE =
  'Reference images control this Omni workflow. Remove them to use a source image, video edit, or refine.';

export const GEMINI_OMNI_SOURCE_VIDEO_ACTIVE_MESSAGE =
  'Source video controls this Omni workflow. Remove it to use image, references, text-only, or refine.';

export const GEMINI_OMNI_REFINE_ACTIVE_MESSAGE =
  'Refine uses a previous interaction id. Clear it before adding image, references, or source video.';

export type GeminiOmniAssetState = {
  hasSourceImage: boolean;
  hasReferenceImages: boolean;
  hasSourceVideo: boolean;
};

export type GeminiOmniWorkflowState = GeminiOmniAssetState & {
  hasPreviousInteraction: boolean;
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

export function isGeminiOmniEngineId(engineId: string | null | undefined): boolean {
  return engineId === 'gemini-omni-flash';
}

export function getGeminiOmniAssetState(
  inputAssets: Record<string, (ReferenceAsset | null)[]>
): GeminiOmniAssetState {
  return {
    hasSourceImage: hasAssetInSlots(inputAssets, SOURCE_IMAGE_FIELD_IDS, 'image'),
    hasReferenceImages: hasAssetInSlots(inputAssets, REFERENCE_IMAGE_FIELD_IDS, 'image'),
    hasSourceVideo: hasAssetInSlots(inputAssets, SOURCE_VIDEO_FIELD_IDS, 'video'),
  };
}

export function hasGeminiOmniPreviousInteraction(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function supportsMode(engine: Pick<EngineCaps, 'modes'>, mode: Mode): boolean {
  return engine.modes.includes(mode);
}

export function resolveGeminiOmniUnifiedMode({
  engine,
  inputAssets,
  previousInteractionId,
}: {
  engine: Pick<EngineCaps, 'id' | 'modes'> | null | undefined;
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  previousInteractionId?: unknown;
}): Mode {
  if (!engine || !isGeminiOmniEngineId(engine.id)) return 't2v';
  const assetState = getGeminiOmniAssetState(inputAssets);
  if (assetState.hasSourceVideo && supportsMode(engine, 'v2v')) return 'v2v';
  if (assetState.hasReferenceImages && supportsMode(engine, 'ref2v')) return 'ref2v';
  if (assetState.hasSourceImage && supportsMode(engine, 'i2v')) return 'i2v';
  if (hasGeminiOmniPreviousInteraction(previousInteractionId) && supportsMode(engine, 'retake')) return 'retake';
  return supportsMode(engine, 't2v') ? 't2v' : engine.modes[0] ?? 't2v';
}

export function getGeminiOmniAssetFieldDisabledReason(
  fieldId: string,
  state: GeminiOmniWorkflowState
): string | null {
  if (state.hasPreviousInteraction) return GEMINI_OMNI_REFINE_ACTIVE_MESSAGE;
  if (state.hasSourceVideo) {
    return SOURCE_VIDEO_FIELD_IDS.has(fieldId) ? null : GEMINI_OMNI_SOURCE_VIDEO_ACTIVE_MESSAGE;
  }
  if (state.hasReferenceImages) {
    return REFERENCE_IMAGE_FIELD_IDS.has(fieldId) ? null : GEMINI_OMNI_REFERENCE_IMAGES_ACTIVE_MESSAGE;
  }
  if (state.hasSourceImage) {
    return SOURCE_IMAGE_FIELD_IDS.has(fieldId) ? null : GEMINI_OMNI_SOURCE_IMAGE_ACTIVE_MESSAGE;
  }
  return null;
}

export function isGeminiOmniUnifiedAssetField(fieldId: string): boolean {
  return (
    SOURCE_IMAGE_FIELD_IDS.has(fieldId) ||
    REFERENCE_IMAGE_FIELD_IDS.has(fieldId) ||
    SOURCE_VIDEO_FIELD_IDS.has(fieldId)
  );
}
