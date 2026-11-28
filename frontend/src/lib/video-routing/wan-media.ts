import type { GeneratePayload } from '../fal-types';

type WanMediaAsset = { url: string; mimeType?: string | null; durationSec?: number | null };
function cleanUrl(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function addUniqueAsset(assets: WanMediaAsset[], value: unknown, metadata?: Partial<WanMediaAsset>) {
  const url = cleanUrl(value);
  if (!url) return;
  const existing = assets.find((asset) => asset.url === url);
  if (existing) {
    if (metadata?.mimeType) existing.mimeType = metadata.mimeType;
    if (typeof metadata?.durationSec === 'number') existing.durationSec = metadata.durationSec;
    return;
  }
  assets.push({ url, ...metadata });
}

export function resolveWanMediaInputs(params: {
  imageUrl: string | null | undefined;
  falPayload: GeneratePayload;
}): {
  ambiguousMedia: boolean;
  startImageUrl: string | null;
  endImageUrl: string | null;
  referenceImages: WanMediaAsset[];
  referenceVideos: WanMediaAsset[];
  referenceAudio: WanMediaAsset[];
  inputVideoDurationSec: number | null;
} {
  let startImageUrl = cleanUrl(params.imageUrl) ?? cleanUrl(params.falPayload.imageUrl);
  let ambiguousMedia = Boolean(params.imageUrl && params.falPayload.imageUrl && cleanUrl(params.imageUrl) !== cleanUrl(params.falPayload.imageUrl));
  let endImageUrl = cleanUrl(params.falPayload.endImageUrl);
  const referenceImages: WanMediaAsset[] = [];
  const referenceVideos: WanMediaAsset[] = [];
  const referenceAudio: WanMediaAsset[] = [];

  for (const url of params.falPayload.referenceImages ?? []) addUniqueAsset(referenceImages, url);
  addUniqueAsset(referenceVideos, params.falPayload.videoUrl);
  addUniqueAsset(referenceAudio, params.falPayload.audioUrl);

  for (const input of params.falPayload.inputs ?? []) {
    const url = cleanUrl(input.url) ?? cleanUrl(input.dataUrl);
    if (!url) { ambiguousMedia = true; continue; }
    const slotId = input.slotId?.trim().toLowerCase() ?? '';
    if (!slotId) ambiguousMedia = true;
    const metadata = { mimeType: cleanUrl(input.type), durationSec: input.durationSec ?? null };
    if (input.kind === 'image' && ['image_url', 'start_image_url', 'first_frame_url'].includes(slotId)) {
      if (startImageUrl && startImageUrl !== url) ambiguousMedia = true;
      startImageUrl ??= url;
    } else if (input.kind === 'image' && ['end_image_url', 'last_frame_url'].includes(slotId)) {
      if (endImageUrl && endImageUrl !== url) ambiguousMedia = true;
      endImageUrl ??= url;
    } else if (input.kind === 'image') {
      if (!['reference_image_urls', 'reference_images'].includes(slotId)) ambiguousMedia = true;
      addUniqueAsset(referenceImages, url, metadata);
    } else if (input.kind === 'video') {
      if (!['reference_video_urls', 'video_url'].includes(slotId)) ambiguousMedia = true;
      addUniqueAsset(referenceVideos, url, metadata);
    } else if (input.kind === 'audio') {
      if (!['reference_audio_urls', 'audio_url'].includes(slotId)) ambiguousMedia = true;
      addUniqueAsset(referenceAudio, url, metadata);
    } else ambiguousMedia = true;
  }

  const knownVideoDurations = referenceVideos
    .map((asset) => asset.durationSec)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return {
    ambiguousMedia,
    startImageUrl,
    endImageUrl,
    referenceImages,
    referenceVideos,
    referenceAudio,
    inputVideoDurationSec:
      referenceVideos.length > 0 && knownVideoDurations.length === referenceVideos.length
        ? knownVideoDurations.reduce((sum, duration) => sum + duration, 0)
        : null,
  };
}
