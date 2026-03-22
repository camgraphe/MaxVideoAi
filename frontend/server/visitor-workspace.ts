import { getMembershipTiers, type MembershipTierConfig } from '@/lib/membership';
import { query } from '@/lib/db';
import { normalizeMediaUrl } from '@/lib/media';
import { ensureBillingSchema } from '@/lib/schema';
import { deriveJobSurface } from '@/lib/job-surface';
import { extractRenderIds, extractRenderThumbUrls, parseStoredImageRenders, resolveHeroThumbFromRenders } from '@/lib/image-renders';
import { listStarterPlaylistVideos, type GalleryVideo } from '@/server/videos';
import type { PricingSnapshot } from '@/types/engines';
import type { Job } from '@/types/jobs';
import type { JobSurface } from '@/types/billing';

const VISITOR_STARTER_LOOKUP_LIMIT = 120;
const VISITOR_IMAGE_LOOKUP_LIMIT = 120;
const VISITOR_SPEND_TODAY_SAMPLE_SIZE = 4;

type VisitorImageLikeSurface = Extract<JobSurface, 'image' | 'character' | 'angle'>;

type VisitorImageLikeRow = {
  job_id: string;
  surface: string | null;
  settings_snapshot: unknown;
  engine_id: string;
  engine_label: string;
  duration_sec: number | null;
  prompt: string;
  thumb_url: string | null;
  video_url: string | null;
  audio_url: string | null;
  created_at: string;
  aspect_ratio: string | null;
  has_audio: boolean | null;
  can_upscale: boolean | null;
  final_price_cents: number | null;
  currency: string | null;
  pricing_snapshot: PricingSnapshot | null;
  render_ids: unknown;
  hero_render_id: string | null;
  local_key: string | null;
  visibility: string | null;
  indexable: boolean | null;
};

function getVideoCostCents(video: GalleryVideo): number | null {
  if (typeof video.finalPriceCents === 'number' && Number.isFinite(video.finalPriceCents)) {
    return Math.max(0, Math.round(video.finalPriceCents));
  }
  const snapshotTotal = video.pricingSnapshot?.totalCents;
  if (typeof snapshotTotal === 'number' && Number.isFinite(snapshotTotal)) {
    return Math.max(0, Math.round(snapshotTotal));
  }
  return null;
}

export function mapVisitorVideoToJob(video: GalleryVideo): Job {
  return {
    jobId: video.id,
    engineLabel: video.engineLabel,
    durationSec: video.durationSec,
    prompt: video.prompt,
    thumbUrl: video.thumbUrl ?? undefined,
    videoUrl: video.videoUrl ?? undefined,
    createdAt: video.createdAt,
    engineId: video.engineId,
    aspectRatio: video.aspectRatio,
    hasAudio: video.hasAudio,
    canUpscale: video.canUpscale,
    previewFrame: video.thumbUrl ?? undefined,
    finalPriceCents: typeof video.finalPriceCents === 'number' ? video.finalPriceCents : undefined,
    currency: video.currency ?? 'USD',
    pricingSnapshot: video.pricingSnapshot,
    paymentStatus: 'curated',
    status: 'completed',
    progress: 100,
    visibility: video.visibility,
    indexable: video.indexable,
    curated: true,
  };
}

export async function listVisitorStarterJobs(limit: number): Promise<Job[]> {
  const videos = await listStarterPlaylistVideos(limit);
  return videos.map(mapVisitorVideoToJob);
}

export async function getVisitorStarterJob(jobId: string): Promise<Job | null> {
  const videos = await listStarterPlaylistVideos(VISITOR_STARTER_LOOKUP_LIMIT);
  const match = videos.find((video) => video.id === jobId);
  return match ? mapVisitorVideoToJob(match) : null;
}

function buildVisitorImageSurfaceClause(surface: VisitorImageLikeSurface | null | undefined): string {
  if (surface === 'image') {
    return `
      AND (
        surface IN ('image', 'character', 'angle')
        OR settings_snapshot->>'surface' IN ('image', 'character-builder', 'angle')
        OR job_id LIKE 'tool_angle_%'
        OR render_ids IS NOT NULL
      )
    `;
  }

  if (surface === 'character') {
    return `
      AND (
        surface = 'character'
        OR settings_snapshot->>'surface' = 'character-builder'
      )
    `;
  }

  if (surface === 'angle') {
    return `
      AND (
        surface = 'angle'
        OR settings_snapshot->>'surface' = 'angle'
        OR job_id LIKE 'tool_angle_%'
      )
    `;
  }

  return `
    AND (
      surface IN ('image', 'character', 'angle')
      OR settings_snapshot->>'surface' IN ('image', 'character-builder', 'angle')
      OR job_id LIKE 'tool_angle_%'
    )
  `;
}

