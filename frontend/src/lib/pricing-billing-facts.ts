import {
  computePricingSnapshot as computeKernelSnapshot,
  type PricingEngineDefinition,
  type PricingFacts,
  type PricingSnapshot,
} from '@maxvideoai/pricing';
import type { EnginePricingDetails } from '@/types/engines';
import type { PricingContext } from '@/lib/pricing';
import { getPricingKernel } from '@/lib/pricing-kernel';
import { isLumaAgentsImageEngineId, isLumaRay32EngineId, isLumaRay32PublicMode } from '@/lib/luma-agents';
import {
  calculateLumaAgentsImageReferencePrice,
  calculateLumaRay32DirectPrice,
  calculateLumaRay32ReferencePrice,
} from '@/lib/luma-agents-pricing';
import {
  getLumaRay2DurationInfo,
  getLumaRay2ResolutionInfo,
  isLumaRay2EditMode,
  isLumaRay2EngineId,
  isLumaRay2GenerateMode,
  normaliseLumaRay2Loop,
  LUMA_RAY2_ERROR_UNSUPPORTED,
} from '@/lib/luma-ray2';
import type { LumaRay2EditWorkflow } from '@/lib/luma-ray2-pricing';
import { computeSeedance2TokenQuote, isSeedance2TokenPricing } from '@/lib/seedance-2-pricing';
import type { PricingRule } from '@/lib/pricing-rule-store';
import {
  buildDefinitionFromEngine,
  buildGptImage2Snapshot,
  buildLumaAgentsImageSnapshot,
  buildLumaRay32DirectSnapshot,
  buildLumaRay32Snapshot,
  buildLumaRay2EditSnapshot,
  buildLumaRay2Snapshot,
  buildSeedance2Snapshot,
  getLumaRay2BasePriceEnv,
  getLumaRay2EditRateEnv,
} from '@/lib/pricing-specialized-snapshots';

export type BillingPricingFacts = {
  facts: PricingFacts;
  base: PricingSnapshot['base'];
  addons: PricingSnapshot['addons'];
  meta: Record<string, unknown>;
  compatibilityProfileId: string;
};

const ZERO_DISCOUNTS: PricingEngineDefinition['memberTierDiscounts'] = {
  member: 0,
  plus: 0,
  pro: 0,
};

function booleanAddon(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
  return false;
}

function factsOnlyRule(currency: string): PricingRule {
  return {
    id: 'facts-only',
    marginPercent: 0,
    marginFlatCents: 0,
    surchargeAudioPercent: 0,
    surchargeUpscalePercent: 0,
    currency,
  };
}

function fromSnapshot(
  engineId: string,
  currency: string,
  snapshot: PricingSnapshot,
  vendorSubtotalExactCents: number,
  compatibilityProfileId = 'standard'
): BillingPricingFacts {
  return {
    facts: {
      engineId,
      currency,
      vendorSubtotalExactCents,
      unit: snapshot.base.unit ?? 'sec',
      quantity: snapshot.base.seconds,
    },
    base: { ...snapshot.base },
    addons: snapshot.addons.map((addon) => ({ ...addon })),
    meta: { ...(snapshot.meta ?? {}) },
    compatibilityProfileId,
  };
}

