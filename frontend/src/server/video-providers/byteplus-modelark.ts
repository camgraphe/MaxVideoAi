import { ENV } from '@/lib/env';
import type { NormalizedVideoProviderTask } from '@/server/video-providers/types';
import {
  BYTEPLUS_SEEDANCE_DEFAULT_MODEL_ID,
  BYTEPLUS_SEEDANCE_FAST_DEFAULT_BASE_URL,
  BYTEPLUS_SEEDANCE_FAST_DEFAULT_MODEL_ID,
  BYTEPLUS_SEEDANCE_MINI_DEFAULT_MODEL_ID,
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
  BYTEPLUS_SEEDANCE_MINI_DEFAULT_MODEL_ID,
  BYTEPLUS_SEEDANCE_MINI_DURATION_OPTIONS,
  BYTEPLUS_SEEDANCE_MINI_RESOLUTIONS,
  BYTEPLUS_SEEDANCE_MODES,
  BYTEPLUS_SEEDANCE_RESOLUTIONS,
  PUBLIC_SEEDANCE_ENGINE_ID,
  PUBLIC_SEEDANCE_FAST_ENGINE_ID,
  PUBLIC_SEEDANCE_MINI_ENGINE_ID,
  isPublicSeedanceEngine,
  isPublicSeedanceFastEngine,
  isPublicSeedanceMiniEngine,
} from './byteplus-modelark-constants';
export { BytePlusModelArkError } from './byteplus-modelark-error';
export { getBytePlusSeedanceProfile, requireBytePlusSeedanceProfile } from './byteplus-modelark-profiles';
export type { BytePlusSeedanceModelConfigKey, BytePlusSeedancePricingProfileKey, BytePlusSeedanceProfile } from './byteplus-modelark-profiles';
export {
  applyBytePlusSeedanceRuntimeOptions,
  getBytePlusSeedanceAllowedAspectRatios,
  getBytePlusSeedanceAllowedModes,
  getBytePlusSeedanceAllowedResolutions,
  getBytePlusSeedanceDurationOptions,
  getBytePlusSeedanceGeneratedAudio,
  isBytePlusSeedanceAdminOnly,
  isBytePlusSeedanceFastEngine,
  isPublicSeedanceBytePlusEngine,
  isSeedanceBytePlusModeAllowed,
  isSeedanceFastBytePlusModeAllowed,
  isSeedanceMiniBytePlusModeAllowed,
  resolveBytePlusSeedanceModelId,
  resolveBytePlusSeedanceRouteProfile,
  seedanceBytePlusAdminOnly,
  seedanceFastBytePlusAdminOnly,
  seedanceFastProviderOverride,
  seedanceMiniBytePlusAdminOnly,
  seedanceProviderOverride,
  shouldRoutePublicSeedanceFastToBytePlus,
  shouldRoutePublicSeedanceMiniToBytePlus,
  shouldRoutePublicSeedanceToBytePlus,
  shouldRouteSeedanceEngineToBytePlus,
} from './byteplus-modelark-profile-policy';
export {
  buildBytePlusSeedanceFastPayload,
  buildBytePlusSeedancePayload,
} from './byteplus-modelark-payload';
export type { BytePlusSeedanceFastPayload, BytePlusSeedancePayload } from './byteplus-modelark-payload';
export {
  getBytePlusTaskFailureCode,
  getBytePlusUserSafeErrorMessage,
  getBytePlusUserSafeTaskFailureMessage,
  normalizeBytePlusTask,
  scrubBytePlusError,
} from './byteplus-modelark-response';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function isBytePlusModelArkEnabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    (ENV.BYTEPLUS_ARK_ENABLED ?? '').trim().toLowerCase()
  );
}

export function getBytePlusArkConfig() {
  return {
    apiKey: ENV.BYTEPLUS_ARK_API_KEY,
    region: ENV.BYTEPLUS_ARK_REGION ?? 'ap-southeast-1',
    baseUrl: trimTrailingSlash(ENV.BYTEPLUS_ARK_BASE_URL ?? BYTEPLUS_SEEDANCE_FAST_DEFAULT_BASE_URL),
    seedanceModelId: ENV.BYTEPLUS_ARK_SEEDANCE_MODEL_ID ?? BYTEPLUS_SEEDANCE_DEFAULT_MODEL_ID,
    seedanceFastModelId: ENV.BYTEPLUS_ARK_SEEDANCE_FAST_MODEL_ID ?? BYTEPLUS_SEEDANCE_FAST_DEFAULT_MODEL_ID,
    seedanceMiniModelId: ENV.BYTEPLUS_ARK_SEEDANCE_MINI_MODEL_ID ?? BYTEPLUS_SEEDANCE_MINI_DEFAULT_MODEL_ID,
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
