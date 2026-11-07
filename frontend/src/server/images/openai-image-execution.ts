import { getRuntimeModelById } from '@/config/model-runtime';
import { isGptImage26EngineId, normalizeGptImage26Settings } from '@/lib/image/gptImage26';
import { isStorageConfigured } from '@/server/storage';
import type { EngineCaps } from '@/types/engines';
import type { ImageGenerationResponse } from '@/types/image-generation';
import type { executeGoogleVertexImageGeneration } from './google-vertex-image-execution';
import { OpenAIImageClient, isOpenAIImageConfigured } from './openai-image-client';
import { OpenAIImageError } from './openai-image-error';
import { buildOpenAIImagePayload } from './openai-image-payload';
import { prepareOpenAIImageReferences } from './openai-image-references';
import { extractOpenAIImages, parseOpenAIImageUsage } from './openai-image-response';
import { persistFailedImageGeneration } from './image-generation-failure';
import { markImageProviderOutcomeAmbiguous } from './image-provider-failure-policy';
import { ImageGenerationExecutionError } from './image-generation-error';
import { openAIImageCompletionContext, reserveOpenAIImageResult, persistOpenAIImageResult } from './openai-image-result-store';
import { recoverOpenAIImageResult, type OpenAIImageRecoveryDependencies } from './openai-image-output-recovery';

const PROVIDER_MODE = 'openai_images_direct';
export type OpenAIImageExecutionParams = Parameters<typeof executeGoogleVertexImageGeneration>[0] & {
  outputCompression?: number; complexity?: string | null; background?: string | null; preparedReferenceUrls?: string[];
  customImageSize?: {width: number; height: number} | null;
};

export function assertOpenAIImageAvailable(engine: EngineCaps): void {
  if (engine.providerMeta?.provider !== 'openai_images') return;
  const expected = engine.id.replace('gpt-image-2-6-', 'gpt-image-2.6-');
  if (!isGptImage26EngineId(engine.id) || engine.providerMeta.modelSlug !== expected
    || getRuntimeModelById(engine.id)?.publication.app.published !== true || !isOpenAIImageConfigured() || !isStorageConfigured()) {
    throw new ImageGenerationExecutionError('OpenAI image generation is unavailable.', { code: 'openai_image_unavailable', status: 503 });
  }
}

type ExecutionDependencies = OpenAIImageRecoveryDependencies & {
  assertAvailableFn?: typeof assertOpenAIImageAvailable;
  prepareReferencesFn?: typeof prepareOpenAIImageReferences;
  generateFn?: OpenAIImageClient['generate'];
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
      complexity: params.complexity ?? undefined, outputFormat: params.outputFormat ?? undefined, outputCompression: params.outputCompression,
      background: params.background ?? undefined, numImages: params.numImages,
      customImageSize: params.customImageSize } as Parameters<typeof normalizeGptImage26Settings>[0]);
    const referenceUrls = params.preparedReferenceUrls ?? await (deps.prepareReferencesFn ?? prepareOpenAIImageReferences)({ userId: params.userId, urls: params.combinedImageUrls });
    const payload = buildOpenAIImagePayload({ modelId: params.engine.providerMeta?.modelSlug ?? '', mode: params.mode, prompt: params.effectivePrompt, settings, referenceUrls });
    await reserveOpenAIImageResult(openAIImageCompletionContext(params), deps.queryFn);
    const client = new OpenAIImageClient();
    const result = await (deps.generateFn ?? client.generate.bind(client))(params.mode, payload);
    acceptedResponse = true;
    providerJobId = result.requestId;
    providerUsage = parseOpenAIImageUsage(result.body);
    const extracted = extractOpenAIImages(result.body, settings.outputFormat, settings.numImages);
    await persistOpenAIImageResult({ jobId: params.jobId, userId: params.userId, requestId: providerJobId, extracted, usage: providerUsage }, deps.queryFn);
    const recovered = await recoverOpenAIImageResult(params.jobId, params.userId, deps);
    if (!recovered) throw new OpenAIImageError('OpenAI image outputs are awaiting recovery or review.', { code: 'OPENAI_IMAGE_RESULT_PENDING', submissionState: 'uncertain', requestId: providerJobId });
    const { images, heroThumb } = recovered;
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
