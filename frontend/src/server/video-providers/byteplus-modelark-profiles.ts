import type { AspectRatio, Mode, Resolution } from '@/types/engines';
import {
  BYTEPLUS_SEEDANCE_ASPECT_RATIOS,
  BYTEPLUS_SEEDANCE_2_5_ASPECT_RATIOS,
  BYTEPLUS_SEEDANCE_2_5_DURATION_OPTIONS,
  BYTEPLUS_SEEDANCE_2_5_RESOLUTIONS,
  BYTEPLUS_SEEDANCE_DURATION_OPTIONS,
  BYTEPLUS_SEEDANCE_FAST_ENGINE_ID,
  BYTEPLUS_SEEDANCE_FAST_RESOLUTIONS,
  BYTEPLUS_SEEDANCE_MINI_DURATION_OPTIONS,
  BYTEPLUS_SEEDANCE_MINI_RESOLUTIONS,
  BYTEPLUS_SEEDANCE_MODES,
  BYTEPLUS_SEEDANCE_RESOLUTIONS,
  PUBLIC_SEEDANCE_ENGINE_ID,
  PUBLIC_SEEDANCE_FAST_ENGINE_ID,
  PUBLIC_SEEDANCE_MINI_ENGINE_ID,
  SEEDANCE_2_5_ENGINE_ID,
} from './byteplus-modelark-constants';
import { BytePlusModelArkError } from './byteplus-modelark-error';

export type BytePlusSeedanceModelConfigKey =
  | 'seedanceModelId'
  | 'seedanceFastModelId'
  | 'seedanceMiniModelId'
  | 'seedance25ModelId';

export type BytePlusSeedancePricingProfileKey = 'standard' | 'fast' | 'mini' | 'seedance25';

export type BytePlusSeedanceProviderOverrideKey =
  | 'SEEDANCE_2_PROVIDER'
  | 'SEEDANCE_FAST_PROVIDER'
  | 'SEEDANCE_2_5_PROVIDER'
  | null;

export type BytePlusSeedanceEnabledKey = 'SEEDANCE_2_5_BYTEPLUS_ENABLED' | null;

export type BytePlusSeedanceAdminOnlyKey =
  | 'SEEDANCE_2_BYTEPLUS_ADMIN_ONLY'
  | 'SEEDANCE_FAST_BYTEPLUS_ADMIN_ONLY'
  | 'SEEDANCE_MINI_BYTEPLUS_ADMIN_ONLY'
  | 'SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY';

export type BytePlusSeedanceAllowedModesKey =
  | 'SEEDANCE_2_BYTEPLUS_MODES'
  | 'SEEDANCE_FAST_BYTEPLUS_MODES'
  | 'SEEDANCE_MINI_BYTEPLUS_MODES'
  | 'SEEDANCE_2_5_BYTEPLUS_MODES';

export type BytePlusSeedanceProfile = Readonly<{
  engineId: string;
  modelConfigKey: BytePlusSeedanceModelConfigKey;
  supportedModes: readonly Mode[];
  durationOptions: readonly number[];
  resolutions: readonly Resolution[];
  aspectRatios: readonly AspectRatio[];
  defaultDurationSec: number;
  defaultResolution: Resolution;
  defaultAspectRatio: AspectRatio;
  motionControls: boolean;
  framesPerSecond: number;
  generatedAudio: boolean;
  pricingProfileKey: BytePlusSeedancePricingProfileKey;
  routing: Readonly<{
    enabledKey: BytePlusSeedanceEnabledKey;
    providerOverrideKey: BytePlusSeedanceProviderOverrideKey;
    adminOnlyKey: BytePlusSeedanceAdminOnlyKey;
    allowedModesKey: BytePlusSeedanceAllowedModesKey;
    alwaysDirect: boolean;
  }>;
}>;

const shared = {
  supportedModes: BYTEPLUS_SEEDANCE_MODES,
  aspectRatios: BYTEPLUS_SEEDANCE_ASPECT_RATIOS,
  defaultDurationSec: 5,
  defaultResolution: '720p',
  defaultAspectRatio: '16:9',
  motionControls: true,
  framesPerSecond: 24,
  generatedAudio: true,
} as const;

