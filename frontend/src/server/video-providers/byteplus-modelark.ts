import { ENV } from '@/lib/env';
import type { NormalizedVideoProviderTask, NormalizedVideoProviderUsage } from '@/server/video-providers/types';
import type { AspectRatio, EngineCaps, EngineInputField, Mode, Resolution } from '@/types/engines';

export const BYTEPLUS_MODELARK_PROVIDER = 'byteplus_modelark';
export const PUBLIC_SEEDANCE_ENGINE_ID = 'seedance-2-0';
export const PUBLIC_SEEDANCE_FAST_ENGINE_ID = 'seedance-2-0-fast';
export const BYTEPLUS_SEEDANCE_FAST_ENGINE_ID = 'seedance-2-0-fast-byteplus';
export const BYTEPLUS_SEEDANCE_DEFAULT_MODEL_ID = 'dreamina-seedance-2-0-260128';
export const BYTEPLUS_SEEDANCE_FAST_DEFAULT_MODEL_ID = 'dreamina-seedance-2-0-fast-260128';
export const BYTEPLUS_SEEDANCE_FAST_DEFAULT_BASE_URL = 'https://ark.ap-southeast.bytepluses.com/api/v3';
export const BYTEPLUS_SEEDANCE_MODES: Mode[] = ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'];
export const BYTEPLUS_SEEDANCE_RESOLUTIONS: Resolution[] = ['480p', '720p', '1080p'];
export const BYTEPLUS_SEEDANCE_FAST_RESOLUTIONS: Resolution[] = ['480p', '720p'];
export const BYTEPLUS_SEEDANCE_ASPECT_RATIOS: AspectRatio[] = ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'];
export const BYTEPLUS_SEEDANCE_DURATION_OPTIONS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const;

type BytePlusContentItem =
  | { type: 'text'; text: string }
  | {
      type: 'image_url';
      image_url: { url: string };
      role: 'reference_image';
    }
  | {
      type: 'video_url';
      video_url: { url: string };
      role: 'reference_video';
    }
  | {
      type: 'audio_url';
      audio_url: { url: string };
      role: 'reference_audio';
    };

export type BytePlusSeedanceFastPayload = {
  model: string;
  content: BytePlusContentItem[];
  resolution: '480p' | '720p' | '1080p';
  ratio: '21:9' | '16:9' | '4:3' | '1:1' | '3:4' | '9:16';
  duration: number;
  generate_audio: boolean;
  watermark: false;
};

export type BytePlusSeedancePayload = BytePlusSeedanceFastPayload;

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

function uniqueNonEmptyUrls(values: Array<string | null | undefined> | undefined): string[] {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean)
    )
  );
}

function allowedBytePlusModes(value: string | undefined): Mode[] {
  const configured = splitCsvEnv(value);
  const modes = configured.filter((mode): mode is Mode => BYTEPLUS_SEEDANCE_MODES.includes(mode as Mode));
  return modes.length ? modes : ['t2v'];
}

function expandBytePlusFieldModes(field: EngineInputField): EngineInputField {
  if (field.id === 'image_urls') {
    return {
      ...field,
      label: 'Reference images (up to 9)',
      description: 'Optional BytePlus visual references for Reference to Video or Video Edit.',
      modes: ['ref2v', 'v2v'],
    };
  }
  if (field.id === 'video_urls') {
    return {
      ...field,
      label: 'Reference/source videos (up to 3)',
      description: 'Use video files as BytePlus references, edit sources, or extension sources.',
      modes: ['ref2v', 'v2v', 'extend'],
    };
  }
  if (field.id === 'audio_urls') {
    return {
      ...field,
      label: 'Reference audio (up to 3)',
      description: 'Optional BytePlus audio references for pacing or soundtrack guidance.',
      modes: ['ref2v', 'v2v', 'extend'],
    };
  }
  return field;
}

