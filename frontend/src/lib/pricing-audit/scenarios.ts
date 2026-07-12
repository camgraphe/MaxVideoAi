import { listFalEngines } from '@/config/falEngines';
import type { EngineCaps } from '@/types/engines';

import type { PricingAuditScenario } from './types';

const MEMBER_TIERS = ['member', 'plus', 'pro'] as const;
const PRICING_HUB_PRESETS = [
  { id: 'entry-route', resolution: '720p', durationSec: null, audio: false },
  { id: '5s-720p', resolution: '720p', durationSec: 5, audio: false },
  { id: '10s-720p', resolution: '720p', durationSec: 10, audio: false },
  { id: '8s-1080p', resolution: '1080p', durationSec: 8, audio: false },
  { id: '10s-1080p', resolution: '1080p', durationSec: 10, audio: false },
  { id: '10s-1080p-audio', resolution: '1080p', durationSec: 10, audio: true },
  { id: '4k-route', resolution: '4k', durationSec: null, audio: false },
] as const;
const AUDIO_PACKS = ['music_only', 'voice_only', 'cinematic', 'cinematic_voice'] as const;
const TOOL_PRODUCTS = ['angle', 'background-removal', 'upscale'] as const;
const PROVIDER_REFERENCE_COMPATIBILITY_ENGINE_IDS = new Set([
  'luma-ray-3-2',
  'luma-uni-1',
  'luma-uni-1-max',
  'seedance-2-0',
  'seedance-2-0-fast',
  'seedance-2-0-mini',
]);

function compatibilityProfileForEngine(engineId: string): string | undefined {
  return PROVIDER_REFERENCE_COMPATIBILITY_ENGINE_IDS.has(engineId) ? 'provider-reference-current' : undefined;
}

function resolveDuration(engine: EngineCaps): number {
  const durationField =
    engine.inputSchema?.optional?.find((field) => field.id === 'duration_seconds') ??
    engine.inputSchema?.optional?.find((field) => field.id === 'duration');
  const raw = durationField?.default ?? durationField?.min ?? engine.pricingDetails?.maxDurationSec ?? engine.maxDurationSec ?? 1;
  const parsed = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 1;
}

function resolveResolution(engine: EngineCaps): string {
  const resolutionField =
    engine.inputSchema?.optional?.find((field) => field.id === 'resolution') ??
    engine.inputSchema?.required?.find((field) => field.id === 'resolution');
  if (typeof resolutionField?.default === 'string' && resolutionField.default !== 'auto') {
    return resolutionField.default;
  }
  return engine.resolutions?.find((value) => value !== 'auto') ?? 'default';
}

function addScenario(rows: PricingAuditScenario[], scenario: PricingAuditScenario): void {
  rows.push(scenario);
}

