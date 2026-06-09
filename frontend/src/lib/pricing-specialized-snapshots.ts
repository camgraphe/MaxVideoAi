import type { EngineCaps, EnginePricingDetails } from '@/types/engines';
import type { PricingEngineDefinition, PricingSnapshot } from '@maxvideoai/pricing';
import { ENV } from '@/lib/env';
import type { LumaAgentsImageEngineId, LumaAgentsImageMode } from '@/lib/luma-agents';
import {
  calculateLumaAgentsImageReferencePrice,
  calculateLumaRay32ReferencePrice,
  type LumaAgentsImageReferencePricingBreakdown,
  type LumaRay32ReferencePricingBreakdown,
} from '@/lib/luma-agents-pricing';
import { calculateLumaRay2EditPrice, calculateLumaRay2Price, type LumaRay2EditWorkflow } from '@/lib/luma-ray2-pricing';
import { computeSeedance2TokenQuote, roundUsdUpToCents } from '@/lib/seedance-2-pricing';
import type { GptImage2ImageSize } from '@/lib/image/gptImage2';
import { normalizeGptImage2Quality, resolveGptImage2PricingTier } from '@/lib/image/gptImage2';
import type { PricingRule } from '@/lib/pricing-rule-store';

const STANDARD_PRICING_MODES = new Set(['t2v', 'i2v', 't2i', 'i2i']);
const CENT_EPSILON = 1e-9;

const LUMA_RAY2_DEFAULT_PRICING = {
  lumaRay2: {
    base5s540pUsd: 0.5,
    modifyPerSecondUsd: 0.12,
    reframePerSecondUsd: 0.2,
  },
  lumaRay2_flash: {
    base5s540pUsd: 0.2,
    modifyPerSecondUsd: 0.12,
    reframePerSecondUsd: 0.06,
  },
} as const;

export function computeRoundedUpMarginCents(baseCents: number, marginPercent = 0, flatCents = 0): number {
  const normalizedBase = Number.isFinite(baseCents) ? Math.max(0, baseCents) : 0;
  const normalizedMargin = Number.isFinite(marginPercent) ? Math.max(0, marginPercent) : 0;
  const normalizedFlat = Number.isFinite(flatCents) ? Math.max(0, flatCents) : 0;
  if (normalizedBase <= 0 && normalizedFlat <= 0) return 0;

  const margin = Math.ceil(normalizedBase * normalizedMargin + normalizedFlat - CENT_EPSILON);
  if (normalizedBase > 0 && (normalizedMargin > 0 || normalizedFlat > 0) && margin <= 0) {
    return 1;
  }
  return Math.max(0, margin);
}

function buildCentsSnapshotFromProviderReference(params: {
  baseSubtotalUsd: number;
  breakdown: LumaAgentsImageReferencePricingBreakdown | LumaRay32ReferencePricingBreakdown;
  base: PricingSnapshot['base'];
  rule: PricingRule;
  memberTier: 'member' | 'plus' | 'pro';
  memberTierDiscounts: PricingEngineDefinition['memberTierDiscounts'];
  currency: string;
  vendorAccountId?: string | null;
  meta?: Record<string, unknown>;
}): PricingSnapshot {
  const baseSubtotalCents = Math.max(0, Math.ceil(params.baseSubtotalUsd * 100 - CENT_EPSILON));
  const marginPercent = params.rule.marginPercent;
  const marginFlatCents = params.rule.marginFlatCents;
  const exactSubtotalBeforeDiscountCents = params.baseSubtotalUsd * 100 * (1 + marginPercent) + marginFlatCents;
  const subtotalBeforeDiscountCents = Math.max(0, Math.ceil(exactSubtotalBeforeDiscountCents - CENT_EPSILON));
  const marginAmount = Math.max(0, subtotalBeforeDiscountCents - baseSubtotalCents);

  const discountPercent = params.memberTierDiscounts[params.memberTier] ?? 0;
  const discountAmount = discountPercent > 0 ? Math.round(subtotalBeforeDiscountCents * discountPercent) : 0;
  const totalCents = Math.max(0, subtotalBeforeDiscountCents - discountAmount);
  const discountAppliedToMargin = Math.min(marginAmount, discountAmount);
  const platformFeeCents = Math.max(0, marginAmount - discountAppliedToMargin);
  const vendorShareCents = Math.max(0, totalCents - platformFeeCents);

  return {
    currency: params.currency,
    totalCents,
    subtotalBeforeDiscountCents,
    base: {
      ...params.base,
      amountCents: baseSubtotalCents,
    },
    addons: [],
    margin: {
      amountCents: marginAmount,
      percentApplied: marginPercent,
      flatCents: marginFlatCents,
    },
    discount: discountAmount
      ? {
          amountCents: discountAmount,
          percentApplied: discountPercent,
          tier: params.memberTier,
        }
      : undefined,
    membershipTier: params.memberTier,
    platformFeeCents,
    vendorShareCents,
    vendorAccountId: params.vendorAccountId ?? undefined,
    meta: {
      pricing_model: 'fal_reference_plus_margin',
      provider_cost_source: 'fal_reference_price',
      cost_breakdown_usd: params.breakdown,
      ...params.meta,
    },
  };
}