const BYTEPLUS_SEEDANCE_PROFILES: Readonly<Record<string, BytePlusSeedanceProfile>> = {
  [PUBLIC_SEEDANCE_ENGINE_ID]: {
    ...shared,
    engineId: PUBLIC_SEEDANCE_ENGINE_ID,
    modelConfigKey: 'seedanceModelId',
    durationOptions: BYTEPLUS_SEEDANCE_DURATION_OPTIONS,
    resolutions: BYTEPLUS_SEEDANCE_RESOLUTIONS,
    pricingProfileKey: 'standard',
    routing: {
      enabledKey: null,
      providerOverrideKey: 'SEEDANCE_2_PROVIDER',
      adminOnlyKey: 'SEEDANCE_2_BYTEPLUS_ADMIN_ONLY',
      allowedModesKey: 'SEEDANCE_2_BYTEPLUS_MODES',
      alwaysDirect: false,
    },
  },
  [PUBLIC_SEEDANCE_FAST_ENGINE_ID]: {
    ...shared,
    engineId: PUBLIC_SEEDANCE_FAST_ENGINE_ID,
    modelConfigKey: 'seedanceFastModelId',
    durationOptions: BYTEPLUS_SEEDANCE_DURATION_OPTIONS,
    resolutions: BYTEPLUS_SEEDANCE_FAST_RESOLUTIONS,
    pricingProfileKey: 'fast',
    routing: {
      enabledKey: null,
      providerOverrideKey: 'SEEDANCE_FAST_PROVIDER',
      adminOnlyKey: 'SEEDANCE_FAST_BYTEPLUS_ADMIN_ONLY',
      allowedModesKey: 'SEEDANCE_FAST_BYTEPLUS_MODES',
      alwaysDirect: false,
    },
  },
  [PUBLIC_SEEDANCE_MINI_ENGINE_ID]: {
    ...shared,
    engineId: PUBLIC_SEEDANCE_MINI_ENGINE_ID,
    modelConfigKey: 'seedanceMiniModelId',
    durationOptions: BYTEPLUS_SEEDANCE_MINI_DURATION_OPTIONS,
    resolutions: BYTEPLUS_SEEDANCE_MINI_RESOLUTIONS,
    pricingProfileKey: 'mini',
    routing: {
      enabledKey: null,
      providerOverrideKey: null,
      adminOnlyKey: 'SEEDANCE_MINI_BYTEPLUS_ADMIN_ONLY',
      allowedModesKey: 'SEEDANCE_MINI_BYTEPLUS_MODES',
      alwaysDirect: true,
    },
  },
  [BYTEPLUS_SEEDANCE_FAST_ENGINE_ID]: {
    ...shared,
    engineId: BYTEPLUS_SEEDANCE_FAST_ENGINE_ID,
    modelConfigKey: 'seedanceFastModelId',
    durationOptions: BYTEPLUS_SEEDANCE_DURATION_OPTIONS,
    resolutions: BYTEPLUS_SEEDANCE_FAST_RESOLUTIONS,
    pricingProfileKey: 'fast',
    routing: {
      enabledKey: null,
      providerOverrideKey: 'SEEDANCE_FAST_PROVIDER',
      adminOnlyKey: 'SEEDANCE_FAST_BYTEPLUS_ADMIN_ONLY',
      allowedModesKey: 'SEEDANCE_FAST_BYTEPLUS_MODES',
      alwaysDirect: true,
    },
  },
  [SEEDANCE_2_5_ENGINE_ID]: {
    engineId: SEEDANCE_2_5_ENGINE_ID,
    modelConfigKey: 'seedance25ModelId',
    supportedModes: ['t2v'],
    durationOptions: BYTEPLUS_SEEDANCE_2_5_DURATION_OPTIONS,
    resolutions: BYTEPLUS_SEEDANCE_2_5_RESOLUTIONS,
    aspectRatios: BYTEPLUS_SEEDANCE_2_5_ASPECT_RATIOS,
    defaultDurationSec: 4,
    defaultResolution: '480p',
    defaultAspectRatio: '16:9',
    motionControls: false,
    framesPerSecond: 24,
    generatedAudio: false,
    pricingProfileKey: 'seedance25',
    routing: {
      enabledKey: 'SEEDANCE_2_5_BYTEPLUS_ENABLED',
      providerOverrideKey: 'SEEDANCE_2_5_PROVIDER',
      adminOnlyKey: 'SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY',
      allowedModesKey: 'SEEDANCE_2_5_BYTEPLUS_MODES',
      alwaysDirect: false,
    },
  },
};

export function getBytePlusSeedanceProfile(
  engineId: string | null | undefined
): BytePlusSeedanceProfile | null {
  const normalizedEngineId = engineId?.trim();
  return normalizedEngineId ? BYTEPLUS_SEEDANCE_PROFILES[normalizedEngineId] ?? null : null;
}

export function requireBytePlusSeedanceProfile(
  engineId: string | null | undefined
): BytePlusSeedanceProfile {
  const profile = getBytePlusSeedanceProfile(engineId);
  if (profile) return profile;
  throw new BytePlusModelArkError('Unsupported BytePlus Seedance engine profile.', {
    status: 400,
    code: 'BYTEPLUS_ENGINE_PROFILE_MISSING',
  });
}
