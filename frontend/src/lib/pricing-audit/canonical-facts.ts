import type { PricingFacts } from '@maxvideoai/pricing';
import { listFalEngines, type FalEngineEntry } from '@/config/falEngines';
import { buildAudioVendorCostFacts, type AudioPackId } from '@/lib/audio-generation';
import { isLumaAgentsImageEngineId, isLumaRay32EngineId } from '@/lib/luma-agents';
import {
  calculateLumaAgentsImageReferencePrice,
  calculateLumaRay32ReferencePrice,
} from '@/lib/luma-agents-pricing';
import { isLumaRay2EngineId } from '@/lib/luma-ray2';
import { calculateLumaRay2Price } from '@/lib/luma-ray2-pricing';
import { buildPricingDefinition } from '@/lib/pricing-definition';
import { getLumaRay2BasePriceEnv } from '@/lib/pricing-specialized-snapshots';
import { computeSeedance2TokenQuote, isSeedance2TokenPricing } from '@/lib/seedance-2-pricing';
import { normalizeGptImage2Quality, resolveGptImage2PricingTier } from '@/lib/image/gptImage2';
import { buildBackgroundRemovalPricingPreview } from '@/lib/tools-background-removal';
import { buildUpscalePricingPreview } from '@/lib/tools-upscale';

import type { PricingAuditScenario } from './types';

const entriesById = new Map(listFalEngines().map((entry) => [entry.id, entry]));

