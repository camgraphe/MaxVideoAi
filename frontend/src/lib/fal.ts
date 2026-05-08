import type { QueueStatus } from '@fal-ai/client';
import { ENV } from '@/lib/env';
import { getResultProviderMode } from '@/lib/result-provider';
import type { ResultProviderMode } from '@/types/providers';
import type { VideoAsset } from '@/types/render';
import { resolveFalModelId } from '@/lib/fal-catalog';
import { listFalEngines } from '@/config/falEngines';
import { getFalClient } from '@/lib/fal-client';
import {
  ensureAssetShape,
  extractVideoAsset,
  getThumbForAspectRatio,
  normalizePendingProgress,
  normalizePendingStatus,
  unwrapFalResponse,
} from '@/lib/fal-response';
import { buildSoraFalInput, type SoraRequest } from '@/lib/sora';
import {
  getLumaRay2DurationInfo,
  isLumaRay2EngineId,
  isLumaRay2GenerateMode,
  toLumaRay2DurationLabel,
} from '@/lib/luma-ray2';

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

const STRING_ENUM_DURATION_MODEL_PATTERN =
  /^(?:bytedance\/seedance-2\.0(?:\/fast)?\/|wan\/v2\.6\/(?:text-to-video|image-to-video|reference-to-video)$|fal-ai\/kling-video\/v3\/(?:pro|standard|4k)\/(?:text-to-video|image-to-video)$)/i;

function normalizeStringEnumDurationValue(duration: number | string): string {
  if (typeof duration === 'number') {
    return String(Math.round(duration));
  }

  const trimmed = duration.trim();
  if (/^\d+(?:\.\d+)?s?$/i.test(trimmed)) {
    return String(Math.round(Number(trimmed.replace(/s$/i, ''))));
  }
  return trimmed;
}

export function normalizeFalDurationValueForModel(
  engineId: string,
  modelSlug: string,
  duration: number | string
): number | string {
  if (STRING_ENUM_DURATION_MODEL_PATTERN.test(modelSlug) || engineId.startsWith('seedance-2-0') || engineId === 'wan-2-6') {
    return normalizeStringEnumDurationValue(duration);
  }

  if (engineId.startsWith('kling-3')) {
    return normalizeStringEnumDurationValue(duration);
  }

  if (typeof duration === 'string') {
    return duration;
  }

  return duration;
}

