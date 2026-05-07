import { normalizeMediaUrl } from '@/lib/media';
import type { GenerateResult } from '@/lib/fal';
import type { VideoAsset } from '@/types/render';
import {
  buildNextProviderVideoCopyState,
  buildSafeProviderMediaLog,
  PROVIDER_VIDEO_COPY_FAILURE_MESSAGE,
  PROVIDER_VIDEO_COPY_RETRY_MESSAGE,
  shouldFailVideoJobOnProviderCopyMiss,
  shouldRetryProviderVideoCopy,
} from '@/server/provider-output-policy';
import { ensureFastStartVideo } from '@/server/video-faststart';
import { ensureJobThumbnail, isPlaceholderThumbnail } from '@/server/thumbnails';

type ProviderMediaState = {
  thumb: string;
  previewFrame: string;
  video: string | null;
  videoAsset: VideoAsset | null;
  providerMode: GenerateResult['provider'];
  status: string;
  progress: number;
  providerJobId: string | null;
};

type ProviderMediaDeps = {
  ensureFastStartVideoFn?: typeof ensureFastStartVideo;
  ensureJobThumbnailFn?: typeof ensureJobThumbnail;
  isPlaceholderThumbnailFn?: typeof isPlaceholderThumbnail;
  shouldFailVideoJobOnProviderCopyMissFn?: typeof shouldFailVideoJobOnProviderCopyMiss;
  buildNextProviderVideoCopyStateFn?: typeof buildNextProviderVideoCopyState;
  shouldRetryProviderVideoCopyFn?: typeof shouldRetryProviderVideoCopy;
  buildSafeProviderMediaLogFn?: typeof buildSafeProviderMediaLog;
  now?: () => Date;
};

export type ProviderMediaResolution = ProviderMediaState & {
  settingsSnapshotJson: string;
  message: string | null;
  sourceVideoUrl: string | null;
};

export function buildInitialProviderMediaState(params: {
  generationResult: GenerateResult;
  batchId: string | null;
  placeholderThumb: string;
}): ProviderMediaState {
  const thumb =
    normalizeMediaUrl(params.generationResult.thumbUrl) ??
    (typeof params.generationResult.thumbUrl === 'string' && params.generationResult.thumbUrl.trim().length
      ? params.generationResult.thumbUrl
      : null) ??
    params.placeholderThumb;
  const video = normalizeMediaUrl(params.generationResult.videoUrl) ?? params.generationResult.videoUrl ?? null;

  return {
    thumb,
    previewFrame: thumb,
    video,
    videoAsset: params.generationResult.video ?? null,
    providerMode: params.generationResult.provider,
    status: params.generationResult.status ?? (video ? 'completed' : 'queued'),
    progress: typeof params.generationResult.progress === 'number' ? params.generationResult.progress : video ? 100 : 0,
    providerJobId: params.generationResult.providerJobId ?? params.batchId ?? null,
  };
}

