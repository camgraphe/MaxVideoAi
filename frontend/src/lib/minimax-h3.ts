import {
  MINIMAX_H3_ENDPOINTS,
  MINIMAX_H3_ID,
} from '@/src/config/fal-engines/minimax-h3';
import type { GeneratePayload } from '@/lib/fal-types';

export function isMinimaxH3EngineId(id: string | null | undefined): boolean {
  return id === MINIMAX_H3_ID;
}

export function resolveMinimaxH3Endpoint(mode: string | null | undefined): string {
  if (mode === 't2v' || mode === 'i2v' || mode === 'ref2v') {
    return MINIMAX_H3_ENDPOINTS[mode];
  }
  throw new Error(`Unsupported MiniMax H3 mode: ${mode ?? 'undefined'}`);
}

function firstAttachmentUrl(payload: GeneratePayload, slotId: string): string | undefined {
  return payload.inputs
    ?.find((attachment) => attachment.slotId?.trim() === slotId && Boolean(attachment.url?.trim() ?? attachment.dataUrl?.trim()))
    ?.url?.trim()
    ?? payload.inputs
      ?.find((attachment) => attachment.slotId?.trim() === slotId && Boolean(attachment.dataUrl?.trim()))
      ?.dataUrl?.trim();
}

function attachmentUrls(payload: GeneratePayload, slotId: string): string[] {
  const urls = (payload.inputs ?? [])
    .filter((attachment) => attachment.slotId?.trim() === slotId)
    .map((attachment) => attachment.url?.trim() ?? attachment.dataUrl?.trim() ?? '')
    .filter(Boolean);
  return Array.from(new Set(urls));
}

function resolveDuration(payload: GeneratePayload): number | string | undefined {
  const raw = payload.durationOption ?? payload.durationSec;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim().length) {
    const value = raw.trim();
    return /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : value;
  }
  return undefined;
}

export function buildMinimaxH3FalRequest(payload: GeneratePayload): {
  model: string;
  requestBody: Record<string, unknown>;
} {
  const mode = payload.mode ?? 't2v';
  const model = resolveMinimaxH3Endpoint(mode);
  const requestBody: Record<string, unknown> = {};
  const prompt = payload.prompt.trim();
  const duration = resolveDuration(payload);
  const resolution = payload.resolution?.trim();

  if (prompt) requestBody.prompt = prompt;
  if (duration !== undefined) requestBody.duration = duration;
  if (resolution) requestBody.resolution = resolution;

  if (mode === 't2v' || mode === 'ref2v') {
    const aspectRatio = payload.aspectRatio?.trim();
    if (aspectRatio) requestBody.aspect_ratio = aspectRatio === 'auto' ? 'adaptive' : aspectRatio;
  }

  if (mode === 'i2v') {
    const imageUrl = firstAttachmentUrl(payload, 'image_url') ?? payload.imageUrl?.trim();
    const endImageUrl = firstAttachmentUrl(payload, 'end_image_url') ?? payload.endImageUrl?.trim();
    if (imageUrl) requestBody.image_url = imageUrl;
    if (endImageUrl) requestBody.end_image_url = endImageUrl;
  }

  if (mode === 'ref2v') {
    const referenceImageUrls = attachmentUrls(payload, 'reference_image_urls');
    const referenceVideoUrls = attachmentUrls(payload, 'reference_video_urls');
    const referenceAudioUrls = attachmentUrls(payload, 'reference_audio_urls');
    if (referenceImageUrls.length) requestBody.reference_image_urls = referenceImageUrls;
    if (referenceVideoUrls.length) requestBody.reference_video_urls = referenceVideoUrls;
    if (referenceAudioUrls.length) requestBody.reference_audio_urls = referenceAudioUrls;
  }

  return { model, requestBody };
}
