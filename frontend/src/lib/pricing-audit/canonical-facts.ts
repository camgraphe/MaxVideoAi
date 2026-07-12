import type { PricingFacts } from '@maxvideoai/pricing';
import { listFalEngines, type FalEngineEntry } from '@/config/falEngines';
import { buildAudioVendorCostFacts, type AudioPackId } from '@/lib/audio-generation';
import { isLumaRay2EngineId } from '@/lib/luma-ray2';
import {
  buildAuthoredPublicOfferFacts,
  buildPublicPricingFacts,
} from '@/lib/pricing-public-facts';
import { getLumaRay2BasePriceEnv } from '@/lib/pricing-specialized-snapshots';
import { buildBackgroundRemovalPricingPreview } from '@/lib/tools-background-removal';
import { buildUpscalePricingPreview } from '@/lib/tools-upscale';
import type { Mode } from '@/types/engines';

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

function buildScenarioPublicFacts(
  entry: FalEngineEntry,
  scenario: PricingAuditScenario,
  resolution: string,
  durationSec: number
): PricingFacts {
  const result = buildPublicPricingFacts({
    engine: entry.engine,
    durationSec,
    resolution,
    ...(scenario.mode ? { mode: scenario.mode as Mode } : {}),
    quality: typeof scenario.input.quality === 'string' ? scenario.input.quality : undefined,
    referenceImageCount: Number(scenario.input.referenceImageCount ?? 0),
    ...(isLumaRay2EngineId(entry.engine.id)
      ? { lumaRay2BasePriceUsd: Number(getLumaRay2BasePriceEnv(entry.engine.id)) }
      : {}),
  });
  return { ...result.facts, engineId: scenario.engineId };
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
      return buildAuthoredPublicOfferFacts({
        engineId: scenario.engineId,
        currency: entry.pricingHint?.currency ?? 'USD',
        amountCents: hinted,
      }).facts;
    }
  }
  if (scenario.surface === 'pricing-hub' || scenario.surface === 'model-page') {
    const dimensions = resolvePublicDimensions(entry, scenario);
    if (!dimensions) return null;
    return buildScenarioPublicFacts(entry, scenario, dimensions.resolution, dimensions.durationSec);
  }
  return buildScenarioPublicFacts(
    entry,
    scenario,
    scenario.resolution ?? 'default',
    scenario.durationSec ?? 1
  );
}
