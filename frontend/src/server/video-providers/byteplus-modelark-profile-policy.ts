import { ENV } from '@/lib/env';
import type { AspectRatio, EngineCaps, EngineInputField, Mode, Resolution } from '@/types/engines';
import {
  BYTEPLUS_MODELARK_PROVIDER,
  BYTEPLUS_SEEDANCE_FAST_ENGINE_ID,
  PUBLIC_SEEDANCE_ENGINE_ID,
  PUBLIC_SEEDANCE_FAST_ENGINE_ID,
  PUBLIC_SEEDANCE_MINI_ENGINE_ID,
  SEEDANCE_2_5_ENGINE_ID,
  isPublicSeedanceEngine,
  isPublicSeedanceFastEngine,
  isPublicSeedanceMiniEngine,
  withBytePlusVideoSourceFields,
} from './byteplus-modelark-constants';
import { BytePlusModelArkError } from './byteplus-modelark-error';
import {
  getBytePlusSeedanceProfile,
  requireBytePlusSeedanceProfile,
  type BytePlusSeedanceProfile,
} from './byteplus-modelark-profiles';

function envFlagEnabled(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes((value ?? '').trim().toLowerCase());
}

function adminOnlyFlagEnabled(value: string | undefined, defaultValue: boolean): boolean {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  return true;
}

function splitCsvEnv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function allowedBytePlusModes(
  value: string | undefined,
  supportedModes: readonly Mode[]
): Mode[] {
  const configured = splitCsvEnv(value);
  const modes = configured.filter((mode): mode is Mode =>
    supportedModes.includes(mode as Mode)
  );
  if (modes.length) return modes;
  return supportedModes.includes('t2v')
    ? ['t2v']
    : supportedModes.slice(0, 1);
}

function assertNever(value: never): never {
  throw new BytePlusModelArkError(
    `Unsupported BytePlus Seedance policy key: ${String(value)}`,
    { status: 500, code: 'BYTEPLUS_PROFILE_POLICY_INVALID' }
  );
}

function readProviderOverride(
  key: BytePlusSeedanceProfile['routing']['providerOverrideKey']
): 'fal' | 'byteplus_modelark' {
  let raw: string | undefined;
  switch (key) {
    case 'SEEDANCE_2_PROVIDER':
      raw = ENV.SEEDANCE_2_PROVIDER;
      break;
    case 'SEEDANCE_FAST_PROVIDER':
      raw = ENV.SEEDANCE_FAST_PROVIDER;
      break;
    case 'SEEDANCE_2_5_PROVIDER':
      raw = ENV.SEEDANCE_2_5_PROVIDER;
      break;
    case null:
      raw = undefined;
      break;
    default:
      return assertNever(key);
  }
  return raw?.trim().toLowerCase() === BYTEPLUS_MODELARK_PROVIDER
    ? BYTEPLUS_MODELARK_PROVIDER
    : 'fal';
}

function readEnabled(profile: BytePlusSeedanceProfile): boolean {
  switch (profile.routing.enabledKey) {
    case null:
      return true;
    case 'SEEDANCE_2_5_BYTEPLUS_ENABLED':
      return envFlagEnabled(ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED ?? 'false');
    default:
      return assertNever(profile.routing.enabledKey);
  }
}

function readAdminOnly(profile: BytePlusSeedanceProfile): boolean {
  const key = profile.routing.adminOnlyKey;
  let raw: string | undefined;
  let defaultValue: boolean;
  switch (key) {
    case 'SEEDANCE_2_BYTEPLUS_ADMIN_ONLY':
      raw = ENV.SEEDANCE_2_BYTEPLUS_ADMIN_ONLY;
      defaultValue = true;
      break;
    case 'SEEDANCE_FAST_BYTEPLUS_ADMIN_ONLY':
      raw = ENV.SEEDANCE_FAST_BYTEPLUS_ADMIN_ONLY;
      defaultValue = true;
      break;
    case 'SEEDANCE_MINI_BYTEPLUS_ADMIN_ONLY':
      raw = ENV.SEEDANCE_MINI_BYTEPLUS_ADMIN_ONLY;
      defaultValue = false;
      break;
    case 'SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY':
      raw = ENV.SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY;
      defaultValue = true;
      break;
    default:
      return assertNever(key);
  }
  return adminOnlyFlagEnabled(raw, defaultValue);
}

