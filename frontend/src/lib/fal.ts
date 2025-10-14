import fs from 'node:fs/promises';
import path from 'node:path';
import type { QueueStatus } from '@fal-ai/client';
import { ENV } from '@/lib/env';
import { getResultProviderMode, shouldUseFalApis } from '@/lib/result-provider';
import type { ResultProviderMode } from '@/types/providers';
import type { VideoAsset } from '@/types/render';
import { resolveFalModelId } from '@/lib/fal-catalog';
import { getFalClient } from '@/lib/fal-client';

const BLOCKED_VIDEO_HOSTS = new Set([
  'upload.wikimedia.org',
  'test-videos.co.uk',
  'd3rlna7iyyu8wu.cloudfront.net',
  'amssamples.streaming.mediaservices.windows.net',
]);

type ManifestEntry = {
  id?: string;
  url?: unknown;
  mime?: unknown;
  width?: unknown;
  height?: unknown;
  durationSec?: unknown;
  tags?: unknown;
  thumbUrl?: unknown;
  thumbnail?: unknown;
  poster?: unknown;
  path?: unknown;
  aspectRatio?: unknown;
  sizeBytes?: unknown;
};

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

type FalRunResponse = {
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

export type GenerateAttachment = {
  name: string;
  type: string;
  size: number;
  kind?: 'image' | 'video';
  slotId?: string;
  label?: string;
  dataUrl: string;
};

export type GeneratePayload = {
  engineId: string;
  prompt: string;
  durationSec: number;
  numFrames?: number | null;
  aspectRatio: string;
  resolution?: string;
  fps?: number;
  mode?: string;
  addons?: { audio?: boolean; upscale4k?: boolean };
  apiKey?: string;
  idempotencyKey?: string;
  inputs?: GenerateAttachment[];
};

export type GenerateResult = {
  provider: ResultProviderMode;
  thumbUrl: string;
  videoUrl?: string;
  video?: VideoAsset;
  providerJobId?: string;
  status?: 'queued' | 'running' | 'completed' | 'failed';
  progress?: number;
};

const MANIFEST_FILENAME = 'maxvideoai_test_videos_manifest.json';
const FAL_FILES_BASE_URL = (process.env.FAL_FILES_BASE_URL || process.env.NEXT_PUBLIC_FAL_FILES_BASE_URL || 'https://fal.media/files').replace(/\/+$/, '');
let manifestPromise: Promise<VideoAsset[]> | null = null;
let manifestCache: VideoAsset[] | null = null;
let manifestCdnBase: string | null = null;

const DEFAULT_TEST_ASSETS: VideoAsset[] = [
  {
    url: '/assets/gallery/adraga-beach.mp4',
    mime: 'video/mp4',
    width: null,
    height: null,
    durationSec: null,
    tags: ['sample', 'local'],
    aspectRatio: '16:9',
  },
  {
    url: '/assets/gallery/drone-snow.mp4',
    mime: 'video/mp4',
    width: null,
    height: null,
    durationSec: null,
    tags: ['sample', 'local'],
    aspectRatio: '16:9',
  },
  {
    url: '/assets/gallery/swimmer.mp4',
    mime: 'video/mp4',
    width: null,
    height: null,
    durationSec: null,
    tags: ['sample', 'local'],
    aspectRatio: '16:9',
  },
  {
    url: '/assets/gallery/aerial-road.mp4',
    mime: 'video/mp4',
    width: null,
    height: null,
    durationSec: null,
    tags: ['sample', 'local'],
    aspectRatio: '16:9',
  },
  {
    url: '/assets/gallery/parking-portrait.mp4',
    mime: 'video/mp4',
    width: null,
    height: null,
    durationSec: null,
    tags: ['sample', 'local', 'portrait'],
    aspectRatio: '9:16',
  },
  {
    url: '/assets/gallery/robot-eyes.mp4',
    mime: 'video/mp4',
    width: null,
    height: null,
    durationSec: null,
    tags: ['sample', 'local'],
    aspectRatio: '9:16',
  },
  {
    url: '/assets/gallery/robot-look.mp4',
    mime: 'video/mp4',
    width: null,
    height: null,
    durationSec: null,
    tags: ['sample', 'local'],
    aspectRatio: '16:9',
  },
];

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
  const base = manifestCdnBase ?? ENV.TEST_VIDEO_BASE_URL ?? '/test-videos';
  return joinUrl(base, normalized);
}

