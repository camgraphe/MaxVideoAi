import type { AssetLibrarySource } from '@/components/library/AssetLibraryBrowser';
import { authFetch } from '@/lib/authFetch';
import {
  DEFAULT_UPSCALE_IMAGE_ENGINE_ID,
  DEFAULT_UPSCALE_VIDEO_ENGINE_ID,
  listUpscaleToolEngines,
} from '@/config/tools-upscale-engines';
import type {
  UpscaleMediaType,
  UpscaleToolEngineId,
  UpscaleToolOutput,
} from '@/types/tools-upscale';
import type { UpscaleVideoPricingMetadata } from '@/lib/tools-upscale';
import type { GroupSummary } from '@/types/groups';
import type { Job } from '@/types/jobs';
import type { RecentUpscaleMedia, UploadedAsset } from './upscale-workspace-types';

export const SAMPLE_IMAGE_URL =
  'https://media.maxvideoai.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/44d08767-2bba-4ece-9e37-00991db207af.webp';

export const SOURCE_FALLBACK_WIDTH = 1024;
export const SOURCE_FALLBACK_HEIGHT = 1280;

export const PREVIEW_ZOOM_OPTIONS: Array<{ value: 'fit' | '100' | '200' | '400'; label: string }> = [
  { value: 'fit', label: 'Fit' },
  { value: '100', label: '100%' },
  { value: '200', label: '200%' },
  { value: '400', label: '400%' },
];

export function isOutputVideo(output?: UpscaleToolOutput | null) {
  return Boolean(output?.mimeType?.startsWith('video/') || output?.url.match(/\.(mp4|webm|mov)(\?|$)/i));
}

export function firstUsableUrl(...values: Array<string | null | undefined>) {
  return values.find((value): value is string => typeof value === 'string' && value.trim().length > 0) ?? null;
}

export function inferMimeType(url: string, mediaType: UpscaleMediaType) {
  if (mediaType === 'video') {
    if (url.match(/\.webm(\?|$)/i)) return 'video/webm';
    if (url.match(/\.mov(\?|$)/i)) return 'video/quicktime';
    return 'video/mp4';
  }
  if (url.match(/\.jpe?g(\?|$)/i)) return 'image/jpeg';
  if (url.match(/\.webp(\?|$)/i)) return 'image/webp';
  return 'image/png';
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function parseRecentImageVariantIndex(id?: string | null) {
  const match = id?.match(/-image-(\d+)$/);
  if (!match) return 0;
  const index = Number.parseInt(match[1], 10);
  return Number.isFinite(index) && index >= 0 ? index : 0;
}

export function resolveRecentUpscaleSource(job: Job): RecentUpscaleMedia['source'] {
  const snapshot = asRecord(job.settingsSnapshot);
  const source = asRecord(snapshot?.source);
  const rawUrl = source?.mediaUrl;
  const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (!url) return null;

  const metadata = asRecord(source?.metadata);
  const mediaType = snapshot?.mediaType === 'video' ? 'video' : 'image';
  return {
    url,
    assetId: typeof source?.sourceAssetId === 'string' ? source.sourceAssetId : null,
    jobId: typeof source?.sourceJobId === 'string' ? source.sourceJobId : null,
    width: finiteNumber(metadata?.width),
    height: finiteNumber(metadata?.height),
    mimeType: inferMimeType(url, mediaType),
  };
}

export function resolveRecentUpscaleMedia(job: Job | null | undefined, preferredImageIndex = 0): RecentUpscaleMedia | null {
  if (!job) return null;
  const videoUrl = firstUsableUrl(job.videoUrl, job.readyVideoUrl);
  const totalCents = job.finalPriceCents ?? job.pricingSnapshot?.totalCents ?? null;
  const currency = job.currency ?? job.pricingSnapshot?.currency ?? 'USD';
  const renderIds = Array.isArray(job.renderIds) ? job.renderIds.filter((value): value is string => typeof value === 'string') : [];
  const renderThumbs = Array.isArray(job.renderThumbUrls)
    ? job.renderThumbUrls.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];
  const source = resolveRecentUpscaleSource(job);

  if (videoUrl) {
    return {
      url: videoUrl,
      thumbUrl: job.thumbUrl ?? job.previewFrame ?? null,
      mediaType: 'video',
      mimeType: inferMimeType(videoUrl, 'video'),
      source,
      job,
      engineLabel: job.engineLabel,
      engineId: job.engineId,
      createdAt: job.createdAt,
      totalCents,
      currency,
    };
  }

  const imageUrl = firstUsableUrl(job.heroRenderId, renderIds[preferredImageIndex], renderIds[0], job.thumbUrl, job.previewFrame);
  if (!imageUrl) return null;
  return {
    url: imageUrl,
    thumbUrl: renderThumbs[preferredImageIndex] ?? renderThumbs[0] ?? job.thumbUrl ?? job.previewFrame ?? imageUrl,
    mediaType: 'image',
    mimeType: inferMimeType(imageUrl, 'image'),
    source,
    job,
    engineLabel: job.engineLabel,
    engineId: job.engineId,
    createdAt: job.createdAt,
    totalCents,
    currency,
  };
}

