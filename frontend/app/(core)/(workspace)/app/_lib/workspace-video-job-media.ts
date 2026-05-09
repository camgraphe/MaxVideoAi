import type { SelectedVideoPreview } from '@/lib/video-preview-group';
import type { SharedVideoPreview } from '@/lib/video-preview-group';
import type { VideoGroup } from '@/types/video-groups';

type VideoSettingsRecord = {
  schemaVersion?: unknown;
  surface?: unknown;
  engineId?: unknown;
  engineLabel?: unknown;
  prompt?: unknown;
  core?: unknown;
};

export type VideoJobPayload = {
  ok?: boolean;
  error?: string;
  settingsSnapshot?: unknown;
  videoUrl?: string;
  previewVideoUrl?: string;
  thumbUrl?: string;
  aspectRatio?: string;
  progress?: number;
  status?: string;
  pricing?: { totalCents?: number; currency?: string } | null;
  finalPriceCents?: number;
  currency?: string;
  createdAt?: string;
};

export type VideoJobMediaPatch = {
  videoUrl: string | null;
  previewVideoUrl: string | null;
  thumbUrl: string | null;
  aspectRatio?: string;
  progress?: number;
  status?: string;
};

export type RequestedJobPreview = {
  sharedVideo: SharedVideoPreview;
  selectedPreview: SelectedVideoPreview;
};

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function buildVideoJobMediaPatch(payload: VideoJobPayload): VideoJobMediaPatch | null {
  const videoUrl = typeof payload.videoUrl === 'string' && payload.videoUrl.length ? payload.videoUrl : null;
  const previewVideoUrl =
    typeof payload.previewVideoUrl === 'string' && payload.previewVideoUrl.length ? payload.previewVideoUrl : null;
  const thumbUrl = typeof payload.thumbUrl === 'string' && payload.thumbUrl.length ? payload.thumbUrl : null;
  if (!videoUrl && !thumbUrl) return null;
  return {
    videoUrl,
    previewVideoUrl,
    thumbUrl,
    aspectRatio: payload.aspectRatio,
    progress: payload.progress,
    status: payload.status,
  };
}

export function applyVideoJobMediaPatchToSelectedPreview(
  current: SelectedVideoPreview | null,
  jobId: string,
  patch: VideoJobMediaPatch
): SelectedVideoPreview | null {
  if (!current || (current.id !== jobId && current.localKey !== jobId)) return current;
  return {
    ...current,
    videoUrl: patch.videoUrl ?? current.videoUrl,
    previewVideoUrl: patch.previewVideoUrl ?? current.previewVideoUrl,
    thumbUrl: patch.thumbUrl ?? current.thumbUrl,
    aspectRatio: patch.aspectRatio ?? current.aspectRatio,
    progress: typeof patch.progress === 'number' ? patch.progress : current.progress,
    status: patch.status === 'failed' ? 'failed' : patch.status === 'pending' ? 'pending' : current.status,
  };
}

export function applyVideoJobMediaPatchToCompositeOverride(
  current: VideoGroup | null,
  jobId: string,
  patch: VideoJobMediaPatch
): VideoGroup | null {
  if (!current) return current;
  let changed = false;
  const items = current.items.map((item) => {
    if (item.id !== jobId && item.jobId !== jobId) return item;
    changed = true;
    return {
      ...item,
      url: patch.videoUrl ?? item.url,
      previewUrl: patch.previewVideoUrl ?? item.previewUrl,
      thumb: patch.thumbUrl ?? item.thumb,
      aspect: patch.aspectRatio === '9:16' || patch.aspectRatio === '1:1' ? patch.aspectRatio : item.aspect,
    };
  });
  return changed ? { ...current, items } : current;
}

export function buildRequestedJobPreview(requestedJobId: string, payload: VideoJobPayload): RequestedJobPreview | null {
  const snapshot = payload.settingsSnapshot as VideoSettingsRecord | null | undefined;
  if (snapshot?.schemaVersion !== 1 || snapshot?.surface !== 'video') return null;
  const core = readRecord(snapshot.core);
  const durationSec = readFiniteNumber(core.durationSec) ?? 0;
  const engineId = typeof snapshot.engineId === 'string' ? snapshot.engineId : 'unknown-engine';
  const engineLabel = typeof snapshot.engineLabel === 'string' ? snapshot.engineLabel : engineId;
  const prompt = typeof snapshot.prompt === 'string' ? snapshot.prompt : '';
  const patch = buildVideoJobMediaPatch(payload);
  if (!patch) return null;

  return {
    sharedVideo: {
      id: requestedJobId,
      engineId,
      engineLabel,
      durationSec,
      prompt,
      thumbUrl: patch.thumbUrl ?? undefined,
      videoUrl: patch.videoUrl ?? undefined,
      previewVideoUrl: patch.previewVideoUrl ?? undefined,
      aspectRatio: payload.aspectRatio ?? undefined,
      createdAt:
        typeof payload.createdAt === 'string' && payload.createdAt.length ? payload.createdAt : new Date().toISOString(),
    },
    selectedPreview: {
      id: requestedJobId,
      videoUrl: patch.videoUrl ?? undefined,
      previewVideoUrl: patch.previewVideoUrl ?? undefined,
      thumbUrl: patch.thumbUrl ?? undefined,
      aspectRatio: payload.aspectRatio ?? undefined,
      progress: typeof payload.progress === 'number' ? payload.progress : undefined,
      status:
        payload.status === 'failed'
          ? 'failed'
          : payload.status === 'completed'
            ? 'completed'
            : ('pending' as const),
      priceCents: payload.finalPriceCents ?? payload.pricing?.totalCents ?? undefined,
      currency: payload.currency ?? payload.pricing?.currency ?? undefined,
      prompt,
    },
  };
}
