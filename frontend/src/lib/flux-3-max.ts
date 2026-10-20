import { FLUX_3_ASPECT_RATIOS } from '@/config/fal-engines/flux-3-shared';
import {
  FLUX_3_MAX_ENDPOINTS, FLUX_3_MAX_ID, FLUX_3_MAX_MODES, FLUX_3_MAX_REASONING_LEVELS, FLUX_3_MAX_RESOLUTIONS, FLUX_3_MAX_SEED_RANGE,
} from '@/config/fal-engines/flux-3-max';
import type { GeneratePayload } from '@/lib/fal-types';

export function isFlux3MaxEngineId(engineId: string | null | undefined): boolean {
  return engineId === FLUX_3_MAX_ID;
}

export function resolveFlux3MaxEndpoint(mode: string): string | undefined {
  return mode === 't2v' || mode === 'i2v' || mode === 'fl2v' || mode === 'ref2v' ? FLUX_3_MAX_ENDPOINTS[mode] : undefined;
}

export function parseFlux3MaxKeyframeIndexes(value: unknown): number[] | null {
  if (typeof value !== 'string' || !/^\s*\d+(?:\s*,\s*\d+)*\s*$/u.test(value)) return null;
  const indexes = value.split(',').map(Number);
  return indexes.every(Number.isSafeInteger) ? indexes : null;
}

function strictDuration(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^\d+$/u.test(value.trim())) return Number(value.trim());
  return null;
}

export function getFlux3MaxConstraintViolation(mode: string, payload: Record<string, unknown>): { field: string; message: string } | null {
  const invalid = (field: string, message: string) => ({ field, message });
  if (!(FLUX_3_MAX_MODES as readonly string[]).includes(mode)) return invalid('mode', 'Unsupported FLUX 3 Max mode.');
  if (typeof payload.prompt !== 'string' || !payload.prompt.trim()) return invalid('prompt', 'FLUX 3 Max prompt is required.');
  const duration = strictDuration(payload.duration ?? payload.duration_seconds);
  if (duration === null || duration < 5 || duration > 20) return invalid('duration', 'FLUX 3 Max duration must be an integer from 5 through 20 seconds.');
  if (payload.resolution !== undefined && !(FLUX_3_MAX_RESOLUTIONS as readonly unknown[]).includes(payload.resolution)) return invalid('resolution', 'FLUX 3 Max resolution must be 720p or 1080p.');
  if (payload.aspect_ratio !== undefined && !(FLUX_3_ASPECT_RATIOS as readonly unknown[]).includes(payload.aspect_ratio)) return invalid('aspect_ratio', 'Unsupported FLUX 3 Max aspect ratio.');
  if (payload.reasoning_level !== undefined && !(FLUX_3_MAX_REASONING_LEVELS as readonly unknown[]).includes(payload.reasoning_level)) return invalid('reasoning_level', 'FLUX 3 Max reasoning level must be low or high.');
  if (payload.generate_audio !== undefined && typeof payload.generate_audio !== 'boolean') return invalid('generate_audio', 'FLUX 3 Max generate_audio must be a boolean.');
  if (payload.seed !== undefined && (typeof payload.seed !== 'number' || !Number.isInteger(payload.seed) ||
    payload.seed < FLUX_3_MAX_SEED_RANGE.min || payload.seed > FLUX_3_MAX_SEED_RANGE.max)) {
    return invalid('seed', `FLUX 3 Max seed must be an integer from ${FLUX_3_MAX_SEED_RANGE.min} through ${FLUX_3_MAX_SEED_RANGE.max}.`);
  }
  const openingImage = payload.image_url ?? payload.start_image_url;
  const endImage = payload.end_image_url;
  if (mode === 'ref2v') {
    const images = payload.reference_image_urls;
    const indexes = parseFlux3MaxKeyframeIndexes(payload.keyframe_indexes);
    if (!Array.isArray(images) || images.length < 1 || images.length > 10 || images.some((value) => typeof value !== 'string' || !value.trim())) return invalid('reference_image_urls', 'FLUX 3 Max requires 1–10 keyframe images.');
    if (!indexes || indexes.length !== images.length || new Set(indexes).size !== indexes.length || indexes.some((index) => index > duration * 24)) return invalid('keyframe_indexes', 'FLUX 3 Max keyframe positions must match the images, be unique integers, and range from 0 through duration × 24 inclusive.');
    if (openingImage !== undefined || endImage !== undefined) return invalid('image_url', 'Use ordered keyframe images for FLUX 3 Max keyframes mode.');
  }
  if ((mode === 'i2v' || mode === 'fl2v') && (typeof openingImage !== 'string' || !openingImage.trim())) return invalid('image_url', 'FLUX 3 Max requires an opening image.');
  if (mode === 'fl2v' && (typeof endImage !== 'string' || !endImage.trim())) return invalid('end_image_url', 'FLUX 3 Max first/last-frame mode requires an end image.');
  if (endImage !== undefined && (typeof endImage !== 'string' || !endImage.trim())) return invalid('end_image_url', 'FLUX 3 Max end image must be a non-empty URL.');
  if (mode === 't2v' && (openingImage !== undefined || endImage !== undefined)) return invalid('image_url', 'FLUX 3 Max images require image-to-video or first/last-frame mode.');
  return null;
}

export function buildFlux3MaxFalRequest(payload: GeneratePayload): { model: string; requestBody: Record<string, unknown> } {
  const mode = payload.mode ?? 't2v';
  const extras = payload.extraInputValues ?? {};
  const attachmentUrl = (slots: readonly string[]) => {
    const attachment = payload.inputs?.find((input) => slots.includes(input.slotId ?? ''));
    return attachment?.url?.trim() || attachment?.dataUrl?.trim() || undefined;
  };
  const imageUrl = payload.imageUrl?.trim() || attachmentUrl(['image_url', 'start_image_url', 'first_frame_url', 'image', 'input_image']);
  const endImageUrl = payload.endImageUrl?.trim() || attachmentUrl(['end_image_url', 'last_frame_url']);
  const keyframeImages = payload.referenceImages ?? payload.inputs?.filter((input) => input.slotId === 'reference_image_urls').map((input) => input.url?.trim() || input.dataUrl?.trim());
  const requestBody: Record<string, unknown> = {
    prompt: payload.prompt.trim(), duration: payload.durationOption ?? payload.durationSec ?? 5,
    resolution: payload.resolution ?? '720p', aspect_ratio: payload.aspectRatio ?? 'auto',
    generate_audio: payload.audio ?? extras.generate_audio ?? true,
    reasoning_level: extras.reasoning_level ?? 'high',
    ...(payload.seed !== undefined ? { seed: payload.seed } : {}),
    ...(imageUrl ? { image_url: imageUrl } : {}), ...(endImageUrl ? { end_image_url: endImageUrl } : {}),
    ...(mode === 'ref2v' ? { reference_image_urls: keyframeImages, keyframe_indexes: extras.keyframe_indexes } : {}),
  };
  const violation = getFlux3MaxConstraintViolation(mode, requestBody);
  if (violation) throw new Error(violation.message);
  requestBody.duration = strictDuration(requestBody.duration)!;
  if (mode === 'ref2v') {
    const indexes = parseFlux3MaxKeyframeIndexes(extras.keyframe_indexes)!;
    requestBody.keyframes = keyframeImages!.map((image_url, index) => ({ image_url, frame_index: indexes[index] }));
    delete requestBody.reference_image_urls;
    delete requestBody.keyframe_indexes;
  }
  return { model: resolveFlux3MaxEndpoint(mode)!, requestBody };
}
