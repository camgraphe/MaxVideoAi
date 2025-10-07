import fs from 'node:fs/promises';
import path from 'node:path';
import { ENV } from '@/lib/env';
import { getResultProviderMode, shouldUseFalApis } from '@/lib/result-provider';
import type { ResultProviderMode } from '@/types/providers';
import type { VideoAsset } from '@/types/render';
import { resolveFalModelId } from '@/lib/fal-catalog';

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
};

type FalVideoCandidate =
  | string
  | {
      url?: string;
      video_url?: string;
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

export type GeneratePayload = {
  engineId: string;
  prompt: string;
  durationSec: number;
  aspectRatio: string;
  resolution?: string;
  fps?: number;
  mode?: string;
  addons?: { audio?: boolean; upscale4k?: boolean };
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
let manifestPromise: Promise<VideoAsset[]> | null = null;
let manifestCache: VideoAsset[] | null = null;

const DEFAULT_TEST_ASSETS: VideoAsset[] = [
  {
    url: '/assets/gallery/adraga-beach.mp4',
    mime: 'video/mp4',
    width: null,
    height: null,
    durationSec: null,
    tags: ['sample', 'local'],
  },
  {
    url: '/assets/gallery/drone-snow.mp4',
    mime: 'video/mp4',
    width: null,
    height: null,
    durationSec: null,
    tags: ['sample', 'local'],
  },
  {
    url: '/assets/gallery/swimmer.mp4',
    mime: 'video/mp4',
    width: null,
    height: null,
    durationSec: null,
    tags: ['sample', 'local'],
  },
  {
    url: '/assets/gallery/aerial-road.mp4',
    mime: 'video/mp4',
    width: null,
    height: null,
    durationSec: null,
    tags: ['sample', 'local'],
  },
  {
    url: '/assets/gallery/parking-portrait.mp4',
    mime: 'video/mp4',
    width: null,
    height: null,
    durationSec: null,
    tags: ['sample', 'local', 'portrait'],
  },
  {
    url: '/assets/gallery/robot-eyes.mp4',
    mime: 'video/mp4',
    width: null,
    height: null,
    durationSec: null,
    tags: ['sample', 'local'],
  },
  {
    url: '/assets/gallery/robot-look.mp4',
    mime: 'video/mp4',
    width: null,
    height: null,
    durationSec: null,
    tags: ['sample', 'local'],
  },
];

function normalizeVideoUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith('http://commondatastorage.googleapis.com')) {
    return `https://${trimmed.slice('http://'.length)}`;
  }
  return trimmed;
}

function isBlockedUrl(url: string): boolean {
  if (!url || url.startsWith('/')) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return BLOCKED_VIDEO_HOSTS.has(parsed.hostname);
  } catch {
    return true;
  }
}

export async function generateVideo(payload: GeneratePayload): Promise<GenerateResult> {
  const provider = getResultProviderMode();
  if (provider === 'FAL' && !ENV.FAL_API_KEY) {
    throw new Error('FAL provider selected but FAL_API_KEY is missing');
  }

  const model = await resolveFalModelId(payload.engineId);
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
  const candidates = manifestEntries.length ? manifestEntries : DEFAULT_TEST_ASSETS;
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
  const runUrl = `https://api.fal.ai/v1/run/${model}`;
  const res = await fetch(runUrl, {
    method: 'POST',
    headers: { Authorization: `Key ${ENV.FAL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: payload.prompt,
      duration: payload.durationSec,
      aspect_ratio: payload.aspectRatio,
      resolution: payload.resolution,
      fps: payload.fps,
      mode: payload.mode,
      audio: Boolean(payload.addons?.audio),
      upscale: Boolean(payload.addons?.upscale4k),
    }),
  });

  if (!res.ok) {
    throw new Error(`FAL run failed (${res.status})`);
  }

  const json = (await res.json().catch(() => null)) as FalRunResponse | null;
  const providerJobId: string | undefined = json?.request_id || json?.id;
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

  // Short poll status until a video URL is available
  let attempts = 10; // ~20s with 2s interval
  let latestProgress: number | undefined;
  const statusUrl = json?.status_url || (providerJobId ? `https://api.fal.ai/v1/status/${providerJobId}` : null);
  while (attempts-- > 0 && statusUrl) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const sr = await fetch(statusUrl, { headers: { Authorization: `Key ${ENV.FAL_API_KEY}` } });
    if (!sr.ok) continue;
    const sj = (await sr.json().catch(() => null)) as FalRunResponse | null;
    const assetCandidate = extractVideoAsset(sj);
    if (assetCandidate) {
      const asset = ensureAssetShape(assetCandidate);
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

    const st: string | undefined = sj?.status || sj?.state;
    const progValue: number | undefined = typeof sj?.progress === 'number' ? sj?.progress : typeof sj?.percent === 'number' ? sj?.percent : undefined;
    if (st === 'failed') {
      return {
        provider,
        thumbUrl: fallbackThumb,
        providerJobId,
        status: 'failed',
        progress: latestProgress ?? 0,
      };
    }
    if (typeof progValue === 'number') {
      latestProgress = Math.max(0, Math.min(100, Math.round(progValue)));
    }
  }

  return {
    provider,
    thumbUrl: fallbackThumb,
    providerJobId,
    status: latestProgress ? 'running' : 'queued',
    progress: latestProgress ?? 0,
  };
}

async function loadManifestVideos(): Promise<VideoAsset[]> {
  if (manifestCache) return manifestCache;
  if (!manifestPromise) {
    manifestPromise = readManifestFileContents()
      .then((raw) => JSON.parse(raw) as { videos?: ManifestEntry[] })
      .then((json) => (Array.isArray(json?.videos) ? json.videos : []))
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
  if (typeof entry.url !== 'string' || !entry.url) return null;
  const normalizedUrl = normalizeVideoUrl(entry.url);
  if (isBlockedUrl(normalizedUrl)) return null;
  const mime = typeof entry.mime === 'string' && entry.mime ? entry.mime : guessMimeFromUrl(normalizedUrl) ?? 'video/mp4';
  const width = typeof entry.width === 'number' ? entry.width : null;
  const height = typeof entry.height === 'number' ? entry.height : null;
  const durationSec = typeof entry.durationSec === 'number' ? entry.durationSec : null;
  const tags = Array.isArray(entry.tags) ? entry.tags.filter((tag): tag is string => typeof tag === 'string') : [];
  const thumbCandidate = [entry.thumbUrl, entry.thumbnail, entry.poster].find((value) => typeof value === 'string' && value.length > 0) as string | undefined;
  return {
    url: normalizedUrl,
    mime,
    width,
    height,
    durationSec,
    tags,
    thumbnailUrl: thumbCandidate ?? null,
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
  const urlCandidate = typeof candidate.url === 'string' && candidate.url ? candidate.url : typeof candidate.video_url === 'string' && candidate.video_url ? candidate.video_url : null;
  if (!urlCandidate) return null;
  const normalizedUrl = normalizeVideoUrl(urlCandidate);
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
