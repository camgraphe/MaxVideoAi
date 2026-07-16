import { deriveJobSurface } from '@/lib/job-surface';
import { extractRenderIds, extractRenderThumbUrls, parseStoredImageRenders } from '@/lib/image-renders';
import { normalizeMediaUrl } from '@/lib/media';

import type { RecentGenerationRecord } from './recent-generations';

export function mapRecentGenerationRecordToWeb(record: RecentGenerationRecord) {
  const parsedRenders = parseStoredImageRenders(record.render_ids);
  const renderIds = extractRenderIds(parsedRenders.entries);
  const renderThumbUrls = extractRenderThumbUrls(parsedRenders);
  const primaryImage = renderIds?.[0] ? normalizeMediaUrl(renderIds[0]) ?? renderIds[0] : undefined;
  const primaryThumb = renderThumbUrls?.[0]
    ? normalizeMediaUrl(renderThumbUrls[0]) ?? renderThumbUrls[0]
    : undefined;
  const surface = deriveJobSurface({
    surface: record.surface,
    settingsSnapshot: record.settings_snapshot,
    jobId: record.job_id,
    engineId: record.engine_id,
    videoUrl: record.video_url,
    renderIds: record.render_ids,
  });
  return {
    jobId: record.job_id,
    surface,
    billingProductKey: record.billing_product_key ?? undefined,
    settingsSnapshot: record.settings_snapshot ?? undefined,
    engineLabel: record.engine_label,
    durationSec: record.duration_sec,
    prompt: record.prompt,
    thumbUrl: normalizeMediaUrl(record.thumb_url) ?? primaryThumb ?? primaryImage ?? undefined,
    videoUrl: normalizeMediaUrl(record.video_url) ?? undefined,
    previewVideoUrl: normalizeMediaUrl(record.preview_video_url) ?? undefined,
    audioUrl: normalizeMediaUrl(record.audio_url) ?? undefined,
    createdAt: record.created_at,
    engineId: record.engine_id,
    aspectRatio: record.aspect_ratio ?? undefined,
    hasAudio: Boolean(record.has_audio ?? false),
    canUpscale: Boolean(record.can_upscale ?? false),
    previewFrame: record.preview_frame ?? undefined,
    finalPriceCents: record.final_price_cents ?? undefined,
    currency: record.currency ?? 'USD',
    pricingSnapshot: record.pricing_snapshot ?? undefined,
    vendorAccountId: record.vendor_account_id ?? undefined,
    paymentStatus: record.payment_status ?? undefined,
    stripePaymentIntentId: record.stripe_payment_intent_id ?? undefined,
    stripeChargeId: record.stripe_charge_id ?? undefined,
    batchId: record.batch_id ?? undefined,
    groupId: record.group_id ?? undefined,
    iterationIndex: record.iteration_index ?? undefined,
    iterationCount: record.iteration_count ?? undefined,
    renderIds,
    renderThumbUrls,
    heroRenderId: record.hero_render_id ?? undefined,
    localKey: record.local_key ?? undefined,
    status: record.status ?? undefined,
    progress: typeof record.progress === 'number' ? record.progress : undefined,
    message: record.message ?? undefined,
    etaSeconds: record.eta_seconds ?? undefined,
    etaLabel: record.eta_label ?? undefined,
    visibility: record.visibility ?? 'public',
    indexable: record.indexable ?? true,
  };
}