function filterInputFieldsForModes(
  fields: EngineInputField[] | undefined,
  allowedModes: Mode[],
  resolutions: Resolution[]
): EngineInputField[] | undefined {
  if (!fields) return fields;
  return fields
    .map(expandBytePlusFieldModes)
    .filter((field) => !field.modes?.length || field.modes.some((mode) => allowedModes.includes(mode)))
    .map((field) => {
      if (field.id === 'resolution' && field.type === 'enum') {
        return {
          ...field,
          values: resolutions,
          default: resolutions.includes('720p') ? '720p' : resolutions[0] ?? field.default,
        };
      }
      if (field.id === 'aspect_ratio' && field.type === 'enum') {
        return {
          ...field,
          values: BYTEPLUS_SEEDANCE_ASPECT_RATIOS,
          default: '16:9',
        };
      }
      if (field.id === 'duration' && field.type === 'enum') {
        return {
          ...field,
          values: BYTEPLUS_SEEDANCE_DURATION_OPTIONS.map(String),
          default: '5',
          min: 5,
          max: 15,
        };
      }
      return field;
    });
}

export function isBytePlusModelArkEnabled(): boolean {
  return envFlagEnabled(ENV.BYTEPLUS_ARK_ENABLED);
}

export function isBytePlusSeedanceFastEngine(engineId: string | null | undefined): boolean {
  return engineId === BYTEPLUS_SEEDANCE_FAST_ENGINE_ID;
}

export function isPublicSeedanceEngine(engineId: string | null | undefined): boolean {
  return engineId === PUBLIC_SEEDANCE_ENGINE_ID;
}

export function isPublicSeedanceFastEngine(engineId: string | null | undefined): boolean {
  return engineId === PUBLIC_SEEDANCE_FAST_ENGINE_ID;
}

export function seedanceProviderOverride(): 'fal' | 'byteplus_modelark' {
  return ENV.SEEDANCE_2_PROVIDER?.trim().toLowerCase() === BYTEPLUS_MODELARK_PROVIDER
    ? BYTEPLUS_MODELARK_PROVIDER
    : 'fal';
}

export function seedanceFastProviderOverride(): 'fal' | 'byteplus_modelark' {
  return ENV.SEEDANCE_FAST_PROVIDER?.trim().toLowerCase() === BYTEPLUS_MODELARK_PROVIDER
    ? BYTEPLUS_MODELARK_PROVIDER
    : 'fal';
}

export function shouldRoutePublicSeedanceToBytePlus(engineId: string | null | undefined): boolean {
  return isPublicSeedanceEngine(engineId) && seedanceProviderOverride() === BYTEPLUS_MODELARK_PROVIDER;
}

export function shouldRoutePublicSeedanceFastToBytePlus(engineId: string | null | undefined): boolean {
  return isPublicSeedanceFastEngine(engineId) && seedanceFastProviderOverride() === BYTEPLUS_MODELARK_PROVIDER;
}

export function seedanceBytePlusAdminOnly(): boolean {
  return envFlagEnabled(ENV.SEEDANCE_2_BYTEPLUS_ADMIN_ONLY ?? 'true');
}

export function seedanceFastBytePlusAdminOnly(): boolean {
  return envFlagEnabled(ENV.SEEDANCE_FAST_BYTEPLUS_ADMIN_ONLY ?? 'true');
}

export function isSeedanceBytePlusModeAllowed(mode: string | null | undefined): boolean {
  const allowedModes = allowedBytePlusModes(ENV.SEEDANCE_2_BYTEPLUS_MODES);
  return allowedModes.length ? allowedModes.includes((mode ?? '').trim().toLowerCase() as Mode) : false;
}

export function isSeedanceFastBytePlusModeAllowed(mode: string | null | undefined): boolean {
  const allowedModes = allowedBytePlusModes(ENV.SEEDANCE_FAST_BYTEPLUS_MODES);
  return allowedModes.length ? allowedModes.includes((mode ?? '').trim().toLowerCase() as Mode) : false;
}

export function getBytePlusSeedanceAllowedModes(engineId: string | null | undefined): Mode[] {
  if (isPublicSeedanceFastEngine(engineId) || isBytePlusSeedanceFastEngine(engineId)) {
    return allowedBytePlusModes(ENV.SEEDANCE_FAST_BYTEPLUS_MODES);
  }
  if (isPublicSeedanceEngine(engineId)) {
    return allowedBytePlusModes(ENV.SEEDANCE_2_BYTEPLUS_MODES);
  }
  return ['t2v'];
}

export function getBytePlusSeedanceAllowedResolutions(engineId: string | null | undefined): Resolution[] {
  return isPublicSeedanceEngine(engineId) ? BYTEPLUS_SEEDANCE_RESOLUTIONS : BYTEPLUS_SEEDANCE_FAST_RESOLUTIONS;
}

