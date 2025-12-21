import type { QueueStatus } from '@fal-ai/client';
import { ENV } from '@/lib/env';
import { getResultProviderMode } from '@/lib/result-provider';
import type { ResultProviderMode } from '@/types/providers';
import type { VideoAsset } from '@/types/render';
import { resolveFalModelId } from '@/lib/fal-catalog';
import { listFalEngines } from '@/config/falEngines';
import { getFalClient } from '@/lib/fal-client';
import { buildSoraFalInput, type SoraRequest } from '@/lib/sora';
import { getLumaRay2DurationInfo, toLumaRay2DurationLabel } from '@/lib/luma-ray2';

const BLOCKED_VIDEO_HOSTS = new Set([
  'upload.wikimedia.org',
  'test-videos.co.uk',
  'd3rlna7iyyu8wu.cloudfront.net',
  'amssamples.streaming.mediaservices.windows.net',
]);

const ENGINE_MODE_MODEL_MAP = (() => {
  const map = new Map<string, Map<string, string>>();
  listFalEngines().forEach((engine) => {
    const modeMap = new Map<string, string>();
    engine.modes.forEach((mode) => {
      modeMap.set(mode.mode, mode.falModelId);
    });
    map.set(engine.id, modeMap);
  });
  return map;
})();

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
  url?: string;
  dataUrl?: string;
  width?: number | null;
  height?: number | null;
  assetId?: string;
};

