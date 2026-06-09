import { ENV } from '@/lib/env';
import { LUMA_AGENTS_PROVIDER } from '@/lib/luma-agents';
import type { GptImage2ImageSize } from '@/lib/image/gptImage2';
import type { EngineCaps } from '@/types/engines';
import type { ImageGenerationMode, GeneratedImage } from '@/types/image-generation';
import {
  createSignedDownloadUrl,
  extractStorageKeyFromUrl,
  isStorageConfigured,
} from '@/server/storage';
import { getResultProviderMode } from '@/lib/result-provider';
import { ImageGenerationExecutionError } from './image-generation-error';
import {
  buildLumaAgentsImagePayload,
  type LumaAgentsImagePayload,
} from './luma-agents-payload';
import {
  LumaAgentsImageClient,
  getLumaAgentsImageClient,
} from './luma-agents-client';
import {
  classifyLumaAgentsImageError,
  shouldFallbackFromLumaAgentsImageSubmit,
} from './luma-agents-error';
import type { NormalizedLumaAgentsImageGeneration } from './luma-agents-response';
import { runFalImageGeneration } from './image-fal-generation';
import { copyGeneratedImagesToStorage as copyGeneratedImagesToStorageDefault } from './image-output-storage';

const SIGNED_REFERENCE_URL_TTL_SECONDS = 60 * 60;
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_SYNC_TIMEOUT_MS = 180_000;
const MIN_POLL_INTERVAL_MS = 2_000;
const MAX_POLL_INTERVAL_MS = 5_000;

export type LumaAgentsImageExecutionResult = {
  result: { data?: unknown; requestId?: string | null };
  providerJobId: string | null;
  providerMode: string;
};

type FalRunner = typeof runFalImageGeneration;
type CopyGeneratedImagesToStorage = typeof copyGeneratedImagesToStorageDefault;

type LumaAgentsImageClientLike = Pick<LumaAgentsImageClient, 'createGeneration' | 'getGeneration'>;

export type ExecuteLumaAgentsImageGenerationParams = {
  falModelId: string;
  effectivePrompt: string;
  numImages: number;
  mode: ImageGenerationMode;
  combinedImageUrls: string[];
  falAspectRatio: string | null;
  providerImageSize: string | GptImage2ImageSize | null;
  resolutionEngineParam: string | null | undefined;
  normalizedSeed: number | null;
  outputFormat: string | null;
  quality: string | null;
  maskUrl: string | null;
  enableWebSearch: boolean;
  thinkingLevel: string | null;
  limitGenerations: boolean;
  engine: Pick<EngineCaps, 'id' | 'label'>;
  engineEntry: {
    id: string;
    marketingName: string;
  };
  jobId: string;
  userId: string;
  requestId?: string | null;
  style?: string | null;
  fallbackToFalEnabled?: boolean;
  pollIntervalMs?: number;
  syncTimeoutMs?: number;
  client?: LumaAgentsImageClientLike;
  runFalImageGeneration?: FalRunner;
  copyGeneratedImagesToStorage?: CopyGeneratedImagesToStorage;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  signReferenceUrls?: (urls: string[]) => Promise<string[]>;
  onProviderJobId?: (providerJobId: string) => void;
  onProviderMode?: (providerMode: string) => void;
};

type ExecuteImageProviderWithOptionalLumaDirectParams = ExecuteLumaAgentsImageGenerationParams & {
  useLumaDirect: boolean;
};

