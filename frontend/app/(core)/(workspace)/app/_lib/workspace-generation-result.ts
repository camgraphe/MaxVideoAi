import { isRefundedPaymentStatus } from '@/lib/gallery-retention';
import type { SelectedVideoPreview } from '@/lib/video-preview-group';
import type { LocalRender } from './render-persistence';

export type AcceptedGenerationResponse = {
  jobId?: string | null;
  batchId?: string | null;
  groupId?: string | null;
  iterationIndex?: number | null;
  iterationCount?: number | null;
  thumbUrl?: string | null;
  pricing?: LocalRender['pricingSnapshot'] | null;
  paymentStatus?: string | null;
  etaSeconds?: number | null;
  etaLabel?: string | null;
  message?: string | null;
  status?: LocalRender['status'] | null;
  progress?: number | null;
  renderIds?: string[] | null;
  heroRenderId?: string | null;
  videoUrl?: string | null;
};

export type AcceptedGenerationFallback = {
  id: string;
  batchId: string;
  iterationIndex: number;
  iterationCount: number;
  thumbUrl: string;
  priceCents?: number;
  currency: string;
  pricingSnapshot?: LocalRender['pricingSnapshot'];
  etaSeconds?: number | null;
  etaLabel?: string | null;
  message: string;
  minReadyAt: number;
  aspectRatio: string;
  localKey: string;
};

export type AcceptedGenerationStatusEventDetail = {
  ok: true;
  jobId: string;
  status: LocalRender['status'];
  progress: number;
  videoUrl: string | null;
  thumbUrl: string | null;
  aspectRatio: string | null;
  pricing: LocalRender['pricingSnapshot'] | undefined;
  finalPriceCents: number | null;
  currency: string;
  paymentStatus: string;
  batchId: string | null;
  groupId: string | null;
  iterationIndex: number | null;
  iterationCount: number | null;
  renderIds: string[] | null;
  heroRenderId: string | null;
  localKey: string;
  message: string | null;
  etaSeconds: number | null;
  etaLabel: string | null;
};

export type AcceptedGenerationProjection = {
  now: number;
  localKey: string;
  jobId: string;
  batchId: string;
  groupId: string;
  iterationIndex: number;
  iterationCount: number;
  thumbUrl: string;
  priceCents?: number;
  currency: string;
  etaSeconds?: number | null;
  etaLabel?: string | null;
  message: string;
  status: LocalRender['status'];
  visibleStatus: LocalRender['status'];
  progress: number;
  gatedProgress: number;
  pricingSnapshot?: LocalRender['pricingSnapshot'];
  paymentStatus: string;
  renderIds?: string[];
  heroRenderId: string | null;
  videoUrl?: string;
  gatingActive: boolean;
  statusEventDetail: AcceptedGenerationStatusEventDetail;
};