export function buildLumaAgentsImageSnapshot(params: {
  engineId: LumaAgentsImageEngineId;
  mode: LumaAgentsImageMode;
  referenceImageCount: number;
  rule: PricingRule;
  memberTier: 'member' | 'plus' | 'pro';
  memberTierDiscounts: PricingEngineDefinition['memberTierDiscounts'];
  currency: string;
  vendorAccountId?: string | null;
}): PricingSnapshot {
  const { baseSubtotalUsd, breakdown } = calculateLumaAgentsImageReferencePrice({
    engineId: params.engineId,
    mode: params.mode,
    referenceImageCount: params.referenceImageCount,
  });

  return buildCentsSnapshotFromProviderReference({
    baseSubtotalUsd,
    breakdown,
    base: {
      seconds: 1,
      rate: baseSubtotalUsd,
      unit: 'image',
      amountCents: 0,
    },
    rule: params.rule,
    memberTier: params.memberTier,
    memberTierDiscounts: params.memberTierDiscounts,
    currency: params.currency,
    vendorAccountId: params.vendorAccountId,
    meta: {
      mode: breakdown.mode,
      source_or_reference_image_count: breakdown.source_or_reference_image_count,
      fal_reference_source: breakdown.falReferenceSource,
    },
  });
}

export function buildLumaRay32Snapshot(params: {
  duration: number | string | null | undefined;
  resolution: string;
  rule: PricingRule;
  memberTier: 'member' | 'plus' | 'pro';
  memberTierDiscounts: PricingEngineDefinition['memberTierDiscounts'];
  currency: string;
  vendorAccountId?: string | null;
}): PricingSnapshot {
  const { baseSubtotalUsd, breakdown } = calculateLumaRay32ReferencePrice({
    duration: params.duration,
    resolution: params.resolution,
  });
  const seconds = breakdown.duration === '10s' ? 10 : 5;

  return buildCentsSnapshotFromProviderReference({
    baseSubtotalUsd,
    breakdown,
    base: {
      seconds,
      rate: seconds > 0 ? Number((baseSubtotalUsd / seconds).toFixed(4)) : baseSubtotalUsd,
      unit: 'sec',
      amountCents: 0,
    },
    rule: params.rule,
    memberTier: params.memberTier,
    memberTierDiscounts: params.memberTierDiscounts,
    currency: params.currency,
    vendorAccountId: params.vendorAccountId,
    meta: {
      duration_label: breakdown.duration,
      resolution: breakdown.resolution,
      fal_reference_source: breakdown.falReferenceSource,
    },
  });
}

