import type { ResultProvider, VideoGroup, VideoItem } from '@/types/video-groups';

export type SharedVideoPreview = {
  id: string;
  engineId: string;
  engineLabel: string;
  durationSec: number;
  prompt: string;
  promptExcerpt?: string;
  thumbUrl?: string;
  videoUrl?: string;
  previewVideoUrl?: string;
  aspectRatio?: string;
  createdAt: string;
};

export type SelectedVideoPreview = {
  localKey?: string;
  batchId?: string;
  iterationIndex?: number;
  iterationCount?: number;
  id?: string;
  videoUrl?: string;
  previewVideoUrl?: string;
  aspectRatio?: string;
  thumbUrl?: string;
  progress?: number;
  status?: 'pending' | 'completed' | 'failed';
  message?: string;
  priceCents?: number;
  currency?: string;
  etaSeconds?: number;
  etaLabel?: string;
  prompt?: string;
};

function toVideoAspect(value?: string | null): VideoItem['aspect'] {
  switch (value) {
    case '9:16':
      return '9:16';
    case '1:1':
      return '1:1';
    default:
      return '16:9';
  }
}

export function mapSharedVideoToGroup(video: SharedVideoPreview, provider: ResultProvider): VideoGroup {
  const aspect = toVideoAspect(video.aspectRatio);
  const url = video.videoUrl ?? video.thumbUrl ?? '';
  const item: VideoItem = {
    id: video.id,
    url,
    previewUrl: video.previewVideoUrl,
    aspect,
    thumb: video.thumbUrl ?? undefined,
    jobId: video.id,
    durationSec: video.durationSec,
    engineId: video.engineId,
    meta: {
      mediaType: video.videoUrl ? 'video' : 'image',
      prompt: video.prompt,
      engineLabel: video.engineLabel,
    },
  };

  return {
    id: `shared-${video.id}`,
    items: [item],
    layout: 'x1',
    createdAt: video.createdAt,
    provider,
    status: 'ready',
    heroItemId: item.id,
    meta: {
      source: 'gallery',
    },
  };
}

export function mapSelectedPreviewToGroup(
  preview: SelectedVideoPreview | null,
  provider: ResultProvider
): VideoGroup | null {
  if (!preview) return null;
  const url = preview.videoUrl ?? preview.thumbUrl ?? '';
  if (!url) return null;

  const itemId = preview.id ?? preview.localKey ?? preview.batchId ?? 'selected-preview';
  const status = preview.status === 'failed' ? 'error' : preview.status === 'pending' ? 'loading' : 'ready';
  const item: VideoItem = {
    id: itemId,
    url,
    previewUrl: preview.previewVideoUrl,
    aspect: toVideoAspect(preview.aspectRatio),
    thumb: preview.thumbUrl ?? undefined,
    jobId: preview.id ?? itemId,
    meta: {
      mediaType: preview.videoUrl ? 'video' : 'image',
      prompt: preview.prompt,
      status: preview.status ?? (preview.videoUrl ? 'completed' : 'pending'),
      progress: preview.progress,
      message: preview.message,
      etaSeconds: preview.etaSeconds,
      etaLabel: preview.etaLabel,
      priceCents: preview.priceCents,
      currency: preview.currency,
    },
  };

  return {
    id: `selected-${preview.batchId ?? preview.id ?? preview.localKey ?? 'preview'}`,
    items: [item],
    layout: 'x1',
    createdAt: new Date().toISOString(),
    provider,
    status,
    heroItemId: item.id,
    errorMsg: status === 'error' ? preview.message ?? 'Generation failed' : undefined,
    meta: {
      source: 'selected-preview',
      batchId: preview.batchId,
      iterationIndex: preview.iterationIndex,
      iterationCount: preview.iterationCount,
    },
    totalCostCents: preview.priceCents,
    currency: preview.currency,
  };
}