function readAllowedModes(profile: BytePlusSeedanceProfile): Mode[] {
  const key = profile.routing.allowedModesKey;
  let raw: string | undefined;
  switch (key) {
    case 'SEEDANCE_2_BYTEPLUS_MODES':
      raw = ENV.SEEDANCE_2_BYTEPLUS_MODES;
      break;
    case 'SEEDANCE_FAST_BYTEPLUS_MODES':
      raw = ENV.SEEDANCE_FAST_BYTEPLUS_MODES;
      break;
    case 'SEEDANCE_MINI_BYTEPLUS_MODES':
      raw = ENV.SEEDANCE_MINI_BYTEPLUS_MODES;
      break;
    case 'SEEDANCE_2_5_BYTEPLUS_MODES':
      raw = ENV.SEEDANCE_2_5_BYTEPLUS_MODES;
      break;
    default:
      return assertNever(key);
  }
  return allowedBytePlusModes(raw, profile.supportedModes);
}

function expandBytePlusFieldModes(field: EngineInputField): EngineInputField {
  if (field.id === 'image_urls') {
    return {
      ...field,
      modes: ['ref2v', 'v2v'],
    };
  }
  if (field.id === 'video_urls') {
    return {
      ...field,
      modes: ['ref2v'],
    };
  }
  if (field.id === 'audio_urls') {
    return {
      ...field,
      modes: ['ref2v', 'v2v'],
    };
  }
  return field;
}

function filterInputFieldsForModes(
  fields: EngineInputField[] | undefined,
  allowedModes: Mode[],
  profile: BytePlusSeedanceProfile,
  options?: { includeBytePlusVideoSourceFields?: boolean }
): EngineInputField[] | undefined {
  if (!fields) return fields;
  const resolutions = [...profile.resolutions];
  const aspectRatios = [...profile.aspectRatios];
  const durationOptions = profile.durationOptions;
  const sourceFields = options?.includeBytePlusVideoSourceFields
    ? withBytePlusVideoSourceFields(fields)
    : fields;
  return sourceFields
    .map(expandBytePlusFieldModes)
    .filter((field) => !field.modes?.length || field.modes.some((mode) => allowedModes.includes(mode)))
    .map((field) => {
      if (field.id === 'resolution' && field.type === 'enum') {
        return {
          ...field,
          values: resolutions,
          default: profile.defaultResolution,
        };
      }
      if (field.id === 'aspect_ratio' && field.type === 'enum') {
        return {
          ...field,
          values: aspectRatios,
          default: profile.defaultAspectRatio,
        };
      }
      if (field.id === 'duration' && field.type === 'enum') {
        return {
          ...field,
          values: durationOptions.map(String),
          default: String(profile.defaultDurationSec),
          min: durationOptions[0] ?? 5,
          max: durationOptions[durationOptions.length - 1],
        };
      }
      return field;
    });
}

export function isBytePlusSeedanceFastEngine(engineId: string | null | undefined): boolean {
  return engineId === BYTEPLUS_SEEDANCE_FAST_ENGINE_ID;
}

export function requiresBytePlusSeedanceEarlyGate(
  engineId: string | null | undefined
): boolean {
  return engineId === BYTEPLUS_SEEDANCE_FAST_ENGINE_ID || engineId === SEEDANCE_2_5_ENGINE_ID;
}

export function isBytePlusSeedanceHiddenEngine(engineId: string | null | undefined): boolean {
  return engineId === BYTEPLUS_SEEDANCE_FAST_ENGINE_ID;
}

export function isBytePlusSeedanceSubmissionEnabled(
  engineId: string | null | undefined
): boolean {
  const profile = getBytePlusSeedanceProfile(engineId);
  if (!profile || !readEnabled(profile)) return false;
  return (
    profile.routing.providerOverrideKey !== 'SEEDANCE_2_5_PROVIDER' ||
    readProviderOverride(profile.routing.providerOverrideKey) === BYTEPLUS_MODELARK_PROVIDER
  );
}

export function assertBytePlusSeedanceSubmissionEnabled(
  engineId: string | null | undefined
): void {
  requireBytePlusSeedanceProfile(engineId);
  if (isBytePlusSeedanceSubmissionEnabled(engineId)) return;
  throw new BytePlusModelArkError('BytePlus Seedance engine is disabled.', {
    status: 404,
    code: 'BYTEPLUS_ENGINE_DISABLED',
  });
}

