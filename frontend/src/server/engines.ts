import {
  cloneEngine,
  getBaseEngines,
  getBaseEnginesByCategory,
  normalizeMemberTier,
  toItemization,
  type EngineCategory,
} from '@/lib/engines';
import { computePricingSnapshot } from '@/lib/pricing';
import type { EngineCaps, EngineInputField, EnginePricing, EnginePricingDetails } from '@/types/engines';
import { fetchEngineOverrides } from '@/server/engine-overrides';
import type { EngineOverride } from '@/server/engine-overrides';
import { ensureEngineSettingsSeed, fetchEngineSettings, EngineSettingsRecord } from '@/server/engine-settings';
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

function applyPricingDetails(engine: EngineCaps, pricing: EnginePricingDetails | null): void {
  if (!pricing) return;
  engine.pricingDetails = pricing;
  const byResolution = pricing.perSecondCents?.byResolution ?? null;
  const baseCents = pricing.perSecondCents?.default ?? null;
  const pricingData: EnginePricing = {
    unit: 'sec',
    currency: pricing.currency,
  };
  if (baseCents != null) {
    pricingData.base = baseCents / 100;
  }
  if (byResolution) {
    pricingData.byResolution = Object.fromEntries(
      Object.entries(byResolution).map(([key, cents]) => [key, cents / 100])
    );
  }
  engine.pricing = pricingData;
}

function filterFieldValues(field: EngineInputField, allowedValues: string[]): EngineInputField {
  if (field.type !== 'enum' || !Array.isArray(field.values) || !allowedValues.length) {
    return field;
  }
  const nextValues = field.values.filter((value) => allowedValues.includes(value));
  if (!nextValues.length) {
    return field;
  }
  const currentDefault =
    typeof field.default === 'string' && nextValues.includes(field.default) ? field.default : nextValues[0];
  return {
    ...field,
    values: nextValues,
    default: currentDefault,
  };
}

function filterDurationField(field: EngineInputField, maxDurationSec?: number): EngineInputField {
  if (field.type !== 'enum' || field.id !== 'duration' || !Array.isArray(field.values) || typeof maxDurationSec !== 'number') {
    return field;
  }
  const nextValues = field.values.filter((value) => {
    const numeric = Number(String(value).replace(/[^\d.]/g, ''));
    return !Number.isFinite(numeric) || numeric <= maxDurationSec;
  });
  if (!nextValues.length) {
    return field;
  }
  const currentDefault =
    typeof field.default === 'string' && nextValues.includes(field.default) ? field.default : nextValues[0];
  return {
    ...field,
    values: nextValues,
    default: currentDefault,
  };
}

function syncInputSchemaWithOptions(engine: EngineCaps, options: Record<string, unknown>): void {
  if (!engine.inputSchema) return;

  const allowedResolutions = Array.isArray(options.resolutions)
    ? options.resolutions.filter((value): value is string => typeof value === 'string')
    : [];
  const allowedAspectRatios = Array.isArray(options.aspectRatios)
    ? options.aspectRatios.filter((value): value is string => typeof value === 'string')
    : [];
  const allowedFps = Array.isArray(options.fps)
    ? options.fps.filter((value): value is number => typeof value === 'number').map((value) => String(value))
    : [];
  const maxDurationSec = typeof options.maxDurationSec === 'number' ? options.maxDurationSec : undefined;

  const syncField = (field: EngineInputField): EngineInputField => {
    let nextField = field;
    if (field.id === 'resolution') {
      nextField = filterFieldValues(nextField, allowedResolutions);
    } else if (field.id === 'aspect_ratio') {
      nextField = filterFieldValues(nextField, allowedAspectRatios);
    } else if (field.id === 'fps') {
      nextField = filterFieldValues(nextField, allowedFps);
    }
    return filterDurationField(nextField, maxDurationSec);
  };

  engine.inputSchema = {
    ...engine.inputSchema,
    required: engine.inputSchema.required?.map(syncField),
    optional: engine.inputSchema.optional?.map(syncField),
  };
}

