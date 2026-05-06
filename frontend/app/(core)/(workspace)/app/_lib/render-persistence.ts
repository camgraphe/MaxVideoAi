import { isPlaceholderMediaUrl } from '@/lib/media';
import type { PreflightResponse } from '@/types/engines';

export type LocalRender = {
  localKey: string;
  batchId: string;
  iterationIndex: number;
  iterationCount: number;
  id: string;
  jobId?: string;
  engineId: string;
  engineLabel: string;
  createdAt: string;
  aspectRatio: string;
  durationSec: number;
  prompt: string;
  progress: number; // 0-100
  message: string;
  status: 'pending' | 'completed' | 'failed';
  videoUrl?: string;
  previewVideoUrl?: string;
  readyVideoUrl?: string;
  thumbUrl?: string;
  hasAudio?: boolean;
  priceCents?: number;
  currency?: string;
  pricingSnapshot?: PreflightResponse['pricing'];
  paymentStatus?: string;
  failedAt?: number;
  etaSeconds?: number;
  etaLabel?: string;
  startedAt: number;
  minReadyAt: number;
  groupId?: string | null;
  renderIds?: string[];
  heroRenderId?: string | null;
};

export type LocalRenderGroup = {
  id: string;
  items: LocalRender[];
  iterationCount: number;
  readyCount: number;
  totalPriceCents: number | null;
  currency?: string;
  groupId?: string | null;
};

type PersistedRender = {
  version: number;
  localKey: string;
  batchId: string;
  iterationIndex: number;
  iterationCount: number;
  id: string;
  jobId?: string;
  engineId: string;
  engineLabel: string;
  createdAt: string;
  aspectRatio: string;
  durationSec: number;
  prompt: string;
  progress: number;
  message: string;
  status: 'pending' | 'completed' | 'failed';
  videoUrl?: string | null;
  previewVideoUrl?: string | null;
  readyVideoUrl?: string | null;
  thumbUrl?: string | null;
  hasAudio?: boolean;
  priceCents?: number | null;
  currency?: string | null;
  paymentStatus?: string | null;
  failedAt?: number | null;
  etaSeconds?: number | null;
  etaLabel?: string | null;
  startedAt: number;
  minReadyAt: number;
  groupId?: string | null;
  renderIds?: string[];
  heroRenderId?: string | null;
};

const PERSISTED_RENDER_VERSION = 1;
const MAX_PERSISTED_RENDERS = 24;

export function resolveRenderThumb(render: { thumbUrl?: string | null; aspectRatio?: string | null }): string {
  if (render.thumbUrl) return render.thumbUrl;
  switch (render.aspectRatio) {
    case '9:16':
      return '/assets/frames/thumb-9x16.svg';
    case '1:1':
      return '/assets/frames/thumb-1x1.svg';
    default:
      return '/assets/frames/thumb-16x9.svg';
  }
}

export function resolvePolledThumbUrl(current?: string | null, next?: string | null): string | undefined {
  if (next && !isPlaceholderMediaUrl(next)) return next;
  if (current) return current;
  return next ?? undefined;
}

export function isAudioWorkspaceRender(input: {
  jobId?: string | null;
  engineId?: string | null;
  surface?: string | null;
}): boolean {
  const surface = typeof input.surface === 'string' ? input.surface.trim().toLowerCase() : '';
  if (surface === 'audio') return true;
  const jobId = typeof input.jobId === 'string' ? input.jobId.trim().toLowerCase() : '';
  if (jobId.startsWith('aud_')) return true;
  const engineId = typeof input.engineId === 'string' ? input.engineId.trim().toLowerCase() : '';
  return engineId.startsWith('audio-');
}