export function applyBytePlusSeedanceRuntimeOptions(
  engine: EngineCaps,
  options?: {
    provider?: 'fal' | 'byteplus_modelark';
    allowedModes?: Mode[];
  }
): EngineCaps {
  const provider =
    options?.provider ??
    (isPublicSeedanceEngine(engine.id)
      ? seedanceProviderOverride()
      : isPublicSeedanceFastEngine(engine.id) || isBytePlusSeedanceFastEngine(engine.id)
        ? seedanceFastProviderOverride()
        : 'fal');
  if (provider !== BYTEPLUS_MODELARK_PROVIDER) {
    return engine;
  }

  const allowedModes = (options?.allowedModes ?? getBytePlusSeedanceAllowedModes(engine.id)).filter((mode) =>
    BYTEPLUS_SEEDANCE_MODES.includes(mode)
  );
  const resolutions = getBytePlusSeedanceAllowedResolutions(engine.id);
  const baseModeCaps = engine.modeCaps ?? {};
  const modeCaps = engine.modeCaps
    ? Object.fromEntries(
        allowedModes.map((mode) => {
          const caps = baseModeCaps[mode] ?? baseModeCaps.ref2v ?? baseModeCaps.i2v ?? baseModeCaps.t2v;
          return [
            mode,
            caps
              ? {
                  ...caps,
                  modes: [mode],
                  resolution: resolutions,
                  resolutionLocked: false,
                  aspectRatio: BYTEPLUS_SEEDANCE_ASPECT_RATIOS,
                  duration: { options: [...BYTEPLUS_SEEDANCE_DURATION_OPTIONS], default: 5 },
                  audioToggle: true,
                }
              : caps,
          ];
        })
      )
    : undefined;

  return {
    ...engine,
    provider: 'BytePlus ModelArk',
    modes: allowedModes,
    maxDurationSec: 15,
    resolutions,
    aspectRatios: BYTEPLUS_SEEDANCE_ASPECT_RATIOS,
    fps: [24],
    audio: true,
    motionControls: true,
    keyframes: allowedModes.includes('i2v'),
    modeCaps,
    inputSchema: engine.inputSchema
      ? {
          ...engine.inputSchema,
          required: filterInputFieldsForModes(engine.inputSchema.required, allowedModes, resolutions),
          optional: filterInputFieldsForModes(engine.inputSchema.optional, allowedModes, resolutions),
        }
      : engine.inputSchema,
    providerMeta: {
      ...engine.providerMeta,
      provider: BYTEPLUS_MODELARK_PROVIDER,
    },
  };
}

export function getBytePlusArkConfig() {
  return {
    apiKey: ENV.BYTEPLUS_ARK_API_KEY,
    region: ENV.BYTEPLUS_ARK_REGION ?? 'ap-southeast-1',
    baseUrl: trimTrailingSlash(ENV.BYTEPLUS_ARK_BASE_URL ?? BYTEPLUS_SEEDANCE_FAST_DEFAULT_BASE_URL),
    seedanceModelId: ENV.BYTEPLUS_ARK_SEEDANCE_MODEL_ID ?? BYTEPLUS_SEEDANCE_DEFAULT_MODEL_ID,
    seedanceFastModelId: ENV.BYTEPLUS_ARK_SEEDANCE_FAST_MODEL_ID ?? BYTEPLUS_SEEDANCE_FAST_DEFAULT_MODEL_ID,
  };
}

