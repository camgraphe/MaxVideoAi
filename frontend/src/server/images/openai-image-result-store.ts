import { query } from '@/lib/db';
import type { GeneratedImage } from '@/types/image-generation';
import type { persistCompletedImageGeneration } from './image-generation-completion';
import type { OpenAIImageExecutionParams } from './openai-image-execution';
import type { extractOpenAIImages, parseOpenAIImageUsage } from './openai-image-response';
import { OpenAIImageError } from './openai-image-error';

export type OpenAIImageCompletionContext = Omit<Parameters<typeof persistCompletedImageGeneration>[0], 'images' | 'openAIRecoveryLease'>;
export type OpenAIImageResultRow = {
  job_id: string; user_id: string; provider_request_id: string | null;
  completion_context: OpenAIImageCompletionContext;
  images: Array<{ index: number; base64: string; mimeType: string }>;
  response_complete: boolean;
  stored_images: Array<{ index: number; image: GeneratedImage }>;
};

/** Allowlist only completion facts: never persist keys, signed references or prompts. */
export function openAIImageCompletionContext(p: OpenAIImageExecutionParams): OpenAIImageCompletionContext {
  return {
    billingProductKey: p.billingProductKey, characterReferenceCount: p.characterReferenceCount,
    costBreakdownJson: p.costBreakdownJson, description: null, enableWebSearch: p.enableWebSearch,
    engineId: p.engine.id, engineLabel: p.engine.label, indexable: p.indexable,
    jobId: p.jobId, jobSurface: p.jobSurface, limitGenerations: p.limitGenerations,
    maskUrl: null, mode: p.mode, normalizedSeed: p.normalizedSeed, numImages: p.numImages,
    outputFormat: p.outputFormat, pricing: p.pricing, pricingSnapshotJson: p.pricingSnapshotJson,
    providerJobId: null, providerMode: 'openai_images_direct', quality: p.quality,
    resolvedAspectRatio: p.resolvedAspectRatio, resolution: p.resolution,
    thinkingLevel: p.thinkingLevel, userId: p.userId, vendorAccountId: p.vendorAccountId,
    visibility: p.visibility,
  };
}

export async function reserveOpenAIImageResult(context: OpenAIImageCompletionContext, execute: typeof query = query): Promise<void> {
  const rows = await execute(`INSERT INTO app_openai_image_results(job_id,user_id,state,completion_context)
    SELECT job_id,user_id,'awaiting_response',$3::jsonb FROM app_jobs
    WHERE job_id=$1 AND user_id=$2 AND status NOT IN ('completed','failed')
    ON CONFLICT (job_id) DO NOTHING RETURNING job_id`, [context.jobId, context.userId, JSON.stringify(context)]);
  if (!rows.length) throw new OpenAIImageError('This OpenAI request already has a durable attempt.', { submissionState: 'uncertain', code: 'OPENAI_IMAGE_ALREADY_SUBMITTED' });
}

/** Database-only retries retain received bytes in memory; never retry the provider. */
export async function persistOpenAIImageResult(params: {
  jobId: string; userId: string; requestId: string | null;
  extracted: ReturnType<typeof extractOpenAIImages>;
  usage: ReturnType<typeof parseOpenAIImageUsage>;
}, execute: typeof query = query): Promise<void> {
  const images = params.extracted.images.map(image => ({ index: image.index, base64: image.data.toString('base64'), mimeType: image.mimeType }));
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const rows = await execute(`UPDATE app_openai_image_results SET provider_request_id=$3,
        completion_context=completion_context || $4::jsonb, images=$5::jsonb, response_complete=$6,
        state='received', updated_at=NOW()
        WHERE job_id=$1 AND user_id=$2 AND state='awaiting_response' RETURNING job_id`,
      [params.jobId, params.userId, params.requestId, JSON.stringify({ providerJobId: params.requestId, providerUsage: params.usage }), JSON.stringify(images), params.extracted.complete]);
      if (!rows.length) throw new Error('Receipt update was not accepted');
      return;
    } catch {
      if (attempt === 2) throw new OpenAIImageError('The received OpenAI result could not be checkpointed.', { submissionState: 'uncertain', code: 'OPENAI_IMAGE_CHECKPOINT_FAILED', requestId: params.requestId });
    }
  }
}
