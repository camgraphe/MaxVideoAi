import { isRefundedPaymentStatus } from '@/lib/gallery-retention';
import { isPlaceholderMediaUrl } from '@/lib/media';
import type { SelectedVideoPreview } from '@/lib/video-preview-group';
import { resolvePolledThumbUrl, type LocalRender } from './render-persistence';

export type GenerationPollStatus = {
  status?: LocalRender['status'] | null;
  progress?: number | null;
  videoUrl?: string | null;
  previewVideoUrl?: string | null;
  thumbUrl?: string | null;
  finalPriceCents?: number | null;
  currency?: string | null;
  pricing?: LocalRender['pricingSnapshot'] | null;
  paymentStatus?: string | null;
  message?: string | null;
};

export type GenerationPollProjection = {
  status: GenerationPollStatus;
  jobId: string;
  localKey: string;
  now: number;
  targetReadyVideoUrl?: string;
  deferUntilReady: boolean;
  shouldApplyState: boolean;
  shouldKeepPolling: boolean;
  shouldStopProgressTracking: boolean;
  nextPollDelayMs: number | null;
  progressMessage?: string;
};

export function projectGenerationPollStatus({
  status,
  target,
  jobId,
  localKey,
  now,
}: {
  status: GenerationPollStatus;
  target?: LocalRender | null;
  jobId: string;
  localKey: string;
  now: number;
}): GenerationPollProjection {
  const isCompleted = status.status === 'completed' || Boolean(status.videoUrl);
  const minReadyAtCurrent = target?.minReadyAt ?? 0;
  if (isCompleted && target && now < minReadyAtCurrent) {
    return {
      status,
      jobId,
      localKey,
      now,
      targetReadyVideoUrl: target.readyVideoUrl,
      deferUntilReady: true,
      shouldApplyState: false,
      shouldKeepPolling: true,
      shouldStopProgressTracking: false,
      nextPollDelayMs: Math.max(500, minReadyAtCurrent - now),
      progressMessage: status.message ?? undefined,
    };
  }

  const hasVideo = Boolean(status.videoUrl);
  const hasThumb = Boolean(status.thumbUrl && !isPlaceholderMediaUrl(status.thumbUrl));
  const shouldKeepPolling = status.status !== 'failed' && (status.status !== 'completed' || !hasVideo || !hasThumb);

  return {
    status,
    jobId,
    localKey,
    now,
    targetReadyVideoUrl: target?.readyVideoUrl,
    deferUntilReady: false,
    shouldApplyState: true,
    shouldKeepPolling,
    shouldStopProgressTracking: status.status === 'failed' || (status.status === 'completed' && hasVideo && hasThumb),
    nextPollDelayMs: shouldKeepPolling ? (status.status === 'completed' && !hasVideo ? 4000 : 2000) : null,
    progressMessage: status.message ?? undefined,
  };
}

export function applyGenerationPollToRender(
  render: LocalRender,
  projection: GenerationPollProjection
): LocalRender {
  const nextStatus = projection.status.status ?? render.status;
  const nextPaymentStatus = projection.status.paymentStatus ?? render.paymentStatus;
  const nextFailedAt =
    nextStatus === 'failed' && isRefundedPaymentStatus(nextPaymentStatus)
      ? render.failedAt ?? projection.now
      : undefined;

  return {
    ...render,
    status: nextStatus,
    progress: projection.status.progress ?? render.progress,
    readyVideoUrl: projection.status.videoUrl ?? render.readyVideoUrl,
    videoUrl: projection.status.videoUrl ?? render.videoUrl ?? render.readyVideoUrl,
    previewVideoUrl: projection.status.previewVideoUrl ?? render.previewVideoUrl,
    thumbUrl: resolvePolledThumbUrl(render.thumbUrl, projection.status.thumbUrl),
    priceCents: projection.status.finalPriceCents ?? projection.status.pricing?.totalCents ?? render.priceCents,
    currency: projection.status.currency ?? projection.status.pricing?.currency ?? render.currency,
    pricingSnapshot: projection.status.pricing ?? render.pricingSnapshot,
    paymentStatus: nextPaymentStatus,
    failedAt: nextFailedAt,
  };
}

export function applyGenerationPollToSelectedPreview(
  current: SelectedVideoPreview | null,
  projection: GenerationPollProjection
): SelectedVideoPreview | null {
  if (!current || (current.id !== projection.jobId && current.localKey !== projection.localKey)) {
    return current;
  }

  return {
    ...current,
    status: projection.status.status ?? current.status,
    id: projection.jobId,
    localKey: projection.localKey,
    progress: projection.status.progress ?? current.progress,
    videoUrl: projection.status.videoUrl ?? projection.targetReadyVideoUrl ?? current.videoUrl,
    previewVideoUrl: projection.status.previewVideoUrl ?? current.previewVideoUrl,
    thumbUrl: resolvePolledThumbUrl(current.thumbUrl, projection.status.thumbUrl),
    priceCents: projection.status.finalPriceCents ?? projection.status.pricing?.totalCents ?? current.priceCents,
    currency: projection.status.currency ?? projection.status.pricing?.currency ?? current.currency,
    etaLabel: current.etaLabel,
    etaSeconds: current.etaSeconds,
  };
}
