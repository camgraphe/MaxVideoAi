import { normalizeMediaUrl } from '@/lib/media';
import { publicExampleGenerationMode, publicExampleRequestedResolution } from '@/lib/example-recreation';
import { normalizeVideoOperation, type VideoOperation } from '@/lib/video-operation';
import { normalizeJobKeyframeUrls, type JobKeyframeUrls } from '@/server/video-keyframes';
import type { Mode, PricingSnapshot } from '@/types/engines';
import { findLaunchExamplePrice } from './launch-example-pricing';
import { sanitizePublicRecreationSnapshot } from './marketing-media/public-recreation';
import { sanitizePublicVideoPricingSnapshot } from './marketing-media/public-pricing';

export type VideoRow = {
  job_id: string;
  user_id: string | null;
  engine_id: string;
  engine_label: string;
  duration_sec: number;
  prompt: string;
  thumb_url: string;
  video_url: string | null;
  preview_video_url: string | null;
  keyframe_urls: unknown;
  aspect_ratio: string | null;
  output_width?: number | null;
  output_height?: number | null;
  requested_resolution?: string | null;
  generation_mode?: unknown;
  generation_operation?: unknown;
  has_audio: boolean | null;
  can_upscale: boolean | null;
  created_at: string;
  visibility: string;
  indexable: boolean | null;
  featured: boolean | null;
  featured_order: number | null;
  final_price_cents: number | null;
  currency: string | null;
  pricing_snapshot?: PricingSnapshot | null;
  settings_snapshot?: unknown;
  recreation_snapshot?: unknown;
  order_index?: number | null;
};

export type GalleryVideo = {
  id: string;
  userId: string | null;
  engineId: string;
  engineLabel: string;
  durationSec: number;
  prompt: string;
  promptExcerpt: string;
  thumbUrl?: string;
  videoUrl?: string;
  previewVideoUrl?: string;
  keyframeUrls?: JobKeyframeUrls | null;
  aspectRatio?: string;
  outputWidth?: number | null;
  outputHeight?: number | null;
  requestedResolution?: string;
  generationMode?: Mode | null;
  operation?: VideoOperation;
  createdAt: string;
  visibility: 'public' | 'private';
  indexable: boolean;
  hasAudio: boolean;
  canUpscale: boolean;
  finalPriceCents?: number | null;
  currency?: string | null;
  pricingSnapshot?: PricingSnapshot;
  settingsSnapshot?: unknown;
  recreationSnapshot?: unknown;
  playlistOrder?: number | null;
};

function formatPromptExcerpt(prompt: string, maxLength = 160): string {
  const trimmed = prompt.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

export function mapGalleryVideoRow(row: VideoRow): GalleryVideo {
  const requestedResolution = publicExampleRequestedResolution(row.requested_resolution);
  const generationMode = publicExampleGenerationMode(row.generation_mode);
  let operation: VideoOperation | undefined;
  if (generationMode && row.generation_operation != null) {
    try {
      operation = normalizeVideoOperation(row.engine_id, generationMode, row.generation_operation);
    } catch {
      // Invalid historical metadata cannot select an unrelated source operation.
    }
  }
  const recipe = sanitizePublicRecreationSnapshot(row.recreation_snapshot);
  const recreationSnapshot = operation && recipe && typeof recipe === 'object' && !Array.isArray(recipe)
    && !Object.hasOwn(recipe, 'operation')
    && (recipe as Record<string, unknown>).engineId === row.engine_id
    && (recipe as Record<string, unknown>).inputMode === generationMode
    ? { ...recipe, operation } : recipe;
  const pricingSnapshot = row.visibility === 'private' && row.recreation_snapshot == null
    ? row.pricing_snapshot
    : sanitizePublicVideoPricingSnapshot(row.pricing_snapshot);
  const historicalPrice = row.final_price_cents == null ? findLaunchExamplePrice({
    jobId: row.job_id,
    engineId: row.engine_id,
    durationSec: row.duration_sec,
    currency: row.currency,
  }) : null;
  return {
    id: row.job_id,
    userId: row.user_id ?? null,
    engineId: row.engine_id,
    engineLabel: row.engine_label,
    durationSec: row.duration_sec,
    prompt: row.prompt,
    promptExcerpt: formatPromptExcerpt(row.prompt),
    thumbUrl: normalizeMediaUrl(row.thumb_url) ?? undefined,
    videoUrl: row.video_url ? normalizeMediaUrl(row.video_url) ?? undefined : undefined,
    previewVideoUrl: row.preview_video_url ? normalizeMediaUrl(row.preview_video_url) ?? undefined : undefined,
    keyframeUrls: normalizeJobKeyframeUrls(row.keyframe_urls),
    aspectRatio: row.aspect_ratio ?? undefined,
    outputWidth: typeof row.output_width === 'number' && Number.isFinite(row.output_width) ? row.output_width : null,
    outputHeight: typeof row.output_height === 'number' && Number.isFinite(row.output_height) ? row.output_height : null,
    ...(requestedResolution ? { requestedResolution } : {}),
    ...(generationMode ? { generationMode } : {}),
    ...(operation ? { operation } : {}),
    createdAt: row.created_at,
    visibility: (row.visibility ?? 'public') === 'private' ? 'private' : 'public',
    indexable: Boolean(row.indexable ?? true),
    hasAudio: Boolean(row.has_audio ?? false),
    canUpscale: Boolean(row.can_upscale ?? false),
    finalPriceCents: row.final_price_cents ?? historicalPrice?.totalCents ?? undefined,
    currency: row.currency ?? historicalPrice?.currency ?? undefined,
    pricingSnapshot: pricingSnapshot ?? undefined,
    settingsSnapshot: row.settings_snapshot ?? undefined,
    recreationSnapshot: recreationSnapshot ?? undefined,
    playlistOrder: typeof row.order_index === 'number' ? row.order_index : null,
  };
}
