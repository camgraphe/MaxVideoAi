import { ENV } from '@/lib/env';
import type { NormalizedVideoProviderTask, NormalizedVideoProviderUsage } from '@/server/video-providers/types';

export const BYTEPLUS_MODELARK_PROVIDER = 'byteplus_modelark';
export const PUBLIC_SEEDANCE_FAST_ENGINE_ID = 'seedance-2-0-fast';
export const BYTEPLUS_SEEDANCE_FAST_ENGINE_ID = 'seedance-2-0-fast-byteplus';
export const BYTEPLUS_SEEDANCE_FAST_DEFAULT_MODEL_ID = 'dreamina-seedance-2-0-fast-260128';
export const BYTEPLUS_SEEDANCE_FAST_DEFAULT_BASE_URL = 'https://ark.ap-southeast.bytepluses.com/api/v3';

type BytePlusContentItem =
  | { type: 'text'; text: string }
  | {
      type: 'image_url';
      image_url: { url: string };
      role: 'reference_image';
    };

export type BytePlusSeedanceFastPayload = {
  model: string;
  content: BytePlusContentItem[];
  resolution: '720p';
  ratio: '16:9';
  duration: number;
  generate_audio: boolean;
  watermark: false;
};

type BytePlusTaskResponse = Record<string, unknown>;

export class BytePlusModelArkError extends Error {
  status: number | null;
  code: string | null;
  providerMessage: string | null;

  constructor(message: string, options: { status?: number | null; code?: string | null; providerMessage?: string | null } = {}) {
    super(message);
    this.name = 'BytePlusModelArkError';
    this.status = options.status ?? null;
    this.code = options.code ?? null;
    this.providerMessage = options.providerMessage ?? null;
  }
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function envFlagEnabled(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes((value ?? '').trim().toLowerCase());
}

function splitCsvEnv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isBytePlusModelArkEnabled(): boolean {
  return envFlagEnabled(ENV.BYTEPLUS_ARK_ENABLED);
}

export function isBytePlusSeedanceFastEngine(engineId: string | null | undefined): boolean {
  return engineId === BYTEPLUS_SEEDANCE_FAST_ENGINE_ID;
}

export function isPublicSeedanceFastEngine(engineId: string | null | undefined): boolean {
  return engineId === PUBLIC_SEEDANCE_FAST_ENGINE_ID;
}

export function seedanceFastProviderOverride(): 'fal' | 'byteplus_modelark' {
  return ENV.SEEDANCE_FAST_PROVIDER?.trim().toLowerCase() === BYTEPLUS_MODELARK_PROVIDER
    ? BYTEPLUS_MODELARK_PROVIDER
    : 'fal';
}

export function shouldRoutePublicSeedanceFastToBytePlus(engineId: string | null | undefined): boolean {
  return isPublicSeedanceFastEngine(engineId) && seedanceFastProviderOverride() === BYTEPLUS_MODELARK_PROVIDER;
}

export function seedanceFastBytePlusAdminOnly(): boolean {
  return envFlagEnabled(ENV.SEEDANCE_FAST_BYTEPLUS_ADMIN_ONLY ?? 'true');
}

export function isSeedanceFastBytePlusModeAllowed(mode: string | null | undefined): boolean {
  const allowedModes = splitCsvEnv(ENV.SEEDANCE_FAST_BYTEPLUS_MODES);
  return allowedModes.length ? allowedModes.includes((mode ?? '').trim().toLowerCase()) : false;
}

export function getBytePlusArkConfig() {
  return {
    apiKey: ENV.BYTEPLUS_ARK_API_KEY,
    region: ENV.BYTEPLUS_ARK_REGION ?? 'ap-southeast-1',
    baseUrl: trimTrailingSlash(ENV.BYTEPLUS_ARK_BASE_URL ?? BYTEPLUS_SEEDANCE_FAST_DEFAULT_BASE_URL),
    seedanceFastModelId: ENV.BYTEPLUS_ARK_SEEDANCE_FAST_MODEL_ID ?? BYTEPLUS_SEEDANCE_FAST_DEFAULT_MODEL_ID,
  };
}

export function buildBytePlusSeedanceFastPayload(params: {
  modelId: string;
  prompt: string;
  durationSec: number;
  mode?: 't2v' | 'i2v';
  imageUrl?: string | null;
  endImageUrl?: string | null;
  generateAudio?: boolean;
}): BytePlusSeedanceFastPayload {
  const prompt = params.prompt.trim();
  const duration = Math.trunc(params.durationSec);
  const mode = params.mode ?? 't2v';
  const imageUrl = typeof params.imageUrl === 'string' ? params.imageUrl.trim() : '';
  const endImageUrl = typeof params.endImageUrl === 'string' ? params.endImageUrl.trim() : '';
  if (!prompt) {
    throw new BytePlusModelArkError('Prompt is required for BytePlus Seedance Fast.', { code: 'PROMPT_REQUIRED' });
  }
  if (mode !== 't2v' && mode !== 'i2v') {
    throw new BytePlusModelArkError('BytePlus Seedance Fast V1b supports only T2V and I2V.', {
      code: 'BYTEPLUS_MODE_UNSUPPORTED',
    });
  }
  if (mode === 'i2v' && !imageUrl) {
    throw new BytePlusModelArkError('Image URL is required for BytePlus Seedance Fast image-to-video.', {
      code: 'IMAGE_URL_REQUIRED',
    });
  }
  if (!Number.isFinite(duration) || duration < 5 || duration > 15) {
    throw new BytePlusModelArkError('BytePlus Seedance Fast V1a duration must be between 5 and 15 seconds.', {
      code: 'BYTEPLUS_DURATION_UNSUPPORTED',
    });
  }
  if (!params.modelId.trim()) {
    throw new BytePlusModelArkError('BytePlus Seedance Fast model id is not configured.', {
      code: 'BYTEPLUS_MODEL_MISSING',
    });
  }

  const text =
    mode === 'i2v' && endImageUrl
      ? `Use Image 1 as the opening frame and Image 2 as the final frame. ${prompt}`
      : mode === 'i2v'
        ? `Use Image 1 as the opening frame. ${prompt}`
        : prompt;
  const content: BytePlusContentItem[] = [{ type: 'text', text }];
  if (mode === 'i2v') {
    content.push({
      type: 'image_url',
      image_url: { url: imageUrl },
      role: 'reference_image',
    });
    if (endImageUrl) {
      content.push({
        type: 'image_url',
        image_url: { url: endImageUrl },
        role: 'reference_image',
      });
    }
  }

  return {
    model: params.modelId.trim(),
    content,
    resolution: '720p',
    ratio: '16:9',
    duration,
    generate_audio: params.generateAudio === true,
    watermark: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function firstString(value: unknown, keys: string[]): string | null {
  if (!isRecord(value)) return null;
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim().length) {
      return candidate.trim();
    }
  }
  return null;
}

function firstRecord(value: unknown, keys: string[]): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  for (const key of keys) {
    const candidate = value[key];
    if (isRecord(candidate)) return candidate;
  }
  return null;
}