function parseDuration(value: number | string | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const match = value.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function durationOptions(entry: FalEngineEntry): number[] {
  const values = new Set<number>();
  for (const mode of entry.modes) {
    const duration = mode.ui.duration;
    if (duration && 'options' in duration) {
      duration.options.forEach((option) => {
        const parsed = parseDuration(option);
        if (parsed != null) values.add(parsed);
      });
    }
  }
  const field = [...(entry.engine.inputSchema?.required ?? []), ...(entry.engine.inputSchema?.optional ?? [])].find(
    (candidate) => candidate.id === 'duration' || candidate.id === 'duration_seconds'
  );
  field?.values?.forEach((value) => {
    const parsed = parseDuration(value);
    if (parsed != null) values.add(parsed);
  });
  return [...values].sort((left, right) => left - right);
}

function resolvePublicDimensions(
  entry: FalEngineEntry,
  scenario: PricingAuditScenario
): { resolution: string; durationSec: number } | null {
  const options = durationOptions(entry);
  const presetId = String(scenario.input.presetId ?? '');
  const engineResolutions = entry.engine.resolutions.map(String);
  let resolution = scenario.resolution ?? engineResolutions[0] ?? 'default';
  let durationSec = scenario.durationSec ?? options[0] ?? entry.engine.maxDurationSec ?? 1;

  if (presetId === 'entry-route') {
    const preferredResolution = ['720p', '768p', '1080p', '480p', '540p', '512p', '4k'];
    resolution =
      preferredResolution
        .map((candidate) => engineResolutions.find((value) => value.toLowerCase() === candidate))
        .find(Boolean) ??
      engineResolutions[0] ??
      resolution;
    durationSec = [10, 8, 5, 6, 12, 15, 4].find((value) => options.includes(value)) ?? options[0] ?? durationSec;
  } else if (presetId === '4k-route') {
    durationSec = [10, 8, 5].find((value) => options.includes(value)) ?? options.find((value) => value >= 5) ?? options[0] ?? durationSec;
  }

  const exactResolution = engineResolutions.find((value) => value.toLowerCase() === resolution.toLowerCase());
  if (!exactResolution) return null;
  if (options.length && !options.includes(durationSec)) return null;
  if (scenario.input.audio === true && !entry.engine.audio) return null;
  return { resolution: exactResolution, durationSec };
}

function standardFacts(entry: FalEngineEntry, scenario: PricingAuditScenario, resolution: string, durationSec: number): PricingFacts {
  const definition = buildPricingDefinition(entry.engine);
  if (!definition) throw new Error(`Missing pricing definition for ${entry.id}`);
  const multiplier = definition.resolutionMultipliers[resolution] ?? definition.resolutionMultipliers.default ?? 1;
  const exact = Math.max(definition.minChargeCents ?? 0, definition.baseUnitPriceCents * multiplier * durationSec);
  return {
    engineId: scenario.engineId,
    currency: definition.currency,
    vendorSubtotalExactCents: exact,
    unit: 'sec',
    quantity: durationSec,
  };
}

function engineFacts(
  entry: FalEngineEntry,
  scenario: PricingAuditScenario,
  resolution: string,
  durationSec: number
): PricingFacts {
  const engine = entry.engine;
  if (isLumaAgentsImageEngineId(engine.id) && (scenario.mode === 't2i' || scenario.mode === 'i2i')) {
    const quote = calculateLumaAgentsImageReferencePrice({
      engineId: engine.id,
      mode: scenario.mode,
      referenceImageCount: Number(scenario.input.referenceImageCount ?? 0),
    });
    return {
      engineId: scenario.engineId,
      currency: 'USD',
      vendorSubtotalExactCents: quote.baseSubtotalUsd * 100,
      unit: 'image',
      quantity: 1,
    };
  }
  if (isLumaRay32EngineId(engine.id) && (scenario.mode === 't2v' || scenario.mode === 'i2v')) {
    const quote = calculateLumaRay32ReferencePrice({ duration: `${durationSec}s`, resolution });
    return {
      engineId: scenario.engineId,
      currency: 'USD',
      vendorSubtotalExactCents: quote.baseSubtotalUsd * 100,
      unit: 'sec',
      quantity: durationSec,
    };
  }
  if (isLumaRay2EngineId(engine.id) && (scenario.mode === 't2v' || scenario.mode === 'i2v')) {
    const baseUsd = Number(getLumaRay2BasePriceEnv(engine.id));
    const quote = calculateLumaRay2Price({
      engineId: engine.id === 'lumaRay2_flash' ? 'luma-ray2-flash' : 'luma-ray2',
      baseUsd,
      duration: durationSec,
      resolution,
    });
    return {
      engineId: scenario.engineId,
      currency: 'USD',
      vendorSubtotalExactCents: quote.baseSubtotalUsd * 100,
      unit: 'sec',
      quantity: durationSec,
    };
  }
  if (engine.id === 'gpt-image-2') {
    const tier = resolveGptImage2PricingTier(resolution);
    const quality = normalizeGptImage2Quality(typeof scenario.input.quality === 'string' ? scenario.input.quality : undefined);
    const count = Math.max(1, Math.round(durationSec));
    return {
      engineId: scenario.engineId,
      currency: 'USD',
      vendorSubtotalExactCents: tier.prices[quality] * count,
      unit: 'image',
      quantity: count,
    };
  }
  if (isSeedance2TokenPricing(engine.pricingDetails)) {
    const quote = computeSeedance2TokenQuote({
      details: engine.pricingDetails,
      durationSec,
      resolution,
      aspectRatio: engine.pricingDetails.tokenPricing.defaultAspectRatio,
    });
    return {
      engineId: scenario.engineId,
      currency: engine.pricingDetails.currency,
      vendorSubtotalExactCents: quote.vendorCostUsd * 100,
      unit: 'sec',
      quantity: durationSec,
    };
  }
  return standardFacts(entry, scenario, resolution, durationSec);
}

function toolFacts(scenario: PricingAuditScenario): PricingFacts {
  const unitPriceCents = Number(scenario.input.unitPriceCents ?? 0);
  let totalCents = unitPriceCents;
  if (scenario.engineId === 'background-removal') {
    totalCents =
      buildBackgroundRemovalPricingPreview({
        unitPriceCents,
        currency: 'USD',
        durationSec: Number(scenario.input.durationSec ?? 10),
        outputCodec: String(scenario.input.outputCodec ?? 'webm_vp9'),
      }).totalCents ?? unitPriceCents;
  } else if (scenario.engineId === 'upscale') {
    totalCents =
      buildUpscalePricingPreview({
        mediaType: 'image',
        engineId: 'seedvr-image',
        unitPriceCents,
        currency: 'USD',
        imageWidth: Number(scenario.input.width ?? 1024),
        imageHeight: Number(scenario.input.height ?? 1024),
        upscaleFactor: Number(scenario.input.factor ?? 2),
      }).totalCents ?? unitPriceCents;
  }
  return {
    engineId: scenario.engineId,
    currency: 'USD',
    vendorSubtotalExactCents: totalCents,
    unit: 'run',
    quantity: 1,
  };
}

export function buildCanonicalPricingFacts(scenario: PricingAuditScenario): PricingFacts | null {
  if (scenario.surface === 'audio') {
    const facts = buildAudioVendorCostFacts({
      pack: String(scenario.input.pack) as AudioPackId,
      durationSec: scenario.durationSec ?? 3,
      script: scenario.mode === 'voice_only' || scenario.mode === 'cinematic_voice' ? 'Audit voice script' : undefined,
    });
    return {
      engineId: scenario.engineId,
      currency: 'USD',
      vendorSubtotalExactCents: facts.vendorSubtotalCents,
      unit: facts.unit,
      quantity: facts.durationSec,
    };
  }
  if (scenario.surface === 'tool') return toolFacts(scenario);
  const entry = entriesById.get(scenario.engineId);
  if (!entry) throw new Error(`Missing pricing audit engine ${scenario.engineId}`);
  if (scenario.surface === 'json-ld') {
    const hinted = entry.pricingHint?.amountCents;
    if (typeof hinted === 'number' && Number.isFinite(hinted) && hinted > 0) {
      return {
        engineId: scenario.engineId,
        currency: entry.pricingHint?.currency ?? 'USD',
        vendorSubtotalExactCents: Math.round(hinted),
        unit: 'offer',
        quantity: 1,
      };
    }
  }
  if (scenario.surface === 'pricing-hub' || scenario.surface === 'model-page') {
    const dimensions = resolvePublicDimensions(entry, scenario);
    if (!dimensions) return null;
    return engineFacts(entry, scenario, dimensions.resolution, dimensions.durationSec);
  }
  return engineFacts(entry, scenario, scenario.resolution ?? 'default', scenario.durationSec ?? 1);
}
