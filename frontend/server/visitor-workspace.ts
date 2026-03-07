import { getMembershipTiers, type MembershipTierConfig } from '@/lib/membership';
import { listStarterPlaylistVideos, type GalleryVideo } from '@/server/videos';
import type { Job } from '@/types/jobs';

const VISITOR_STARTER_LOOKUP_LIMIT = 120;
const VISITOR_SPEND_TODAY_SAMPLE_SIZE = 4;

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
