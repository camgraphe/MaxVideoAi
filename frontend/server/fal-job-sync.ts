import { resolveFalModelId } from '@/lib/fal-catalog';
import { getFalClient } from '@/lib/fal-client';
import { normalizeMediaUrl } from '@/lib/media';
import { ensureJobThumbnail } from '@/server/thumbnails';

type FetchOptions = {
  jobId: string;
  engineId: string | null;
  providerJobId: string;
  userId?: string | null;
  aspectRatio?: string | null;
  existingThumbUrl?: string | null;
};

type FetchResult = {
  normalizedResult: Record<string, unknown> | null;
  videoUrl: string | null;
  thumbUrl: string | null;
};

function cloneResult<T>(input: T): T {
  return input && typeof input === 'object' ? JSON.parse(JSON.stringify(input)) : (input as T);
}

function extractVideoUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.video_url === 'string') return record.video_url;
  if (typeof record.videoUrl === 'string') return record.videoUrl;
  if (typeof record.url === 'string') return record.url;
  if (record.video && typeof record.video === 'object') {
    return extractVideoUrl(record.video);
  }
  if (Array.isArray(record.videos)) {
    for (const entry of record.videos) {
      const candidate = extractVideoUrl(entry);
      if (candidate) return candidate;
    }
  }
  if (record.data && typeof record.data === 'object') {
    return extractVideoUrl(record.data);
  }
  return null;
}

function extractThumbUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.thumbnail === 'string') return record.thumbnail;
  if (typeof record.thumb_url === 'string') return record.thumb_url;
  if (typeof record.thumbUrl === 'string') return record.thumbUrl;
  if (record.data && typeof record.data === 'object') {
    return extractThumbUrl(record.data);
  }
  return null;
}

function fallbackThumbnail(aspectRatio?: string | null): string {
  const normalized = aspectRatio?.trim().toLowerCase();
  if (normalized === '9:16') return '/assets/frames/thumb-9x16.svg';
  if (normalized === '1:1') return '/assets/frames/thumb-1x1.svg';
  return '/assets/frames/thumb-16x9.svg';
}

export async function fetchFalJobMedia(options: FetchOptions): Promise<FetchResult> {
  const engineId = options.engineId ?? 'fal-unknown';
  const falModelId = (await resolveFalModelId(engineId)) ?? engineId;
  const falClient = getFalClient();

  const queueResult = await falClient.queue
    .result(falModelId, { requestId: options.providerJobId })
    .catch((error: unknown) => {
      throw new Error(`Fal result lookup failed: ${(error as Error)?.message ?? error}`);
    });

  if (!queueResult) {
    return { normalizedResult: null, videoUrl: null, thumbUrl: null };
  }

  const normalized = cloneResult(queueResult) as Record<string, unknown>;
  if (!normalized.data && normalized.video) {
    normalized.data = { video: normalized.video };
  }

  let videoUrl = extractVideoUrl(normalized);
  let thumbUrl = extractThumbUrl(normalized);

  if (videoUrl) {
    videoUrl = normalizeMediaUrl(videoUrl) ?? videoUrl;
  }
  if (thumbUrl) {
    thumbUrl = normalizeMediaUrl(thumbUrl) ?? thumbUrl;
  }

  if (videoUrl && (!thumbUrl || thumbUrl.startsWith('/assets/'))) {
    const generatedThumb = await ensureJobThumbnail({
      jobId: options.jobId,
      userId: options.userId ?? undefined,
      videoUrl,
      aspectRatio: options.aspectRatio ?? undefined,
      existingThumbUrl: options.existingThumbUrl ?? undefined,
    });
    if (generatedThumb) {
      thumbUrl = normalizeMediaUrl(generatedThumb) ?? generatedThumb;
      normalized.data = normalized.data ?? {};
      (normalized.data as Record<string, unknown>).thumbnail = thumbUrl;
      (normalized.data as Record<string, unknown>).thumb_url = thumbUrl;
      normalized.thumbnail = thumbUrl;
      normalized.thumb_url = thumbUrl;
    }
  }

  if (!thumbUrl) {
    thumbUrl = fallbackThumbnail(options.aspectRatio);
    normalized.data = normalized.data ?? {};
    (normalized.data as Record<string, unknown>).thumbnail = thumbUrl;
    (normalized.data as Record<string, unknown>).thumb_url = thumbUrl;
    normalized.thumbnail = thumbUrl;
    normalized.thumb_url = thumbUrl;
  }

  return { normalizedResult: normalized, videoUrl: videoUrl ?? null, thumbUrl: thumbUrl ?? null };
}