export function buildLumaRay2Snapshot(params: {
  engineId: 'luma-ray2' | 'luma-ray2-flash';
  baseUsd: number;
  duration: number | string | null | undefined;
  resolution: string;
  loop?: boolean;
  rule: PricingRule;
  memberTier: 'member' | 'plus' | 'pro';
  memberTierDiscounts: PricingEngineDefinition['memberTierDiscounts'];
  currency: string;
  vendorAccountId?: string | null;
}): PricingSnapshot {
  const { baseSubtotalUsd, breakdown } = calculateLumaRay2Price({
    engineId: params.engineId,
    baseUsd: params.baseUsd,
    duration: params.duration,
    resolution: params.resolution,
    loop: params.loop,
  });

  const baseSubtotalCents = Math.max(0, Math.round(baseSubtotalUsd * 100));
  const marginPercent = params.rule.marginPercent;
  const marginFlatCents = params.rule.marginFlatCents;
  const marginAmount = computeRoundedUpMarginCents(baseSubtotalCents, marginPercent, marginFlatCents);
  const subtotalBeforeDiscountCents = baseSubtotalCents + marginAmount;

  const discountPercent = params.memberTierDiscounts[params.memberTier] ?? 0;
  const discountAmount = discountPercent > 0 ? Math.round(subtotalBeforeDiscountCents * discountPercent) : 0;
  const totalCents = Math.max(0, subtotalBeforeDiscountCents - discountAmount);
  const discountAppliedToMargin = Math.min(marginAmount, discountAmount);
  const platformFeeCents = Math.max(0, marginAmount - discountAppliedToMargin);
  const vendorShareCents = Math.max(0, totalCents - platformFeeCents);

  const seconds = breakdown.duration === '9s' ? 9 : 5;
  const rateUsd = seconds > 0 ? Number((breakdown.computed_total_usd / seconds).toFixed(4)) : Number(breakdown.computed_total_usd.toFixed(4));

  return {
    currency: params.currency,
    totalCents,
    subtotalBeforeDiscountCents,
    base: {
      seconds,
      rate: rateUsd,
      unit: 'sec',
      amountCents: baseSubtotalCents,
    },
    addons: [],
    margin: {
      amountCents: marginAmount,
      percentApplied: marginPercent,
      flatCents: marginFlatCents,
    },
    discount: discountAmount
      ? {
          amountCents: discountAmount,
          percentApplied: discountPercent,
          tier: params.memberTier,
        }
      : undefined,
    membershipTier: params.memberTier,
    platformFeeCents,
    vendorShareCents,
    vendorAccountId: params.vendorAccountId ?? undefined,
    meta: {
      cost_breakdown_usd: breakdown,
      duration_label: breakdown.duration,
      resolution: breakdown.resolution,
      duration_factor: breakdown.duration_factor,
      resolution_factor: breakdown.resolution_factor,
      loop: typeof breakdown.loop === 'boolean' ? breakdown.loop : undefined,
    },
  };
}

export function buildLumaRay2EditSnapshot(params: {
  engineId: 'luma-ray2' | 'luma-ray2-flash';
  workflow: LumaRay2EditWorkflow;
  durationSec: number;
  rateUsd: number;
  rule: PricingRule;
  memberTier: 'member' | 'plus' | 'pro';
  memberTierDiscounts: PricingEngineDefinition['memberTierDiscounts'];
  currency: string;
  vendorAccountId?: string | null;
}): PricingSnapshot {
  const { baseSubtotalUsd, breakdown } = calculateLumaRay2EditPrice({
    engineId: params.engineId,
    workflow: params.workflow,
    durationSec: params.durationSec,
    rateUsd: params.rateUsd,
  });

  const baseSubtotalCents = Math.max(0, Math.round(baseSubtotalUsd * 100));
  const marginPercent = params.rule.marginPercent;
  const marginFlatCents = params.rule.marginFlatCents;
  const marginAmount = computeRoundedUpMarginCents(baseSubtotalCents, marginPercent, marginFlatCents);
  const subtotalBeforeDiscountCents = baseSubtotalCents + marginAmount;

  const discountPercent = params.memberTierDiscounts[params.memberTier] ?? 0;
  const discountAmount = discountPercent > 0 ? Math.round(subtotalBeforeDiscountCents * discountPercent) : 0;
  const totalCents = Math.max(0, subtotalBeforeDiscountCents - discountAmount);
  const discountAppliedToMargin = Math.min(marginAmount, discountAmount);
  const platformFeeCents = Math.max(0, marginAmount - discountAppliedToMargin);
  const vendorShareCents = Math.max(0, totalCents - platformFeeCents);

  return {
    currency: params.currency,
    totalCents,
    subtotalBeforeDiscountCents,
    base: {
      seconds: breakdown.seconds,
      rate: breakdown.rate_per_second_usd,
      unit: 'sec',
      amountCents: baseSubtotalCents,
    },
    addons: [],
    margin: {
      amountCents: marginAmount,
      percentApplied: marginPercent,
      flatCents: marginFlatCents,
    },
    discount: discountAmount
      ? {
          amountCents: discountAmount,
          percentApplied: discountPercent,
          tier: params.memberTier,
        }
      : undefined,
    membershipTier: params.memberTier,
    platformFeeCents,
    vendorShareCents,
    vendorAccountId: params.vendorAccountId ?? undefined,
    meta: {
      cost_breakdown_usd: breakdown,
      workflow: breakdown.workflow,
      seconds: breakdown.seconds,
      rate_per_second_usd: breakdown.rate_per_second_usd,
    },
  };
}