export function buildPricingAuditScenarios(): PricingAuditScenario[] {
  const entries = listFalEngines().filter((entry) => entry.surfaces.pricing.includeInEstimator);
  const rows: PricingAuditScenario[] = [];

  for (const entry of entries) {
    const engine = entry.engine;
    const durationSec = resolveDuration(engine);
    const resolution = resolveResolution(engine);
    const mode = entry.modes[0]?.mode ?? (entry.category === 'image' ? 't2i' : 't2v');
    const equivalenceKey = `${entry.id}:${mode}:${durationSec}:${resolution}:member`;
    const compatibilityProfile = compatibilityProfileForEngine(entry.id);

    for (const membershipTier of MEMBER_TIERS) {
      addScenario(rows, {
        id: `billing:${entry.id}:${mode}:${durationSec}:${resolution}:${membershipTier}`,
        surface: 'billing',
        engineId: entry.id,
        mode,
        resolution,
        durationSec,
        membershipTier,
        equivalenceKey: `${entry.id}:${mode}:${durationSec}:${resolution}:${membershipTier}`,
        ...(compatibilityProfile ? { compatibilityProfile } : {}),
        input: {},
      });
    }

    addScenario(rows, {
      id: `estimator:${entry.id}:${durationSec}:${resolution}`,
      surface: 'estimator',
      engineId: entry.id,
      mode,
      resolution,
      durationSec,
      membershipTier: 'member',
      equivalenceKey,
      ...(compatibilityProfile ? { compatibilityProfile } : {}),
      input: {},
    });
  }

  const videoEntry = entries.find((entry) => entry.category !== 'image');
  const imageEntry = entries.find((entry) => entry.category === 'image');
  if (videoEntry) {
    for (const preset of PRICING_HUB_PRESETS) {
      addScenario(rows, {
        id: `pricing-hub:${videoEntry.id}:${preset.id}`,
        surface: 'pricing-hub',
        engineId: videoEntry.id,
        mode: 't2v',
        resolution: preset.resolution,
        durationSec: preset.durationSec ?? undefined,
        membershipTier: 'member',
        ...(compatibilityProfileForEngine(videoEntry.id)
          ? { compatibilityProfile: compatibilityProfileForEngine(videoEntry.id) }
          : {}),
        input: { presetId: preset.id, audio: preset.audio },
      });
    }

    const durationSec = resolveDuration(videoEntry.engine);
    const resolution = resolveResolution(videoEntry.engine);
    const equivalenceKey = `${videoEntry.id}:t2v:${durationSec}:${resolution}:member`;
    addScenario(rows, {
      id: `price-chip:${videoEntry.id}:${durationSec}:${resolution}`,
      surface: 'price-chip',
      engineId: videoEntry.id,
      mode: 't2v',
      resolution,
      durationSec,
      membershipTier: 'member',
      ...(compatibilityProfileForEngine(videoEntry.id)
        ? { compatibilityProfile: compatibilityProfileForEngine(videoEntry.id) }
        : {}),
      equivalenceKey,
      input: {},
    });
    addScenario(rows, {
      id: `model-page:${videoEntry.id}:decision`,
      surface: 'model-page',
      engineId: videoEntry.id,
      mode: 't2v',
      resolution,
      durationSec,
      membershipTier: 'member',
      ...(compatibilityProfileForEngine(videoEntry.id)
        ? { compatibilityProfile: compatibilityProfileForEngine(videoEntry.id) }
        : {}),
      equivalenceKey,
      input: { modelSlug: videoEntry.modelSlug },
    });
    addScenario(rows, {
      id: `json-ld:${videoEntry.id}:offer`,
      surface: 'json-ld',
      engineId: videoEntry.id,
      mode: 't2v',
      resolution,
      durationSec,
      membershipTier: 'member',
      compatibilityProfile: 'schema-current',
      input: { modelSlug: videoEntry.modelSlug },
    });
  }

  if (imageEntry) {
    addScenario(rows, {
      id: `pricing-hub:${imageEntry.id}:image-default`,
      surface: 'pricing-hub',
      engineId: imageEntry.id,
      mode: 't2i',
      resolution: resolveResolution(imageEntry.engine),
      durationSec: 1,
      membershipTier: 'member',
      ...(compatibilityProfileForEngine(imageEntry.id)
        ? { compatibilityProfile: compatibilityProfileForEngine(imageEntry.id) }
        : {}),
      input: { quantity: 1 },
    });
  }

  for (const pack of AUDIO_PACKS) {
    for (const durationSec of [3, 30, 184]) {
      addScenario(rows, {
        id: `audio:${pack}:${durationSec}`,
        surface: 'audio',
        engineId: 'audio-generation',
        mode: pack,
        durationSec,
        membershipTier: 'member',
        compatibilityProfile: 'audio-current',
        input: { pack },
      });
    }
  }

  for (const product of TOOL_PRODUCTS) {
    addScenario(rows, {
      id: `tool:${product}:default`,
      surface: 'tool',
      engineId: product,
      membershipTier: 'member',
      compatibilityProfile: 'fixed-product-current',
      input:
        product === 'angle'
          ? { product, unitPriceCents: 4, engineId: 'flux-multiple-angles', width: 1024, height: 1024 }
          : product === 'background-removal'
            ? { product, unitPriceCents: 5, durationSec: 10, outputCodec: 'webm_vp9' }
            : { product, unitPriceCents: 4, mediaType: 'image', engineId: 'seedvr-image', width: 1024, height: 1024, factor: 2 },
    });
  }

  rows.sort((left, right) =>
    left.surface.localeCompare(right.surface) || left.engineId.localeCompare(right.engineId) || left.id.localeCompare(right.id)
  );
  const ids = new Set<string>();
  for (const row of rows) {
    if (ids.has(row.id)) throw new Error(`Duplicate pricing audit scenario id: ${row.id}`);
    ids.add(row.id);
  }
  return rows;
}