export function buildBytePlusSeedancePayload(params: {
  modelId: string;
  prompt: string;
  durationSec: number;
  mode?: Extract<Mode, 't2v' | 'i2v' | 'ref2v' | 'v2v' | 'extend'>;
  imageUrl?: string | null;
  endImageUrl?: string | null;
  referenceImageUrls?: string[];
  referenceVideoUrls?: string[];
  referenceAudioUrls?: string[];
  resolution?: string | null;
  ratio?: string | null;
  generateAudio?: boolean;
  allowedResolutions?: Resolution[];
}): BytePlusSeedancePayload {
  const prompt = params.prompt.trim();
  const duration = Math.trunc(params.durationSec);
  const mode = params.mode ?? 't2v';
  const imageUrl = typeof params.imageUrl === 'string' ? params.imageUrl.trim() : '';
  const endImageUrl = typeof params.endImageUrl === 'string' ? params.endImageUrl.trim() : '';
  const referenceImageUrls = uniqueNonEmptyUrls(params.referenceImageUrls);
  const referenceVideoUrls = uniqueNonEmptyUrls(params.referenceVideoUrls);
  const referenceAudioUrls = uniqueNonEmptyUrls(params.referenceAudioUrls);
  const allowedResolutions = params.allowedResolutions?.length ? params.allowedResolutions : BYTEPLUS_SEEDANCE_FAST_RESOLUTIONS;
  const requestedResolution = (typeof params.resolution === 'string' && params.resolution.trim()
    ? params.resolution.trim()
    : '720p') as Resolution;
  const requestedRatio = (typeof params.ratio === 'string' && params.ratio.trim() ? params.ratio.trim() : '16:9') as AspectRatio;
  if (!prompt) {
    throw new BytePlusModelArkError('Prompt is required for BytePlus Seedance.', { code: 'PROMPT_REQUIRED' });
  }
  if (!BYTEPLUS_SEEDANCE_MODES.includes(mode)) {
    throw new BytePlusModelArkError('BytePlus Seedance supports only configured T2V, I2V, reference, video edit, and extension modes.', {
      code: 'BYTEPLUS_MODE_UNSUPPORTED',
    });
  }
  if (mode === 'i2v' && !imageUrl) {
    throw new BytePlusModelArkError('Image URL is required for BytePlus Seedance image-to-video.', {
      code: 'IMAGE_URL_REQUIRED',
    });
  }
  if (mode === 'ref2v' && referenceImageUrls.length + referenceVideoUrls.length + referenceAudioUrls.length === 0) {
    throw new BytePlusModelArkError('At least one reference image, video, or audio URL is required for BytePlus Seedance reference-to-video.', {
      code: 'REFERENCE_URL_REQUIRED',
    });
  }
  if (mode === 'ref2v' && referenceImageUrls.length + referenceVideoUrls.length === 0) {
    throw new BytePlusModelArkError('At least one reference image or video URL is required for BytePlus Seedance reference-to-video.', {
      code: 'REFERENCE_MEDIA_REQUIRED',
    });
  }
  if ((mode === 'v2v' || mode === 'extend') && referenceVideoUrls.length === 0) {
    throw new BytePlusModelArkError('At least one source video URL is required for BytePlus Seedance video edit and extension modes.', {
      code: 'VIDEO_URL_REQUIRED',
    });
  }
  if (!Number.isFinite(duration) || duration < 5 || duration > 15) {
    throw new BytePlusModelArkError('BytePlus Seedance duration must be between 5 and 15 seconds.', {
      code: 'BYTEPLUS_DURATION_UNSUPPORTED',
    });
  }
  if (!params.modelId.trim()) {
    throw new BytePlusModelArkError('BytePlus Seedance model id is not configured.', {
      code: 'BYTEPLUS_MODEL_MISSING',
    });
  }
  if (!allowedResolutions.includes(requestedResolution)) {
    throw new BytePlusModelArkError('BytePlus Seedance resolution is not supported by this model.', {
      code: 'BYTEPLUS_RESOLUTION_UNSUPPORTED',
    });
  }
  if (!BYTEPLUS_SEEDANCE_ASPECT_RATIOS.includes(requestedRatio)) {
    throw new BytePlusModelArkError('BytePlus Seedance aspect ratio is not supported.', {
      code: 'BYTEPLUS_RATIO_UNSUPPORTED',
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
  if (mode === 'ref2v' || mode === 'v2v' || mode === 'extend') {
    for (const url of referenceImageUrls) {
      content.push({
        type: 'image_url',
        image_url: { url },
        role: 'reference_image',
      });
    }
    for (const url of referenceVideoUrls) {
      content.push({
        type: 'video_url',
        video_url: { url },
        role: 'reference_video',
      });
    }
    for (const url of referenceAudioUrls) {
      content.push({
        type: 'audio_url',
        audio_url: { url },
        role: 'reference_audio',
      });
    }
  }

  return {
    model: params.modelId.trim(),
    content,
    resolution: requestedResolution as BytePlusSeedancePayload['resolution'],
    ratio: requestedRatio as BytePlusSeedancePayload['ratio'],
    duration,
    generate_audio: params.generateAudio === true,
    watermark: false,
  };
}

export function buildBytePlusSeedanceFastPayload(params: Parameters<typeof buildBytePlusSeedancePayload>[0]): BytePlusSeedanceFastPayload {
  return buildBytePlusSeedancePayload(params);
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