export async function resolveProviderMediaState(params: {
  state: ProviderMediaState;
  generationResult: GenerateResult;
  jobId: string;
  userId: string;
  isLumaRay2: boolean;
  aspectRatio: string | null;
  settingsSnapshot: Record<string, unknown>;
  settingsSnapshotJson: string;
  message: string | null;
  deps?: ProviderMediaDeps;
}): Promise<ProviderMediaResolution> {
  const deps = params.deps ?? {};
  const ensureFastStartVideoFn = deps.ensureFastStartVideoFn ?? ensureFastStartVideo;
  const ensureJobThumbnailFn = deps.ensureJobThumbnailFn ?? ensureJobThumbnail;
  const isPlaceholderThumbnailFn = deps.isPlaceholderThumbnailFn ?? isPlaceholderThumbnail;
  const shouldFailVideoJobOnProviderCopyMissFn =
    deps.shouldFailVideoJobOnProviderCopyMissFn ?? shouldFailVideoJobOnProviderCopyMiss;
  const buildNextProviderVideoCopyStateFn = deps.buildNextProviderVideoCopyStateFn ?? buildNextProviderVideoCopyState;
  const shouldRetryProviderVideoCopyFn = deps.shouldRetryProviderVideoCopyFn ?? shouldRetryProviderVideoCopy;
  const buildSafeProviderMediaLogFn = deps.buildSafeProviderMediaLogFn ?? buildSafeProviderMediaLog;
  const now = deps.now ?? (() => new Date());

  let { thumb, previewFrame, video, videoAsset, status, progress } = params.state;
  const { providerMode, providerJobId } = params.state;
  let settingsSnapshotJson = params.settingsSnapshotJson;
  let message = params.message;

  if (params.isLumaRay2) {
    console.info('[fal] luma ray generation', {
      jobId: params.jobId,
      providerJobId,
      status,
      video: buildSafeProviderMediaLogFn(video),
    });
  }

  const sourceVideoUrl =
    (typeof params.generationResult.video?.url === 'string' && params.generationResult.video.url.length
      ? params.generationResult.video.url
      : typeof params.generationResult.videoUrl === 'string' && params.generationResult.videoUrl.length
        ? params.generationResult.videoUrl
        : null) ?? null;
  const isSourceAbsolute = Boolean(sourceVideoUrl && /^https?:\/\//i.test(sourceVideoUrl));
  if (sourceVideoUrl && isSourceAbsolute) {
    const fastStartVideo = await ensureFastStartVideoFn({
      jobId: params.jobId,
      userId: params.userId,
      videoUrl: sourceVideoUrl,
    });
    if (fastStartVideo) {
      video = fastStartVideo;
      if (videoAsset) {
        videoAsset.url = fastStartVideo;
      }
    } else if (
      shouldFailVideoJobOnProviderCopyMissFn({
        provider: providerMode,
        sourceUrl: sourceVideoUrl,
        copiedUrl: null,
      })
    ) {
      const nextCopyState = buildNextProviderVideoCopyStateFn(params.settingsSnapshot, {
        providerStatus: status,
        reason: 'provider_video_copy_failed',
      });
      const canRetryCopy =
        Boolean(providerJobId) &&
        shouldRetryProviderVideoCopyFn({ state: nextCopyState, createdAt: now().toISOString() });
      console.warn('[api/generate] provider video copy failed', {
        jobId: params.jobId,
        providerJobId,
        provider: providerMode,
        video: buildSafeProviderMediaLogFn(sourceVideoUrl),
        retryDeferred: canRetryCopy,
      });
      video = null;
      videoAsset = null;
      params.settingsSnapshot.providerVideoCopy = nextCopyState;
      settingsSnapshotJson = JSON.stringify(params.settingsSnapshot);
      if (canRetryCopy) {
        status = 'processing';
        progress = 90;
        message = PROVIDER_VIDEO_COPY_RETRY_MESSAGE;
      } else {
        status = 'failed';
        progress = 0;
        message = PROVIDER_VIDEO_COPY_FAILURE_MESSAGE;
      }
    }
  }

  const thumbnailSourceVideoUrl = video ?? sourceVideoUrl;
  if (thumbnailSourceVideoUrl && /^https?:\/\//i.test(thumbnailSourceVideoUrl) && isPlaceholderThumbnailFn(thumb)) {
    const generatedThumb = await ensureJobThumbnailFn({
      jobId: params.jobId,
      userId: params.userId,
      videoUrl: thumbnailSourceVideoUrl,
      aspectRatio: params.aspectRatio ?? undefined,
      existingThumbUrl: thumb,
    });
    if (generatedThumb) {
      thumb = generatedThumb;
      previewFrame = generatedThumb;
      if (videoAsset) {
        videoAsset.thumbnailUrl = generatedThumb;
      }
    }
  }

  return {
    thumb,
    previewFrame,
    video,
    videoAsset,
    providerMode,
    status,
    progress,
    providerJobId,
    settingsSnapshotJson,
    message,
    sourceVideoUrl,
  };
}
