import { isRefundedPaymentStatus } from '@/lib/gallery-retention';
import { isPlaceholderMediaUrl } from '@/lib/media';
import type { SelectedVideoPreview } from '@/lib/video-preview-group';
import type { Job } from '@/types/jobs';
import type { LocalRender } from './render-persistence';
import { resolvePolledThumbUrl, resolveRenderThumb } from './render-persistence';

export type RenderHeroCandidate = {
  batchId: string | null;
  localKey: string;
};

export type PolledJobStatus = {
  status?: LocalRender['status'] | null;
  progress?: number | null;
  videoUrl?: string | null;
  previewVideoUrl?: string | null;
  thumbUrl?: string | null;
  aspectRatio?: string | null;
  finalPriceCents?: number | null;
  currency?: string | null;
  pricing?: LocalRender['pricingSnapshot'] | null;
  paymentStatus?: string | null;
  message?: string | null;
};

export type LocalRenderFromJobOptions = {
  engineIdByLabel?: ReadonlyMap<string, string>;
  now?: number;
};

export function convertJobToLocalRender(job: Job, options: LocalRenderFromJobOptions = {}): LocalRender {
  const now = options.now ?? Date.now();
  const baseLocalKey = job.localKey ?? job.jobId;
  const localKey = baseLocalKey ?? `job_${job.jobId}`;
  const batchId = job.batchId ?? job.groupId ?? localKey;
  const renderIds = Array.isArray(job.renderIds)
    ? job.renderIds.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : undefined;
  const normalizedStatus = (() => {
    const raw = (job.status ?? '').toLowerCase();
    if (raw === 'failed') return 'failed' as const;
    if (raw === 'completed') return 'completed' as const;
    if (job.videoUrl) return 'completed' as const;
    return 'pending' as const;
  })();
  const normalizedProgress = (() => {
    if (typeof job.progress === 'number' && Number.isFinite(job.progress)) {
      return Math.max(0, Math.min(100, Math.round(job.progress)));
    }
    if (normalizedStatus === 'completed' || job.videoUrl) return 100;
    if (normalizedStatus === 'failed') return 100;
    return 0;
  })();
  const createdAt = typeof job.createdAt === 'string' && job.createdAt.length ? job.createdAt : new Date(now).toISOString();
  const parsedCreated = Number.isFinite(Date.parse(createdAt)) ? Date.parse(createdAt) : now;
  const priceCents = typeof job.finalPriceCents === 'number' ? job.finalPriceCents : job.pricingSnapshot?.totalCents;
  const currency = job.currency ?? job.pricingSnapshot?.currency ?? undefined;
  const engineId =
    job.engineId ??
    (job.engineLabel ? options.engineIdByLabel?.get(job.engineLabel.toLowerCase()) ?? undefined : undefined) ??
    'unknown-engine';
  const pendingMessage = (() => {
    if (engineId.startsWith('sora-2')) {
      return 'Sora 2 renders take a little longer—hang tight while we finish up the magic.';
    }
    return 'Render pending.';
  })();

  const message =
    job.message ??
    (normalizedStatus === 'completed'
      ? 'Render completed.'
      : normalizedStatus === 'failed'
        ? 'The service reported a failure without details. Try again. If it fails repeatedly, contact support with your request ID.'
        : pendingMessage);
  const jobThumb = job.thumbUrl && !isPlaceholderMediaUrl(job.thumbUrl) ? job.thumbUrl : null;
  const thumbUrl =
    jobThumb ??
    job.previewFrame ??
    resolveRenderThumb({ thumbUrl: job.thumbUrl, aspectRatio: job.aspectRatio ?? null });

  return {
    localKey,
    batchId,
    iterationIndex:
      typeof job.iterationIndex === 'number' && Number.isFinite(job.iterationIndex)
        ? Math.max(0, Math.trunc(job.iterationIndex))
        : 0,
    iterationCount: Math.max(
      1,
      typeof job.iterationCount === 'number' && Number.isFinite(job.iterationCount)
        ? Math.trunc(job.iterationCount)
        : renderIds?.length ?? 1
    ),
    id: job.jobId,
    jobId: job.jobId,
    engineId,
    engineLabel: job.engineLabel ?? 'Unknown engine',
    createdAt,
    aspectRatio: job.aspectRatio ?? '16:9',
    durationSec: job.durationSec,
    prompt: job.prompt ?? '',
    progress: normalizedProgress,
    message,
    status: normalizedStatus,
    videoUrl: job.videoUrl ?? undefined,
    previewVideoUrl: job.previewVideoUrl ?? undefined,
    readyVideoUrl: job.videoUrl ?? undefined,
    thumbUrl,
    hasAudio: typeof job.hasAudio === 'boolean' ? job.hasAudio : undefined,
    priceCents: priceCents ?? undefined,
    currency,
    pricingSnapshot: job.pricingSnapshot,
    paymentStatus: job.paymentStatus ?? 'platform',
    failedAt:
      normalizedStatus === 'failed' && isRefundedPaymentStatus(job.paymentStatus ?? null)
        ? parsedCreated
        : undefined,
    etaSeconds: job.etaSeconds ?? undefined,
    etaLabel: job.etaLabel ?? undefined,
    startedAt: parsedCreated,
    minReadyAt: parsedCreated,
    groupId: job.groupId ?? job.batchId ?? null,
    renderIds,
    heroRenderId: job.heroRenderId ?? null,
  };
}

