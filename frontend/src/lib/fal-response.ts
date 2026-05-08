import type { QueueStatus } from '@fal-ai/client';
import type { VideoAsset } from '@/types/render';

const BLOCKED_VIDEO_HOSTS = new Set([
  'upload.wikimedia.org',
  'test-videos.co.uk',
  'd3rlna7iyyu8wu.cloudfront.net',
  'amssamples.streaming.mediaservices.windows.net',
]);

const FAL_FILES_BASE_URL = (
  process.env.FAL_FILES_BASE_URL ||
  process.env.NEXT_PUBLIC_FAL_FILES_BASE_URL ||
  'https://fal.media/files'
).replace(/\/+$/, '');

type FalVideoCandidate =
  | string
  | {
      url?: string;
      video_url?: string;
      path?: string;
      mime?: string;
      mimetype?: string;
      content_type?: string;
      width?: number;
      height?: number;
      duration?: number;
      duration_seconds?: number;
      durationSec?: number;
      tags?: unknown;
      metadata?: {
        width?: number;
        height?: number;
        duration?: number;
        duration_seconds?: number;
      };
    };

export type FalRunResponse = {
  request_id?: string;
  id?: string;
  response?: { video?: FalVideoCandidate; videos?: FalVideoCandidate[] };
  output?: { video?: FalVideoCandidate; videos?: FalVideoCandidate[] };
  video_url?: string;
  videos?: FalVideoCandidate[];
  assets?: FalVideoCandidate[];
  status_url?: string;
  status?: string;
  state?: string;
  progress?: number;
  percent?: number;
};

type PendingStatusInfo = {
  status: 'queued' | 'running' | 'failed';
  providerJobIdFallback?: string;
};

export function unwrapFalResponse(payload: unknown): FalRunResponse | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const candidate = payload as Record<string, unknown>;
  if (typeof candidate.status === 'string' && candidate.status.toUpperCase() === 'ERROR') {
    const errorMessage = typeof candidate.error === 'string' ? candidate.error : 'FAL request failed';
    throw new Error(errorMessage);
  }
  if ('payload' in candidate && typeof candidate.payload === 'object') {
    return candidate.payload as FalRunResponse;
  }
  return candidate as FalRunResponse;
}

export function normalizePendingStatus(
  queueStatus: QueueStatus | null,
  response: FalRunResponse | null | undefined
): PendingStatusInfo {
  const providerJobIdFallback =
    response?.request_id ??
    response?.id ??
    (queueStatus?.request_id ?? null) ??
    null;

  const rawStatuses = [
    queueStatus?.status,
    typeof response?.status === 'string' ? response.status : null,
    typeof response?.state === 'string' ? response.state : null,
  ]
    .map((value) => (typeof value === 'string' ? value.toUpperCase() : null))
    .filter((value): value is string => Boolean(value));

  let normalized: PendingStatusInfo['status'] = queueStatus?.status === 'IN_PROGRESS' ? 'running' : 'queued';

  for (const raw of rawStatuses) {
    if (raw === 'IN_QUEUE' || raw === 'QUEUED' || raw === 'PENDING') {
      normalized = normalized === 'running' ? 'running' : 'queued';
    } else if (raw === 'IN_PROGRESS' || raw === 'PROCESSING' || raw === 'RUNNING' || raw === 'STARTED') {
      normalized = 'running';
    } else if (raw === 'COMPLETED' || raw === 'FINISHED' || raw === 'COMPLETE') {
      normalized = 'running';
    } else if (raw === 'FAILED' || raw === 'ERROR' || raw === 'CANCELLED' || raw === 'CANCELED' || raw === 'ABORTED') {
      return { status: 'failed', providerJobIdFallback: providerJobIdFallback ?? undefined };
    }
  }

  return { status: normalized, providerJobIdFallback: providerJobIdFallback ?? undefined };
}