export function shouldRouteSeedanceEngineToBytePlus(
  engineId: string | null | undefined
): boolean {
  const profile = getBytePlusSeedanceProfile(engineId);
  return Boolean(
    profile &&
      (profile.routing.alwaysDirect ||
        readProviderOverride(profile.routing.providerOverrideKey) ===
          BYTEPLUS_MODELARK_PROVIDER)
  );
}

export function isBytePlusSeedanceAdminOnly(
  engineId: string | null | undefined
): boolean {
  const profile = getBytePlusSeedanceProfile(engineId);
  return profile ? readAdminOnly(profile) : false;
}

export function resolveBytePlusSeedanceRouteProfile(
  engineId: string | null | undefined,
  declaredProvider: string | null | undefined
): BytePlusSeedanceProfile | null {
  const profile = getBytePlusSeedanceProfile(engineId);
  const explicitlyDeclared =
    declaredProvider?.trim().toLowerCase() === BYTEPLUS_MODELARK_PROVIDER;
  const routed = shouldRouteSeedanceEngineToBytePlus(engineId);
  if (!explicitlyDeclared && !routed) return null;
  return profile ?? requireBytePlusSeedanceProfile(engineId);
}

export function seedanceProviderOverride(): 'fal' | 'byteplus_modelark' {
  return readProviderOverride(
    requireBytePlusSeedanceProfile(PUBLIC_SEEDANCE_ENGINE_ID).routing.providerOverrideKey
  );
}

export function seedanceFastProviderOverride(): 'fal' | 'byteplus_modelark' {
  return readProviderOverride(
    requireBytePlusSeedanceProfile(PUBLIC_SEEDANCE_FAST_ENGINE_ID).routing.providerOverrideKey
  );
}

export function shouldRoutePublicSeedanceToBytePlus(
  engineId: string | null | undefined
): boolean {
  return isPublicSeedanceEngine(engineId) && shouldRouteSeedanceEngineToBytePlus(engineId);
}

export function shouldRoutePublicSeedanceFastToBytePlus(
  engineId: string | null | undefined
): boolean {
  return isPublicSeedanceFastEngine(engineId) && shouldRouteSeedanceEngineToBytePlus(engineId);
}

export function shouldRoutePublicSeedanceMiniToBytePlus(
  engineId: string | null | undefined
): boolean {
  return isPublicSeedanceMiniEngine(engineId) && shouldRouteSeedanceEngineToBytePlus(engineId);
}

export function isPublicSeedanceBytePlusEngine(
  engineId: string | null | undefined
): boolean {
  return (
    isPublicSeedanceEngine(engineId) ||
    isPublicSeedanceFastEngine(engineId) ||
    isPublicSeedanceMiniEngine(engineId)
  ) && shouldRouteSeedanceEngineToBytePlus(engineId);
}

export function seedanceBytePlusAdminOnly(): boolean {
  return readAdminOnly(requireBytePlusSeedanceProfile(PUBLIC_SEEDANCE_ENGINE_ID));
}

export function seedanceFastBytePlusAdminOnly(): boolean {
  return readAdminOnly(requireBytePlusSeedanceProfile(PUBLIC_SEEDANCE_FAST_ENGINE_ID));
}

export function seedanceMiniBytePlusAdminOnly(): boolean {
  return readAdminOnly(requireBytePlusSeedanceProfile(PUBLIC_SEEDANCE_MINI_ENGINE_ID));
}

export function getBytePlusSeedanceAllowedModes(engineId: string | null | undefined): Mode[] {
  return readAllowedModes(requireBytePlusSeedanceProfile(engineId));
}

export function isSeedanceBytePlusModeAllowed(mode: string | null | undefined): boolean {
  return getBytePlusSeedanceAllowedModes(PUBLIC_SEEDANCE_ENGINE_ID).includes(
    (mode ?? '').trim().toLowerCase() as Mode
  );
}

export function isSeedanceFastBytePlusModeAllowed(mode: string | null | undefined): boolean {
  return getBytePlusSeedanceAllowedModes(PUBLIC_SEEDANCE_FAST_ENGINE_ID).includes(
    (mode ?? '').trim().toLowerCase() as Mode
  );
}

export function isSeedanceMiniBytePlusModeAllowed(mode: string | null | undefined): boolean {
  return getBytePlusSeedanceAllowedModes(PUBLIC_SEEDANCE_MINI_ENGINE_ID).includes(
    (mode ?? '').trim().toLowerCase() as Mode
  );
}

