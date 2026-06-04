import type { PricingSnapshot } from '@maxvideoai/pricing';
import { authFetch } from '@/lib/authFetch';
import { normalizeJobMessage, normalizeJobProgress, normalizeJobStatus } from '@/lib/job-status';
import type { Job } from '@/types/jobs';

export type JobStatusResult = {
  ok: true;
  jobId: string;
  status: 'pending' | 'completed' | 'failed';
  progress: number;
  videoUrl: string | null;
  previewVideoUrl?: string | null;
  audioUrl?: string | null;
  thumbUrl: string | null;
  aspectRatio?: string | null;
  pricing?: PricingSnapshot;
  finalPriceCents?: number;
  currency?: string;
  paymentStatus: string;
  batchId?: string | null;
  groupId?: string | null;
  iterationIndex?: number | null;
  iterationCount?: number | null;
  renderIds?: string[] | null;
  renderThumbUrls?: string[] | null;
  heroRenderId?: string | null;
  localKey?: string | null;
  message?: string | null;
  etaSeconds?: number | null;
  etaLabel?: string | null;
};

type StatusRetryMeta = {
  attempt: number;
  timer: number | null;
};

export function jobHasRenderableMedia(job: Pick<Job, 'videoUrl' | 'audioUrl' | 'renderIds'>): boolean {
  const hasImageMedia =
    Array.isArray(job.renderIds) && job.renderIds.some((value) => typeof value === 'string' && value.length);
  return Boolean(job.videoUrl || job.audioUrl) || hasImageMedia;
}

const STATUS_RETRY_TIMERS = new Map<string, StatusRetryMeta>();
const STATUS_RETRY_BASE_DELAY_MS = 60_000;
const STATUS_RETRY_MAX_DELAY_MS = 30 * 60 * 1000;

export function clearStatusRetry(jobId: string): void {
  if (typeof window === 'undefined') return;
  const existing = STATUS_RETRY_TIMERS.get(jobId);
  if (existing?.timer != null) {
    window.clearTimeout(existing.timer);
  }
  STATUS_RETRY_TIMERS.delete(jobId);
}

export function scheduleStatusRetry(jobId: string, attempt: number): void {
  if (typeof window === 'undefined') return;
  const existing = STATUS_RETRY_TIMERS.get(jobId);
  if (existing?.timer != null) {
    window.clearTimeout(existing.timer);
  }
  const delay = Math.min(STATUS_RETRY_BASE_DELAY_MS * Math.pow(2, attempt), STATUS_RETRY_MAX_DELAY_MS);
  const timer = window.setTimeout(() => {
    STATUS_RETRY_TIMERS.set(jobId, { attempt: attempt + 1, timer: null });
    void getJobStatus(jobId).catch(() => {
      scheduleStatusRetry(jobId, attempt + 1);
    });
  }, delay);
  STATUS_RETRY_TIMERS.set(jobId, { attempt, timer });
}

export function getStatusRetryMeta(jobId: string): StatusRetryMeta | undefined {
  return STATUS_RETRY_TIMERS.get(jobId);
}

export function clearMissingStatusRetries(seenJobIds: Set<string>): void {
  STATUS_RETRY_TIMERS.forEach((_meta, jobId) => {
    if (!seenJobIds.has(jobId)) {
      clearStatusRetry(jobId);
    }
  });
}

export async function getJobStatus(jobId: string): Promise<JobStatusResult> {
  let response: Response;
  try {
    response = await authFetch(`/api/jobs/${encodeURIComponent(jobId)}`);
  } catch (error) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('jobs:status-error', { detail: { jobId } }));
    }
    throw error;
  }

  const payload = (await response.json().catch(() => null)) as
    | (Partial<JobStatusResult> & { error?: string; status?: string; progress?: number })
    | null;

  if (!response.ok) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('jobs:status-error', { detail: { jobId } }));
    }
    const message = payload?.error ?? `Status fetch failed (${response.status})`;
    const error = new Error(message);
    Object.assign(error, { status: response.status, jobId });
    throw error;
  }

  if (!payload) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('jobs:status-error', { detail: { jobId } }));
    }
    throw new Error('Status payload missing');
  }

  const renderIds =
    Array.isArray(payload.renderIds) && payload.renderIds.length
      ? payload.renderIds.filter((value): value is string => typeof value === 'string')
      : payload.renderIds === null
        ? null
        : undefined;
  const renderThumbUrls =
    Array.isArray(payload.renderThumbUrls) && payload.renderThumbUrls.length
      ? payload.renderThumbUrls.filter((value): value is string => typeof value === 'string')
      : payload.renderThumbUrls === null
        ? null
        : undefined;
  const hasMedia = Boolean(payload.videoUrl || payload.audioUrl) || Boolean(renderIds?.length);
  const statusFromPayload = normalizeJobStatus(payload.status ?? null, hasMedia);
  const normalizedStatus = (statusFromPayload ?? (hasMedia ? 'completed' : 'pending')) as JobStatusResult['status'];
  const progressValue = normalizeJobProgress(payload.progress, normalizedStatus, hasMedia);
  const progress = progressValue ?? (normalizedStatus === 'completed' ? 100 : 0);
  const normalizedMessage =
    normalizeJobMessage(payload.message) ??
    (normalizedStatus === 'failed'
      ? 'MaxVideoAI could not complete this render. Please retry in a few moments. If this keeps happening, contact support with your request ID.'
      : undefined);

  const result: JobStatusResult = {
    ok: true,
    jobId: payload.jobId ?? jobId,
    status: normalizedStatus,
    progress,
    videoUrl: payload.videoUrl ?? null,
    previewVideoUrl: payload.previewVideoUrl ?? null,
    audioUrl: payload.audioUrl ?? null,
    thumbUrl: payload.thumbUrl ?? null,
    aspectRatio: payload.aspectRatio ?? null,
    pricing: payload.pricing,
    finalPriceCents: payload.finalPriceCents,
    currency: payload.currency,
    paymentStatus: payload.paymentStatus ?? 'platform',
    batchId: payload.batchId ?? null,
    groupId: payload.groupId ?? null,
    iterationIndex: payload.iterationIndex ?? null,
    iterationCount: payload.iterationCount ?? null,
    renderIds: renderIds ?? null,
    renderThumbUrls: renderThumbUrls ?? null,
    heroRenderId: payload.heroRenderId ?? null,
    localKey: payload.localKey ?? null,
    message: normalizedMessage ?? null,
    etaSeconds: payload.etaSeconds ?? null,
    etaLabel: payload.etaLabel ?? null,
  };

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<JobStatusResult>('jobs:status', { detail: result }));
  }

  return result;
}