function unwrapFalResponse(payload: unknown): FalRunResponse | null {
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

function resolveModelSlug(payload: GeneratePayload, fallback?: string): string | undefined {
  const baseSlug = fallback;
  const tier = payload.engineId === 'sora-2-pro' ? 'pro' : 'base';
  const mode = payload.mode === 'i2v' ? 'image-to-video' : 'text-to-video';

  if (payload.engineId === 'sora-2' || payload.engineId === 'sora-2-pro') {
    const suffix = tier === 'pro' ? '/pro' : '';
    return `fal-ai/sora-2/${mode}${suffix}`;
  }

  return baseSlug;
}

export async function generateVideo(payload: GeneratePayload): Promise<GenerateResult> {
  const provider = getResultProviderMode();
  if (provider === 'FAL' && !ENV.FAL_API_KEY) {
    throw new Error('FAL provider selected but FAL_API_KEY is missing');
  }

  const resolvedFallback = await resolveFalModelId(payload.engineId);
  const model = resolveModelSlug(payload, resolvedFallback);
  const canUseFal = shouldUseFalApis() && Boolean(model);
  if (!canUseFal) {
    return generateFromManifest(payload, provider);
  }

  try {
    return await generateViaFal(payload, provider, model!);
  } catch (error) {
    if (provider === 'FAL') {
      throw error instanceof Error ? error : new Error('FAL generation failed');
    }
    console.warn('[result-provider] FAL generation failed, falling back to manifest:', error);
    return generateFromManifest(payload, provider);
  }
}

async function generateFromManifest(payload: GeneratePayload, provider: ResultProviderMode): Promise<GenerateResult> {
  const manifestEntries = await loadManifestVideos();
  const aspectMatches = manifestEntries.filter((asset) => matchesAspect(payload.aspectRatio, asset));
  const candidates = aspectMatches.length ? aspectMatches : manifestEntries.length ? manifestEntries : DEFAULT_TEST_ASSETS;
  const selected = selectRandom(candidates) ?? DEFAULT_TEST_ASSETS[0];
  const asset = ensureAssetShape(selected);
  const fallbackThumb = getThumbForAspectRatio(payload.aspectRatio);
  const poster = asset.thumbnailUrl ?? (await getPosterFrame(asset.url).catch(() => null));
  const thumbUrl = poster ?? fallbackThumb;
  return {
    provider,
    thumbUrl,
    videoUrl: asset.url,
    video: asset,
    status: 'completed',
    progress: 100,
  };
}

async function generateViaFal(payload: GeneratePayload, provider: ResultProviderMode, model: string): Promise<GenerateResult> {
  const fallbackThumb = getThumbForAspectRatio(payload.aspectRatio);
  const falClient = getFalClient();

  let apiKey: string | undefined;
  if (payload.apiKey && payload.apiKey.trim().length > 10) {
    apiKey = payload.apiKey.trim();
  }

  let imageUrl: string | undefined;
  if (payload.mode === 'i2v' && payload.inputs?.length) {
    const primaryImage = payload.inputs.find(
      (entry) => entry.kind === 'image' || entry.slotId === 'image_url' || entry.type.startsWith('image/')
    );
    if (primaryImage?.dataUrl) {
      imageUrl = primaryImage.dataUrl;
    }
  }

  const requestBody: Record<string, unknown> = {
    prompt: payload.prompt,
    aspect_ratio: payload.aspectRatio,
    resolution: payload.resolution,
    fps: payload.fps,
    mode: payload.mode,
    audio: Boolean(payload.addons?.audio),
    upscale: Boolean(payload.addons?.upscale4k),
  };

  if (typeof payload.numFrames === 'number' && Number.isFinite(payload.numFrames) && payload.numFrames > 0) {
    requestBody.num_frames = Math.round(payload.numFrames);
  } else {
    requestBody.duration = payload.durationSec;
  }

  if (apiKey) {
    requestBody.api_key = apiKey;
  }
  if (imageUrl) {
    requestBody.image_url = imageUrl;
  }

  let latestQueueStatus: QueueStatus | null = null;
  const result = await falClient.subscribe(model, {
    input: requestBody,
    onQueueUpdate(update) {
      latestQueueStatus = update;
    },
  });

  const json = unwrapFalResponse(result.data);
  const queueRequestId = (latestQueueStatus as { request_id?: string } | null)?.request_id;
  const providerJobId: string | undefined =
    result.requestId ??
    json?.request_id ??
    json?.id ??
    queueRequestId;
  const immediateAsset = extractVideoAsset(json);
  if (immediateAsset) {
    const asset = ensureAssetShape(immediateAsset);
    const poster = asset.thumbnailUrl ?? (await getPosterFrame(asset.url).catch(() => null));
    const thumbUrl = poster ?? fallbackThumb;
    return {
      provider,
      thumbUrl,
      providerJobId,
      videoUrl: asset.url,
      video: asset,
      status: 'completed',
      progress: 100,
    };
  }

  const fallbackStatus = normalizePendingStatus(latestQueueStatus, json);
  const fallbackProgress = normalizePendingProgress(latestQueueStatus, json);

  if (!providerJobId && !fallbackStatus.providerJobIdFallback) {
    throw new Error('FAL response did not contain a video asset');
  }

  return {
    provider,
    thumbUrl: fallbackThumb,
    providerJobId: providerJobId ?? fallbackStatus.providerJobIdFallback ?? undefined,
    status: fallbackStatus.status,
    progress: fallbackProgress,
  };
}

type PendingStatusInfo = {
  status: 'queued' | 'running' | 'failed';
  providerJobIdFallback?: string;
};

function normalizePendingStatus(queueStatus: QueueStatus | null, response: FalRunResponse | null | undefined): PendingStatusInfo {
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

function normalizePendingProgress(queueStatus: QueueStatus | null, response: FalRunResponse | null | undefined): number | undefined {
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

async function loadManifestVideos(): Promise<VideoAsset[]> {
  if (manifestCache) return manifestCache;
  if (!manifestPromise) {
    manifestPromise = readManifestFileContents()
      .then((raw) => JSON.parse(raw) as { videos?: ManifestEntry[]; cdnBase?: unknown })
      .then((json) => {
        manifestCdnBase = resolveManifestBase(json?.cdnBase);
        return Array.isArray(json?.videos) ? json.videos : [];
      })
      .then((entries) => entries.map(normalizeManifestEntry).filter((entry): entry is VideoAsset => Boolean(entry)))
      .catch((error) => {
        console.warn(`[result-provider] Failed to load ${MANIFEST_FILENAME}:`, error);
        return [];
      });
  }
  manifestCache = await manifestPromise;
  return manifestCache;
}

function normalizeManifestEntry(entry: ManifestEntry | null | undefined): VideoAsset | null {
  if (!entry || typeof entry !== 'object') return null;
  let normalizedUrl: string | null = null;
  if (typeof entry.url === 'string' && entry.url.trim().length) {
    normalizedUrl = normalizeVideoUrl(entry.url);
  } else if (typeof entry.path === 'string' && entry.path.trim().length) {
    const base = manifestCdnBase ?? ENV.TEST_VIDEO_BASE_URL ?? '/test-videos';
    normalizedUrl = normalizeVideoUrl(joinUrl(base, entry.path));
  }
  if (!normalizedUrl) return null;
  if (isBlockedUrl(normalizedUrl)) return null;
  const mime = typeof entry.mime === 'string' && entry.mime ? entry.mime : guessMimeFromUrl(normalizedUrl) ?? 'video/mp4';
  const width = typeof entry.width === 'number' ? entry.width : null;
  const height = typeof entry.height === 'number' ? entry.height : null;
  const durationSec = typeof entry.durationSec === 'number' ? entry.durationSec : null;
  const tags = Array.isArray(entry.tags) ? entry.tags.filter((tag): tag is string => typeof tag === 'string') : [];
  const aspectRatio = resolveAspectRatio(entry.aspectRatio, width, height, tags);
  const thumbCandidate = [entry.thumbUrl, entry.thumbnail, entry.poster].find((value) => typeof value === 'string' && value.length > 0) as string | undefined;
  return {
    url: normalizedUrl,
    mime,
    width,
    height,
    durationSec,
    tags,
    thumbnailUrl: thumbCandidate ?? null,
    aspectRatio,
  };
}

function extractVideoAsset(response: FalRunResponse | null | undefined): VideoAsset | null {
  if (!response) return null;
  const candidates: FalVideoCandidate[] = [];
  if (response.response?.video) candidates.push(response.response.video);
  if (Array.isArray(response.response?.videos)) candidates.push(...response.response.videos);
  if (response.output?.video) candidates.push(response.output.video);
  if (Array.isArray(response.output?.videos)) candidates.push(...response.output.videos);
  if (response.video_url) candidates.push(response.video_url);
  if (Array.isArray(response.videos)) candidates.push(...response.videos);
  if (Array.isArray(response.assets)) candidates.push(...response.assets);

  for (const candidate of candidates) {
    const asset = normalizeVideoCandidate(candidate);
    if (asset) {
      return asset;
    }
  }

  return null;
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

function ensureAssetShape(asset: VideoAsset): VideoAsset {
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

function getDurationSeconds(candidate: { duration?: number; duration_seconds?: number; durationSec?: number; metadata?: { duration?: number; duration_seconds?: number } }): number | null {
  if (typeof candidate.durationSec === 'number') return candidate.durationSec;
  if (typeof candidate.duration_seconds === 'number') return candidate.duration_seconds;
  if (typeof candidate.duration === 'number') return candidate.duration;
  if (typeof candidate.metadata?.duration_seconds === 'number') return candidate.metadata.duration_seconds;
  if (typeof candidate.metadata?.duration === 'number') return candidate.metadata.duration;
  return null;
}

export async function getPosterFrame(url: string): Promise<string | null> {
  void url;
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

function getThumbForAspectRatio(aspectRatio: string): string {
  if (aspectRatio === '9:16') return '/assets/frames/thumb-9x16.svg';
  if (aspectRatio === '1:1') return '/assets/frames/thumb-1x1.svg';
  return '/assets/frames/thumb-16x9.svg';
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

function selectRandom<T>(items: readonly T[]): T | undefined {
  if (!items.length) return undefined;
  const index = Math.floor(Math.random() * items.length);
  return items[index];
}

async function readManifestFileContents(): Promise<string> {
  const candidates = [
    path.resolve(process.cwd(), MANIFEST_FILENAME),
    path.resolve(process.cwd(), '..', MANIFEST_FILENAME),
  ];

  for (const candidate of candidates) {
    try {
      return await fs.readFile(candidate, 'utf8');
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }

  throw new Error(`Unable to locate ${MANIFEST_FILENAME}`);
}

function resolveManifestBase(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed === '.') return '';
  return trimmed.replace(/\/+$/, '');
}

function joinUrl(base: string, segment: unknown): string {
  const safeBase = base.replace(/\/+$/, '');
  const safeSegment = typeof segment === 'string' ? segment.replace(/^\/+/, '') : '';
  if (!safeSegment) return safeBase;
  if (!safeBase) return `/${safeSegment}`;
  return `${safeBase}/${safeSegment}`;
}

function resolveAspectRatio(
  rawAspect: unknown,
  width: number | null,
  height: number | null,
  tags: string[] | null | undefined
): string | null {
  const candidate =
    normaliseAspectString(typeof rawAspect === 'string' ? rawAspect : null) ??
    extractAspectFromTags(tags) ??
    deriveAspectFromDimensions(width, height);
  return candidate;
}

function extractAspectFromTags(tags: string[] | null | undefined): string | null {
  if (!Array.isArray(tags)) return null;
  for (const tag of tags) {
    const value = typeof tag === 'string' ? tag.toLowerCase() : '';
    if (value.startsWith('aspect:')) {
      return normaliseAspectString(tag.slice('aspect:'.length));
    }
    if (value === 'landscape') return '16:9';
    if (value === 'portrait') return '9:16';
    if (value === 'square') return '1:1';
  }
  return null;
}

function deriveAspectFromDimensions(width: number | null | undefined, height: number | null | undefined): string | null {
  if (!width || !height) return null;
  const ratio = width / height;
  if (Math.abs(ratio - 16 / 9) < 0.08) return '16:9';
  if (Math.abs(ratio - 9 / 16) < 0.08) return '9:16';
  if (Math.abs(ratio - 1) < 0.08) return '1:1';
  return `${width}:${height}`;
}

function matchesAspect(requested: string, asset: VideoAsset): boolean {
  const desired = normaliseAspectString(requested);
  if (!desired) return true;
  const assetAspect = normaliseAspectString(asset.aspectRatio) ?? deriveAspectFromDimensions(asset.width, asset.height);
  if (!assetAspect) return true;
  if (desired === assetAspect) return true;
  const desiredRatio = parseAspect(desired);
  const assetRatio = parseAspect(assetAspect);
  if (!desiredRatio || !assetRatio) return false;
  if (Math.abs(desiredRatio - assetRatio) <= 0.08) return true;
  const desiredOrientation = orientationFromAspect(desired);
  const assetOrientation = orientationFromAspect(assetAspect) ?? orientationFromTags(asset.tags);
  return Boolean(desiredOrientation && assetOrientation && desiredOrientation === assetOrientation);
}

function normaliseAspectString(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed === '16x9' || trimmed === 'landscape') return '16:9';
  if (trimmed === '9x16' || trimmed === 'portrait') return '9:16';
  if (trimmed === '1x1' || trimmed === 'square') return '1:1';
  if (/^\d+:\d+$/.test(trimmed)) return trimmed;
  return null;
}

function parseAspect(aspect: string | null | undefined): number | null {
  if (!aspect) return null;
  const match = aspect.match(/^(\d+):(\d+)$/);
  if (!match) return null;
  const a = Number.parseInt(match[1], 10);
  const b = Number.parseInt(match[2], 10);
  if (!a || !b) return null;
  return a / b;
}

function orientationFromAspect(aspect: string | null | undefined): 'landscape' | 'portrait' | 'square' | null {
  const ratio = parseAspect(aspect);
  if (!ratio) return null;
  if (Math.abs(ratio - 1) < 0.08) return 'square';
  return ratio > 1 ? 'landscape' : 'portrait';
}

function orientationFromTags(tags: string[] | null | undefined): 'landscape' | 'portrait' | 'square' | null {
  if (!Array.isArray(tags)) return null;
  const lower = tags.map((tag) => tag.toLowerCase());
  if (lower.includes('portrait')) return 'portrait';
  if (lower.includes('square')) return 'square';
  if (lower.includes('landscape')) return 'landscape';
  return null;
}
