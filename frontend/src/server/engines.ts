import {
  cloneEngine,
  getBaseEngineIncludingHidden,
  getBaseEngines,
  getBaseEnginesByCategory,
  normalizeMemberTier,
  toItemization,
  type EngineCategory,
} from '@/lib/engines';
import { computeCanonicalPublicSnapshot } from '@/server/pricing/quote-public';
import type { EngineCaps } from '@/types/engines';
import {
  fetchEngineOverrides,
  fetchEngineOverridesWithExecutor,
} from '@/server/engine-overrides';
import {
  ensureEngineSettingsSeed,
  fetchEngineSettings,
  fetchEngineSettingsWithExecutor,
} from '@/server/engine-settings';
import type { TransactionQueryExecutor } from '@/lib/db';
import type { PreflightRequest, PreflightResponse } from '@/types/engines';
import type { PricingSnapshot } from '@maxvideoai/pricing';
import { ensureBillingSchema } from '@/lib/schema';
import {
  getLumaRay2DurationInfo,
  isLumaRay2EngineId,
  isLumaRay2AspectRatio,
  normaliseLumaRay2Loop,
  LUMA_RAY2_ERROR_UNSUPPORTED,
} from '@/lib/luma-ray2';
import { applyEngineVariantPricing, buildEngineAddonInput } from '@/lib/pricing-addons';
import { getEngineCaps } from '@/fixtures/engineCaps';
import {
  applyConfiguredEngineRuntimeOptions,
  projectConfiguredEngine,
} from '@/server/engine-configuration-projection';
import { getPrivateRuntimeEngineById } from '@/server/video-generation/private-engine-registry';

async function getConfiguredEnginesForBase(
  baseEngines: EngineCaps[],
  includeDisabled = false,
  options?: { bootstrap?: boolean }
): Promise<EngineCaps[]> {
  if (!process.env.DATABASE_URL) {
    return includeDisabled ? baseEngines.map(cloneEngine) : baseEngines.map(cloneEngine);
  }

  const bootstrap = options?.bootstrap !== false;
  if (bootstrap) {
    await ensureBillingSchema();
    await ensureEngineSettingsSeed();
  }
  const [settingsMap, overridesMap] = await Promise.all([
    fetchEngineSettings(),
    fetchEngineOverrides(),
  ]);

  return baseEngines
    .map((engine) => projectConfiguredEngine(engine, settingsMap, overridesMap))
    .filter((entry) => includeDisabled || !entry.disabled)
    .map((entry) => applyConfiguredEngineRuntimeOptions(entry.engine));
}

export async function getConfiguredEnginesByCategory(
  category: EngineCategory = 'video',
  includeDisabled = false
): Promise<EngineCaps[]> {
  const baseEngines = getBaseEnginesByCategory(category);
  return getConfiguredEnginesForBase(baseEngines, includeDisabled);
}

export async function getPublicConfiguredEnginesByCategory(
  category: EngineCategory = 'video',
  includeDisabled = false
): Promise<EngineCaps[]> {
  const baseEngines = getBaseEnginesByCategory(category);
  return getConfiguredEnginesForBase(baseEngines, includeDisabled, { bootstrap: false });
}

export async function getPublicConfiguredEnginesByCategoryInExecutor(
  category: EngineCategory,
  executor: TransactionQueryExecutor,
): Promise<EngineCaps[]> {
  await executor.query('LOCK TABLE engine_settings, engine_overrides IN SHARE MODE');
  const [settingsMap, overridesMap] = await Promise.all([
    fetchEngineSettingsWithExecutor(executor),
    fetchEngineOverridesWithExecutor(executor),
  ]);
  return getBaseEnginesByCategory(category)
    .map((engine) => projectConfiguredEngine(engine, settingsMap, overridesMap))
    .filter((entry) => !entry.disabled)
    .map((entry) => applyConfiguredEngineRuntimeOptions(entry.engine));
}

export async function getConfiguredEngines(includeDisabled = false): Promise<EngineCaps[]> {
  const baseEngines = getBaseEngines();
  return getConfiguredEnginesForBase(baseEngines, includeDisabled);
}

export async function getConfiguredEngine(engineId: string, includeDisabled = false): Promise<EngineCaps | undefined> {
  if (!engineId) return undefined;
  const engines = await getConfiguredEngines(includeDisabled);
  return engines.find((engine) => engine.id === engineId);
}