export function buildSeedance2Snapshot(params: {
  pricingDetails: EnginePricingDetails & { tokenPricing: NonNullable<EnginePricingDetails['tokenPricing']> };
  durationSec: number;
  resolution: string;
  aspectRatio?: string | null;
  rule: PricingRule;
  memberTier: 'member' | 'plus' | 'pro';
  memberTierDiscounts: PricingEngineDefinition['memberTierDiscounts'];
  currency: string;
  vendorAccountId?: string | null;
}): PricingSnapshot {
  const quote = computeSeedance2TokenQuote({
    details: params.pricingDetails,
    durationSec: params.durationSec,
    resolution: params.resolution,
    aspectRatio: params.aspectRatio,
  });

  const vendorShareCentsBase = roundUsdUpToCents(quote.vendorCostUsd);
  const subtotalBeforeDiscountExactUsd =
    quote.vendorCostUsd * (1 + params.rule.marginPercent) + params.rule.marginFlatCents / 100;
  const subtotalBeforeDiscountCents = roundUsdUpToCents(subtotalBeforeDiscountExactUsd);
  const discountPercent = params.memberTierDiscounts[params.memberTier] ?? 0;
  const discountAmount =
    discountPercent > 0 ? Math.round(subtotalBeforeDiscountCents * discountPercent) : 0;
  const totalCents = Math.max(0, subtotalBeforeDiscountCents - discountAmount);
  const platformFeeCents = Math.max(0, totalCents - vendorShareCentsBase);
  const vendorShareCents = Math.max(0, totalCents - platformFeeCents);
  const marginAmount = Math.max(0, subtotalBeforeDiscountCents - vendorShareCentsBase);

  return {
    currency: params.currency,
    totalCents,
    subtotalBeforeDiscountCents,
    base: {
      seconds: params.durationSec,
      rate: quote.vendorCostPerSecondUsd,
      unit: 'sec',
      amountCents: vendorShareCentsBase,
    },
    addons: [],
    margin: {
      amountCents: marginAmount,
      percentApplied: params.rule.marginPercent,
      flatCents: params.rule.marginFlatCents,
    },
    discount: discountAmount
      ? {
          amountCents: discountAmount,
          percentApplied: discountPercent,
          tier: params.memberTier,
        }
      : undefined,
    membershipTier: params.memberTier,
    platformFeeCents,
    vendorShareCents,
    vendorAccountId: params.vendorAccountId ?? undefined,
    meta: {
      pricing_model: 'fal_tokens',
      provider_cost_source: 'estimated_fal_pricing_config',
      billed_resolution: params.resolution,
      billed_aspect_ratio: quote.aspectRatio,
      output_width: quote.width,
      output_height: quote.height,
      frame_rate: quote.frameRate,
      token_count: Number(quote.tokenCount.toFixed(3)),
      provider_tokens_estimated: Number(quote.tokenCount.toFixed(3)),
      provider_cost_usd_estimated: quote.vendorCostUsd,
      vendor_cost_usd: quote.vendorCostUsd,
      vendor_cost_per_second_usd: quote.vendorCostPerSecondUsd,
      unit_price_usd_per_1k_tokens: params.pricingDetails.tokenPricing.unitPriceUsdPer1kTokens,
      rounding: params.pricingDetails.tokenPricing.rounding ?? 'ceil_cent',
    },
  };
}

