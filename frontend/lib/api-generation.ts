import { authFetch } from '@/lib/authFetch';
import { translateError } from '@/lib/error-messages';
import type { AudioGenerateRequestBody, AudioGenerateResponse } from '@/lib/audio-generation';
import type { GenerateAttachment } from '@/lib/fal';
import type { SoraRequest } from '@/lib/sora';
import type { PreflightRequest, PreflightResponse } from '@/types/engines';
import type { PricingSnapshot } from '@maxvideoai/pricing';
import type { VideoAsset } from '@/types/render';
import type { CharacterBuilderRequest, CharacterBuilderResponse } from '@/types/character-builder';
import type { ImageGenerationRequest, ImageGenerationResponse } from '@/types/image-generation';
import type { AngleToolRequest, AngleToolResponse } from '@/types/tools-angle';
import type {
  BackgroundRemovalRealtimeSessionRequest,
  BackgroundRemovalRealtimeSessionResponse,
  BackgroundRemovalToolRequest,
  BackgroundRemovalToolResponse,
} from '@/types/tools-background-removal';
import type { UpscaleToolRequest, UpscaleToolResponse } from '@/types/tools-upscale';

type PrimitiveValue = string | number | boolean | null | undefined;

type GeneratePayload = {
  engineId: string;
  prompt: string;
  durationSec?: number;
  durationOption?: number | string | null;
  numFrames?: number | null;
  aspectRatio?: string;
  resolution?: string;
  fps?: number;
  mode: string;
  audio?: boolean;
  cfgScale?: number | null;
  membershipTier?: string;
  payment?: { mode?: string | null; paymentIntentId?: string | null } | null;
  negativePrompt?: string;
  inputs?: GenerateAttachment[] | undefined;
  idempotencyKey?: string;
  apiKey?: string;
  audioUrl?: string;
  batchId?: string | null;
  groupId?: string | null;
  iterationIndex?: number | null;
  iterationCount?: number | null;
  renderIds?: string[] | null;
  renderThumbUrls?: string[] | null;
  heroRenderId?: string | null;
  localKey?: string | null;
  message?: string | null;
  etaSeconds?: number | null;
  etaLabel?: string | null;
  soraRequest?: SoraRequest;
  visibility?: 'public' | 'private';
  allowIndex?: boolean;
  indexable?: boolean;
  loop?: boolean;
  multiPrompt?: Array<{ prompt: string; duration: number }>;
  shotType?: 'customize' | 'intelligent';
  voiceIds?: string[];
  voiceControl?: boolean;
  elements?: Array<{ frontalImageUrl?: string; referenceImageUrls?: string[]; videoUrl?: string }>;
  endImageUrl?: string;
  extraInputValues?: Record<string, unknown>;
};

type GenerateOptions = {
  token?: string;
};

type GenerateResult = {
  ok: true;
  jobId: string;
  videoUrl: string | null;
  video?: VideoAsset | null;
  thumbUrl: string | null;
  status: 'pending' | 'completed' | 'failed';
  progress: number;
  pricing?: PricingSnapshot;
  paymentStatus: string;
  provider: string;
  providerJobId: string | null;
  batchId?: string | null;
  groupId?: string | null;
  iterationIndex?: number | null;
  iterationCount?: number | null;
  renderIds?: string[] | null;
  renderThumbUrls?: string[] | null;
  heroRenderId?: string | null;
  localKey?: string | null;
  message?: string | null;
  etaSeconds?: number | null;
  etaLabel?: string | null;
};

function toPrimitive(value: unknown): PrimitiveValue {
  if (value == null) return value as null | undefined;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return undefined;
}

function toPrimitiveArray(value: unknown): PrimitiveValue[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.reduce<PrimitiveValue[]>((acc, entry) => {
    if (entry === null || entry === undefined) {
      acc.push(entry);
      return acc;
    }
    if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
      acc.push(entry);
    }
    return acc;
  }, []);
}

export async function runPreflight(payload: PreflightRequest): Promise<PreflightResponse> {
  const response = await authFetch('/api/preflight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => null)) as PreflightResponse | null;
  if (!data) {
    return {
      ok: false,
      messages: ['Unable to compute pricing'],
      error: {
        code: 'PRICING_ERROR',
        message: 'Failed to compute pricing',
      },
    };
  }
  return data;
}

export async function runGenerate(
  payload: GeneratePayload,
  options?: GenerateOptions
): Promise<GenerateResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options?.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await authFetch('/api/generate', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const body = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
    const primitiveValue = toPrimitive(payload?.value);
    const allowedValues = toPrimitiveArray(payload?.allowed);
    const translation = translateError({
      code: typeof payload?.error === 'string' ? (payload.error as string) : undefined,
      status: response.status,
      message: typeof payload?.message === 'string' ? (payload.message as string) : undefined,
      providerMessage:
        typeof payload?.providerMessage === 'string' ? (payload.providerMessage as string) : undefined,
      field: typeof payload?.field === 'string' ? (payload.field as string) : undefined,
      value: primitiveValue,
      allowed: allowedValues,
    });
    const error = new Error(translation.message);
    if (payload) {
      Object.assign(error, payload);
    }
    Object.assign(error, {
      code: translation.code,
      message: translation.message,
      originalMessage: translation.originalMessage ?? (typeof payload?.message === 'string' ? payload.message : undefined),
      providerMessage:
        typeof payload?.providerMessage === 'string' ? (payload.providerMessage as string) : undefined,
      field: typeof payload?.field === 'string' ? (payload.field as string) : undefined,
      allowed: allowedValues,
      value: primitiveValue,
      details: payload,
      status: response.status,
    });
    throw error;
  }

  if (!body || typeof body !== 'object') {
    throw new Error('Generation response malformed');
  }

  return body as GenerateResult;
}