function coercePersistedRender(entry: PersistedRender): LocalRender | null {
  const localKey = typeof entry.localKey === 'string' && entry.localKey.length ? entry.localKey : null;
  const engineId = typeof entry.engineId === 'string' && entry.engineId.length ? entry.engineId : null;
  const engineLabel = typeof entry.engineLabel === 'string' && entry.engineLabel.length ? entry.engineLabel : null;
  if (!localKey || !engineId || !engineLabel) {
    return null;
  }
  if (isAudioWorkspaceRender({ jobId: entry.jobId, engineId })) {
    return null;
  }

  const createdAt =
    typeof entry.createdAt === 'string' && entry.createdAt.length ? entry.createdAt : new Date().toISOString();
  const iterationIndex =
    Number.isFinite(entry.iterationIndex) && entry.iterationIndex >= 0 ? Math.trunc(entry.iterationIndex) : 0;
  const iterationCount =
    Number.isFinite(entry.iterationCount) && entry.iterationCount > 0 ? Math.trunc(entry.iterationCount) : 1;
  const durationSec =
    Number.isFinite(entry.durationSec) && entry.durationSec >= 0 ? Math.round(entry.durationSec) : 0;
  const progress =
    Number.isFinite(entry.progress) && entry.progress >= 0
      ? Math.max(0, Math.min(100, Math.round(entry.progress)))
      : 0;
  const status: 'pending' | 'completed' | 'failed' =
    entry.status === 'completed' || entry.status === 'failed' ? entry.status : 'pending';
  const startedAt =
    Number.isFinite(entry.startedAt) && entry.startedAt > 0 ? Math.trunc(entry.startedAt) : Date.now();
  const minReadyAt =
    Number.isFinite(entry.minReadyAt) && entry.minReadyAt > 0 ? Math.trunc(entry.minReadyAt) : startedAt;

  return {
    localKey,
    batchId: typeof entry.batchId === 'string' && entry.batchId.length ? entry.batchId : localKey,
    iterationIndex,
    iterationCount,
    id: typeof entry.id === 'string' && entry.id.length ? entry.id : localKey,
    jobId: typeof entry.jobId === 'string' && entry.jobId.length ? entry.jobId : undefined,
    engineId,
    engineLabel,
    createdAt,
    aspectRatio: typeof entry.aspectRatio === 'string' && entry.aspectRatio.length ? entry.aspectRatio : '16:9',
    durationSec,
    prompt: typeof entry.prompt === 'string' ? entry.prompt : '',
    progress,
    message: typeof entry.message === 'string' && entry.message.length ? entry.message : '',
    status,
    videoUrl: typeof entry.videoUrl === 'string' && entry.videoUrl.length ? entry.videoUrl : undefined,
    previewVideoUrl:
      typeof entry.previewVideoUrl === 'string' && entry.previewVideoUrl.length ? entry.previewVideoUrl : undefined,
    readyVideoUrl:
      typeof entry.readyVideoUrl === 'string' && entry.readyVideoUrl.length ? entry.readyVideoUrl : undefined,
    thumbUrl: typeof entry.thumbUrl === 'string' && entry.thumbUrl.length ? entry.thumbUrl : undefined,
    hasAudio: typeof entry.hasAudio === 'boolean' ? entry.hasAudio : undefined,
    priceCents: typeof entry.priceCents === 'number' ? entry.priceCents : undefined,
    currency: typeof entry.currency === 'string' && entry.currency.length ? entry.currency : undefined,
    pricingSnapshot: undefined,
    paymentStatus: typeof entry.paymentStatus === 'string' && entry.paymentStatus.length ? entry.paymentStatus : undefined,
    failedAt:
      typeof entry.failedAt === 'number' && Number.isFinite(entry.failedAt) && entry.failedAt > 0
        ? Math.trunc(entry.failedAt)
        : undefined,
    etaSeconds: typeof entry.etaSeconds === 'number' ? entry.etaSeconds : undefined,
    etaLabel: typeof entry.etaLabel === 'string' && entry.etaLabel.length ? entry.etaLabel : undefined,
    startedAt,
    minReadyAt,
    groupId:
      typeof entry.groupId === 'string'
        ? entry.groupId
        : entry.groupId === null
          ? null
          : undefined,
    renderIds: Array.isArray(entry.renderIds)
      ? entry.renderIds.filter((value): value is string => typeof value === 'string' && value.length > 0)
      : undefined,
    heroRenderId: typeof entry.heroRenderId === 'string' ? entry.heroRenderId : null,
  };
}

export function deserializePendingRenders(value: string | null): LocalRender[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as Array<Partial<PersistedRender>> | null;
    if (!Array.isArray(parsed)) return [];
    const items: LocalRender[] = [];
    parsed.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      if (entry.version !== PERSISTED_RENDER_VERSION) return;
      const normalized = coercePersistedRender(entry as PersistedRender);
      if (normalized && normalized.status === 'pending' && typeof normalized.jobId === 'string' && normalized.jobId.length > 0) {
        items.push(normalized);
      }
    });
    items.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return items;
  } catch {
    return [];
  }
}

export function serializePendingRenders(renders: LocalRender[]): string | null {
  const pending = renders
    .filter(
      (render) =>
        render.status === 'pending' &&
        typeof render.jobId === 'string' &&
        render.jobId.length > 0 &&
        !isAudioWorkspaceRender({ jobId: render.jobId, engineId: render.engineId })
    )
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, MAX_PERSISTED_RENDERS)
    .map((render) => ({
      version: PERSISTED_RENDER_VERSION,
      localKey: render.localKey,
      batchId: render.batchId,
      iterationIndex: render.iterationIndex,
      iterationCount: render.iterationCount,
      id: render.id,
      jobId: render.jobId,
      engineId: render.engineId,
      engineLabel: render.engineLabel,
      createdAt: render.createdAt,
      aspectRatio: render.aspectRatio,
      durationSec: render.durationSec,
      prompt: render.prompt,
      progress: render.progress,
      message: render.message,
      status: render.status,
      videoUrl: render.videoUrl,
      previewVideoUrl: render.previewVideoUrl,
      readyVideoUrl: render.readyVideoUrl,
      thumbUrl: render.thumbUrl,
      hasAudio: render.hasAudio,
      priceCents: render.priceCents,
      currency: render.currency,
      paymentStatus: render.paymentStatus,
      failedAt: render.failedAt ?? null,
      etaSeconds: render.etaSeconds,
      etaLabel: render.etaLabel,
      startedAt: render.startedAt,
      minReadyAt: render.minReadyAt,
      groupId: render.groupId ?? null,
      renderIds: render.renderIds,
      heroRenderId: render.heroRenderId ?? null,
    }));
  if (!pending.length) return null;
  try {
    return JSON.stringify(pending);
  } catch {
    return null;
  }
}