export function buildGptImage2Snapshot(params: {
  numImages: number;
  imageSize: string;
  customImageSize?: GptImage2ImageSize | null;
  quality?: string | null;
  rule: PricingRule;
  memberTier: 'member' | 'plus' | 'pro';
  memberTierDiscounts: PricingEngineDefinition['memberTierDiscounts'];
  currency: string;
  vendorAccountId?: string | null;
}): PricingSnapshot {
  const quality = normalizeGptImage2Quality(params.quality);
  const tier = resolveGptImage2PricingTier(params.imageSize, params.customImageSize);
  const unitCents = tier.prices[quality];
  const imageCount = Math.max(1, Math.round(params.numImages));
  const vendorShareCentsBase = unitCents * imageCount;
  const marginAmount = computeRoundedUpMarginCents(
    vendorShareCentsBase,
    params.rule.marginPercent,
    params.rule.marginFlatCents
  );
  const subtotalBeforeDiscountCents = vendorShareCentsBase + marginAmount;
  const discountPercent = params.memberTierDiscounts[params.memberTier] ?? 0;
  const discountAmount =
    discountPercent > 0 ? Math.round(subtotalBeforeDiscountCents * discountPercent) : 0;
  const totalCents = Math.max(0, subtotalBeforeDiscountCents - discountAmount);
  const discountAppliedToMargin = Math.min(marginAmount, discountAmount);
  const platformFeeCents = Math.max(0, marginAmount - discountAppliedToMargin);
  const vendorShareCents = Math.max(0, totalCents - platformFeeCents);

  return {
    currency: params.currency,
    totalCents,
    subtotalBeforeDiscountCents,
    base: {
      seconds: imageCount,
      rate: unitCents / 100,
      unit: 'image',
      amountCents: vendorShareCentsBase,
    },
    addons: [],
    margin: {
      amountCents: marginAmount,
      percentApplied: params.rule.marginPercent,
      flatCents: params.rule.marginFlatCents,
    },
    discount: discountAmount
      ? {
          amountCents: discountAmount,
          percentApplied: discountPercent,
          tier: params.memberTier,
        }
      : undefined,
    membershipTier: params.memberTier,
    platformFeeCents,
    vendorShareCents,
    vendorAccountId: params.vendorAccountId ?? undefined,
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
  };
}

export function getLumaRay2BasePriceEnv(engineId: string): string | undefined {
  if (engineId === 'lumaRay2_flash') {
    return (
      ENV.LUMARAY2_FLASH_BASE_5S_540P_USD ??
      ENV.LUMARAY2_BASE_5S_540P_USD ??
      String(LUMA_RAY2_DEFAULT_PRICING.lumaRay2_flash.base5s540pUsd)
    );
  }
  return ENV.LUMARAY2_BASE_5S_540P_USD ?? String(LUMA_RAY2_DEFAULT_PRICING.lumaRay2.base5s540pUsd);
}

export function getLumaRay2EditRateEnv(engineId: string, workflow: LumaRay2EditWorkflow): string | undefined {
  if (workflow === 'modify') {
    if (engineId === 'lumaRay2_flash') {
      return (
        ENV.LUMARAY2_FLASH_MODIFY_PER_SECOND_USD ??
        ENV.LUMARAY2_MODIFY_PER_SECOND_USD ??
        String(LUMA_RAY2_DEFAULT_PRICING.lumaRay2_flash.modifyPerSecondUsd)
      );
    }
    return ENV.LUMARAY2_MODIFY_PER_SECOND_USD ?? String(LUMA_RAY2_DEFAULT_PRICING.lumaRay2.modifyPerSecondUsd);
  }
  if (engineId === 'lumaRay2_flash') {
    return (
      ENV.LUMARAY2_FLASH_REFRAME_PER_SECOND_USD ??
      ENV.LUMARAY2_REFRAME_PER_SECOND_USD ??
      String(LUMA_RAY2_DEFAULT_PRICING.lumaRay2_flash.reframePerSecondUsd)
    );
  }
  return ENV.LUMARAY2_REFRAME_PER_SECOND_USD ?? String(LUMA_RAY2_DEFAULT_PRICING.lumaRay2.reframePerSecondUsd);
}

