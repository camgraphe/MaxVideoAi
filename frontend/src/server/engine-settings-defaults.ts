import type { EngineCaps, EnginePricingDetails } from '@/types/engines';
import type { EngineSettingsRecord } from '@/server/engine-configuration-read';

export type EngineSettingsSeedPayload = {
  engine_id: string;
  options: Record<string, unknown>;
  pricing: EnginePricingDetails | null;
  updated_by: string | null;
};

function normalizeOptions(engine: EngineCaps): Record<string, unknown> {
  return {
    label: engine.label,
    provider: engine.provider,
    maxDurationSec: engine.maxDurationSec,
    modes: engine.modes,
    resolutions: engine.resolutions,
    aspectRatios: engine.aspectRatios,
    fps: engine.fps,
    audio: engine.audio,
    upscale4k: engine.upscale4k,
    extend: engine.extend,
    motionControls: engine.motionControls,
    keyframes: engine.keyframes,
    inputLimits: engine.inputLimits,
    params: engine.params,
    availability: engine.availability,
    latencyTier: engine.latencyTier,
    apiAvailability: engine.apiAvailability ?? null,
    brandId: engine.brandId ?? null,
  };
}

function extractPricing(engine: EngineCaps): EnginePricingDetails | null {
  if (engine.pricingDetails) return engine.pricingDetails;
  if (!engine.pricing) return null;
  return {
    currency: engine.pricing.currency ?? 'USD',
    perSecondCents: engine.pricing.byResolution
      ? {
          default: engine.pricing.base != null ? Math.round(engine.pricing.base * 100) : undefined,
          byResolution: Object.fromEntries(
            Object.entries(engine.pricing.byResolution).map(([key, dollars]) => [key, Math.round(dollars * 100)])
          ),
        }
      : engine.pricing.base != null
        ? { default: Math.round(engine.pricing.base * 100) }
        : undefined,
    maxDurationSec: engine.maxDurationSec,
  };
}

// The writer and preflight share the effective system defaults. Administrator
// rows are never refreshed; JSON normalization matches the persisted payload.
export function buildEngineSettingsSeedPayload(
  engine: EngineCaps,
  current?: EngineSettingsRecord,
  updatedBy?: string,
): EngineSettingsSeedPayload | null {
  if (current?.updated_by != null) return null;
  return {
    engine_id: engine.id,
    options: JSON.parse(JSON.stringify(normalizeOptions(engine))),
    pricing: JSON.parse(JSON.stringify(extractPricing(engine) ?? current?.pricing ?? null)),
    updated_by: updatedBy ?? null,
  };
}

export function projectSeededEngineSettings(
  seededEngines: EngineCaps[],
  settings: Map<string, EngineSettingsRecord>,
): Map<string, EngineSettingsRecord> {
  const effective = new Map(settings);
  for (const engine of seededEngines) {
    const current = settings.get(engine.id);
    const payload = buildEngineSettingsSeedPayload(engine, current);
    if (payload) {
      // Timestamps are not inputs to engine projection; preserve known metadata.
      effective.set(engine.id, { ...payload, updated_at: current?.updated_at ?? '' });
    }
  }
  return effective;
}