export type GeneratePayload = {
  engineId: string;
  prompt: string;
  durationSec: number;
  durationOption?: number | string | null;
  numFrames?: number | null;
  aspectRatio?: string;
  resolution?: string;
  fps?: number;
  mode?: string;
  apiKey?: string;
  idempotencyKey?: string;
  imageUrl?: string;
  referenceImages?: string[];
  inputs?: GenerateAttachment[];
  soraRequest?: SoraRequest;
  jobId?: string;
  localKey?: string | null;
  loop?: boolean;
  cfgScale?: number | null;
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

type GenerateHooks = {
  onRequestId?: (requestId: string) => void | Promise<void>;
  onQueueUpdate?: (status: QueueStatus) => void | Promise<void>;
};

export class FalGenerationError extends Error {
  status?: number;
  body?: unknown;
  providerJobId?: string;

  constructor(
    message: string,
    options: { status?: number; body?: unknown; providerJobId?: string; cause?: unknown } = {}
  ) {
    super(message);
    this.name = 'FalGenerationError';
    this.status = options.status;
    this.body = options.body;
    this.providerJobId = options.providerJobId;
    if (options.cause) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export function getFalWebhookUrl(): string | null {
  const token = process.env.FAL_WEBHOOK_TOKEN?.trim();
  const candidates: Array<{ value: string | undefined | null; normalize?: (raw: string) => string }> = [
    { value: process.env.NEXT_PUBLIC_APP_URL },
    { value: process.env.APP_URL },
    { value: process.env.APP_BASE_URL },
    { value: process.env.NEXT_PUBLIC_SITE_URL },
    {
      value: process.env.VERCEL_URL,
      normalize: (raw) => (raw.startsWith('http') ? raw : `https://${raw}`),
    },
    {
      value: process.env.NEXT_PUBLIC_VERCEL_URL,
      normalize: (raw) => (raw.startsWith('http') ? raw : `https://${raw}`),
    },
  ];

  for (const candidate of candidates) {
    const raw = typeof candidate.value === 'string' ? candidate.value.trim() : '';
    if (!raw) continue;
    const normalized = candidate.normalize ? candidate.normalize(raw) : raw;
    if (!/^https?:\/\//i.test(normalized)) continue;
    const base = normalized.replace(/\/+$/, '') + '/';
    const webhookUrl = new URL('api/fal/webhook', base);
    if (token) {
      webhookUrl.searchParams.set('token', token);
    }
    return webhookUrl.toString();
  }

  return null;
}

const FAL_FILES_BASE_URL = (process.env.FAL_FILES_BASE_URL || process.env.NEXT_PUBLIC_FAL_FILES_BASE_URL || 'https://fal.media/files').replace(/\/+$/, '');
let warnedMissingWebhookUrl = false;

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
  const modeKey = typeof payload.mode === 'string' ? payload.mode : undefined;
  const mapped =
    modeKey && payload.engineId ? ENGINE_MODE_MODEL_MAP.get(payload.engineId)?.get(modeKey) : undefined;
  if (mapped) {
    return mapped;
  }
  const mode = payload.mode === 'i2v' ? 'image-to-video' : 'text-to-video';

  if (payload.engineId === 'veo-3-1-first-last') {
    if (payload.mode === 'i2i') {
      return 'fal-ai/veo3.1/fast/first-last-frame-to-video';
    }
    return 'fal-ai/veo3.1/first-last-frame-to-video';
  }

  if (payload.engineId === 'sora-2') {
    return `fal-ai/sora-2/${mode}`;
  }

  if (payload.engineId === 'sora-2-pro') {
    return `fal-ai/sora-2/${mode}/pro`;
  }

  if (!baseSlug) {
    return undefined;
  }

  const stripVariantSuffix = (slug: string) => slug.replace(/\/(text-to-video|image-to-video|modify|reframe)$/i, '');
  const normalized = baseSlug.replace(/\/+$/, '');

  if (payload.engineId === 'lumaDM') {
    const root = stripVariantSuffix(normalized);
    const base = root.endsWith('/luma-dream-machine') ? root : `${root}/luma-dream-machine`;
    return mode === 'image-to-video' ? `${base}/image-to-video` : base;
  }

  if (payload.engineId === 'lumaRay2') {
    const root = stripVariantSuffix(normalized);
    const base = root.endsWith('/ray-2') ? root : `${root.replace(/\/ray-2$/, '')}/ray-2`;
    return mode === 'image-to-video' ? `${base}/image-to-video` : base;
  }

  if (payload.engineId === 'lumaRay2_flash') {
    const root = stripVariantSuffix(normalized);
    const base = root.endsWith('/ray-2-flash') ? root : `${root.replace(/\/ray-2-flash$/, '')}/ray-2-flash`;
    return mode === 'image-to-video' ? `${base}/image-to-video` : base;
  }

  if (payload.engineId === 'lumaRay2_modify') {
    const root = stripVariantSuffix(normalized);
    const base = root.endsWith('/modify') ? root : `${root.replace(/\/modify$/, '')}/modify`;
    return base;
  }

  if (payload.engineId === 'lumaRay2_reframe') {
    const root = stripVariantSuffix(normalized);
    const base = root.endsWith('/reframe') ? root : `${root.replace(/\/reframe$/, '')}/reframe`;
    return base;
  }

  if (payload.engineId === 'lumaRay2_flash_reframe') {
    const root = stripVariantSuffix(normalized);
    const base = root.endsWith('/reframe') ? root : `${root.replace(/\/reframe$/, '')}/reframe`;
    return base;
  }

  return baseSlug;
}

export async function generateVideo(payload: GeneratePayload, hooks?: GenerateHooks): Promise<GenerateResult> {
  const provider = getResultProviderMode();
  if (!ENV.FAL_API_KEY) {
    throw new Error('FAL_API_KEY is missing');
  }
  const resolvedFallback = await resolveFalModelId(payload.engineId);
  const resolvedModelSlug = resolveModelSlug(payload, resolvedFallback);
  if (!resolvedModelSlug && !payload.soraRequest) {
    throw new Error('Unable to resolve FAL model for requested engine');
  }

  return generateViaFal(payload, provider, resolvedModelSlug ?? '', hooks);
}

async function generateViaFal(
  payload: GeneratePayload,
  provider: ResultProviderMode,
  defaultModel: string,
  hooks?: GenerateHooks
): Promise<GenerateResult> {
  const fallbackThumb = getThumbForAspectRatio(payload.aspectRatio);
  const falClient = getFalClient();

  let apiKey: string | undefined;
  if (payload.apiKey && payload.apiKey.trim().length > 10) {
    apiKey = payload.apiKey.trim();
  }

  const soraFal = payload.soraRequest ? buildSoraFalInput(payload.soraRequest) : null;
  let model = defaultModel;
  let requestBody: Record<string, unknown> = {};

  if (soraFal) {
    model = soraFal.model;
    requestBody = { ...soraFal.input };
    if (apiKey && !requestBody.api_key) {
      requestBody.api_key = apiKey;
    }
  } else {
    requestBody = {
      prompt: payload.prompt,
      resolution: payload.resolution,
      fps: payload.fps,
      mode: payload.mode,
    };
    if (payload.aspectRatio) {
      requestBody.aspect_ratio = payload.aspectRatio;
    }

    if (typeof payload.numFrames === 'number' && Number.isFinite(payload.numFrames) && payload.numFrames > 0) {
      requestBody.num_frames = Math.round(payload.numFrames);
    } else if (payload.engineId !== 'lumaRay2' && payload.durationSec != null) {
      requestBody.duration = payload.durationSec;
    }

    if (apiKey) {
      requestBody.api_key = apiKey;
    }
  }

  if (payload.engineId === 'lumaRay2') {
    const durationInfo = getLumaRay2DurationInfo(payload.durationOption ?? payload.durationSec);
    const durationLabel = durationInfo?.label ?? toLumaRay2DurationLabel(payload.durationSec) ?? '5s';
    requestBody.duration = durationLabel;
    if (payload.resolution) {
      requestBody.resolution = payload.resolution;
    }
    if (typeof payload.loop === 'boolean') {
      requestBody.loop = payload.loop;
    }
  }

  if (typeof payload.cfgScale === 'number') {
    requestBody.cfg_scale = payload.cfgScale;
  }

  const arrayCollectors = new Map<string, Set<string>>();
  const addToArray = (key: string, value: string) => {
    if (!arrayCollectors.has(key)) {
      arrayCollectors.set(key, new Set());
    }
    arrayCollectors.get(key)!.add(value);
  };

  const attachments = payload.inputs ?? [];
  let primaryImageUrl = payload.imageUrl?.trim();

  for (const attachment of attachments) {
    const urlCandidate = attachment.url?.trim() ?? attachment.dataUrl?.trim();
    if (!urlCandidate) continue;

    if (!primaryImageUrl && attachment.kind === 'image') {
      primaryImageUrl = urlCandidate;
    }

    const slotId = attachment.slotId?.trim();
    if (slotId === 'reference_images' || slotId === 'images' || slotId === 'image_urls') {
      addToArray(slotId === 'reference_images' ? 'reference_images' : slotId, urlCandidate);
      continue;
    }
    if (
      slotId === 'video_urls' ||
      slotId === 'video_url' ||
      slotId === 'reference_videos' ||
      slotId === 'videos'
    ) {
      addToArray('video_urls', urlCandidate);
      continue;
    }
    if (slotId === 'input_image' || slotId === 'image' || slotId === 'image_url') {
      requestBody[slotId] = urlCandidate;
      continue;
    }
    if (slotId === 'first_frame_url' || slotId === 'last_frame_url') {
      requestBody[slotId] = urlCandidate;
      continue;
    }
    if (!slotId && attachment.kind === 'video') {
      addToArray('video_urls', urlCandidate);
      continue;
    }
  }

  const referenceImages = payload.referenceImages ?? [];
  referenceImages.forEach((url) => {
    const trimmed = url.trim();
    if (trimmed) addToArray('reference_images', trimmed);
  });

  for (const [key, values] of arrayCollectors.entries()) {
    requestBody[key] = Array.from(values);
  }

  if (!primaryImageUrl) {
    const referenceArray = requestBody.reference_images as string[] | undefined;
    if (referenceArray?.length) {
      primaryImageUrl = referenceArray[0];
    }
  }

  if (!requestBody.image_url && primaryImageUrl) {
    requestBody.image_url = primaryImageUrl;
  }
  if (!requestBody.input_image && primaryImageUrl && payload.engineId.startsWith('sora-2')) {
    requestBody.input_image = primaryImageUrl;
  }

  const metadataPayload: Record<string, unknown> = {};
  if (payload.jobId) {
    metadataPayload.app_job_id = payload.jobId;
  }
  if (payload.localKey) {
    metadataPayload.app_local_key = payload.localKey;
  }
  if (Object.keys(metadataPayload).length) {
    const existing =
      requestBody.metadata && typeof requestBody.metadata === 'object' && !Array.isArray(requestBody.metadata)
        ? (requestBody.metadata as Record<string, unknown>)
        : {};
    requestBody.metadata = { ...existing, ...metadataPayload };
  }

  let latestQueueStatus: QueueStatus | null = null;
  const webhookUrl = getFalWebhookUrl() ?? undefined;
  if (!webhookUrl && !warnedMissingWebhookUrl) {
    warnedMissingWebhookUrl = true;
    console.warn('[fal] No webhook URL configured; relying on polling only.');
  }
  let enqueuedRequestId: string | undefined;
  let result: Awaited<ReturnType<typeof falClient.subscribe>>;
  try {
    result = await falClient.subscribe(model, {
      input: requestBody,
      webhookUrl,
      mode: 'polling',
      onEnqueue(requestId) {
        if (typeof requestId === 'string') {
          enqueuedRequestId = requestId;
          if (hooks?.onRequestId) {
            Promise.resolve(hooks.onRequestId(requestId)).catch((error) => {
              console.warn('[fal] onRequestId hook failed', error);
            });
          }
        }
      },
      onQueueUpdate(update) {
        latestQueueStatus = update;
        if (hooks?.onQueueUpdate) {
          Promise.resolve(hooks.onQueueUpdate(update)).catch((error) => {
            console.warn('[fal] onQueueUpdate hook failed', error);
          });
        }
      },
    });
  } catch (error) {
    const metadataStatus =
      typeof (error as { $metadata?: { httpStatusCode?: number } } | undefined)?.$metadata?.httpStatusCode === 'number'
        ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata!.httpStatusCode
        : undefined;
    const statusCandidate =
      typeof (error as { status?: number } | undefined)?.status === 'number'
        ? (error as { status?: number }).status
        : metadataStatus;
    const queueRequestId = (latestQueueStatus as { request_id?: string } | null)?.request_id;
    const fallbackProviderJobId =
      enqueuedRequestId ??
      queueRequestId ??
      (error as { providerJobId?: string } | undefined)?.providerJobId ??
      (error as { requestId?: string } | undefined)?.requestId ??
      (error as { request_id?: string } | undefined)?.request_id ??
      (error as { response?: { request_id?: string; id?: string } } | undefined)?.response?.request_id ??
      (error as { response?: { request_id?: string; id?: string } } | undefined)?.response?.id ??
      undefined;
    const bodyCandidate =
      (error as { body?: unknown } | undefined)?.body ??
      (error as { response?: unknown } | undefined)?.response ??
      (error as { data?: unknown } | undefined)?.data ??
      null;
    const message = error instanceof Error ? error.message : 'Fal request failed';
    const falError = new FalGenerationError(message, {
      status: statusCandidate,
      body: bodyCandidate,
      providerJobId: fallbackProviderJobId,
      cause: error,
    });
    if ((error as { $metadata?: unknown } | undefined)?.$metadata) {
      (falError as { $metadata?: unknown }).$metadata = (error as { $metadata?: unknown }).$metadata;
    }
    (falError as { originalError?: unknown }).originalError = error;
    if (fallbackProviderJobId && hooks?.onRequestId) {
      Promise.resolve(hooks.onRequestId(fallbackProviderJobId)).catch((hookError) => {
        console.warn('[fal] onRequestId hook failed after error', hookError);
      });
    }
    throw falError;
  }

  const json = unwrapFalResponse(result.data);
  const queueRequestId = (latestQueueStatus as { request_id?: string } | null)?.request_id;
  const providerJobId: string | undefined =
    enqueuedRequestId ??
    result.requestId ??
    json?.request_id ??
    json?.id ??
    queueRequestId;
  const immediateAsset = extractVideoAsset(json);
  if (immediateAsset) {
    const asset = ensureAssetShape(immediateAsset);
    const thumbUrl = asset.thumbnailUrl ?? fallbackThumb;
    if (providerJobId && hooks?.onRequestId) {
      Promise.resolve(hooks.onRequestId(providerJobId)).catch((error) => {
        console.warn('[fal] onRequestId hook failed after immediate result', error);
      });
    }
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

  const resolvedProviderJobId = providerJobId ?? fallbackStatus.providerJobIdFallback ?? undefined;
  if (resolvedProviderJobId && hooks?.onRequestId) {
    Promise.resolve(hooks.onRequestId(resolvedProviderJobId)).catch((error) => {
      console.warn('[fal] onRequestId hook failed after pending result', error);
    });
  }
  return {
    provider,
    thumbUrl: fallbackThumb,
    providerJobId: resolvedProviderJobId,
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

function extractVideoAsset(response: FalRunResponse | null | undefined): VideoAsset | null {
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

function getThumbForAspectRatio(aspectRatio?: string): string {
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

function deriveAspectFromDimensions(width: number | null | undefined, height: number | null | undefined): string | null {
  if (!width || !height) return null;
  const ratio = width / height;
  if (Math.abs(ratio - 16 / 9) < 0.08) return '16:9';
  if (Math.abs(ratio - 9 / 16) < 0.08) return '9:16';
  if (Math.abs(ratio - 1) < 0.08) return '1:1';
  return `${width}:${height}`;
}