export function resolveRecentUpscaleMediaFromGroup(group: GroupSummary): RecentUpscaleMedia | null {
  const heroJob = group.hero.job;
  const fallbackJob = group.members.find((member) => member.job)?.job ?? null;
  const variantIndex = parseRecentImageVariantIndex(group.hero.id);
  return resolveRecentUpscaleMedia(heroJob ?? fallbackJob, variantIndex);
}

export function resolveRecentUpscaleJobFromGroup(group: GroupSummary): Job | null {
  return group.hero.job ?? group.members.find((member) => member.job)?.job ?? null;
}

export function resolveGeneratedImageSource(job: Job | null | undefined): UploadedAsset | null {
  if (!job) return null;
  const renderIds = Array.isArray(job.renderIds) ? job.renderIds.filter((value): value is string => typeof value === 'string') : [];
  const imageUrl = firstUsableUrl(job.heroRenderId, renderIds[0], job.thumbUrl, job.previewFrame);
  if (!imageUrl) return null;
  return {
    id: null,
    jobId: job.jobId,
    url: imageUrl,
    mime: inferMimeType(imageUrl, 'image'),
    name: `Generated image · ${job.engineLabel}`,
  };
}

export function hasRenderableUpscaleJobMedia(job: Job): boolean {
  const hasImageMedia = Array.isArray(job.renderIds) && job.renderIds.some((value) => typeof value === 'string' && value.trim().length > 0);
  return Boolean(firstUsableUrl(job.videoUrl, job.readyVideoUrl, job.audioUrl) || hasImageMedia);
}

export function resolveUpscaleEngineId(value: string | undefined, mediaType: UpscaleMediaType): UpscaleToolEngineId {
  const engines = listUpscaleToolEngines(mediaType);
  return (
    engines.find((entry) => entry.id === value)?.id ??
    (mediaType === 'video' ? DEFAULT_UPSCALE_VIDEO_ENGINE_ID : DEFAULT_UPSCALE_IMAGE_ENGINE_ID)
  );
}

export function mediaTypeFromMime(mime?: string | null): UpscaleMediaType | null {
  if (!mime) return null;
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return null;
}

export async function uploadSourceFile(file: File, mediaType: UpscaleMediaType): Promise<UploadedAsset> {
  const form = new FormData();
  form.append('file', file);
  const response = await authFetch(mediaType === 'video' ? '/api/uploads/video' : '/api/uploads/image', {
    method: 'POST',
    body: form,
  });
  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    asset?: UploadedAsset;
  } | null;
  if (!response.ok || !payload?.ok || !payload.asset?.url) {
    throw new Error(payload?.error ?? `Upload failed (${response.status})`);
  }
  return payload.asset;
}

export function formatCurrency(amountCents?: number | null, currency = 'USD', locale?: string): string {
  if (typeof amountCents !== 'number') return '-';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(amountCents / 100);
  } catch {
    return `${currency} ${(amountCents / 100).toFixed(2)}`;
  }
}

export function readVideoPricingMetadata(url: string): Promise<UpscaleVideoPricingMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
    };

    video.onloadedmetadata = () => {
      const durationSec = Number.isFinite(video.duration) ? video.duration : 0;
      const width = video.videoWidth;
      const height = video.videoHeight;
      cleanup();
      if (width > 0 && height > 0 && durationSec > 0) {
        resolve({ width, height, durationSec });
        return;
      }
      reject(new Error('Video metadata unavailable'));
    };
    video.onerror = () => {
      cleanup();
      reject(new Error('Video metadata unavailable'));
    };
    video.src = url;
  });
}

export function clampComparePosition(value: number) {
  return Math.min(92, Math.max(8, value));
}

export function buildLibraryCacheKey(kind: UpscaleMediaType, source: AssetLibrarySource) {
  return `${kind}:${source}`;
}