export async function getConfiguredEngineIncludingHidden(
  engineId: string,
  includeDisabled = false
): Promise<EngineCaps | undefined> {
  if (!engineId) return undefined;
  const publicEngine = await getConfiguredEngine(engineId, includeDisabled);
  if (publicEngine) return publicEngine;
  const hiddenBase = getBaseEngineIncludingHidden(engineId) ?? getPrivateRuntimeEngineById(engineId);
  if (!hiddenBase) return undefined;
  const [configured] = await getConfiguredEnginesForBase([hiddenBase], includeDisabled);
  return configured;
}

export async function getConfiguredEngineIncludingHiddenInExecutor(
  engineId: string,
  executor: TransactionQueryExecutor,
): Promise<EngineCaps | undefined> {
  if (!engineId) return undefined;
  const hiddenBase = getBaseEngineIncludingHidden(engineId) ?? getPrivateRuntimeEngineById(engineId);
  if (!hiddenBase) return undefined;
  await executor.query('LOCK TABLE engine_settings, engine_overrides IN SHARE MODE');
  const [settingsMap, overridesMap] = await Promise.all([
    fetchEngineSettingsWithExecutor(executor),
    fetchEngineOverridesWithExecutor(executor),
  ]);
  const merged = projectConfiguredEngine(hiddenBase, settingsMap, overridesMap);
  if (merged.disabled) return undefined;
  return applyConfiguredEngineRuntimeOptions(merged.engine);
}

export type TrustedPreflightMediaPricingFacts = Readonly<{
  referenceImageCount?: number;
  inputAudioDurationSec?: number;
  verifiedReferenceTokenCount?: number;
}>;

export type ComputeConfiguredPreflightOptions = Readonly<{
  resolvedEngine?: EngineCaps;
  trustedMediaPricingFacts?: TrustedPreflightMediaPricingFacts;
}>;

