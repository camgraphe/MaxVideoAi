import type { GeneratePayload } from '@/lib/fal-types';
import { buildMinimaxH3FalRequest } from '@/lib/minimax-h3';
import { calculateMinimaxH3ProviderPrice } from '@/lib/minimax-h3-pricing';
import { rankQuotedOffers } from '@/lib/video-purchase-decision';
import { MINIMAX_H3_ID } from '@/src/config/fal-engines/minimax-h3';
import type { VideoProviderKey } from '../types';
import type { PinnedVideoRequest } from './client';

export const MINIMAX_H3_WAVESPEED_MODEL = 'minimax/h3/wavespeed';
const durationSeconds = 15;
const imageCount = 2;
// $0.04/s subtotal plus the standard 2.5% fee. The live account estimate may be lower.
const publishedMicros = 41_000 * durationSeconds;
const reviewedFields = new Set([
  'engineId', 'mode', 'prompt', 'durationSec', 'durationOption', 'resolution', 'aspectRatio',
  'inputs', 'referenceImages', 'extraInputValues', 'audio', 'jobId', 'localKey', 'idempotencyKey', 'submissionMode',
]);
const reviewedFalFields = new Set(['prompt', 'duration', 'resolution', 'aspect_ratio', 'reference_image_urls', 'prompt_expansion_mode']);

export function minimaxH3VideoRouterEnabled() {
  return process.env.MINIMAX_H3_VIDEOROUTER_CANARY === 'public' && Boolean(process.env.VIDEOROUTER_API_KEY?.trim());
}

export function minimaxH3WaveSpeedPlan(durationSec: number, ceilingMicros: number) {
  const fal = calculateMinimaxH3ProviderPrice({ durationSec, resolution: '480P', referenceImageCount: imageCount });
  const baselineMicros = Math.round(fal.subtotalUsd * 1_000_000);
  const plan = rankQuotedOffers<VideoProviderKey>([
    { provider: 'videorouter', tariff: 'WaveSpeed H3 480p with standard fee',
      costMicros: durationSec === durationSeconds ? publishedMicros : null, excluded: null },
    { provider: 'fal', tariff: 'Fal H3 480P, two image references', costMicros: baselineMicros, excluded: null },
  ], { ceilingMicros: Math.min(baselineMicros, ceilingMicros) });
  return { ...plan, baselineProvider: 'fal' as const, baselineMicros, engineId: MINIMAX_H3_ID };
}

export function minimaxH3WaveSpeedReferences(payload: GeneratePayload): string[] | null {
  if (payload.engineId !== MINIMAX_H3_ID || payload.mode !== 'ref2v' || payload.durationSec !== durationSeconds ||
      (payload.audio != null && payload.audio !== true) ||
      Object.entries(payload).some(([key, value]) => value != null && !reviewedFields.has(key))) return null;

  const extra = payload.extraInputValues;
  if (extra != null && (Array.isArray(extra) || typeof extra !== 'object' ||
      Object.entries(extra).some(([key, value]) => key !== 'prompt_expansion_mode' || value !== 'balanced'))) return null;

  try {
    const { requestBody } = buildMinimaxH3FalRequest(payload);
    const images = requestBody.reference_image_urls;
    if (!requestBody.prompt || requestBody.duration !== durationSeconds || String(requestBody.resolution).toLowerCase() !== '480p' ||
        requestBody.aspect_ratio !== '21:9' || Object.keys(requestBody).some(key => !reviewedFalFields.has(key)) ||
        (requestBody.prompt_expansion_mode !== undefined && requestBody.prompt_expansion_mode !== 'balanced') ||
        !Array.isArray(images) || images.length !== imageCount) return null;

    // Fal merges top-level references and attachment URLs. Only admit an unambiguous, ordered projection.
    if (payload.referenceImages && (payload.referenceImages.length !== imageCount ||
        payload.referenceImages.some((url, index) => url.trim() !== images[index]))) return null;
    const inputs = payload.inputs;
    if (inputs?.length !== imageCount || inputs.some((input, index) => input.slotId !== 'reference_image_urls' ||
        input.kind !== 'image' || !input.assetId?.trim() || input.dataUrl || !input.url?.startsWith('https://') ||
        input.url.trim() !== images[index]) || inputs[0].assetId === inputs[1].assetId) return null;
    return images;
  } catch {
    return null;
  }
}

export function minimaxH3WaveSpeedRequest(prompt: string, durationSec: number, urls: string[], maximumUsd: number): PinnedVideoRequest {
  if (durationSec !== durationSeconds || urls.length !== imageCount || !Number.isFinite(maximumUsd) || maximumUsd < 0) {
    throw new Error('Outside the reviewed WaveSpeed H3 request.');
  }
  return {
    hostModel: 'wavespeed/minimax-h3-native',
    maximumUsd: Math.min(maximumUsd, publishedMicros / 1_000_000),
    body: {
      model: MINIMAX_H3_WAVESPEED_MODEL,
      provider: { only: ['wavespeed'], allow_fallbacks: false },
      prompt: prompt.trim(), duration_secs: durationSec, strict_duration: true, resolution: '480p', aspect_ratio: '21:9',
      // The host exposes a boolean approximation of Fal's balanced expansion, with native audio.
      prompt_extend: true,
      input_references: urls.map(url => ({ type: 'image_url', image_url: { url } })),
    },
  };
}
