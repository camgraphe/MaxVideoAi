import {
  MINIMAX_H3_ENDPOINTS,
  MINIMAX_H3_ID,
  MINIMAX_H3_PROMPT_EXPANSION_MODES,
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
  const expansion = payload.extraInputValues?.prompt_expansion_mode;
  if (typeof expansion === 'string' && (MINIMAX_H3_PROMPT_EXPANSION_MODES as readonly string[]).includes(expansion)) {
    requestBody.prompt_expansion_mode = expansion;
  }
  const seed = payload.seed ?? payload.extraInputValues?.seed;
  if (typeof seed === 'number' && Number.isInteger(seed)) requestBody.seed = seed;

  if (mode === 't2v' || mode === 'i2v') {
    const targetAudioUrl = firstAttachmentUrl(payload, 'target_audio_url');
    if (targetAudioUrl) requestBody.target_audio_url = targetAudioUrl;
  }

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
    const referenceImageUrls = Array.from(new Set([
      ...(payload.referenceImages ?? []).map((url) => url.trim()).filter(Boolean),
      ...attachmentUrls(payload, 'reference_image_urls'),
    ]));
    const referenceVideoUrls = attachmentUrls(payload, 'reference_video_urls');
    const referenceAudioUrls = attachmentUrls(payload, 'reference_audio_urls');
    if (referenceImageUrls.length) requestBody.reference_image_urls = referenceImageUrls;
    if (referenceVideoUrls.length) requestBody.reference_video_urls = referenceVideoUrls;
    if (referenceAudioUrls.length) requestBody.reference_audio_urls = referenceAudioUrls;
  }

  return { model, requestBody };
}
