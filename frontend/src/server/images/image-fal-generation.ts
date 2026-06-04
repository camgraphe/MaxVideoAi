import { getFalClient } from '@/lib/fal-client';
import { createSignedDownloadUrl, extractStorageKeyFromUrl, isStorageConfigured } from '@/server/storage';
import type { GptImage2ImageSize } from '@/lib/image/gptImage2';
import type { ImageGenerationMode } from '@/types/image-generation';

const SIGNED_REFERENCE_URL_TTL_SECONDS = 60 * 60;

export async function runFalImageGeneration(params: {
  falModelId: string;
  effectivePrompt: string;
  numImages: number;
  mode: ImageGenerationMode;
  combinedImageUrls: string[];
  falAspectRatio: string | null;
  providerImageSize: string | GptImage2ImageSize | null;
  resolutionEngineParam: string | null | undefined;
  normalizedSeed: number | null;
  outputFormat: string | null;
  quality: string | null;
  maskUrl: string | null;
  enableWebSearch: boolean;
  thinkingLevel: string | null;
  limitGenerations: boolean;
  onProviderJobId?: (providerJobId: string) => void;
}): Promise<{ result: { data?: unknown; requestId?: string | null }; providerJobId: string | null }> {
  let providerJobId: string | undefined;
  const resolvedReferenceUrls =
    params.mode === 'i2i'
      ? await Promise.all(
          params.combinedImageUrls.map(async (url) => {
            const key = extractStorageKeyFromUrl(url);
            if (!key || !isStorageConfigured()) return url;
            try {
              return await createSignedDownloadUrl(key, {
                expiresInSeconds: SIGNED_REFERENCE_URL_TTL_SECONDS,
              });
            } catch (signError) {
              console.warn('[images] failed to sign reference image URL', signError);
              return url;
            }
          })
        )
      : [];

  const result = await getFalClient().subscribe(params.falModelId, {
    input: {
      prompt: params.effectivePrompt,
      num_images: params.numImages,
      ...(params.mode === 'i2i' ? { image_urls: resolvedReferenceUrls } : {}),
      ...(params.falAspectRatio ? { aspect_ratio: params.falAspectRatio } : {}),
      ...(params.providerImageSize && params.resolutionEngineParam === 'image_size'
        ? { image_size: params.providerImageSize }
        : {}),
      ...(params.providerImageSize && params.resolutionEngineParam !== 'image_size'
        ? { resolution: params.providerImageSize }
        : {}),
      ...(params.normalizedSeed != null ? { seed: params.normalizedSeed } : {}),
      ...(params.outputFormat ? { output_format: params.outputFormat } : {}),
      ...(params.quality ? { quality: params.quality } : {}),
      ...(params.maskUrl ? { mask_url: params.maskUrl } : {}),
      ...(params.enableWebSearch ? { enable_web_search: true } : {}),
      ...(params.thinkingLevel ? { thinking_level: params.thinkingLevel } : {}),
      ...(params.limitGenerations ? { limit_generations: true } : {}),
    },
    mode: 'polling',
    onEnqueue(requestId) {
      providerJobId = requestId;
      params.onProviderJobId?.(requestId);
    },
    onQueueUpdate(update) {
      if (update?.request_id) {
        providerJobId = update.request_id;
        params.onProviderJobId?.(update.request_id);
      }
    },
  });

  return {
    result,
    providerJobId: providerJobId ?? result.requestId ?? null,
  };
}
