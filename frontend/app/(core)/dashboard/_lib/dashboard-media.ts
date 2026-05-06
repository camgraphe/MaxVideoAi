import type { MediaLightboxEntry } from '@/components/MediaLightbox';
import { getAspectRatioNumber } from '@/lib/aspect';
import { deriveJobSurface } from '@/lib/job-surface';
import type { JobSurface } from '@/types/billing';
import type { GroupSummary } from '@/types/groups';
import type { Job } from '@/types/jobs';

const DASHBOARD_PREVIEW_RATIO = 16 / 9;

export function resolveWorkspaceJobHref(jobId: string, surface?: JobSurface | null): string {
  return surface === 'audio'
    ? `/app/audio?job=${encodeURIComponent(jobId)}`
    : `/app?job=${encodeURIComponent(jobId)}`;
}

export function resolveRemixEntryHref(entry: MediaLightboxEntry): string | null {
  const jobId = entry.jobId ?? entry.id;
  if (!jobId) return null;
  if (entry.curated && entry.videoUrl) {
    return `/app?from=${encodeURIComponent(jobId)}`;
  }
  return resolveWorkspaceJobHref(jobId, entry.surface);
}

export function resolveDashboardJobSurface(job: Job): JobSurface {
  return deriveJobSurface({
    surface: job.surface,
    jobId: job.jobId,
    engineId: job.engineId ?? null,
    videoUrl: job.videoUrl ?? null,
    renderIds: job.renderIds,
  });
}

export function resolveGroupSurface(group: GroupSummary): JobSurface {
  if (group.hero.job) {
    return resolveDashboardJobSurface(group.hero.job);
  }
  if (group.hero.audioUrl) return 'audio';
  if (group.hero.videoUrl) return 'video';
  return 'image';
}

export function shouldFillDashboardPreview(aspectRatio?: string | null): boolean {
  if (!aspectRatio) return true;
  const ratio = getAspectRatioNumber(aspectRatio, DASHBOARD_PREVIEW_RATIO);
  return Math.abs(ratio - DASHBOARD_PREVIEW_RATIO) < 0.04;
}

export function getJobCostCents(job: Job): number | null {
  if (typeof job.finalPriceCents === 'number') return job.finalPriceCents;
  const pricing = job.pricingSnapshot as { totalCents?: number } | undefined;
  if (typeof pricing?.totalCents === 'number') return pricing.totalCents;
  return null;
}

export function buildEntriesFromJob(job: Job): MediaLightboxEntry[] {
  const imageUrl =
    Array.isArray(job.renderIds) && job.renderIds.length
      ? job.renderIds.find((value): value is string => typeof value === 'string' && value.length > 0) ?? undefined
      : undefined;

  return [
    {
      id: job.jobId,
      jobId: job.jobId,
      surface: job.surface ?? null,
      label: job.engineLabel,
      videoUrl: job.videoUrl ?? undefined,
      imageUrl,
      thumbUrl: job.thumbUrl ?? undefined,
      aspectRatio: job.aspectRatio ?? undefined,
      status: (job.status as MediaLightboxEntry['status']) ?? 'completed',
      progress: typeof job.progress === 'number' ? job.progress : null,
      message: job.message ?? null,
      engineLabel: job.engineLabel,
      engineId: job.engineId ?? null,
      durationSec: job.durationSec,
      createdAt: job.createdAt,
      hasAudio: Boolean(job.hasAudio),
      prompt: job.prompt ?? null,
      priceCents: getJobCostCents(job),
      currency: job.currency ?? null,
      curated: Boolean(job.curated),
    },
  ];
}

export function buildEntriesFromGroup(group: GroupSummary, versionLabel: string): MediaLightboxEntry[] {
  return group.members.map((member) => {
    const imageUrl =
      Array.isArray(member.job?.renderIds) && member.job.renderIds.length
        ? member.job.renderIds.find((value): value is string => typeof value === 'string' && value.length > 0) ?? undefined
        : undefined;

    return {
      id: member.id,
      jobId: member.jobId ?? member.id,
      surface: member.job?.surface ?? null,
      label:
        typeof member.iterationIndex === 'number'
          ? versionLabel.replace('{index}', String(member.iterationIndex + 1))
          : member.engineLabel ?? member.id,
      videoUrl: member.videoUrl ?? undefined,
      imageUrl,
      thumbUrl: member.thumbUrl ?? undefined,
      aspectRatio: member.aspectRatio ?? undefined,
      status: member.status ?? 'completed',
      progress: typeof member.progress === 'number' ? member.progress : null,
      message: member.message ?? null,
      engineLabel: member.engineLabel,
      engineId: member.engineId ?? null,
      durationSec: member.durationSec,
      createdAt: member.createdAt,
      hasAudio: Boolean(member.job?.hasAudio),
      prompt: member.prompt ?? group.hero.prompt ?? null,
      priceCents: typeof member.priceCents === 'number' ? member.priceCents : null,
      currency: member.currency ?? group.currency ?? null,
      curated: Boolean(member.job?.curated),
    };
  });
}

