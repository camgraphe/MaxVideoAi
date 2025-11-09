import type { VideoGroup, VideoItem, VideoAspect, ResultProvider } from '@/types/video-groups';

type ImageVariant = {
  url: string;
  width?: number | null;
  height?: number | null;
};

export type ImageRunDescriptor = {
  id: string;
  createdAt: number | string;
  prompt?: string | null;
  engineLabel?: string | null;
  engineId?: string | null;
  jobId?: string | null;
  provider?: ResultProvider;
  images: ImageVariant[];
};

function inferAspect(width?: number | null, height?: number | null): VideoAspect {
  if (typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0) {
    const ratio = width / height;
    if (ratio > 1.2) return '16:9';
    if (ratio < 0.8) return '9:16';
  }
  return '1:1';
}

export function buildVideoGroupFromImageRun(run: ImageRunDescriptor): VideoGroup {
  const createdAtIso =
    typeof run.createdAt === 'number' ? new Date(run.createdAt).toISOString() : new Date(run.createdAt).toISOString();

  const items: VideoItem[] = run.images.map((image, index) => ({
    id: `${run.id}-img-${index}`,
    url: image.url,
    thumb: image.url,
    aspect: inferAspect(image.width, image.height),
    jobId: run.jobId ?? run.id,
    engineId: run.engineId ?? undefined,
    meta: {
      mediaType: 'image',
      status: 'completed',
    },
  }));

  const layout = (() => {
    if (items.length >= 4) return 'x4';
    if (items.length === 3) return 'x3';
    if (items.length === 2) return 'x2';
    return 'x1';
  })();

  return {
    id: run.id,
    items,
    layout,
    createdAt: createdAtIso,
    provider: run.provider ?? 'fal',
    paramsSnapshot: {
      prompt: run.prompt ?? undefined,
      engineLabel: run.engineLabel ?? undefined,
    },
    status: 'ready',
    heroItemId: items[0]?.id,
    meta: {
      jobId: run.jobId ?? run.id,
    },
  };
}