export function buildBillingPricingFacts(
  context: PricingContext,
  pricingDetails: EnginePricingDetails | undefined,
  currency: string
): BillingPricingFacts {
  const { engine, durationSec, resolution } = context;
  const mode = context.mode ?? 't2v';
  const rule = factsOnlyRule(currency);

  if (isLumaAgentsImageEngineId(engine.id) && (mode === 't2i' || mode === 'i2i')) {
    const addonReferenceImageCount =
      typeof context.addons?.reference_image_count === 'number' && Number.isFinite(context.addons.reference_image_count)
        ? context.addons.reference_image_count
        : 0;
    const referenceImageCount = context.referenceImageCount ?? addonReferenceImageCount;
    const reference = calculateLumaAgentsImageReferencePrice({ engineId: engine.id, mode, referenceImageCount });
    const snapshot = buildLumaAgentsImageSnapshot({
      engineId: engine.id,
      mode,
      referenceImageCount,
      rule,
      memberTier: 'member',
      memberTierDiscounts: ZERO_DISCOUNTS,
      currency,
    });
    return fromSnapshot(
      engine.id,
      currency,
      snapshot,
      reference.baseSubtotalUsd * 100,
      'provider-reference-current'
    );
  }

  if (isLumaRay32EngineId(engine.id) && isLumaRay32PublicMode(mode)) {
    const reference = calculateLumaRay32ReferencePrice({
      duration: context.durationOption ?? durationSec,
      resolution,
      hdr: booleanAddon(context.addons?.hdr),
      exrExport: booleanAddon(context.addons?.exr_export ?? context.addons?.exrExport),
    });
    const snapshot = buildLumaRay32Snapshot({
      duration: context.durationOption ?? durationSec,
      resolution,
      hdr: booleanAddon(context.addons?.hdr),
      exrExport: booleanAddon(context.addons?.exr_export ?? context.addons?.exrExport),
      rule,
      memberTier: 'member',
      memberTierDiscounts: ZERO_DISCOUNTS,
      currency,
    });
    return fromSnapshot(
      engine.id,
      currency,
      snapshot,
      reference.baseSubtotalUsd * 100,
      'provider-reference-current'
    );
  }

  if (isLumaRay32EngineId(engine.id) && (mode === 'v2v' || mode === 'reframe')) {
    const reference = calculateLumaRay32DirectPrice({
      mode,
      durationSec,
      duration: context.durationOption ?? durationSec,
      resolution,
      hdr: booleanAddon(context.addons?.hdr),
      exrExport: booleanAddon(context.addons?.exr_export ?? context.addons?.exrExport),
    });
    const snapshot = buildLumaRay32DirectSnapshot({
      mode,
      durationSec,
      duration: context.durationOption ?? durationSec,
      resolution,
      hdr: booleanAddon(context.addons?.hdr),
      exrExport: booleanAddon(context.addons?.exr_export ?? context.addons?.exrExport),
      rule,
      memberTier: 'member',
      memberTierDiscounts: ZERO_DISCOUNTS,
      currency,
    });
    return fromSnapshot(
      engine.id,
      currency,
      snapshot,
      reference.baseSubtotalUsd * 100,
      'provider-reference-current'
    );
  }

  if (isLumaRay2EngineId(engine.id) && isLumaRay2GenerateMode(mode)) {
    const baseUsd = Number(getLumaRay2BasePriceEnv(engine.id));
    if (!Number.isFinite(baseUsd) || baseUsd <= 0) {
      throw new Error('Luma Ray 2 base price must be a positive number');
    }
    const durationInfo = getLumaRay2DurationInfo(context.durationOption ?? durationSec);
    const resolutionInfo = getLumaRay2ResolutionInfo(resolution);
    if (!durationInfo || !resolutionInfo) throw new Error(LUMA_RAY2_ERROR_UNSUPPORTED);
    const snapshot = buildLumaRay2Snapshot({
      engineId: engine.id === 'lumaRay2_flash' ? 'luma-ray2-flash' : 'luma-ray2',
      baseUsd,
      duration: durationInfo.label,
      resolution: resolutionInfo.value,
      loop: normaliseLumaRay2Loop(context.loop),
      rule,
      memberTier: 'member',
      memberTierDiscounts: ZERO_DISCOUNTS,
      currency,
    });
    snapshot.base.seconds = durationInfo.seconds;
    return fromSnapshot(engine.id, currency, snapshot, snapshot.base.amountCents);
  }

  if (isLumaRay2EngineId(engine.id) && isLumaRay2EditMode(mode)) {
    const workflow: LumaRay2EditWorkflow = mode === 'reframe' ? 'reframe' : 'modify';
    const rateUsd = Number(getLumaRay2EditRateEnv(engine.id, workflow));
    if (!Number.isFinite(rateUsd) || rateUsd <= 0) {
      throw new Error('Luma Ray 2 edit rate must be a positive number');
    }
    const snapshot = buildLumaRay2EditSnapshot({
      engineId: engine.id === 'lumaRay2_flash' ? 'luma-ray2-flash' : 'luma-ray2',
      workflow,
      durationSec,
      rateUsd,
      rule,
      memberTier: 'member',
      memberTierDiscounts: ZERO_DISCOUNTS,
      currency,
    });
    return fromSnapshot(engine.id, currency, snapshot, snapshot.base.amountCents);
  }

  if (engine.id === 'gpt-image-2') {
    const snapshot = buildGptImage2Snapshot({
      numImages: durationSec,
      imageSize: resolution,
      customImageSize: context.customImageSize,
      quality: context.quality,
      rule,
      memberTier: 'member',
      memberTierDiscounts: ZERO_DISCOUNTS,
      currency,
    });
    return fromSnapshot(engine.id, currency, snapshot, snapshot.base.amountCents);
  }

  if (isSeedance2TokenPricing(pricingDetails)) {
    const billingInputType =
      context.hasVideoInput === true ? 'video_input' : context.hasVideoInput === false ? 'no_video_input' : undefined;
    const providerQuote = computeSeedance2TokenQuote({
      details: pricingDetails,
      durationSec,
      resolution,
      aspectRatio: context.aspectRatio,
      billingInputType,
    });
    const snapshot = buildSeedance2Snapshot({
      pricingDetails,
      durationSec,
      resolution,
      aspectRatio: context.aspectRatio,
      billingInputType,
      rule,
      memberTier: 'member',
      memberTierDiscounts: ZERO_DISCOUNTS,
      currency,
    });
    return fromSnapshot(
      engine.id,
      currency,
      snapshot,
      providerQuote.vendorCostUsd * 100,
      'provider-reference-current'
    );
  }

  let definition = buildDefinitionFromEngine(engine, pricingDetails);
  if (!definition) {
    definition = getPricingKernel().getDefinition(engine.id) ?? null;
  }
  if (!definition) throw new Error(`Pricing definition not found for engine ${engine.id}`);
  if (!definition.resolutionMultipliers[resolution] && pricingDetails?.perSecondCents?.byResolution?.[resolution]) {
    const perSecond = pricingDetails.perSecondCents.byResolution[resolution];
    if (typeof perSecond === 'number' && definition.baseUnitPriceCents > 0) {
      definition = {
        ...definition,
        resolutionMultipliers: {
          ...definition.resolutionMultipliers,
          [resolution]: perSecond / definition.baseUnitPriceCents,
        },
      };
    }
  }
  const factualDefinition: PricingEngineDefinition = {
    ...definition,
    currency,
    platformFeePct: 0,
    platformFeeFlatCents: 0,
    memberTierDiscounts: ZERO_DISCOUNTS,
  };
  const factualSnapshot = computeKernelSnapshot(factualDefinition, {
    engineId: engine.id,
    durationSec,
    resolution,
    memberTier: 'member',
    ...(context.addons ? { addons: context.addons } : {}),
  }).snapshot;
  const exactSubtotal = factualSnapshot.base.amountCents + factualSnapshot.addons.reduce((sum, addon) => sum + addon.amountCents, 0);
  return fromSnapshot(engine.id, currency, factualSnapshot, exactSubtotal);
}
