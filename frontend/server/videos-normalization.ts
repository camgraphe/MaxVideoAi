import { normalizeMediaUrl } from '@/lib/media';
import { normalizeJobKeyframeUrls, type JobKeyframeUrls } from '@/server/video-keyframes';
import type { PricingSnapshot } from '@/types/engines';

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
  createdAt: string;
  visibility: 'public' | 'private';
  indexable: boolean;
  hasAudio: boolean;
  canUpscale: boolean;
  finalPriceCents?: number | null;
  currency?: string | null;
  pricingSnapshot?: PricingSnapshot;
  settingsSnapshot?: unknown;
  playlistOrder?: number | null;
};

function formatPromptExcerpt(prompt: string, maxLength = 160): string {
  const trimmed = prompt.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

export function mapGalleryVideoRow(row: VideoRow): GalleryVideo {
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
    createdAt: row.created_at,
    visibility: (row.visibility ?? 'public') === 'private' ? 'private' : 'public',
    indexable: Boolean(row.indexable ?? true),
    hasAudio: Boolean(row.has_audio ?? false),
    canUpscale: Boolean(row.can_upscale ?? false),
    finalPriceCents: row.final_price_cents ?? undefined,
    currency: row.currency ?? undefined,
    pricingSnapshot: row.pricing_snapshot ?? undefined,
    settingsSnapshot: row.settings_snapshot ?? undefined,
    playlistOrder: typeof row.order_index === 'number' ? row.order_index : null,
  };
}