export async function computeConfiguredPreflight(
  request: PreflightRequest,
  options: ComputeConfiguredPreflightOptions = {},
): Promise<PreflightResponse> {
  const engineId = typeof request.engine === 'string' ? request.engine : '';
  const resolvedEngine = options.resolvedEngine ?? await getConfiguredEngine(engineId);
  const engine = resolvedEngine?.id === engineId ? resolvedEngine : undefined;
  if (!engine) {
    const disabledEngine = await getConfiguredEngine(engineId, true);
    if (disabledEngine) {
      return {
        ok: false,
        messages: ['Engine is temporarily unavailable'],
        error: {
          code: 'ENGINE_DISABLED',
          message: 'Engine is temporarily unavailable',
        },
      };
    }
    return {
      ok: false,
      messages: ['Unknown engine selection'],
      error: {
        code: 'ENGINE_NOT_FOUND',
        message: 'Unknown engine',
      },
    };
  }

  const isLumaRay2 = isLumaRay2EngineId(engine.id);
  const pricingEngine = applyEngineVariantPricing(engine, request.mode);
  const capability = getEngineCaps(engine.id, request.mode);
  const supportsDuration = Boolean(capability?.duration || capability?.frames);
  const supportsResolution = Boolean(capability?.resolution?.length);
  const supportsAspectRatio = Boolean(capability?.aspectRatio?.length);
  const requestedResolution = request.resolution;
  const availableResolutions: string[] = engine.resolutions.map((value) => value);
  let effectiveResolution = requestedResolution;
  if (isLumaRay2) {
    if (!supportsResolution) {
      effectiveResolution =
        (availableResolutions.find((value) => value !== 'auto') ?? availableResolutions[0] ?? '540p') as typeof requestedResolution;
    } else if (requestedResolution === 'auto') {
      effectiveResolution = '540p' as typeof requestedResolution;
    } else if (!availableResolutions.includes(requestedResolution)) {
      return {
        ok: false,
        messages: [LUMA_RAY2_ERROR_UNSUPPORTED],
        error: {
          code: 'ENGINE_CONSTRAINT',
          message: LUMA_RAY2_ERROR_UNSUPPORTED,
        },
      };
    }
  } else if (requestedResolution === 'auto') {
    effectiveResolution =
      (engine.resolutions.find((value) => value !== 'auto') ?? engine.resolutions[0] ?? '1080p') as typeof requestedResolution;
  } else if (!availableResolutions.includes(requestedResolution)) {
    const fallback =
      availableResolutions.find((value) => value !== 'auto') ?? availableResolutions[0] ?? engine.resolutions[0];
    effectiveResolution = (fallback ?? '1080p') as typeof requestedResolution;
  }

  const durationInfo = isLumaRay2 && supportsDuration ? getLumaRay2DurationInfo(request.durationSec) : null;
  if (isLumaRay2 && supportsDuration && !durationInfo) {
    return {
      ok: false,
      messages: [LUMA_RAY2_ERROR_UNSUPPORTED],
      error: {
        code: 'ENGINE_CONSTRAINT',
        message: LUMA_RAY2_ERROR_UNSUPPORTED,
      },
    };
  }

  if (
    isLumaRay2 &&
    supportsAspectRatio &&
    request.aspectRatio &&
    !isLumaRay2AspectRatio(request.aspectRatio, { includeSquare: request.mode === 'reframe' })
  ) {
    return {
      ok: false,
      messages: [LUMA_RAY2_ERROR_UNSUPPORTED],
      error: {
        code: 'ENGINE_CONSTRAINT',
        message: LUMA_RAY2_ERROR_UNSUPPORTED,
      },
    };
  }

  const durationSecRaw = Number.isFinite(request.durationSec) ? Math.max(1, Math.round(request.durationSec)) : 4;
  const durationSec = durationInfo ? durationInfo.seconds : durationSecRaw;
  const memberTier = normalizeMemberTier(request.user?.memberTier);
  const loop = isLumaRay2 && supportsDuration ? normaliseLumaRay2Loop(request.loop) : undefined;
  const audioEnabled = typeof request.audio === 'boolean' ? request.audio : undefined;
  const addons = buildEngineAddonInput(pricingEngine, {
    audioEnabled,
    voiceControl: request.voiceControl,
  });
  const rawExtraInputValues =
    request.extraInputValues && typeof request.extraInputValues === 'object' && !Array.isArray(request.extraInputValues)
      ? request.extraInputValues
      : {};
  if (
    Object.prototype.hasOwnProperty.call(rawExtraInputValues, 'referenceImageCount')
    || Object.prototype.hasOwnProperty.call(rawExtraInputValues, 'inputAudioDurationSec')
    || Object.prototype.hasOwnProperty.call(rawExtraInputValues, 'verifiedReferenceTokenCount')
  ) {
    return {
      ok: false,
      messages: ['Unable to verify media pricing facts'],
      error: {
        code: 'PRICING_MEDIA_FACTS_UNTRUSTED',
        message: 'Client-declared media pricing facts are not accepted.',
      },
    };
  }
  const {
    referenceImageCount,
    inputAudioDurationSec,
    verifiedReferenceTokenCount,
  } = options.trustedMediaPricingFacts ?? {};
  const booleanExtraAddon = (value: unknown): boolean | undefined => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
    }
    return undefined;
  };
  const pricingAddons = {
    ...(addons ?? {}),
    ...(booleanExtraAddon(rawExtraInputValues.hdr) ? { hdr: true } : {}),
    ...(booleanExtraAddon(rawExtraInputValues.exr_export ?? rawExtraInputValues.exrExport) ? { exr_export: true } : {}),
  };
  let snapshot: PricingSnapshot;
  try {
    snapshot = await computeCanonicalPublicSnapshot({
      engine: pricingEngine,
      durationSec,
      resolution: effectiveResolution,
      aspectRatio: request.aspectRatio,
      mode: request.mode,
      membershipTier: memberTier,
      loop,
      hasVideoInput: request.hasVideoInput,
      durationOption: durationInfo?.label,
      addons: Object.keys(pricingAddons).length ? pricingAddons : undefined,
      referenceImageCount,
      inputAudioDurationSec,
      verifiedReferenceTokenCount,
    });
  } catch (error) {
    return {
      ok: false,
      messages: ['Unable to compute pricing'],
      error: {
        code: 'PRICING_ERROR',
        message: error instanceof Error ? error.message : 'Pricing calculation failed',
      },
    };
  }

  return {
    ok: true,
    currency: snapshot.currency,
    total: snapshot.totalCents,
    itemization: toItemization(snapshot, memberTier),
    pricing: snapshot,
    caps: {
      id: engine.id,
      label: engine.label,
      maxDurationSec: engine.maxDurationSec,
      resolutions: engine.resolutions,
      aspectRatios: engine.aspectRatios,
      fps: engine.fps,
      params: engine.params,
      inputLimits: engine.inputLimits,
      inputSchema: engine.inputSchema,
      pricing: pricingEngine.pricing,
      pricingDetails: pricingEngine.pricingDetails,
    },
  };
}