export function normalizePendingProgress(
  queueStatus: QueueStatus | null,
  response: FalRunResponse | null | undefined
): number | undefined {
  const progressCandidates: Array<number | undefined> = [
    typeof response?.progress === 'number' ? response.progress : undefined,
    typeof response?.percent === 'number' ? response.percent : undefined,
  ];

  for (const candidate of progressCandidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      const value = candidate > 1 ? candidate : candidate * 100;
      return Math.max(0, Math.min(100, Math.round(value)));
    }
  }

  if (queueStatus?.status === 'IN_QUEUE') {
    return 0;
  }
  if (queueStatus?.status === 'IN_PROGRESS') {
    return undefined;
  }

  return undefined;
}

export function extractVideoAsset(response: FalRunResponse | null | undefined): VideoAsset | null {
  if (!response) return null;
  const candidates: FalVideoCandidate[] = [];
  if (response.response?.video) candidates.push(response.response.video);
  if (Array.isArray(response.response?.videos)) candidates.push(...response.response.videos);
  if (Array.isArray((response.response as { images?: FalVideoCandidate[] } | undefined)?.images)) {
    candidates.push(...(response.response as { images?: FalVideoCandidate[] }).images!);
  }
  if (response.output?.video) candidates.push(response.output.video);
  if (Array.isArray(response.output?.videos)) candidates.push(...response.output.videos);
  if (Array.isArray((response.output as { images?: FalVideoCandidate[] } | undefined)?.images)) {
    candidates.push(...(response.output as { images?: FalVideoCandidate[] }).images!);
  }
  if (response.video_url) candidates.push(response.video_url);
  if (Array.isArray(response.videos)) candidates.push(...response.videos);
  if (Array.isArray((response as { images?: FalVideoCandidate[] }).images)) {
    candidates.push(...(response as { images?: FalVideoCandidate[] }).images!);
  }
  if (Array.isArray(response.assets)) candidates.push(...response.assets);

  for (const candidate of candidates) {
    const asset = normalizeVideoCandidate(candidate);
    if (asset) {
      return asset;
    }
  }

  return null;
}

export function ensureAssetShape(asset: VideoAsset): VideoAsset {
  return {
    url: asset.url,
    mime: asset.mime ?? guessMimeFromUrl(asset.url) ?? 'video/mp4',
    width: asset.width ?? null,
    height: asset.height ?? null,
    durationSec: asset.durationSec ?? null,
    tags: Array.isArray(asset.tags) ? asset.tags : [],
    thumbnailUrl: typeof asset.thumbnailUrl === 'string' && asset.thumbnailUrl.length > 0 ? asset.thumbnailUrl : null,
    aspectRatio: asset.aspectRatio ?? deriveAspectFromDimensions(asset.width, asset.height),
  };
}

export function getThumbForAspectRatio(aspectRatio?: string): string {
  if (aspectRatio === '9:16') return '/assets/frames/thumb-9x16.svg';
  if (aspectRatio === '1:1') return '/assets/frames/thumb-1x1.svg';
  return '/assets/frames/thumb-16x9.svg';
}