export function buildDefinitionFromEngine(
  engine: EngineCaps,
  pricingDetails?: EnginePricingDetails
): PricingEngineDefinition | null {
  const currency =
    pricingDetails?.currency ??
    engine.pricing?.currency ??
    'USD';

  const perSecondDefault = pricingDetails?.perSecondCents?.default ?? undefined;
  const perSecondByResolution = pricingDetails?.perSecondCents?.byResolution ?? undefined;

  let baseUnitPriceCents: number | undefined = typeof perSecondDefault === 'number' ? perSecondDefault : undefined;

  if (baseUnitPriceCents == null && perSecondByResolution) {
    const first = Object.values(perSecondByResolution)[0];
    if (typeof first === 'number') {
      baseUnitPriceCents = first;
    }
  }

  if (baseUnitPriceCents == null) {
    const fallbackBase = engine.pricing?.base;
    if (typeof fallbackBase === 'number') {
      baseUnitPriceCents = Math.round(fallbackBase * 100);
    } else if (engine.pricing?.byResolution) {
      const first = Object.values(engine.pricing.byResolution)[0];
      if (typeof first === 'number') {
        baseUnitPriceCents = Math.round(first * 100);
      }
    }
  }

  if (baseUnitPriceCents == null || baseUnitPriceCents <= 0) {
    return null;
  }

  const resolutionMultipliers: Record<string, number> = {};
  if (perSecondByResolution) {
    for (const [resolution, cents] of Object.entries(perSecondByResolution)) {
      resolutionMultipliers[resolution] = baseUnitPriceCents > 0 ? cents / baseUnitPriceCents : 1;
    }
  } else if (engine.pricing?.byResolution) {
    for (const [resolution, dollars] of Object.entries(engine.pricing.byResolution)) {
      const cents = Math.round(dollars * 100);
      resolutionMultipliers[resolution] = baseUnitPriceCents > 0 ? cents / baseUnitPriceCents : 1;
    }
  }

  if (!Object.values(resolutionMultipliers).some((value) => Math.abs(value - 1) < 1e-6)) {
    resolutionMultipliers.default = 1;
  }

  const durationField =
    engine.inputSchema?.optional?.find(
      (field) =>
        field.id === 'duration_seconds' &&
        (!Array.isArray(field.modes) || !field.modes.length || field.modes.some((mode) => STANDARD_PRICING_MODES.has(mode)))
    ) ??
    engine.inputSchema?.optional?.find(
      (field) =>
        field.id === 'duration' &&
        (!Array.isArray(field.modes) || !field.modes.length || field.modes.some((mode) => STANDARD_PRICING_MODES.has(mode)))
    );
  const durationValues = Array.isArray(durationField?.values)
    ? durationField.values
        .map((value) => {
          if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value);
          if (typeof value === 'string') {
            const numeric = Number(value.replace(/[^\d.]/g, ''));
            return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null;
          }
          return null;
        })
        .filter((value): value is number => value != null)
    : [];
  const minDuration = Math.max(1, Math.floor(durationField?.min ?? durationValues[0] ?? 1));
  const maxDuration = Math.max(
    minDuration,
    Math.floor(durationField?.max ?? durationValues[durationValues.length - 1] ?? pricingDetails?.maxDurationSec ?? engine.maxDurationSec ?? 30)
  );
  const stepDuration = Math.max(1, Math.floor(durationField?.step ?? 1));
  const defaultDurationRaw = durationField?.default;
  const defaultDuration =
    typeof defaultDurationRaw === 'number'
      ? defaultDurationRaw
      : typeof defaultDurationRaw === 'string'
        ? Number(defaultDurationRaw)
        : undefined;

  return {
    engineId: engine.id,
    label: engine.label,
    version: engine.version,
    currency,
    baseUnitPriceCents,
    durationSteps: {
      min: minDuration,
      max: maxDuration,
      step: stepDuration,
      default: Number.isFinite(defaultDuration) ? Number(defaultDuration) : undefined,
    },
    resolutionMultipliers,
    memberTierDiscounts: {
      member: 0,
      plus: 0.05,
      pro: 0.1,
    },
    minChargeCents: 0,
    rounding: { mode: 'nearest', incrementCents: 1 },
    taxPolicyHint: 'standard',
    addons: pricingDetails?.addons ?? undefined,
    platformFeePct: 0.3,
    platformFeeFlatCents: 0,
    availability: engine.availability,
    metadata: {
      source: 'engine-caps',
    },
  };
}
