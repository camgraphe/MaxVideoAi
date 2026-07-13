import {
  computePricingSnapshot as computeKernelSnapshot,
  type PricingEngineDefinition,
  type PricingFacts,
  type PricingSnapshot,
} from '@maxvideoai/pricing';
import { normalizeGptImage2Quality, resolveGptImage2PricingTier } from '@/lib/image/gptImage2';
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
import { calculateLumaRay2EditPrice, calculateLumaRay2Price, type LumaRay2EditWorkflow } from '@/lib/luma-ray2-pricing';
import { getLumaRay2BasePriceUsd, getLumaRay2EditRateUsd } from '@/lib/luma-ray2-pricing-config';
import type { PricingContext } from '@/lib/pricing-context';
import { applyEnginePricingOverride, buildPricingDefinition } from '@/lib/pricing-definition';
import { getPricingKernel } from '@/lib/pricing-kernel';
import {
  computeSeedance2TokenQuote,
  isSeedance2TokenPricing,
  roundUsdUpToCents,
} from '@/lib/seedance-2-pricing';
import type { EnginePricingDetails } from '@/types/engines';

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

function resultFromFacts(params: {
  engineId: string;
  currency: string;
  vendorSubtotalExactCents: number;
  base: PricingSnapshot['base'];
  addons?: PricingSnapshot['addons'];
  meta?: Record<string, unknown>;
  compatibilityProfileId?: string;
}): BillingPricingFacts {
  return {
    facts: {
      engineId: params.engineId,
      currency: params.currency,
      vendorSubtotalExactCents: params.vendorSubtotalExactCents,
      unit: params.base.unit ?? 'sec',
      quantity: params.base.seconds,
    },
    base: { ...params.base },
    addons: (params.addons ?? []).map((addon) => ({ ...addon })),
    meta: { ...(params.meta ?? {}) },
    compatibilityProfileId: params.compatibilityProfileId ?? 'standard',
  };
}

