import { query } from '@/lib/db';
import { getRuntimeModelById } from '@/config/model-runtime';
import { isGptImage26EngineId, normalizeGptImage26Settings } from '@/lib/image/gptImage26';
import { buildStoredImageRenderEntries } from '@/lib/image-renders';
import { normalizeMediaUrl } from '@/lib/media';
import { isStorageConfigured, uploadImageToStorage } from '@/server/storage';
import { createImageThumbnailBatch } from '@/server/image-thumbnails';
import type { EngineCaps } from '@/types/engines';
import type { GeneratedImage, ImageGenerationResponse } from '@/types/image-generation';
import type { executeGoogleVertexImageGeneration } from './google-vertex-image-execution';
import { OpenAIImageClient, isOpenAIImageConfigured } from './openai-image-client';
import { OpenAIImageError } from './openai-image-error';
import { buildOpenAIImagePayload } from './openai-image-payload';
import { prepareOpenAIImageReferences } from './openai-image-references';
import { extractOpenAIImages, parseOpenAIImageUsage } from './openai-image-response';
import { persistCompletedImageGeneration } from './image-generation-completion';
import { persistFailedImageGeneration } from './image-generation-failure';
import { markImageProviderOutcomeAmbiguous } from './image-provider-failure-policy';
import { ImageGenerationExecutionError } from './image-generation-error';

const PROVIDER_MODE = 'openai_images_direct';
export type OpenAIImageExecutionParams = Parameters<typeof executeGoogleVertexImageGeneration>[0] & {
  complexity?: string | null; background?: string | null; preparedReferenceUrls?: string[];
};

export function assertOpenAIImageAvailable(engine: EngineCaps): void {
  if (engine.providerMeta?.provider !== 'openai_images') return;
  const expected = engine.id.replace('gpt-image-2-6-', 'gpt-image-2.6-');
  if (!isGptImage26EngineId(engine.id) || engine.providerMeta.modelSlug !== expected
    || getRuntimeModelById(engine.id)?.publication.app.published !== true || !isOpenAIImageConfigured() || !isStorageConfigured()) {
    throw new ImageGenerationExecutionError('OpenAI image generation is unavailable.', { code: 'openai_image_unavailable', status: 503 });
  }
}

type ExecutionDependencies = {
  assertAvailableFn?: typeof assertOpenAIImageAvailable;
  prepareReferencesFn?: typeof prepareOpenAIImageReferences;
  generateFn?: OpenAIImageClient['generate'];
  queryFn?: typeof query;
  uploadFn?: (params: Parameters<typeof uploadImageToStorage>[0]) => Promise<{ url: string; width?: number | null; height?: number | null; mime: string }>;
  thumbnailsFn?: typeof createImageThumbnailBatch;
  completeFn?: (params: Parameters<typeof persistCompletedImageGeneration>[0]) => Promise<{ heroThumb: string | null }>;
  failFn?: (params: Parameters<typeof persistFailedImageGeneration>[0]) => Promise<{ message: string; providerBody: unknown; providerStatus: number | null }>;
  ambiguousFn?: typeof markImageProviderOutcomeAmbiguous;
};

/** Runs only after the shared atomic job reservation. Owns every direct-provider
 * outcome, because the legacy fal catch does not surround direct execution. */