function extractUsage(value: unknown): NormalizedVideoProviderUsage | null {
  const content = firstRecord(value, ['content', 'result', 'output', 'data']);
  const usage = firstRecord(value, ['usage']) ?? firstRecord(content, ['usage']);
  if (!usage) return null;
  const totalRaw = usage.total_tokens ?? usage.totalTokens;
  const completionRaw = usage.completion_tokens ?? usage.completionTokens;
  const totalTokens = typeof totalRaw === 'number' && Number.isFinite(totalRaw) ? totalRaw : null;
  const completionTokens = typeof completionRaw === 'number' && Number.isFinite(completionRaw) ? completionRaw : null;
  return totalTokens == null && completionTokens == null ? null : { totalTokens, completionTokens };
}

function extractVideoUrl(value: unknown): string | null {
  const content = firstRecord(value, ['content', 'result', 'output', 'data']);
  const direct = firstString(value, ['video_url', 'videoUrl', 'url']);
  if (direct) return direct;
  const contentDirect = firstString(content, ['video_url', 'videoUrl', 'url']);
  if (contentDirect) return contentDirect;
  const video = firstRecord(content, ['video']) ?? firstRecord(value, ['video']);
  return firstString(video, ['url', 'video_url', 'videoUrl']);
}

function extractErrorMessage(value: unknown): string | null {
  const error = firstRecord(value, ['error']);
  return (
    firstString(error, ['message', 'msg', 'detail']) ??
    firstString(value, ['message', 'error_message', 'errorMessage']) ??
    null
  );
}