export function buildBillingPricingFacts(
  context: PricingContext,
  pricingDetails: EnginePricingDetails | undefined,
  currency: string
): BillingPricingFacts {
  const { engine, durationSec, resolution } = context;
  const mode = context.mode ?? 't2v';

  if (isLumaAgentsImageEngineId(engine.id) && (mode === 't2i' || mode === 'i2i')) {
    const addonReferenceImageCount =
      typeof context.addons?.reference_image_count === 'number' && Number.isFinite(context.addons.reference_image_count)
        ? context.addons.reference_image_count
        : 0;
    const referenceImageCount = context.referenceImageCount ?? addonReferenceImageCount;
    const reference = calculateLumaAgentsImageReferencePrice({ engineId: engine.id, mode, referenceImageCount });
    const presentedCents = Math.max(0, Math.ceil(reference.baseSubtotalUsd * 100 - 1e-9));
    return resultFromFacts({
      engineId: engine.id,
      currency,
      vendorSubtotalExactCents: reference.baseSubtotalUsd * 100,
      base: { seconds: 1, rate: reference.baseSubtotalUsd, unit: 'image', amountCents: presentedCents },
      compatibilityProfileId: 'provider-reference-current',
      meta: {
        pricing_model: 'fal_reference_plus_margin',
        provider_cost_source: 'fal_reference_price',
        cost_breakdown_usd: reference.breakdown,
        mode: reference.breakdown.mode,
        source_or_reference_image_count: reference.breakdown.source_or_reference_image_count,
        fal_reference_source: reference.breakdown.falReferenceSource,
      },
    });
  }

  if (isLumaRay32EngineId(engine.id) && isLumaRay32PublicMode(mode)) {
    const reference = calculateLumaRay32ReferencePrice({
      duration: context.durationOption ?? durationSec,
      resolution,
      hdr: booleanAddon(context.addons?.hdr),
      exrExport: booleanAddon(context.addons?.exr_export ?? context.addons?.exrExport),
    });
    const seconds = reference.breakdown.duration === '10s' ? 10 : 5;
    return resultFromFacts({
      engineId: engine.id,
      currency,
      vendorSubtotalExactCents: reference.baseSubtotalUsd * 100,
      base: {
        seconds,
        rate: Number((reference.baseSubtotalUsd / seconds).toFixed(4)),
        unit: 'sec',
        amountCents: Math.max(0, Math.ceil(reference.baseSubtotalUsd * 100 - 1e-9)),
      },
      compatibilityProfileId: 'provider-reference-current',
      meta: {
        pricing_model: 'fal_reference_plus_margin',
        provider_cost_source: 'fal_reference_price',
        cost_breakdown_usd: reference.breakdown,
        duration_label: reference.breakdown.duration,
        resolution: reference.breakdown.resolution,
        dynamic_range: reference.breakdown.dynamic_range,
        fal_reference_source: reference.breakdown.falReferenceSource,
      },
    });
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
    const seconds = mode === 'reframe' ? durationSec : reference.breakdown.duration === '10s' ? 10 : 5;
    return resultFromFacts({
      engineId: engine.id,
      currency,
      vendorSubtotalExactCents: reference.baseSubtotalUsd * 100,
      base: {
        seconds,
        rate: Number((reference.baseSubtotalUsd / seconds).toFixed(4)),
        unit: 'sec',
        amountCents: Math.max(0, Math.ceil(reference.baseSubtotalUsd * 100 - 1e-9)),
      },
      compatibilityProfileId: 'provider-reference-current',
      meta: {
        pricing_model: 'fal_reference_interpolated_plus_margin',
        provider_cost_source: reference.breakdown.providerCostSource,
        cost_breakdown_usd: reference.breakdown,
        mode: reference.breakdown.mode,
        duration_label: reference.breakdown.duration,
        resolution: reference.breakdown.resolution,
        dynamic_range: reference.breakdown.dynamic_range,
      },
    });
  }

  if (isLumaRay2EngineId(engine.id) && isLumaRay2GenerateMode(mode)) {
    const durationInfo = getLumaRay2DurationInfo(context.durationOption ?? durationSec);
    const resolutionInfo = getLumaRay2ResolutionInfo(resolution);
    if (!durationInfo || !resolutionInfo) throw new Error(LUMA_RAY2_ERROR_UNSUPPORTED);
    const reference = calculateLumaRay2Price({
      engineId: engine.id === 'lumaRay2_flash' ? 'luma-ray2-flash' : 'luma-ray2',
      baseUsd: getLumaRay2BasePriceUsd(engine.id),
      duration: durationInfo.label,
      resolution: resolutionInfo.value,
      loop: normaliseLumaRay2Loop(context.loop),
    });
    const presentedCents = Math.max(0, Math.round(reference.baseSubtotalUsd * 100));
    return resultFromFacts({
      engineId: engine.id,
      currency,
      vendorSubtotalExactCents: presentedCents,
      base: {
        seconds: durationInfo.seconds,
        rate: Number((reference.breakdown.computed_total_usd / durationInfo.seconds).toFixed(4)),
        unit: 'sec',
        amountCents: presentedCents,
      },
      meta: {
        cost_breakdown_usd: reference.breakdown,
        duration_label: reference.breakdown.duration,
        resolution: reference.breakdown.resolution,
        duration_factor: reference.breakdown.duration_factor,
        resolution_factor: reference.breakdown.resolution_factor,
        loop: typeof reference.breakdown.loop === 'boolean' ? reference.breakdown.loop : undefined,
      },
    });
  }

  if (isLumaRay2EngineId(engine.id) && isLumaRay2EditMode(mode)) {
    const workflow: LumaRay2EditWorkflow = mode === 'reframe' ? 'reframe' : 'modify';
    const reference = calculateLumaRay2EditPrice({
      engineId: engine.id === 'lumaRay2_flash' ? 'luma-ray2-flash' : 'luma-ray2',
      workflow,
      durationSec,
      rateUsd: getLumaRay2EditRateUsd(engine.id, workflow),
    });
    const presentedCents = Math.max(0, Math.round(reference.baseSubtotalUsd * 100));
    return resultFromFacts({
      engineId: engine.id,
      currency,
      vendorSubtotalExactCents: presentedCents,
      base: {
        seconds: reference.breakdown.seconds,
        rate: reference.breakdown.rate_per_second_usd,
        unit: 'sec',
        amountCents: presentedCents,
      },
      meta: {
        cost_breakdown_usd: reference.breakdown,
        workflow: reference.breakdown.workflow,
        seconds: reference.breakdown.seconds,
        rate_per_second_usd: reference.breakdown.rate_per_second_usd,
      },
    });
  }

  if (engine.id === 'gpt-image-2') {
    const quality = normalizeGptImage2Quality(context.quality);
    const tier = resolveGptImage2PricingTier(resolution, context.customImageSize);
    const imageCount = Math.max(1, Math.round(durationSec));
    const unitCents = tier.prices[quality];
    const vendorSubtotalCents = unitCents * imageCount;
    return resultFromFacts({
      engineId: engine.id,
      currency,
      vendorSubtotalExactCents: vendorSubtotalCents,
      base: { seconds: imageCount, rate: unitCents / 100, unit: 'image', amountCents: vendorSubtotalCents },
      meta: {
        pricing_model: 'gpt_image_2_quality_size',
        billed_image_size: tier.billingKey,
        requested_image_size: tier.requestedKey,
        requested_image_width: tier.width,
        requested_image_height: tier.height,
        quality,
        base_unit_price_cents: unitCents,
        estimated_from_nearest_canonical: tier.estimatedFromNearestCanonical,
        source: 'fal.ai GPT Image 2 pricing table',
      },
    });
  }

  if (isSeedance2TokenPricing(pricingDetails)) {
    const billingInputType =
      context.hasVideoInput === true ? 'video_input' : context.hasVideoInput === false ? 'no_video_input' : undefined;
    const reference = computeSeedance2TokenQuote({
      details: pricingDetails,
      durationSec,
      resolution,
      aspectRatio: context.aspectRatio,
      billingInputType,
    });
    return resultFromFacts({
      engineId: engine.id,
      currency,
      vendorSubtotalExactCents: reference.vendorCostUsd * 100,
      base: {
        seconds: durationSec,
        rate: reference.vendorCostPerSecondUsd,
        unit: 'sec',
        amountCents: roundUsdUpToCents(reference.vendorCostUsd),
      },
      compatibilityProfileId: 'provider-reference-current',
      meta: {
        pricing_model: 'byteplus_tokens',
        provider_cost_source: 'byteplus_modelark_pricing_config',
        billed_resolution: resolution,
        billed_aspect_ratio: reference.aspectRatio,
        output_width: reference.width,
        output_height: reference.height,
        frame_rate: reference.frameRate,
        token_count: Number(reference.tokenCount.toFixed(3)),
        provider_tokens_estimated: Number(reference.tokenCount.toFixed(3)),
        provider_cost_usd_estimated: reference.vendorCostUsd,
        vendor_cost_usd: reference.vendorCostUsd,
        vendor_cost_per_second_usd: reference.vendorCostPerSecondUsd,
        unit_price_usd_per_1k_tokens: reference.unitPriceUsdPer1kTokens,
        byteplus_billing_input_type: billingInputType,
        pricing_source: pricingDetails.tokenPricing.pricingSource,
        rounding: pricingDetails.tokenPricing.rounding ?? 'ceil_cent',
      },
    });
  }

  const pricedEngine = applyEnginePricingOverride(engine, pricingDetails);
  let definition = buildPricingDefinition(pricedEngine) ?? getPricingKernel().getDefinition(engine.id) ?? null;
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
  const snapshot = computeKernelSnapshot(factualDefinition, {
    engineId: engine.id,
    durationSec,
    resolution,
    memberTier: 'member',
    ...(context.addons ? { addons: context.addons } : {}),
  }).snapshot;
  const exactSubtotal = snapshot.base.amountCents + snapshot.addons.reduce((sum, addon) => sum + addon.amountCents, 0);
  return resultFromFacts({
    engineId: engine.id,
    currency,
    vendorSubtotalExactCents: exactSubtotal,
    base: snapshot.base,
    addons: snapshot.addons,
    meta: snapshot.meta,
  });
}