export async function executeOpenAIImageGeneration(params: OpenAIImageExecutionParams, deps: ExecutionDependencies = {}): Promise<ImageGenerationResponse> {
  let providerJobId: string | null = null;
  let acceptedResponse = false;
  let providerUsage: ReturnType<typeof parseOpenAIImageUsage> = null;
  try {
    (deps.assertAvailableFn ?? assertOpenAIImageAvailable)(params.engine);
    const settings = normalizeGptImage26Settings({ resolution: params.resolution, quality: params.quality ?? undefined,
      complexity: params.complexity ?? undefined, outputFormat: params.outputFormat ?? undefined,
      background: params.background ?? undefined, numImages: params.numImages } as Parameters<typeof normalizeGptImage26Settings>[0]);
    const referenceUrls = params.preparedReferenceUrls ?? await (deps.prepareReferencesFn ?? prepareOpenAIImageReferences)({ userId: params.userId, urls: params.combinedImageUrls });
    const payload = buildOpenAIImagePayload({ modelId: params.engine.providerMeta?.modelSlug ?? '', mode: params.mode, prompt: params.effectivePrompt, settings, referenceUrls });
    const client = new OpenAIImageClient();
    const result = await (deps.generateFn ?? client.generate.bind(client))(params.mode, payload);
    acceptedResponse = true;
    providerJobId = result.requestId;
    providerUsage = parseOpenAIImageUsage(result.body);
    const extracted = extractOpenAIImages(result.body, settings.outputFormat, settings.numImages);
    const stored: GeneratedImage[] = [];
    // Checkpoint each durable original, including valid members of a partial
    // response. A later thumbnail/storage failure never authorizes another POST.
    for (const image of extracted.images.slice(0, settings.numImages)) {
      const upload = await (deps.uploadFn ?? uploadImageToStorage)({ data: image.data, mime: image.mimeType,
        userId: params.userId, prefix: 'renders/images', fileName: `${params.jobId}-${image.index + 1}.${settings.outputFormat === 'jpeg' ? 'jpg' : settings.outputFormat}` });
      stored.push({ url: normalizeMediaUrl(upload.url) ?? upload.url, width: upload.width, height: upload.height, mimeType: upload.mime });
      await (deps.queryFn ?? query)(`UPDATE app_jobs SET render_ids = $3::jsonb, provider_job_id = COALESCE($4, provider_job_id),
        provider = $5, updated_at = NOW() WHERE job_id = $1 AND user_id = $2 AND status NOT IN ('completed','failed')`,
      [params.jobId, params.userId, JSON.stringify(buildStoredImageRenderEntries(stored)), providerJobId, PROVIDER_MODE]);
    }
    if (!extracted.complete) throw new OpenAIImageError('OpenAI did not return a complete validated image result.', { code: 'OPENAI_IMAGE_PARTIAL_RESULT', submissionState: 'uncertain', requestId: providerJobId });
    const thumbs = await (deps.thumbnailsFn ?? createImageThumbnailBatch)({ jobId: params.jobId, userId: params.userId, imageUrls: stored.map(image => image.url) });
    const images = stored.map((image, index) => ({ ...image, thumbUrl: thumbs[index] ?? null }));
    const { heroThumb } = await (deps.completeFn ?? persistCompletedImageGeneration)({ ...params,
      engineId: params.engine.id, engineLabel: params.engine.label, images, description: null, providerJobId, providerMode: PROVIDER_MODE, providerUsage });
    return { ok: true, jobId: params.jobId, mode: params.mode, images, description: null,
      requestId: providerJobId ?? undefined, providerJobId: providerJobId ?? undefined,
      engineId: params.engineEntry.id, engineLabel: params.engineEntry.marketingName, pricing: params.pricing,
      paymentStatus: 'paid_wallet', thumbUrl: heroThumb, aspectRatio: params.resolvedAspectRatio, resolution: settings.resolution };
  } catch (error) {
    if (error instanceof OpenAIImageError) providerJobId ??= error.requestId;
    if (acceptedResponse || (error instanceof OpenAIImageError && error.submissionState === 'uncertain')) {
      const message = 'The image outcome is still being verified. Keep this job ID; do not submit it again.';
      try { await (deps.ambiguousFn ?? markImageProviderOutcomeAmbiguous)(params.jobId, providerJobId ?? undefined, { providerMode: PROVIDER_MODE, userId: params.userId, message, strict: true }); }
      catch { console.warn('[images] OpenAI outcome persistence deferred', { jobId: params.jobId, providerJobId }); }
      throw new ImageGenerationExecutionError(message, { mode: params.mode, status: 503, code: 'provider_outcome_ambiguous', extras: { jobId: params.jobId, providerJobId: providerJobId ?? undefined, paymentStatus: 'paid_wallet' } });
    }
    // Local preparation failure or a definite HTTP rejection may be refunded.
    const safeError = error instanceof OpenAIImageError || error instanceof ImageGenerationExecutionError ? error
      : new OpenAIImageError('OpenAI image preparation failed.', { status: 400, code: 'OPENAI_IMAGE_PREPARATION_FAILED' });
    const { message } = await (deps.failFn ?? persistFailedImageGeneration)({ ...params, engineId: params.engine.id,
      error: safeError, falModelId: params.engine.providerMeta?.modelSlug ?? '', providerJobId, providerMode: PROVIDER_MODE,
      referenceImageUrls: params.combinedImageUrls, providerUsage });
    throw new ImageGenerationExecutionError(message, { mode: params.mode, code: safeError.code, status: safeError.status ?? 502,
      extras: { jobId: params.jobId, engineId: params.engine.id, engineLabel: params.engine.label, paymentStatus: 'refunded_wallet' } });
  }
}