export function projectAcceptedGenerationResult({
  response,
  fallback,
  now,
}: {
  response: AcceptedGenerationResponse;
  fallback: AcceptedGenerationFallback;
  now: number;
}): AcceptedGenerationProjection {
  const jobId = response.jobId ?? fallback.id;
  const batchId = response.batchId ?? fallback.batchId;
  const groupId = response.groupId ?? fallback.batchId;
  const iterationIndex = response.iterationIndex ?? fallback.iterationIndex;
  const iterationCount = response.iterationCount ?? fallback.iterationCount;
  const thumbUrl = response.thumbUrl ?? fallback.thumbUrl;
  const priceCents = response.pricing?.totalCents ?? fallback.priceCents;
  const currency = response.pricing?.currency ?? fallback.currency;
  const etaSeconds = typeof response.etaSeconds === 'number' ? response.etaSeconds : fallback.etaSeconds;
  const etaLabel = response.etaLabel ?? fallback.etaLabel;
  const message = response.message ?? fallback.message;
  const status = response.status ?? (response.videoUrl ? 'completed' : 'pending');
  const progress = typeof response.progress === 'number' ? response.progress : response.videoUrl ? 100 : 5;
  const pricingSnapshot = response.pricing ?? fallback.pricingSnapshot;
  const paymentStatus = response.paymentStatus ?? 'pending_payment';
  const renderIds = response.renderIds ?? undefined;
  const heroRenderId = response.heroRenderId ?? null;
  const videoUrl = response.videoUrl ?? undefined;
  const gatingActive = Boolean(videoUrl) && now < fallback.minReadyAt;
  const clampedProgress = progress < 5 ? 5 : progress;
  const gatedProgress = gatingActive ? Math.min(clampedProgress, 95) : clampedProgress;
  const visibleStatus = gatingActive ? 'pending' : status;

  return {
    now,
    localKey: fallback.localKey,
    jobId,
    batchId,
    groupId,
    iterationIndex,
    iterationCount,
    thumbUrl,
    priceCents,
    currency,
    etaSeconds,
    etaLabel,
    message,
    status,
    visibleStatus,
    progress,
    gatedProgress,
    pricingSnapshot,
    paymentStatus,
    renderIds,
    heroRenderId,
    videoUrl,
    gatingActive,
    statusEventDetail: {
      ok: true,
      jobId,
      status,
      progress,
      videoUrl: videoUrl ?? null,
      thumbUrl: thumbUrl ?? null,
      aspectRatio: fallback.aspectRatio ?? null,
      pricing: pricingSnapshot,
      finalPriceCents: priceCents ?? null,
      currency,
      paymentStatus: paymentStatus ?? 'platform',
      batchId: batchId ?? null,
      groupId: groupId ?? null,
      iterationIndex: iterationIndex ?? null,
      iterationCount: iterationCount ?? null,
      renderIds: renderIds ?? null,
      heroRenderId: heroRenderId ?? null,
      localKey: fallback.localKey,
      message: message ?? null,
      etaSeconds: etaSeconds ?? null,
      etaLabel: etaLabel ?? null,
    },
  };
}

export function applyAcceptedGenerationResultToRender(
  render: LocalRender,
  projection: AcceptedGenerationProjection
): LocalRender {
  const nextFailedAt =
    projection.status === 'failed' && isRefundedPaymentStatus(projection.paymentStatus)
      ? render.failedAt ?? projection.now
      : undefined;

  return {
    ...render,
    id: projection.jobId,
    jobId: projection.jobId,
    batchId: projection.batchId,
    groupId: projection.groupId,
    iterationIndex: projection.iterationIndex,
    iterationCount: projection.iterationCount,
    thumbUrl: projection.thumbUrl,
    message: projection.message,
    progress: projection.gatedProgress,
    status: projection.visibleStatus,
    priceCents: projection.priceCents,
    currency: projection.currency,
    pricingSnapshot: projection.pricingSnapshot,
    paymentStatus: projection.paymentStatus,
    failedAt: nextFailedAt,
    etaSeconds: projection.etaSeconds ?? undefined,
    etaLabel: projection.etaLabel ?? undefined,
    renderIds: projection.renderIds,
    heroRenderId: projection.heroRenderId,
    readyVideoUrl: projection.videoUrl ?? render.readyVideoUrl,
    videoUrl: projection.gatingActive ? render.videoUrl : projection.videoUrl ?? render.videoUrl,
    previewVideoUrl: render.previewVideoUrl,
  };
}

export function applyAcceptedGenerationResultToSelectedPreview(
  current: SelectedVideoPreview | null,
  projection: AcceptedGenerationProjection
): SelectedVideoPreview | null {
  if (!current || current.localKey !== projection.localKey) {
    return current;
  }

  return {
    ...current,
    id: projection.jobId,
    batchId: projection.batchId,
    iterationIndex: projection.iterationIndex,
    iterationCount: projection.iterationCount,
    thumbUrl: projection.thumbUrl,
    progress: projection.gatedProgress,
    message: projection.message,
    priceCents: projection.priceCents,
    currency: projection.currency,
    etaSeconds: projection.etaSeconds ?? undefined,
    etaLabel: projection.etaLabel ?? undefined,
    videoUrl: projection.gatingActive ? current.videoUrl : projection.videoUrl ?? current.videoUrl,
    previewVideoUrl: current.previewVideoUrl,
    status: projection.visibleStatus,
  };
}