export async function runImageGeneration(payload: ImageGenerationRequest): Promise<ImageGenerationResponse> {
  const response = await authFetch('/api/images/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => null)) as ImageGenerationResponse | null;
  if (!data) {
    throw new Error('Image generation response malformed');
  }
  if (!response.ok || !data.ok) {
    const error = new Error(data.error?.message ?? `Image generation failed (${response.status})`);
    Object.assign(error, {
      code: data.error?.code ?? 'image_generation_failed',
      detail: data.error?.detail,
      status: response.status,
    });
    throw error;
  }
  return data;
}

export async function runAudioGenerate(payload: AudioGenerateRequestBody): Promise<AudioGenerateResponse> {
  const response = await authFetch('/api/audio/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => null)) as
    | (AudioGenerateResponse & { error?: string; message?: string; field?: string; providerFailures?: unknown })
    | null;

  if (!data) {
    throw new Error('Audio generation response malformed');
  }

  if (!response.ok || !data.ok) {
    const error = new Error(data.message ?? `Audio generation failed (${response.status})`);
    Object.assign(error, {
      code: data.error ?? 'audio_generation_failed',
      field: data.field,
      providerFailures: data.providerFailures,
      status: response.status,
    });
    throw error;
  }

  return data;
}

export async function runCharacterBuilderTool(payload: CharacterBuilderRequest): Promise<CharacterBuilderResponse> {
  const response = await authFetch('/api/tools/character-builder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => null)) as CharacterBuilderResponse | null;
  if (!data) {
    throw new Error('Character builder response malformed');
  }
  if (!response.ok || !data.ok) {
    const error = new Error(data.error?.message ?? `Character builder failed (${response.status})`);
    Object.assign(error, {
      code: data.error?.code ?? 'character_builder_failed',
      detail: data.error?.detail,
      status: response.status,
    });
    throw error;
  }
  return data;
}

export async function runAngleTool(payload: AngleToolRequest): Promise<AngleToolResponse> {
  const response = await authFetch('/api/tools/angle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => null)) as
    | (AngleToolResponse & { error?: { code?: string; message?: string; detail?: unknown } })
    | null;

  if (!data) {
    throw new Error('Angle tool response malformed');
  }

  if (!response.ok || !data.ok) {
    const error = new Error(data.error?.message ?? `Angle tool failed (${response.status})`);
    Object.assign(error, {
      code: data.error?.code ?? 'angle_tool_failed',
      detail: data.error?.detail,
      status: response.status,
    });
    throw error;
  }

  return data;
}

export async function runUpscaleTool(payload: UpscaleToolRequest): Promise<UpscaleToolResponse> {
  const response = await authFetch(`/api/tools/upscale/${payload.mediaType}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => null)) as
    | (UpscaleToolResponse & { error?: { code?: string; message?: string; detail?: unknown } })
    | null;

  if (!data) {
    throw new Error('Upscale tool response malformed');
  }

  if (!response.ok || !data.ok) {
    const error = new Error(data.error?.message ?? `Upscale tool failed (${response.status})`);
    Object.assign(error, {
      code: data.error?.code ?? 'upscale_tool_failed',
      detail: data.error?.detail,
      status: response.status,
    });
    throw error;
  }

  return data;
}

export async function runBackgroundRemovalTool(
  payload: BackgroundRemovalToolRequest
): Promise<BackgroundRemovalToolResponse> {
  const response = await authFetch('/api/tools/background-removal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => null)) as
    | (BackgroundRemovalToolResponse & { error?: { code?: string; message?: string; detail?: unknown } })
    | null;

  if (!data) {
    throw new Error('Background removal response malformed');
  }

  if (!response.ok || !data.ok) {
    const error = new Error(data.error?.message ?? `Background removal failed (${response.status})`);
    Object.assign(error, {
      code: data.error?.code ?? 'background_removal_failed',
      detail: data.error?.detail,
      status: response.status,
    });
    throw error;
  }

  return data;
}

export async function startBackgroundRemovalRealtimeSession(
  payload: BackgroundRemovalRealtimeSessionRequest
): Promise<BackgroundRemovalRealtimeSessionResponse> {
  const response = await authFetch('/api/tools/background-removal/realtime-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => null)) as
    | (BackgroundRemovalRealtimeSessionResponse & { error?: { code?: string; message?: string; detail?: unknown } })
    | null;

  if (!data) {
    throw new Error('Realtime background removal session response malformed');
  }

  if (!response.ok || !data.ok) {
    const error = new Error(data.error?.message ?? `Realtime session failed (${response.status})`);
    Object.assign(error, {
      code: data.error?.code ?? 'background_removal_realtime_failed',
      detail: data.error?.detail,
      status: response.status,
    });
    throw error;
  }

  return data;
}
