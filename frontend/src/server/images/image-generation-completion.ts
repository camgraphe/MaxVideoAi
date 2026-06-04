import { query } from '@/lib/db';
import { buildStoredImageRenderEntries, resolveHeroThumbFromRenders } from '@/lib/image-renders';
import { ensureReusableAsset, upsertLegacyJobOutputs } from '@/server/media-library';
import type { BillingProductKey, JobSurface } from '@/types/billing';
import type { PricingSnapshot } from '@/types/engines';
import type { GeneratedImage, ImageGenerationMode } from '@/types/image-generation';
import { PLACEHOLDER_THUMB } from './image-initial-job';

type CompletedImage = GeneratedImage & {
  thumbUrl?: string | null;
};

export async function persistCompletedImageGeneration(params: {
  billingProductKey: BillingProductKey | null;
  characterReferenceCount: number;
  costBreakdownJson: string | null;
  description: string | null;
  enableWebSearch: boolean;
  engineId: string;
  engineLabel: string;
  images: CompletedImage[];
  indexable: boolean;
  jobId: string;
  jobSurface: JobSurface;
  limitGenerations: boolean;
  maskUrl: string | null;
  mode: ImageGenerationMode;
  normalizedSeed: number | null;
  numImages: number;
  outputFormat: string | null;
  pricing: PricingSnapshot;
  pricingSnapshotJson: string;
  paymentStatus?: string;
  providerJobId: string | null;
  providerMode: string;
  quality: string | null;
  resolvedAspectRatio: string | null;
  resolution: string;
  thinkingLevel: string | null;
  userId: string;
  vendorAccountId: string | null;
  visibility: 'public' | 'private';
}) {
  const {
    characterReferenceCount,
    costBreakdownJson,
    description,
    enableWebSearch,
    engineId,
    images,
    indexable,
    jobId,
    jobSurface,
    limitGenerations,
    maskUrl,
    mode,
    normalizedSeed,
    numImages,
    outputFormat,
    pricing,
    pricingSnapshotJson,
    paymentStatus,
    providerJobId,
    providerMode,
    quality,
    resolvedAspectRatio,
    resolution,
    thinkingLevel,
    userId,
    vendorAccountId,
    visibility,
  } = params;

  const storedRenderEntries = buildStoredImageRenderEntries(images);
  const hero = images[0]?.url ?? null;
  const heroThumb = resolveHeroThumbFromRenders(images) ?? hero;
  const renderIdsJson = JSON.stringify(storedRenderEntries);

  await query(
    `UPDATE app_jobs
     SET thumb_url = $2,
         preview_frame = $2,
         video_url = $3,
         status = 'completed',
         progress = 100,
         provider_job_id = COALESCE($4, provider_job_id),
         final_price_cents = $5,
         pricing_snapshot = $6::jsonb,
         cost_breakdown_usd = $7::jsonb,
         currency = $8,
         vendor_account_id = $9,
         payment_status = $15,
         visibility = $10,
         indexable = $11,
         message = $12,
         render_ids = $13::jsonb,
         hero_render_id = $14,
         provisional = FALSE,
         updated_at = NOW()
     WHERE job_id = $1`,
    [
      jobId,
      heroThumb ?? PLACEHOLDER_THUMB,
      null,
      providerJobId ?? null,
      pricing.totalCents,
      pricingSnapshotJson,
      costBreakdownJson,
      pricing.currency,
      vendorAccountId,
      visibility,
      indexable,
      description,
      renderIdsJson,
      hero,
      paymentStatus ?? 'paid_wallet',
    ]
  );

  await upsertLegacyJobOutputs({
    job_id: jobId,
    user_id: userId,
    surface: jobSurface,
    video_url: null,
    audio_url: null,
    thumb_url: heroThumb ?? PLACEHOLDER_THUMB,
    preview_frame: heroThumb ?? PLACEHOLDER_THUMB,
    render_ids: storedRenderEntries,
    duration_sec: 1,
    status: 'completed',
  }).catch((outputError) => {
    console.warn('[images] failed to persist job outputs', { jobId }, outputError);
  });

  if (jobSurface === 'character') {
    await Promise.allSettled(
      images.map((image, index) =>
        ensureReusableAsset({
          userId,
          url: image.url,
          kind: 'image',
          source: 'character',
          sourceJobId: jobId,
          sourceOutputId: `${jobId}:image:${index}`,
          mimeType: image.mimeType ?? 'image/png',
          width: image.width ?? null,
          height: image.height ?? null,
          thumbUrl: image.thumbUrl ?? null,
        })
      )
    );
  }

  try {
    await query(
      `INSERT INTO fal_queue_log (job_id, provider, provider_job_id, engine_id, status, payload)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [
        jobId,
        providerMode,
        providerJobId ?? null,
        engineId,
        'completed',
        JSON.stringify({
          request: {
            mode,
            numImages,
            resolution,
            ...(characterReferenceCount ? { characterReferenceCount } : {}),
            ...(resolvedAspectRatio ? { aspect_ratio: resolvedAspectRatio } : {}),
            ...(normalizedSeed != null ? { seed: normalizedSeed } : {}),
            ...(outputFormat ? { output_format: outputFormat } : {}),
            ...(quality ? { quality } : {}),
            ...(maskUrl ? { mask_url: maskUrl } : {}),
            ...(enableWebSearch ? { enable_web_search: true } : {}),
            ...(thinkingLevel ? { thinking_level: thinkingLevel } : {}),
            ...(limitGenerations ? { limit_generations: true } : {}),
          },
          pricing: { totalCents: pricing.totalCents, currency: pricing.currency },
        }),
      ]
    );
  } catch (error) {
    console.warn('[images] failed to record fal queue log', error);
  }

  return { hero, heroThumb, renderIdsJson, storedRenderEntries };
}