export type GenerateAttachment = {
  name: string;
  type: string;
  size: number;
  kind?: 'image' | 'video' | 'audio';
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
  durationSec?: number;
  durationOption?: number | string | null;
  numFrames?: number | null;
  aspectRatio?: string;
  resolution?: string;
  fps?: number;
  mode?: string;
  audio?: boolean;
  apiKey?: string;
  idempotencyKey?: string;
  imageUrl?: string;
  audioUrl?: string;
  referenceImages?: string[];
  inputs?: GenerateAttachment[];
  soraRequest?: SoraRequest;
  jobId?: string;
  localKey?: string | null;
  loop?: boolean;
  cfgScale?: number | null;
  multiPrompt?: Array<{ prompt: string; duration: number }>;
  shotType?: 'customize' | 'intelligent';
  seed?: number;
  cameraFixed?: boolean;
  safetyChecker?: boolean;
  voiceIds?: string[];
  elements?: Array<{ frontalImageUrl?: string; referenceImageUrls?: string[]; videoUrl?: string }>;
  endImageUrl?: string;
  extraInputValues?: Record<string, unknown>;
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

let warnedMissingWebhookUrl = false;

function normalizeFalVideoResolution(value: string | undefined): string | undefined {
  if (!value) return value;
  const normalized = value.trim().toLowerCase();
  if (normalized === '4k') return '2160p';
  return value;
}

export function resolveFalVideoResolutionInput(engineId: string, value: string | undefined): string | undefined {
  if (engineId.startsWith('kling-')) {
    return undefined;
  }
  return normalizeFalVideoResolution(value);
}

function resolveModelSlug(payload: GeneratePayload, fallback?: string): string | undefined {
  const baseSlug = fallback;
  const modeKey = typeof payload.mode === 'string' ? payload.mode : undefined;
  const mapped =
    modeKey && payload.engineId ? ENGINE_MODE_MODEL_MAP.get(payload.engineId)?.get(modeKey) : undefined;
  if (mapped) {
    return mapped;
  }
  const mode = (() => {
    switch (payload.mode) {
      case 'i2v':
        return 'image-to-video';
      case 'ref2v':
        return 'reference-to-video';
      case 'fl2v':
        return 'first-last-frame-to-video';
      case 'v2v':
        return 'modify';
      case 'a2v':
        return 'audio-to-video';
      case 'extend':
        return 'extend-video';
      case 'retake':
        return 'retake-video';
      case 'reframe':
        return 'reframe';
      default:
        return 'text-to-video';
    }
  })();

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
    const resolution = resolveFalVideoResolutionInput(payload.engineId, payload.resolution);
    requestBody = {
      fps: payload.fps,
    };
    if (resolution) {
      requestBody.resolution = resolution;
    }
    if (payload.prompt.trim().length) {
      requestBody.prompt = payload.prompt;
    }
    if (payload.aspectRatio) {
      requestBody.aspect_ratio = payload.aspectRatio;
    }

    if (typeof payload.audio === 'boolean') {
      requestBody.generate_audio = payload.audio;
    }

    if (payload.audioUrl) {
      requestBody.audio_url = payload.audioUrl;
    }

    if (typeof payload.numFrames === 'number' && Number.isFinite(payload.numFrames) && payload.numFrames > 0) {
      requestBody.num_frames = Math.round(payload.numFrames);
    } else if (!isLumaRay2EngineId(payload.engineId)) {
      if (payload.durationOption != null) {
        requestBody.duration = normalizeFalDurationValueForModel(payload.engineId, model, payload.durationOption);
      } else if (payload.durationSec != null) {
        requestBody.duration = normalizeFalDurationValueForModel(payload.engineId, model, payload.durationSec);
      }
    }

    if (apiKey) {
      requestBody.api_key = apiKey;
    }
  }

  if (payload.multiPrompt && payload.multiPrompt.length) {
    requestBody.multi_prompt = payload.multiPrompt
      .filter((entry) => entry && typeof entry.prompt === 'string' && entry.prompt.trim().length)
      .map((entry) => ({
        prompt: entry.prompt,
        duration: String(Math.round(entry.duration || 0)),
      }));
  }
  if (payload.shotType) {
    requestBody.shot_type = payload.shotType;
  }
  if (typeof payload.seed === 'number' && Number.isFinite(payload.seed)) {
    requestBody.seed = Math.trunc(payload.seed);
  }
  if (typeof payload.cameraFixed === 'boolean') {
    requestBody.camera_fixed = payload.cameraFixed;
  }
  if (typeof payload.safetyChecker === 'boolean') {
    requestBody.enable_safety_checker = payload.safetyChecker;
  }
  if (payload.voiceIds && payload.voiceIds.length) {
    requestBody.voice_ids = payload.voiceIds;
  }
  if (payload.elements && payload.elements.length) {
    requestBody.elements = payload.elements.map((entry) => ({
      frontal_image_url: entry.frontalImageUrl,
      reference_image_urls: entry.referenceImageUrls,
      video_url: entry.videoUrl,
    }));
  }
  if (payload.endImageUrl) {
    requestBody.end_image_url = payload.endImageUrl;
  }

  if (isLumaRay2EngineId(payload.engineId) && isLumaRay2GenerateMode(payload.mode)) {
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
  const expectsSingleSourceVideo =
    payload.mode === 'v2v' || payload.mode === 'reframe' || payload.mode === 'extend' || payload.mode === 'retake';
  const expectsImageArray = payload.mode === 'ref2v';
  const expectsFirstLastFrames = payload.mode === 'fl2v';
  const forbidsPrimaryImage = payload.mode === 'ref2v';
  const addToArray = (key: string, value: string) => {
    if (!arrayCollectors.has(key)) {
      arrayCollectors.set(key, new Set());
    }
    arrayCollectors.get(key)!.add(value);
  };

  const attachments = payload.inputs ?? [];
  let primaryImageUrl = payload.imageUrl?.trim();
  let primaryAudioUrl = payload.audioUrl?.trim();

  for (const attachment of attachments) {
    const urlCandidate = attachment.url?.trim() ?? attachment.dataUrl?.trim();
    if (!urlCandidate) continue;

    if (!primaryImageUrl && attachment.kind === 'image') {
      primaryImageUrl = urlCandidate;
    }
    if (!primaryAudioUrl && attachment.kind === 'audio') {
      primaryAudioUrl = urlCandidate;
    }

    const slotId = attachment.slotId?.trim();
    if (
      slotId === 'reference_images' ||
      slotId === 'images' ||
      slotId === 'image_urls' ||
      slotId === 'reference_image_urls'
    ) {
      if (expectsImageArray) {
        addToArray('image_urls', urlCandidate);
      } else if (slotId === 'reference_images') {
        addToArray('reference_images', urlCandidate);
      } else if (slotId === 'reference_image_urls') {
        addToArray('reference_image_urls', urlCandidate);
      } else {
        addToArray(slotId === 'images' ? 'image_urls' : slotId, urlCandidate);
      }
      continue;
    }
    if (
      slotId === 'video_urls' ||
      slotId === 'video_url' ||
      slotId === 'reference_video_urls' ||
      slotId === 'reference_videos' ||
      slotId === 'videos'
    ) {
      if (expectsSingleSourceVideo) {
        if (!requestBody.video_url) {
          requestBody.video_url = urlCandidate;
        }
      } else {
        if (expectsImageArray && (slotId === 'reference_videos' || slotId === 'reference_video_urls')) {
          addToArray('video_urls', urlCandidate);
        } else if (slotId === 'reference_videos' || slotId === 'reference_video_urls') {
          addToArray('reference_video_urls', urlCandidate);
        } else {
          addToArray('video_urls', urlCandidate);
        }
      }
      continue;
    }
    if (
      slotId === 'audio_url' ||
      slotId === 'audio_urls' ||
      slotId === 'reference_audio_urls' ||
      slotId === 'reference_audios'
    ) {
      if (slotId === 'audio_url') {
        requestBody.audio_url = urlCandidate;
      } else if (expectsImageArray && (slotId === 'reference_audio_urls' || slotId === 'reference_audios')) {
        addToArray('audio_urls', urlCandidate);
      } else {
        addToArray(slotId === 'reference_audios' ? 'reference_audio_urls' : slotId, urlCandidate);
      }
      continue;
    }
    if (slotId === 'input_image' || slotId === 'image' || slotId === 'image_url') {
      if (expectsFirstLastFrames) {
        if (!requestBody.first_frame_url) {
          requestBody.first_frame_url = urlCandidate;
        }
        continue;
      }
      requestBody[slotId] = urlCandidate;
      continue;
    }
    if (slotId === 'first_frame_url' || slotId === 'last_frame_url' || slotId === 'end_image_url') {
      requestBody[slotId] = urlCandidate;
      continue;
    }
    if (!slotId && attachment.kind === 'image' && expectsImageArray) {
      addToArray('image_urls', urlCandidate);
      continue;
    }
    if (!slotId && attachment.kind === 'video') {
      if (expectsSingleSourceVideo) {
        if (!requestBody.video_url) {
          requestBody.video_url = urlCandidate;
        }
      } else {
        addToArray('video_urls', urlCandidate);
      }
      continue;
    }
    if (!slotId && attachment.kind === 'audio') {
      if (expectsImageArray) {
        addToArray('audio_urls', urlCandidate);
      } else if (!requestBody.audio_url) {
        requestBody.audio_url = urlCandidate;
      } else {
        addToArray('reference_audio_urls', urlCandidate);
      }
      continue;
    }
  }

  const referenceImages = payload.referenceImages ?? [];
  referenceImages.forEach((url) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (expectsImageArray) {
      addToArray('image_urls', trimmed);
      return;
    }
    if (expectsSingleSourceVideo && (payload.engineId === 'happy-horse-1-0' || requestBody.reference_image_urls)) {
      addToArray('reference_image_urls', trimmed);
      return;
    }
    addToArray('reference_images', trimmed);
  });

  for (const [key, values] of arrayCollectors.entries()) {
    requestBody[key] = Array.from(values);
  }

  if (!primaryImageUrl && !forbidsPrimaryImage && !expectsFirstLastFrames) {
    const referenceArray = requestBody.reference_images as string[] | undefined;
    if (referenceArray?.length) {
      primaryImageUrl = referenceArray[0];
    }
  }

  if (!requestBody.first_frame_url && primaryImageUrl && expectsFirstLastFrames) {
    requestBody.first_frame_url = primaryImageUrl;
  }
  if (!requestBody.image_url && primaryImageUrl && !forbidsPrimaryImage && !expectsFirstLastFrames) {
    requestBody.image_url = primaryImageUrl;
  }
  if (!requestBody.audio_url && primaryAudioUrl) {
    requestBody.audio_url = primaryAudioUrl;
  }
  if (!requestBody.input_image && primaryImageUrl && payload.engineId.startsWith('sora-2')) {
    requestBody.input_image = primaryImageUrl;
  }

  if (expectsSingleSourceVideo) {
    if (!requestBody.video_url) {
      const collected = requestBody.video_urls;
      const sourceVideo =
        Array.isArray(collected) && collected.length
          ? collected.find((value): value is string => typeof value === 'string' && value.trim().length > 0)
          : typeof collected === 'string' && collected.trim().length
            ? collected.trim()
            : undefined;
      if (sourceVideo) {
        requestBody.video_url = sourceVideo;
      }
    }
    delete requestBody.video_urls;
  }

  if (payload.extraInputValues) {
    Object.entries(payload.extraInputValues).forEach(([key, value]) => {
      if (value === undefined || value === null || key in requestBody) return;
      requestBody[key] = value;
    });
  }

  if (payload.engineId.startsWith('kling-3') && requestBody.image_url && !requestBody.start_image_url) {
    requestBody.start_image_url = requestBody.image_url;
    delete requestBody.image_url;
  }

  if (payload.engineId.startsWith('kling-3') && requestBody.multi_prompt && requestBody.prompt) {
    // Kling v3 expects prompt or multi_prompt, not both.
    delete requestBody.prompt;
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