function applyOptions(engine: EngineCaps, record?: EngineSettingsRecord | null): EngineCaps {
  if (!record?.options) return engine;
  const options = record.options;
  const clone = engine;
  if (Array.isArray(options.modes)) {
    clone.modes = options.modes.filter((mode): mode is EngineCaps['modes'][number] =>
      typeof mode === 'string'
    ) as EngineCaps['modes'];
  }
  if (typeof options.maxDurationSec === 'number') {
    clone.maxDurationSec = options.maxDurationSec;
  }
  if (Array.isArray(options.resolutions)) {
    clone.resolutions = options.resolutions.filter((value): value is EngineCaps['resolutions'][number] =>
      typeof value === 'string'
    ) as EngineCaps['resolutions'];
  }
  if (Array.isArray(options.aspectRatios)) {
    clone.aspectRatios = options.aspectRatios.filter(
      (value): value is EngineCaps['aspectRatios'][number] => typeof value === 'string'
    ) as EngineCaps['aspectRatios'];
  }
  if (Array.isArray(options.fps)) {
    clone.fps = options.fps.filter((value): value is number => typeof value === 'number');
  }
  if (typeof options.audio === 'boolean') {
    clone.audio = options.audio;
  }
  if (typeof options.upscale4k === 'boolean') {
    clone.upscale4k = options.upscale4k;
  }
  if (typeof options.extend === 'boolean') {
    clone.extend = options.extend;
  }
  if (typeof options.motionControls === 'boolean') {
    clone.motionControls = options.motionControls;
  }
  if (typeof options.keyframes === 'boolean') {
    clone.keyframes = options.keyframes;
  }
  if (options.inputLimits && typeof options.inputLimits === 'object') {
    clone.inputLimits = {
      ...clone.inputLimits,
      ...(options.inputLimits as EngineCaps['inputLimits']),
    };
  }
  if (options.params && typeof options.params === 'object') {
    clone.params = {
      ...clone.params,
      ...(options.params as EngineCaps['params']),
    };
  }
  if (typeof options.availability === 'string') {
    clone.availability = options.availability as EngineCaps['availability'];
  }
  if (typeof options.latencyTier === 'string') {
    clone.latencyTier = options.latencyTier as EngineCaps['latencyTier'];
  }
  if (typeof options.apiAvailability === 'string') {
    clone.apiAvailability = options.apiAvailability;
  }
  if (typeof options.brandId === 'string') {
    clone.brandId = options.brandId;
  }
  syncInputSchemaWithOptions(clone, options);
  return clone;
}

function mergeEngine(
  base: EngineCaps,
  settingsMap: Map<string, EngineSettingsRecord>,
  overrideMap: Map<string, EngineOverride>
): { engine: EngineCaps; disabled: boolean } {
  const clone = cloneEngine(base);
  const settings = settingsMap.get(base.id);
  if (settings) {
    applyOptions(clone, settings);
    applyPricingDetails(clone, settings.pricing ?? null);
  }

  const override = overrideMap.get(base.id);
  const disabled = override?.active === false;

  if (override?.availability) {
    clone.availability = override.availability as EngineCaps['availability'];
  }
  if (override?.status) {
    clone.status = override.status as EngineCaps['status'];
  }
  if (override?.latency_tier) {
    clone.latencyTier = override.latency_tier as EngineCaps['latencyTier'];
  }

  return { engine: clone, disabled };
}

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
    .map((engine) => mergeEngine(engine, settingsMap, overridesMap))
    .filter((entry) => includeDisabled || !entry.disabled)
    .map((entry) => entry.engine);
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

export async function getConfiguredEngines(includeDisabled = false): Promise<EngineCaps[]> {
  const baseEngines = getBaseEngines();
  return getConfiguredEnginesForBase(baseEngines, includeDisabled);
}

export async function getConfiguredEngine(engineId: string, includeDisabled = false): Promise<EngineCaps | undefined> {
  if (!engineId) return undefined;
  const engines = await getConfiguredEngines(includeDisabled);
  return engines.find((engine) => engine.id === engineId);
}

export async function computeConfiguredPreflight(request: PreflightRequest): Promise<PreflightResponse> {
  const engineId = typeof request.engine === 'string' ? request.engine : '';
  const engine = await getConfiguredEngine(engineId);
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
  let snapshot: PricingSnapshot;
  try {
    snapshot = await computePricingSnapshot({
      engine: pricingEngine,
      durationSec,
      resolution: effectiveResolution,
      mode: request.mode,
      membershipTier: memberTier,
      loop,
      durationOption: durationInfo?.label,
      addons,
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
