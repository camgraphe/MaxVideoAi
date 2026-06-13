import type { EngineInputField } from '@/types/engines';
import type { getLocalizedAssetDropzoneCopy } from '@/lib/ltx-localization';
import type { AssetFieldRole } from './asset-dropzone-types';

export const VEO_REFERENCE_WARNING_ENGINES = new Set(['veo-3-1', 'veo-3-1-fast', 'veo-3-1-lite']);

export function resolveAssetFieldTitle(
  field: EngineInputField,
  role: AssetFieldRole,
  assetCopy: ReturnType<typeof getLocalizedAssetDropzoneCopy>
): string | undefined {
  if (role === 'primary') return field.label ?? assetCopy.primaryImageFallback;
  if (role === 'reference') return field.label ?? assetCopy.additionalReferencesFallback;
  if (role === 'frame') return field.label ?? assetCopy.frameFallback;
  return field.label;
}

export function resolveAssetRoleDescription(
  role: AssetFieldRole,
  assetCopy: ReturnType<typeof getLocalizedAssetDropzoneCopy>
): string | null {
  if (role === 'primary') return assetCopy.primaryRoleDescription;
  if (role === 'reference') return assetCopy.referenceRoleDescription;
  if (role === 'frame') return assetCopy.frameRoleDescription;
  return null;
}

export function buildAssetFieldTooltipLines(items: {
  roleDescription: string | null;
  fieldDescription?: string;
  referenceWarning?: string;
  showReferenceWarning: boolean;
  helperLines: string[];
}): string[] {
  return [
    items.roleDescription,
    items.fieldDescription,
    items.referenceWarning && items.showReferenceWarning ? items.referenceWarning : null,
    items.helperLines.length ? items.helperLines.join(' • ') : null,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

export function resolveSlotLabel(
  field: EngineInputField,
  role: AssetFieldRole,
  slotIndex: number,
  assetCopy: ReturnType<typeof getLocalizedAssetDropzoneCopy>
): string {
  const sequence = slotIndex + 1;
  const normalizedId = String(field.id ?? '').toLowerCase();

  if (field.slotLabelPattern) {
    return field.slotLabelPattern
      .replace(/\{n\}/g, String(sequence))
      .replace(/\{index\}/g, String(sequence));
  }

  if (normalizedId === 'image_url' || normalizedId === 'input_image') return assetCopy.startImageSlot;
  if (normalizedId === 'end_image_url') return assetCopy.endImageSlot;
  if (normalizedId === 'first_frame_url') return assetCopy.firstFrameSlot;
  if (normalizedId === 'last_frame_url') return assetCopy.lastFrameSlot;
  if (normalizedId === 'image_urls' || normalizedId.endsWith('_image_urls') || (role === 'reference' && field.type === 'image')) {
    return assetCopy.referenceImageSlot(sequence);
  }
  if (normalizedId === 'video_urls' || normalizedId.endsWith('_video_urls') || normalizedId.includes('reference_video')) {
    return assetCopy.referenceVideoSlot(sequence);
  }
  if (normalizedId === 'audio_urls' || normalizedId.endsWith('_audio_urls') || normalizedId.includes('reference_audio')) {
    return assetCopy.referenceAudioSlot(sequence);
  }
  if (field.type === 'video') return assetCopy.sourceVideoSlot;
  if (field.type === 'audio') return assetCopy.sourceAudioSlot;
  return field.label ?? assetCopy.imageSlot;
}

export function readMediaDuration(file: File, type: 'audio' | 'video') {
  return new Promise<number | null>((resolve) => {
    if (typeof window === 'undefined') {
      resolve(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const element = document.createElement(type);
    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      element.removeAttribute('src');
      element.load?.();
    };
    element.preload = 'metadata';
    element.onloadedmetadata = () => {
      const duration = Number.isFinite(element.duration) ? element.duration : null;
      cleanup();
      resolve(duration);
    };
    element.onerror = () => {
      cleanup();
      resolve(null);
    };
    element.src = objectUrl;
  });
}
