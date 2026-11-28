import type { GeneratePayload } from '@/lib/fal-types';
import { buildKlingV4FalRequest } from '@/lib/kling-v4';
import { klingV4PricingUsage } from '@/lib/kling-v4-pricing';
import { rankQuotedOffers } from '@/lib/video-purchase-decision';
import type { VideoProviderKey } from '../types';
import type { PinnedVideoRequest } from './client';

export const KLING_V4_SANDBASE_MODEL = 'kuaishou/kling-v4.0/sandbase';
export function klingV4VideoRouterEnabled() {
  return process.env.KLING_V4_VIDEOROUTER_CANARY === 'public' && Boolean(process.env.VIDEOROUTER_API_KEY?.trim());
}

const reviewedFields = new Set(['engineId', 'mode', 'prompt', 'durationSec', 'durationOption', 'aspectRatio', 'resolution',
  'audio', 'inputs', 'referenceImages', 'idempotencyKey', 'jobId', 'localKey', 'submissionMode']);
const referenceSlots = new Set(['image_urls', 'reference_image_urls', 'reference_images']);

export function klingV4SandBasePlan(durationSec: number, ceilingMicros: number) {
  const fal = klingV4PricingUsage({ mode: 'ref2v', resolution: '720p', durationSec, hasVideoInput: false });
  const baselineMicros = Math.round(fal.supplierExactCents * 10_000);
  const publishedMicros = Math.ceil(133_450 * durationSec * 1025 / 1000);
  const plan = rankQuotedOffers<VideoProviderKey>([
    { provider: 'videorouter', tariff: 'SandBase 720p with standard fee', costMicros: publishedMicros, excluded: null },
    { provider: 'fal', tariff: 'Fal Kling V4 SDR 720p, image references', costMicros: baselineMicros, excluded: null },
  ], { ceilingMicros: Math.min(baselineMicros, ceilingMicros) });
  return { ...plan, baselineProvider: 'fal' as const, baselineMicros, engineId: 'kling-v4' };
}

/** Match the submitted Fal contract before translating. No caller fields are removed or rewritten. */
export function klingV4SandBaseReferences(payload: GeneratePayload): string[] | null {
  if (payload.engineId !== 'kling-v4' || payload.mode !== 'ref2v' ||
      Object.entries(payload).some(([field, value]) => value != null && !reviewedFields.has(field))) return null;
  try {
    const { requestBody } = buildKlingV4FalRequest(payload);
    const keys = ['prompt', 'duration', 'resolution', 'aspect_ratio', 'image_urls'];
    if (Object.keys(requestBody).some(key => !keys.includes(key)) || !requestBody.prompt ||
        requestBody.duration !== payload.durationSec || requestBody.resolution !== '720p' ||
        requestBody.aspect_ratio !== '16:9' || !Array.isArray(requestBody.image_urls) || requestBody.image_urls.length !== 3) return null;
    const images = requestBody.image_urls as string[];
    // On all entry points owned-media validation binds each ordered original to an attachment.
    if (payload.inputs?.length !== images.length || payload.inputs.some((input, i) => input.kind !== 'image' ||
        !referenceSlots.has(input.slotId ?? '') || !input.assetId || !input.url || input.url.trim() !== images[i] ||
        Boolean(input.dataUrl) || !images[i].startsWith('https://'))) return null;
    return images;
  } catch {
    return null;
  }
}

export function klingV4SandBaseRequest(prompt: string, durationSec: number, urls: string[], maximumUsd: number): PinnedVideoRequest {
  // The qualified host uses Kling's native audio. An explicit generate_audio switch is not equivalent.
  return { maximumUsd, hostModel: 'sandbase/kling-v4.0', body: {
    model: KLING_V4_SANDBASE_MODEL, provider: { only: ['sandbase'], allow_fallbacks: false },
    duration_secs: durationSec, strict_duration: true, resolution: '720p', aspect_ratio: '16:9',
    prompt: prompt.trim(), input_references: urls.map(url => ({ type: 'image_url', image_url: { url } })),
  } };
}