export function normalizeBytePlusTask(task: unknown): NormalizedVideoProviderTask {
  const root = firstRecord(task, ['data', 'task']) ?? task;
  const providerJobId = firstString(root, ['id', 'task_id', 'taskId']) ?? '';
  const rawStatus = firstString(root, ['status', 'state'])?.toLowerCase() ?? null;
  const status =
    rawStatus === 'succeeded' || rawStatus === 'success'
      ? 'completed'
      : rawStatus === 'failed' || rawStatus === 'expired' || rawStatus === 'cancelled' || rawStatus === 'canceled'
        ? 'failed'
        : rawStatus === 'running' || rawStatus === 'processing' || rawStatus === 'in_progress'
          ? 'running'
          : 'queued';

  return {
    providerJobId,
    status,
    rawStatus,
    videoUrl: extractVideoUrl(root) ?? extractVideoUrl(task),
    message: extractErrorMessage(root) ?? extractErrorMessage(task),
    usage: extractUsage(root) ?? extractUsage(task),
    raw: task,
  };
}

export function scrubBytePlusError(error: unknown): string {
  const nestedError = isRecord(error) && isRecord(error.error) ? error.error : null;
  const raw =
    error instanceof Error
      ? error.message
      : isRecord(error) && typeof error.message === 'string'
        ? error.message
        : nestedError && typeof nestedError.message === 'string'
          ? nestedError.message
        : typeof error === 'string'
          ? error
          : 'BytePlus ModelArk request failed.';
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/ark-[A-Za-z0-9._~+/=-]+/gi, '[redacted-api-key]')
    .replace(/([?&](?:X-Amz-Signature|Signature|Expires|X-Amz-Credential)=)[^&\s]+/gi, '$1[redacted]');
}

export function getBytePlusUserSafeErrorMessage(providerMessage: string): string {
  const normalized = providerMessage.toLowerCase();
  if (
    normalized.includes('real person') ||
    normalized.includes('private information') ||
    normalized.includes('sensitive') ||
    normalized.includes('policy')
  ) {
    return 'BytePlus rejected one of the input images. Try an image without identifiable people or private content.';
  }
  return 'BytePlus could not start this render. Please retry later.';
}

async function parseJsonResponse(response: Response): Promise<BytePlusTaskResponse> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text);
    return isRecord(parsed) ? parsed : { value: parsed };
  } catch {
    return { message: text };
  }
}

export class BytePlusModelArkClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(params: { apiKey: string; baseUrl: string }) {
    this.apiKey = params.apiKey;
    this.baseUrl = trimTrailingSlash(params.baseUrl);
  }

  async createSeedanceFastTask(payload: BytePlusSeedanceFastPayload): Promise<NormalizedVideoProviderTask> {
    const response = await fetch(`${this.baseUrl}/contents/generations/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    const parsed = await parseJsonResponse(response);
    if (!response.ok) {
      throw new BytePlusModelArkError(scrubBytePlusError(parsed), {
        status: response.status,
        code: firstString(parsed, ['code', 'error_code']) ?? null,
        providerMessage: scrubBytePlusError(parsed),
      });
    }
    const normalized = normalizeBytePlusTask(parsed);
    if (!normalized.providerJobId) {
      throw new BytePlusModelArkError('BytePlus task response did not include a task id.', {
        status: response.status,
        code: 'BYTEPLUS_TASK_ID_MISSING',
      });
    }
    return normalized;
  }

  async retrieveTask(taskId: string): Promise<NormalizedVideoProviderTask> {
    const response = await fetch(`${this.baseUrl}/contents/generations/tasks/${encodeURIComponent(taskId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      cache: 'no-store',
    });
    const parsed = await parseJsonResponse(response);
    if (!response.ok) {
      throw new BytePlusModelArkError(scrubBytePlusError(parsed), {
        status: response.status,
        code: firstString(parsed, ['code', 'error_code']) ?? null,
        providerMessage: scrubBytePlusError(parsed),
      });
    }
    const normalized = normalizeBytePlusTask(parsed);
    return normalized.providerJobId ? normalized : { ...normalized, providerJobId: taskId };
  }

  async deleteTask(taskId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/contents/generations/tasks/${encodeURIComponent(taskId)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      cache: 'no-store',
    });
    if (!response.ok) {
      const parsed = await parseJsonResponse(response);
      throw new BytePlusModelArkError(scrubBytePlusError(parsed), {
        status: response.status,
        code: firstString(parsed, ['code', 'error_code']) ?? null,
        providerMessage: scrubBytePlusError(parsed),
      });
    }
  }
}

export function getBytePlusModelArkClient(): BytePlusModelArkClient {
  const config = getBytePlusArkConfig();
  if (!config.apiKey) {
    throw new BytePlusModelArkError('BytePlus ModelArk API key is not configured.', {
      code: 'BYTEPLUS_API_KEY_MISSING',
    });
  }
  return new BytePlusModelArkClient({ apiKey: config.apiKey, baseUrl: config.baseUrl });
}