function normalizeVideoCandidate(candidate: FalVideoCandidate | null | undefined): VideoAsset | null {
  if (!candidate) return null;
  if (typeof candidate === 'string') {
    const normalized = normalizeVideoUrl(candidate);
    if (isBlockedUrl(normalized)) return null;
    return {
      url: normalized,
      mime: guessMimeFromUrl(normalized) ?? 'video/mp4',
      width: null,
      height: null,
      durationSec: null,
      tags: [],
      thumbnailUrl: null,
    };
  }
  const urlCandidate =
    (typeof candidate.url === 'string' && candidate.url) ||
    (typeof candidate.video_url === 'string' && candidate.video_url) ||
    null;
  let normalizedUrl: string | null = null;
  if (urlCandidate) {
    normalizedUrl = normalizeVideoUrl(urlCandidate);
  } else if (typeof candidate.path === 'string' && candidate.path.trim().length) {
    normalizedUrl = normalizeVideoUrl(candidate.path);
  }
  if (!normalizedUrl) return null;
  if (isBlockedUrl(normalizedUrl)) return null;
  const mime = candidate.mime || candidate.mimetype || candidate.content_type || guessMimeFromUrl(normalizedUrl) || null;
  const width =
    typeof candidate.width === 'number'
      ? candidate.width
      : typeof candidate.metadata?.width === 'number'
        ? candidate.metadata.width
        : null;
  const height =
    typeof candidate.height === 'number'
      ? candidate.height
      : typeof candidate.metadata?.height === 'number'
        ? candidate.metadata.height
        : null;
  const durationSec = getDurationSeconds(candidate);
  const tags = Array.isArray(candidate.tags) ? candidate.tags.filter((tag): tag is string => typeof tag === 'string') : [];
  const thumbCandidate =
    typeof (candidate as { thumbnail?: string })?.thumbnail === 'string' && (candidate as { thumbnail?: string }).thumbnail
      ? (candidate as { thumbnail: string }).thumbnail
      : typeof (candidate as { poster?: string })?.poster === 'string' && (candidate as { poster?: string }).poster
        ? (candidate as { poster: string }).poster
        : typeof (candidate as { preview?: string })?.preview === 'string' && (candidate as { preview?: string }).preview
          ? (candidate as { preview: string }).preview
          : typeof (candidate as { preview_image?: string })?.preview_image === 'string' && (candidate as { preview_image?: string }).preview_image
            ? (candidate as { preview_image: string }).preview_image
            : typeof (candidate as { thumb_url?: string })?.thumb_url === 'string' && (candidate as { thumb_url?: string }).thumb_url
              ? (candidate as { thumb_url: string }).thumb_url
              : null;
  return {
    url: normalizedUrl,
    mime,
    width,
    height,
    durationSec,
    tags,
    thumbnailUrl: thumbCandidate,
  };
}

function normalizeVideoUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('http://commondatastorage.googleapis.com')) {
    return `https://${trimmed.slice('http://'.length)}`;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    return trimmed.replace(/\/{2,}/g, '/');
  }
  const normalized = trimmed.replace(/^\.?\/+/, '');
  if (looksLikeFalAsset(normalized)) {
    return `${FAL_FILES_BASE_URL}/${normalized}`;
  }
  return `/${normalized}`;
}

function isBlockedUrl(url: string): boolean {
  if (!url || url.startsWith('/')) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return BLOCKED_VIDEO_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

function getDurationSeconds(candidate: {
  duration?: number;
  duration_seconds?: number;
  durationSec?: number;
  metadata?: { duration?: number; duration_seconds?: number };
}): number | null {
  if (typeof candidate.durationSec === 'number') return candidate.durationSec;
  if (typeof candidate.duration_seconds === 'number') return candidate.duration_seconds;
  if (typeof candidate.duration === 'number') return candidate.duration;
  if (typeof candidate.metadata?.duration_seconds === 'number') return candidate.metadata.duration_seconds;
  if (typeof candidate.metadata?.duration === 'number') return candidate.metadata.duration;
  return null;
}

function guessMimeFromUrl(url: string): string | null {
  const lower = url.toLowerCase();
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.avi')) return 'video/x-msvideo';
  if (lower.endsWith('.m3u8')) return 'application/x-mpegURL';
  if (lower.endsWith('.mpd')) return 'application/dash+xml';
  return null;
}

function looksLikeFalAsset(path: string): boolean {
  const normalized = path.replace(/^\/+/, '').toLowerCase();
  if (!normalized) return false;
  const [head] = normalized.split('/');
  return (
    head.startsWith('local_batch') ||
    head.startsWith('local-invocation') ||
    head.startsWith('local_invocation') ||
    head.startsWith('fal') ||
    head.startsWith('tmp') ||
    head.startsWith('storage')
  );
}

function deriveAspectFromDimensions(width: number | null | undefined, height: number | null | undefined): string | null {
  if (!width || !height) return null;
  const ratio = width / height;
  if (Math.abs(ratio - 16 / 9) < 0.08) return '16:9';
  if (Math.abs(ratio - 9 / 16) < 0.08) return '9:16';
  if (Math.abs(ratio - 1) < 0.08) return '1:1';
  return `${width}:${height}`;
}