export function getRendersNeedingStatusRefresh(renders: LocalRender[]): LocalRender[] {
  return renders.filter((render) => {
    if (typeof render.jobId !== 'string' || render.jobId.length === 0) return false;
    if (render.status === 'failed') return false;
    const hasVideo = Boolean(render.videoUrl);
    const hasThumb = Boolean(render.thumbUrl && !isPlaceholderMediaUrl(render.thumbUrl));
    if ((render.status ?? 'pending') !== 'completed') return true;
    return !hasVideo || !hasThumb;
  });
}

export function applyPolledJobStatusToRender(render: LocalRender, status: PolledJobStatus): LocalRender {
  return {
    ...render,
    status: status.status ?? render.status,
    progress: status.progress ?? render.progress,
    readyVideoUrl: status.videoUrl ?? render.readyVideoUrl,
    videoUrl: status.videoUrl ?? render.videoUrl ?? render.readyVideoUrl,
    previewVideoUrl: status.previewVideoUrl ?? render.previewVideoUrl,
    thumbUrl: resolvePolledThumbUrl(render.thumbUrl, status.thumbUrl),
    aspectRatio: status.aspectRatio ?? render.aspectRatio,
    priceCents: status.finalPriceCents ?? status.pricing?.totalCents ?? render.priceCents,
    currency: status.currency ?? status.pricing?.currency ?? render.currency,
    pricingSnapshot: status.pricing ?? render.pricingSnapshot,
    paymentStatus: status.paymentStatus ?? render.paymentStatus,
    message: status.message ?? render.message,
  };
}

export function applyPolledJobStatusToSelectedPreview(
  current: SelectedVideoPreview | null,
  render: Pick<LocalRender, 'jobId' | 'localKey'>,
  status: PolledJobStatus
): SelectedVideoPreview | null {
  if (!current || !render.jobId || (current.id !== render.jobId && current.localKey !== render.localKey)) {
    return current;
  }

  return {
    ...current,
    id: render.jobId,
    localKey: render.localKey,
    status: status.status ?? current.status,
    progress: status.progress ?? current.progress,
    videoUrl: status.videoUrl ?? current.videoUrl,
    previewVideoUrl: status.previewVideoUrl ?? current.previewVideoUrl,
    thumbUrl: resolvePolledThumbUrl(current.thumbUrl, status.thumbUrl),
    aspectRatio: status.aspectRatio ?? current.aspectRatio,
    priceCents: status.finalPriceCents ?? status.pricing?.totalCents ?? current.priceCents,
    currency: status.currency ?? status.pricing?.currency ?? current.currency,
    message: status.message ?? current.message,
  };
}

export type RecentJobsMergeResult = {
  renders: LocalRender[];
  heroCandidates: RenderHeroCandidate[];
  changed: boolean;
};

export function mergeRecentJobsIntoLocalRenders(
  previous: LocalRender[],
  recentJobs: Job[],
  options: LocalRenderFromJobOptions = {}
): RecentJobsMergeResult {
  const next = [...previous];
  const byLocalKey = new Map<string, number>();
  const byJobId = new Map<string, number>();
  const heroCandidates: RenderHeroCandidate[] = [];

  previous.forEach((render, index) => {
    if (render.localKey) {
      byLocalKey.set(render.localKey, index);
    }
    if (render.jobId) {
      byJobId.set(render.jobId, index);
    }
  });

  let changed = false;

  recentJobs.forEach((job) => {
    if (!job.jobId) return;
    const converted = convertJobToLocalRender(job, options);
    const jobIdIndex = converted.jobId ? byJobId.get(converted.jobId) : undefined;
    const localKeyIndex = byLocalKey.get(converted.localKey);
    const targetIndex = jobIdIndex ?? localKeyIndex;

    if (targetIndex !== undefined) {
      const existing = next[targetIndex];
      const merged: LocalRender = {
        ...converted,
        localKey: existing.localKey ?? converted.localKey,
        batchId: existing.batchId ?? converted.batchId,
      };
      next[targetIndex] = merged;
      if (merged.localKey) {
        byLocalKey.set(merged.localKey, targetIndex);
      }
      if (merged.jobId) {
        byJobId.set(merged.jobId, targetIndex);
      }
      heroCandidates.push({ batchId: merged.batchId ?? null, localKey: merged.localKey });
      changed = true;
      return;
    }

    next.push(converted);
    if (converted.localKey) {
      byLocalKey.set(converted.localKey, next.length - 1);
    }
    if (converted.jobId) {
      byJobId.set(converted.jobId, next.length - 1);
    }
    heroCandidates.push({ batchId: converted.batchId ?? null, localKey: converted.localKey });
    changed = true;
  });

  if (!changed) {
    return { renders: previous, heroCandidates, changed: false };
  }

  next.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return { renders: next, heroCandidates, changed: true };
}

export function buildRecentJobIdSet(recentJobs: Pick<Job, 'jobId'>[]): Set<string> {
  const ids = new Set<string>();
  recentJobs.forEach((job) => {
    if (typeof job.jobId === 'string' && job.jobId.length > 0) {
      ids.add(job.jobId);
    }
  });
  return ids;
}

export function shouldRemoveCompletedSyncedRender(render: LocalRender, recentJobIds: Set<string>): boolean {
  if (!render.jobId || !recentJobIds.has(render.jobId)) {
    return false;
  }
  if (render.status !== 'completed') {
    return false;
  }
  return Boolean(render.videoUrl ?? render.readyVideoUrl);
}