export function getBytePlusSeedanceAllowedResolutions(
  engineId: string | null | undefined
): Resolution[] {
  return [...requireBytePlusSeedanceProfile(engineId).resolutions];
}

export function getBytePlusSeedanceAllowedAspectRatios(
  engineId: string | null | undefined
): AspectRatio[] {
  return [...requireBytePlusSeedanceProfile(engineId).aspectRatios];
}

export function getBytePlusSeedanceDurationOptions(
  engineId: string | null | undefined
): readonly number[] {
  return requireBytePlusSeedanceProfile(engineId).durationOptions;
}

export function getBytePlusSeedanceGeneratedAudio(
  engineId: string | null | undefined
): boolean {
  return requireBytePlusSeedanceProfile(engineId).generatedAudio;
}

export function resolveBytePlusSeedanceModelId(
  engineId: string | null | undefined,
  config: Record<
    'seedanceModelId' | 'seedanceFastModelId' | 'seedanceMiniModelId' | 'seedance25ModelId',
    string
  >
): string {
  const profile = requireBytePlusSeedanceProfile(engineId);
  const modelId = config[profile.modelConfigKey]?.trim();
  if (!modelId) {
    throw new BytePlusModelArkError('BytePlus Seedance model ID is not configured.', {
      status: 503,
      code: 'BYTEPLUS_MODEL_ID_MISSING',
    });
  }
  return modelId;
}

export function applyBytePlusSeedanceRuntimeOptions(
  engine: EngineCaps,
  options?: {
    provider?: 'fal' | 'byteplus_modelark';
    allowedModes?: Mode[];
  }
): EngineCaps {
  const discoveredProfile = getBytePlusSeedanceProfile(engine.id);
  const provider =
    options?.provider ??
    (discoveredProfile
      ? discoveredProfile.routing.providerOverrideKey
        ? readProviderOverride(discoveredProfile.routing.providerOverrideKey)
        : discoveredProfile.routing.alwaysDirect
          ? BYTEPLUS_MODELARK_PROVIDER
          : 'fal'
      : 'fal');
  if (provider !== BYTEPLUS_MODELARK_PROVIDER) {
    return engine;
  }
  const profile = discoveredProfile ?? requireBytePlusSeedanceProfile(engine.id);
  const allowedModes = (options?.allowedModes ?? readAllowedModes(profile)).filter((mode) =>
    profile.supportedModes.includes(mode)
  );
  const resolutions: Resolution[] = [...profile.resolutions];
  const aspectRatios: AspectRatio[] = [...profile.aspectRatios];
  const durationOptions = profile.durationOptions;
  const baseModeCaps = engine.modeCaps ?? {};
  const modeCaps = engine.modeCaps
    ? Object.fromEntries(
        allowedModes.map((mode) => {
          const caps =
            baseModeCaps[mode] ??
            baseModeCaps.ref2v ??
            baseModeCaps.i2v ??
            baseModeCaps.t2v;
          return [
            mode,
            caps
              ? {
                  ...caps,
                  modes: [mode],
                  resolution: resolutions,
                  resolutionLocked: false,
                  aspectRatio:
                    engine.id === 'seedance-2-5' && mode === 'i2v'
                      ? undefined
                      : aspectRatios,
                  duration: {
                    options: [...durationOptions],
                    default: profile.defaultDurationSec,
                  },
                  audioToggle: profile.generatedAudio,
                }
              : caps,
          ];
        })
      )
    : undefined;

  return {
    ...engine,
    provider: 'ByteDance',
    modes: allowedModes,
    maxDurationSec: durationOptions[durationOptions.length - 1],
    resolutions,
    aspectRatios,
    fps: [profile.framesPerSecond],
    audio: profile.generatedAudio,
    extend: allowedModes.includes('extend'),
    motionControls: profile.motionControls,
    keyframes: allowedModes.includes('i2v'),
    modeCaps,
    inputSchema: engine.inputSchema
      ? {
          ...engine.inputSchema,
          required: filterInputFieldsForModes(
            engine.inputSchema.required,
            allowedModes,
            profile
          ),
          optional: filterInputFieldsForModes(
            engine.inputSchema.optional,
            allowedModes,
            profile,
            { includeBytePlusVideoSourceFields: true }
          ),
        }
      : engine.inputSchema,
    providerMeta: {
      ...engine.providerMeta,
      provider: BYTEPLUS_MODELARK_PROVIDER,
    },
  };
}