async function listVisitorImageLikeRows(
  limit: number,
  surface?: VisitorImageLikeSurface | null
): Promise<VisitorImageLikeRow[]> {
  await ensureBillingSchema();
  const normalizedLimit = Math.max(1, Math.min(Math.round(limit), VISITOR_IMAGE_LOOKUP_LIMIT));
  const clause = buildVisitorImageSurfaceClause(surface ?? null);
  return query<VisitorImageLikeRow>(
    `
      SELECT
        job_id,
        surface,
        settings_snapshot,
        engine_id,
        engine_label,
        duration_sec,
        prompt,
        thumb_url,
        video_url,
        audio_url,
        created_at,
        aspect_ratio,
        has_audio,
        can_upscale,
        final_price_cents,
        currency,
        pricing_snapshot,
        render_ids,
        hero_render_id,
        local_key,
        visibility,
        indexable
      FROM app_jobs
      WHERE visibility = 'public'
        AND COALESCE(indexable, TRUE)
        AND hidden IS NOT TRUE
        ${clause}
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [normalizedLimit]
  );
}

function mapVisitorImageLikeToJob(row: VisitorImageLikeRow): Job | null {
  const parsedRenders = parseStoredImageRenders(row.render_ids);
  const renderIds = extractRenderIds(parsedRenders.entries);
  if (!renderIds?.length) {
    return null;
  }
  const renderThumbUrls = extractRenderThumbUrls(parsedRenders);
  const thumbUrl =
    normalizeMediaUrl(row.thumb_url) ??
    resolveHeroThumbFromRenders(parsedRenders.entries) ??
    renderThumbUrls?.[0] ??
    renderIds[0];
  const surface = deriveJobSurface({
    surface: row.surface,
    settingsSnapshot: row.settings_snapshot,
    jobId: row.job_id,
    engineId: row.engine_id,
    videoUrl: row.video_url,
    renderIds: row.render_ids,
  });

  if (surface !== 'image' && surface !== 'character' && surface !== 'angle') {
    return null;
  }

  return {
    jobId: row.job_id,
    surface,
    engineLabel: row.engine_label,
    durationSec: row.duration_sec ?? 0,
    prompt: row.prompt,
    thumbUrl,
    videoUrl: undefined,
    audioUrl: undefined,
    createdAt: row.created_at,
    engineId: row.engine_id,
    aspectRatio: row.aspect_ratio ?? undefined,
    hasAudio: Boolean(row.has_audio ?? false),
    canUpscale: Boolean(row.can_upscale ?? false),
    previewFrame: thumbUrl,
    finalPriceCents: typeof row.final_price_cents === 'number' ? row.final_price_cents : undefined,
    currency: row.currency ?? 'USD',
    pricingSnapshot: row.pricing_snapshot ?? undefined,
    paymentStatus: 'curated',
    status: 'completed',
    progress: 100,
    visibility: 'public',
    indexable: Boolean(row.indexable ?? true),
    curated: true,
    renderIds,
    renderThumbUrls: renderThumbUrls ?? renderIds,
    heroRenderId: row.hero_render_id ?? renderIds[0],
  };
}

export async function listVisitorImageLikeJobs(
  limit: number,
  surface?: VisitorImageLikeSurface | null
): Promise<Job[]> {
  const rows = await listVisitorImageLikeRows(limit, surface);
  return rows
    .map(mapVisitorImageLikeToJob)
    .filter((job): job is Job => job !== null && (!surface || job.surface === surface));
}

export async function getVisitorImageLikeJob(jobId: string): Promise<Job | null> {
  const jobs = await listVisitorImageLikeJobs(VISITOR_IMAGE_LOOKUP_LIMIT);
  return jobs.find((job) => job.jobId === jobId) ?? null;
}

function resolveActiveTier(spent30Cents: number, tiers: MembershipTierConfig[]): MembershipTierConfig {
  let activeTier = tiers[0] ?? { tier: 'member', spendThresholdCents: 0, discountPercent: 0 };
  tiers.forEach((tier) => {
    if (spent30Cents >= tier.spendThresholdCents) {
      activeTier = tier;
    }
  });
  return activeTier;
}

function formatTierLabel(tier: string): string {
  if (!tier.length) return 'Member';
  return `${tier.slice(0, 1).toUpperCase()}${tier.slice(1)}`;
}

export async function getVisitorMemberStatus(includeTiers: boolean): Promise<{
  tier: string;
  savingsPct: number;
  spent30: number;
  spentToday: number;
  tiers?: MembershipTierConfig[];
}> {
  const [videos, tiers] = await Promise.all([
    listStarterPlaylistVideos(VISITOR_STARTER_LOOKUP_LIMIT),
    getMembershipTiers(),
  ]);

  const costs = videos
    .map((video) => getVideoCostCents(video))
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  const spent30Cents = costs.reduce((sum, value) => sum + value, 0);
  const spentTodayCents = costs.slice(0, VISITOR_SPEND_TODAY_SAMPLE_SIZE).reduce((sum, value) => sum + value, 0);
  const activeTier = resolveActiveTier(spent30Cents, tiers);

  return {
    tier: formatTierLabel(activeTier.tier),
    savingsPct: Math.round((activeTier.discountPercent ?? 0) * 100),
    spent30: spent30Cents / 100,
    spentToday: spentTodayCents / 100,
    ...(includeTiers ? { tiers } : {}),
  };
}