function flagEnabled(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes((value ?? '').trim().toLowerCase());
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function clampPollInterval(value: number): number {
  return Math.min(MAX_POLL_INTERVAL_MS, Math.max(MIN_POLL_INTERVAL_MS, Math.trunc(value)));
}

export function lumaAgentsImageDirectEnabled(): boolean {
  return flagEnabled(ENV.LUMA_AGENTS_IMAGE_DIRECT_ENABLED);
}

function lumaAgentsFallbackToFalEnabled(): boolean {
  return flagEnabled(ENV.LUMA_AGENTS_FALLBACK_TO_FAL_ENABLED);
}

function resolvePollInterval(params: ExecuteLumaAgentsImageGenerationParams): number {
  if (typeof params.pollIntervalMs === 'number' && Number.isFinite(params.pollIntervalMs) && params.pollIntervalMs > 0) {
    return Math.trunc(params.pollIntervalMs);
  }
  return clampPollInterval(positiveInt(ENV.LUMA_AGENTS_POLL_INTERVAL_MS, DEFAULT_POLL_INTERVAL_MS));
}

function resolveSyncTimeout(params: ExecuteLumaAgentsImageGenerationParams): number {
  if (typeof params.syncTimeoutMs === 'number' && Number.isFinite(params.syncTimeoutMs) && params.syncTimeoutMs > 0) {
    return Math.trunc(params.syncTimeoutMs);
  }
  return positiveInt(ENV.LUMA_AGENTS_IMAGE_SYNC_TIMEOUT_MS, DEFAULT_SYNC_TIMEOUT_MS);
}

async function defaultSleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function signLumaImageReferenceUrls(urls: string[]): Promise<string[]> {
  return Promise.all(
    urls.map(async (url) => {
      const key = extractStorageKeyFromUrl(url);
      if (!key || !isStorageConfigured()) return url;
      try {
        return await createSignedDownloadUrl(key, {
          expiresInSeconds: SIGNED_REFERENCE_URL_TTL_SECONDS,
        });
      } catch (error) {
        console.warn('[images] failed to sign Luma Agents image reference URL', error);
        return url;
      }
    })
  );
}

function buildPayloadFromPreparedValues(params: ExecuteLumaAgentsImageGenerationParams, signedImageUrls: string[]): LumaAgentsImagePayload {
  const [sourceImageUrl, ...editReferenceUrls] = signedImageUrls;
  return buildLumaAgentsImagePayload({
    engineId: params.engine.id,
    mode: params.mode,
    prompt: params.effectivePrompt,
    aspectRatio: params.mode === 't2i' ? params.falAspectRatio : null,
    style: params.style ?? null,
    outputFormat: params.outputFormat,
    webSearch: params.mode === 't2i' && params.enableWebSearch,
    sourceImageUrl: params.mode === 'i2i' ? sourceImageUrl ?? null : null,
    referenceImageUrls: params.mode === 'i2i' ? editReferenceUrls : signedImageUrls,
  });
}

async function runFalFallback(params: ExecuteLumaAgentsImageGenerationParams): Promise<LumaAgentsImageExecutionResult> {
  const providerMode = getResultProviderMode();
  params.onProviderMode?.(providerMode);
  const falResult = await (params.runFalImageGeneration ?? runFalImageGeneration)({
    falModelId: params.falModelId,
    effectivePrompt: params.effectivePrompt,
    numImages: params.numImages,
    mode: params.mode,
    combinedImageUrls: params.combinedImageUrls,
    falAspectRatio: params.falAspectRatio,
    providerImageSize: params.providerImageSize,
    resolutionEngineParam: params.resolutionEngineParam,
    normalizedSeed: params.normalizedSeed,
    outputFormat: params.outputFormat,
    quality: params.quality,
    style: params.style,
    maskUrl: params.maskUrl,
    enableWebSearch: params.enableWebSearch,
    thinkingLevel: params.thinkingLevel,
    limitGenerations: params.limitGenerations,
    onProviderJobId: params.onProviderJobId,
  });
  return {
    ...falResult,
    providerMode,
  };
}

function terminalFailure(params: {
  mode: ImageGenerationMode;
  task: NormalizedLumaAgentsImageGeneration;
  providerJobId: string;
}): never {
  throw new ImageGenerationExecutionError(
    params.task.message ?? 'Luma Agents image generation failed.',
    {
      mode: params.mode,
      code: 'luma_agents_image_failed',
      status: 502,
      detail: params.task.raw,
      extras: {
        providerJobId: params.providerJobId,
        requestId: params.providerJobId,
      },
    }
  );
}

function terminalTimeout(params: {
  mode: ImageGenerationMode;
  providerJobId: string;
  timeoutMs: number;
}): never {
  throw new ImageGenerationExecutionError('Luma Agents image generation timed out.', {
    mode: params.mode,
    code: 'luma_agents_image_timeout',
    status: 504,
    detail: {
      providerJobId: params.providerJobId,
      timeoutMs: params.timeoutMs,
    },
    extras: {
      providerJobId: params.providerJobId,
      requestId: params.providerJobId,
    },
  });
}

function normalizePollError(params: {
  mode: ImageGenerationMode;
  providerJobId: string;
  error: unknown;
}): never {
  const normalized = classifyLumaAgentsImageError(params.error);
  throw new ImageGenerationExecutionError(normalized.message, {
    mode: params.mode,
    code: 'luma_agents_image_poll_error',
    status: normalized.status ?? 502,
    detail: normalized.raw,
    extras: {
      providerJobId: params.providerJobId,
      requestId: params.providerJobId,
    },
  });
}

function assertStableLumaImageCopies(params: {
  originalImages: GeneratedImage[];
  copiedImages: GeneratedImage[];
  mode: ImageGenerationMode;
  providerJobId: string;
}): void {
  const failedIndex = params.originalImages.findIndex((_original, index) => {
    const copied = params.copiedImages[index];
    return !copied?.url || !isStableMaxVideoAiImageUrl(copied.url);
  });

  if (failedIndex >= 0) {
    throw new ImageGenerationExecutionError('Luma Agents image output was not copied to stable storage.', {
      mode: params.mode,
      code: 'luma_agents_image_copy_unstable',
      status: 502,
      detail: {
        providerJobId: params.providerJobId,
        failedIndex,
        originalUrl: params.originalImages[failedIndex]?.url ?? null,
        copiedUrl: params.copiedImages[failedIndex]?.url ?? null,
      },
      extras: {
        providerJobId: params.providerJobId,
        requestId: params.providerJobId,
      },
    });
  }
}

function isStableMaxVideoAiImageUrl(url: string): boolean {
  if (extractStorageKeyFromUrl(url)) return true;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.replace(/^\/+/, '');
    return (
      (host === 'media.maxvideoai.com' || host === 'cdn.maxvideoai.com') &&
      path.startsWith('renders/images/')
    );
  } catch {
    return false;
  }
}

