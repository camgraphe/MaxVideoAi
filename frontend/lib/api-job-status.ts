import { readLastKnownUserId } from '@/lib/last-known';
import { generationStage, normalizeGenerationObservation, type GenerationObservation } from '@/lib/generation-observation';
import type { PricingSnapshot } from '@maxvideoai/pricing';
import { authFetch } from '@/lib/authFetch';
import { normalizeJobMessage, normalizeJobProgress, normalizeJobStatus } from '@/lib/job-status';
import { getVideoFailureCodeFromSettingsSnapshot } from '@/lib/video-failure-codes';
import type { Job } from '@/types/jobs';

export type JobStatusResult = {
  createdAt?: string;
  ok: true;
  jobId: string;
  status: 'pending' | 'completed' | 'failed';
  observation?: GenerationObservation;
  etaSource?: 'observed' | 'heuristic';
  progress: number;
  videoUrl: string | null;
  previewVideoUrl?: string | null;
  playbackVideoUrl?: string | null;
  outputPreparationState?: 'active' | 'manual_review';
  lastFrameUrl?: string | null;
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
  settingsSnapshot?: unknown;
  failureCode?: string | null;
  etaSeconds?: number | null;
  etaLabel?: string | null;
};

export function jobHasRenderableMedia(job: Pick<Job, 'videoUrl' | 'audioUrl' | 'renderIds'>): boolean {
  const hasImageMedia =
    Array.isArray(job.renderIds) && job.renderIds.some((value) => typeof value === 'string' && value.length);
  return Boolean(job.videoUrl || job.audioUrl) || hasImageMedia;
}

const RECENT_STATUS = new Map<string, { until: number; result: JobStatusResult }>();
const IN_FLIGHT_STATUS = new Map<string, { request: Promise<JobStatusResult>; isCurrent: () => boolean }>();

export type JobStatusScope = { principal: string; isCurrent: () => boolean };

export function getJobStatus(jobId: string, scope?: JobStatusScope): Promise<JobStatusResult> {
  const principal = scope?.principal ?? readLastKnownUserId();
  const isCurrent = scope?.isCurrent ?? (() => readLastKnownUserId() === principal);
  // Only coalesce in the authenticated browser scope; never share server requests.
  if (typeof window === 'undefined' || !principal) return fetchJobStatus(jobId, isCurrent);
  const key = JSON.stringify([principal, jobId]);
  const recent = RECENT_STATUS.get(key);
  if (recent && recent.until > Date.now()) {
    if (scope && isCurrent()) window.dispatchEvent(new CustomEvent<JobStatusResult>('jobs:status', { detail: recent.result }));
    return Promise.resolve(recent.result);
  }
  const existing = IN_FLIGHT_STATUS.get(key);
  if (existing?.isCurrent()) return existing.request;
  const startedAt = Date.now();
  const request = fetchJobStatus(jobId, isCurrent).then(result => {
    if (isCurrent()) RECENT_STATUS.set(key, { until: startedAt + 15_000, result });
    if (RECENT_STATUS.size > 1000) RECENT_STATUS.delete(RECENT_STATUS.keys().next().value!);
    return result;
  }).finally(() => {
    if (IN_FLIGHT_STATUS.get(key)?.request === request) IN_FLIGHT_STATUS.delete(key);
  });
  IN_FLIGHT_STATUS.set(key, { request, isCurrent });
  return request;
}

async function fetchJobStatus(jobId: string, isCurrent: () => boolean): Promise<JobStatusResult> {
  const checkedAt = Date.now();
  let response: Response;
  try {
    response = await authFetch(`/api/jobs/${encodeURIComponent(jobId)}`);
  } catch (error) {
    if (typeof window !== 'undefined' && isCurrent()) {
      window.dispatchEvent(new CustomEvent('jobs:status-error', { detail: { jobId } }));
    }
    throw error;
  }

  const payload = (await response.json().catch(() => null)) as
    | (Partial<JobStatusResult> & { error?: string; status?: string; progress?: number })
    | null;

  if (!response.ok) {
    if (typeof window !== 'undefined' && isCurrent()) {
      window.dispatchEvent(new CustomEvent('jobs:status-error', { detail: { jobId, status: response.status } }));
    }
    const message = payload?.error ?? `Status fetch failed (${response.status})`;
    const error = new Error(message);
    Object.assign(error, { status: response.status, jobId });
    throw error;
  }

  if (!payload) {
    if (typeof window !== 'undefined' && isCurrent()) {
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
  const statusFromPayload = normalizeJobStatus(payload.status ?? null, hasMedia, payload.outputPreparationState);
  const normalizedStatus = (statusFromPayload ?? (hasMedia ? 'completed' : 'pending')) as JobStatusResult['status'];
  const progressValue = normalizeJobProgress(payload.progress, normalizedStatus, hasMedia);
  const progress = progressValue ?? (normalizedStatus === 'completed' ? 100 : 0);
  const normalizedMessage =
    normalizeJobMessage(payload.message) ??
    (normalizedStatus === 'failed'
      ? 'MaxVideoAI could not complete this render. Please retry in a few moments. If this keeps happening, contact support with your request ID.'
      : undefined);

  const observation = normalizeGenerationObservation(payload.observation) ?? { stage: generationStage(payload.status) };
  if (normalizedStatus === 'pending' && observation.stage === 'completed') observation.stage = 'finalizing';
  const result: JobStatusResult = {
    createdAt: payload.createdAt,
    observation: { ...observation, ...(observation.degraded ? {} : { checkedAt: observation.checkedAt ?? checkedAt }) },
    ok: true,
    jobId: payload.jobId ?? jobId,
    status: normalizedStatus,
    progress,
    videoUrl: payload.videoUrl ?? null,
    previewVideoUrl: payload.previewVideoUrl ?? null,
    playbackVideoUrl: payload.playbackVideoUrl ?? null,
    outputPreparationState: payload.outputPreparationState,
    lastFrameUrl: payload.lastFrameUrl ?? null,
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
    settingsSnapshot: payload.settingsSnapshot,
    failureCode: getVideoFailureCodeFromSettingsSnapshot(payload.settingsSnapshot),
    etaSeconds: payload.etaSeconds ?? null,
    etaLabel: payload.etaLabel ?? null,
  };

  if (typeof window !== 'undefined' && isCurrent()) {
    window.dispatchEvent(new CustomEvent<JobStatusResult>('jobs:status', { detail: result }));
  }

  return result;
}
