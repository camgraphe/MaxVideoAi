import { ENV } from '@/lib/env';
import type { NormalizedVideoProviderTask } from '@/server/video-providers/types';
import type { EngineCaps, EngineInputField, Mode, Resolution } from '@/types/engines';
import {
  BYTEPLUS_MODELARK_PROVIDER,
  BYTEPLUS_SEEDANCE_ASPECT_RATIOS,
  BYTEPLUS_SEEDANCE_DEFAULT_MODEL_ID,
  BYTEPLUS_SEEDANCE_DURATION_OPTIONS,
  BYTEPLUS_SEEDANCE_FAST_DEFAULT_BASE_URL,
  BYTEPLUS_SEEDANCE_FAST_DEFAULT_MODEL_ID,
  BYTEPLUS_SEEDANCE_FAST_ENGINE_ID,
  BYTEPLUS_SEEDANCE_FAST_RESOLUTIONS,
  BYTEPLUS_SEEDANCE_MODES,
  BYTEPLUS_SEEDANCE_RESOLUTIONS,
  PUBLIC_SEEDANCE_ENGINE_ID,
  PUBLIC_SEEDANCE_FAST_ENGINE_ID,
} from './byteplus-modelark-constants';
import { BytePlusModelArkError } from './byteplus-modelark-error';
import type { BytePlusSeedanceFastPayload } from './byteplus-modelark-payload';
import {
  firstString,
  normalizeBytePlusTask,
  parseJsonResponse,
  scrubBytePlusError,
} from './byteplus-modelark-response';

export {
  BYTEPLUS_MODELARK_PROVIDER,
  BYTEPLUS_SEEDANCE_ASPECT_RATIOS,
  BYTEPLUS_SEEDANCE_DEFAULT_MODEL_ID,
  BYTEPLUS_SEEDANCE_DURATION_OPTIONS,
  BYTEPLUS_SEEDANCE_FAST_DEFAULT_BASE_URL,
  BYTEPLUS_SEEDANCE_FAST_DEFAULT_MODEL_ID,
  BYTEPLUS_SEEDANCE_FAST_ENGINE_ID,
  BYTEPLUS_SEEDANCE_FAST_RESOLUTIONS,
  BYTEPLUS_SEEDANCE_MODES,
  BYTEPLUS_SEEDANCE_RESOLUTIONS,
  PUBLIC_SEEDANCE_ENGINE_ID,
  PUBLIC_SEEDANCE_FAST_ENGINE_ID,
} from './byteplus-modelark-constants';
export { BytePlusModelArkError } from './byteplus-modelark-error';
export {
  buildBytePlusSeedanceFastPayload,
  buildBytePlusSeedancePayload,
} from './byteplus-modelark-payload';
export type {
  BytePlusSeedanceFastPayload,
  BytePlusSeedancePayload,
} from './byteplus-modelark-payload';
export {
  getBytePlusUserSafeErrorMessage,
  normalizeBytePlusTask,
  scrubBytePlusError,
} from './byteplus-modelark-response';

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
