import { cloneEngine } from '@/lib/engines';
import type {
  EngineCaps,
  EngineInputField,
  EnginePricing,
  EnginePricingDetails,
} from '@/types/engines';
import { applyBytePlusSeedanceRuntimeOptions } from '@/server/video-providers/byteplus-modelark';
import { applyGoogleVertexVeoRuntimeOptions } from '@/server/video-providers/google-vertex-veo/model-map';

import type { EngineOverride, EngineSettingsRecord } from './engine-configuration-read';

function applyPricingDetails(engine: EngineCaps, pricing: EnginePricingDetails | null): void {
  if (!pricing) return;
  engine.pricingDetails = {
    ...pricing,
    ...(!pricing.byMode && engine.pricingDetails?.byMode
      ? { byMode: engine.pricingDetails.byMode }
      : {}),
    ...(!pricing.referenceImages && engine.pricingDetails?.referenceImages
      ? { referenceImages: engine.pricingDetails.referenceImages }
      : {}),
  };
  const byResolution = pricing.perSecondCents?.byResolution ?? null;
  const baseCents = pricing.perSecondCents?.default ?? null;
  const pricingData: EnginePricing = { unit: 'sec', currency: pricing.currency };
  if (baseCents != null) pricingData.base = baseCents / 100;
  if (byResolution) {
    pricingData.byResolution = Object.fromEntries(
      Object.entries(byResolution).map(([key, cents]) => [key, cents / 100]),
    );
  }
  engine.pricing = pricingData;
}

function filterFieldValues(field: EngineInputField, allowedValues: string[]): EngineInputField {
  if (field.type !== 'enum' || !Array.isArray(field.values) || !allowedValues.length) return field;
  const nextValues = field.values.filter((value) => allowedValues.includes(value));
  if (!nextValues.length) return field;
  const currentDefault = typeof field.default === 'string' && nextValues.includes(field.default)
    ? field.default
    : nextValues[0];
  return { ...field, values: nextValues, default: currentDefault };
}

function filterDurationField(field: EngineInputField, maxDurationSec?: number): EngineInputField {
  if (field.type !== 'enum'
    || field.id !== 'duration'
    || !Array.isArray(field.values)
    || typeof maxDurationSec !== 'number') return field;
  const nextValues = field.values.filter((value) => {
    const numeric = Number(String(value).replace(/[^\d.]/g, ''));
    return !Number.isFinite(numeric) || numeric <= maxDurationSec;
  });
  if (!nextValues.length) return field;
  const currentDefault = typeof field.default === 'string' && nextValues.includes(field.default)
    ? field.default
    : nextValues[0];
  return { ...field, values: nextValues, default: currentDefault };
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
    ? options.fps.filter((value): value is number => typeof value === 'number').map(String)
    : [];
  const maxDurationSec = typeof options.maxDurationSec === 'number' ? options.maxDurationSec : undefined;
  const syncField = (field: EngineInputField): EngineInputField => {
    let nextField = field;
    if (field.id === 'resolution') nextField = filterFieldValues(nextField, allowedResolutions);
    else if (field.id === 'aspect_ratio') nextField = filterFieldValues(nextField, allowedAspectRatios);
    else if (field.id === 'fps') nextField = filterFieldValues(nextField, allowedFps);
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
  if (Array.isArray(options.modes)) {
    engine.modes = options.modes.filter((mode): mode is EngineCaps['modes'][number] =>
      typeof mode === 'string') as EngineCaps['modes'];
  }
  if (typeof options.maxDurationSec === 'number') engine.maxDurationSec = options.maxDurationSec;
  if (Array.isArray(options.resolutions)) {
    engine.resolutions = options.resolutions.filter(
      (value): value is EngineCaps['resolutions'][number] => typeof value === 'string',
    ) as EngineCaps['resolutions'];
  }
  if (Array.isArray(options.aspectRatios)) {
    engine.aspectRatios = options.aspectRatios.filter(
      (value): value is EngineCaps['aspectRatios'][number] => typeof value === 'string',
    ) as EngineCaps['aspectRatios'];
  }
  if (Array.isArray(options.fps)) {
    engine.fps = options.fps.filter((value): value is number => typeof value === 'number');
  }
  if (typeof options.audio === 'boolean') engine.audio = options.audio;
  if (typeof options.upscale4k === 'boolean') engine.upscale4k = options.upscale4k;
  if (typeof options.extend === 'boolean') engine.extend = options.extend;
  if (typeof options.motionControls === 'boolean') engine.motionControls = options.motionControls;
  if (typeof options.keyframes === 'boolean') engine.keyframes = options.keyframes;
  if (options.inputLimits && typeof options.inputLimits === 'object') {
    engine.inputLimits = { ...engine.inputLimits, ...(options.inputLimits as EngineCaps['inputLimits']) };
  }
  if (options.params && typeof options.params === 'object') {
    engine.params = { ...engine.params, ...(options.params as EngineCaps['params']) };
  }
  if (typeof options.availability === 'string') {
    engine.availability = options.availability as EngineCaps['availability'];
  }
  if (typeof options.latencyTier === 'string') {
    engine.latencyTier = options.latencyTier as EngineCaps['latencyTier'];
  }
  if (typeof options.apiAvailability === 'string') engine.apiAvailability = options.apiAvailability;
  if (typeof options.brandId === 'string') engine.brandId = options.brandId;
  syncInputSchemaWithOptions(engine, options);
  return engine;
}

export function projectConfiguredEngine(
  base: EngineCaps,
  settingsMap: Map<string, EngineSettingsRecord>,
  overrideMap: Map<string, EngineOverride>,
): { engine: EngineCaps; disabled: boolean } {
  const engine = cloneEngine(base);
  const settings = settingsMap.get(base.id);
  if (settings) {
    applyOptions(engine, settings);
    applyPricingDetails(engine, settings.pricing ?? null);
  }
  const override = overrideMap.get(base.id);
  const disabled = override?.active === false;
  if (override?.availability) engine.availability = override.availability as EngineCaps['availability'];
  if (override?.status) engine.status = override.status as EngineCaps['status'];
  if (override?.latency_tier) engine.latencyTier = override.latency_tier as EngineCaps['latencyTier'];
  return { engine, disabled };
}

export function applyConfiguredEngineRuntimeOptions(engine: EngineCaps): EngineCaps {
  return applyGoogleVertexVeoRuntimeOptions(applyBytePlusSeedanceRuntimeOptions(engine));
}