async function waitForCompletedGeneration(params: {
  client: LumaAgentsImageClientLike;
  initialTask: NormalizedLumaAgentsImageGeneration;
  providerJobId: string;
  mode: ImageGenerationMode;
  pollIntervalMs: number;
  syncTimeoutMs: number;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}): Promise<NormalizedLumaAgentsImageGeneration> {
  let task = params.initialTask;
  const deadline = params.now() + params.syncTimeoutMs;
  for (;;) {
    if (task.status === 'completed') return task;
    if (task.status === 'failed') {
      terminalFailure({
        mode: params.mode,
        task,
        providerJobId: params.providerJobId,
      });
    }
    if (params.now() >= deadline) {
      terminalTimeout({
        mode: params.mode,
        providerJobId: params.providerJobId,
        timeoutMs: params.syncTimeoutMs,
      });
    }
    await params.sleep(Math.min(params.pollIntervalMs, Math.max(0, deadline - params.now())));
    if (params.now() >= deadline) {
      terminalTimeout({
        mode: params.mode,
        providerJobId: params.providerJobId,
        timeoutMs: params.syncTimeoutMs,
      });
    }
    try {
      task = await params.client.getGeneration(params.providerJobId);
    } catch (error) {
      normalizePollError({
        mode: params.mode,
        providerJobId: params.providerJobId,
        error,
      });
    }
  }
}

export async function executeLumaAgentsImageGenerationWithFalFallback(
  params: ExecuteLumaAgentsImageGenerationParams
): Promise<LumaAgentsImageExecutionResult> {
  const signReferenceUrls = params.signReferenceUrls ?? signLumaImageReferenceUrls;
  const signedImageUrls = await signReferenceUrls(params.combinedImageUrls);
  const payload = buildPayloadFromPreparedValues(params, signedImageUrls);
  const client = params.client ?? getLumaAgentsImageClient();
  const fallbackToFalEnabled = params.fallbackToFalEnabled ?? lumaAgentsFallbackToFalEnabled();
  let acceptedProviderJobId: string | null = null;

  params.onProviderMode?.(LUMA_AGENTS_PROVIDER);
  let created: NormalizedLumaAgentsImageGeneration;
  try {
    created = await client.createGeneration(payload, {
      requestId: params.requestId ?? params.jobId,
    });
    acceptedProviderJobId = created.providerJobId;
    params.onProviderJobId?.(acceptedProviderJobId);
  } catch (error) {
    if (
      shouldFallbackFromLumaAgentsImageSubmit({
        acceptedProviderJobId,
        error,
        fallbackToFalEnabled,
      })
    ) {
      return runFalFallback(params);
    }
    throw error;
  }

  const completed = await waitForCompletedGeneration({
    client,
    initialTask: created,
    providerJobId: acceptedProviderJobId,
    mode: params.mode,
    pollIntervalMs: resolvePollInterval(params),
    syncTimeoutMs: resolveSyncTimeout(params),
    sleep: params.sleep ?? defaultSleep,
    now: params.now ?? Date.now,
  });

  if (!completed.images.length) {
    throw new ImageGenerationExecutionError('Luma Agents image generation completed without image outputs.', {
      mode: params.mode,
      code: 'luma_agents_image_empty_response',
      status: 502,
      detail: completed.raw,
      extras: {
        providerJobId: acceptedProviderJobId,
        requestId: acceptedProviderJobId,
      },
    });
  }

  const copiedImages: GeneratedImage[] = await (params.copyGeneratedImagesToStorage ?? copyGeneratedImagesToStorageDefault)({
    images: completed.images,
    jobId: params.jobId,
    userId: params.userId,
  });
  assertStableLumaImageCopies({
    originalImages: completed.images,
    copiedImages,
    mode: params.mode,
    providerJobId: acceptedProviderJobId,
  });

  return {
    result: {
      requestId: acceptedProviderJobId,
      data: {
        images: copiedImages,
        id: acceptedProviderJobId,
        request_id: acceptedProviderJobId,
        provider: LUMA_AGENTS_PROVIDER,
        raw: completed.raw,
      },
    },
    providerJobId: acceptedProviderJobId,
    providerMode: LUMA_AGENTS_PROVIDER,
  };
}

export async function executeImageProviderWithLumaAgentsDirectFallback(
  params: ExecuteImageProviderWithOptionalLumaDirectParams
): Promise<LumaAgentsImageExecutionResult> {
  if (params.useLumaDirect) {
    return executeLumaAgentsImageGenerationWithFalFallback(params);
  }
  return runFalFallback(params);
}
