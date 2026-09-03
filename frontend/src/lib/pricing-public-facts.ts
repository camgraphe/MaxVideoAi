import {
  computePricingDefinitionFacts,
  type PricingFacts,
  type PricingSnapshot,
} from '@maxvideoai/pricing';
import { isLumaAgentsImageEngineId, isLumaRay32EngineId, isLumaRay32PublicMode } from '@/lib/luma-agents';
import {
  calculateLumaAgentsImageReferencePrice,
  calculateLumaRay32ReferencePrice,
} from '@/lib/luma-agents-pricing';
import { isLumaRay2EngineId, isLumaRay2GenerateMode } from '@/lib/luma-ray2';
import { calculateLumaRay2Price } from '@/lib/luma-ray2-pricing';
import { buildPricingDefinition } from '@/lib/pricing-definition';
import { computeSeedance2TokenQuote, isSeedance2TokenPricing } from '@/lib/seedance-2-pricing';
import { normalizeGptImage2Quality, resolveGptImage2PricingTier } from '@/lib/image/gptImage2';
import type { EngineCaps, Mode } from '@/types/engines';
import { isMinimaxH3EngineId } from '@/lib/minimax-h3';
import { calculateMinimaxH3ProviderPrice } from '@/lib/minimax-h3-pricing';
import { isMinimaxH3MaxEngineId } from '@/lib/minimax-h3-max';
import {
  calculateMinimaxH3MaxProviderCost,
  MINIMAX_H3_MAX_PRICING_SOURCE,
} from '@/lib/minimax-h3-max-pricing';
import {
  calculateGoogleOmniProviderCost,
  GOOGLE_OMNI_PRICING_SOURCE,
  resolveGoogleOmniPricingInput,
} from '@/lib/google-omni-pricing';

export type PublicPricingFactsResult = {
  facts: PricingFacts;
  base: PricingSnapshot['base'];
  addons: PricingSnapshot['addons'];
  meta: Record<string, unknown>;
  compatibilityProfileId: string;
};

export type PublicPricingFactsContext = {
  engine: EngineCaps;
  durationSec: number;
  resolution: string;
  mode?: Mode;
  durationOption?: number | string | null;
  inputAudioDurationSec?: number;
  aspectRatio?: string | null;
  quality?: string | null;
  referenceImageCount?: number;
  verifiedReferenceTokenCount?: number;
  inputImageCount?: number;
  inputVideoDurationSec?: number;
  inheritedDurationSec?: number;
  hasVideoInput?: boolean;
  addons?: Record<string, boolean | number | undefined>;
  lumaRay2BasePriceUsd?: number;
  useFlatImageUnitFacts?: boolean;
  useStandardDefinitionFacts?: boolean;
};

const DEFAULT_LUMA_RAY2_BASE_PRICE_USD = {
  standard: 0.5,
  flash: 0.2,
} as const;

function booleanAddon(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
  return false;
}

function resultFromExactFacts(params: {
  engineId: string;
  currency: string;
  exactCents: number;
  quantity: number;
  unit: string;
  compatibilityProfileId?: string;
  presentedBaseCents?: number;
  rate?: number;
  meta?: Record<string, unknown>;
  addons?: PricingSnapshot['addons'];
}): PublicPricingFactsResult {
  const presentedBaseCents = params.presentedBaseCents ?? Math.round(params.exactCents);
  return {
    facts: {
      engineId: params.engineId,
      currency: params.currency,
      vendorSubtotalExactCents: params.exactCents,
      unit: params.unit,
      quantity: params.quantity,
    },
    base: {
      seconds: params.quantity,
      rate: params.rate ?? (params.quantity > 0 ? params.exactCents / params.quantity / 100 : 0),
      unit: params.unit,
      amountCents: presentedBaseCents,
    },
    addons: (params.addons ?? []).map((addon) => ({ ...addon })),
    meta: { ...(params.meta ?? {}) },
    compatibilityProfileId: params.compatibilityProfileId ?? 'standard',
  };
}

function buildStandardDefinitionFacts(
  context: PublicPricingFactsContext,
  currency: string
): PublicPricingFactsResult {
  const { engine, durationSec, resolution } = context;
  const definition = buildPricingDefinition(engine);
  if (!definition) throw new Error(`Pricing definition not found for engine ${engine.id}`);
  const factualDefinition = {
    ...definition,
    currency,
  };
  const definitionFacts = computePricingDefinitionFacts(factualDefinition, {
    durationSec,
    resolution,
    ...(context.mode ? { mode: context.mode } : {}),
    ...(typeof context.inputAudioDurationSec === 'number'
      ? { inputAudioDurationSec: context.inputAudioDurationSec }
      : {}),
    ...(typeof context.referenceImageCount === 'number'
      ? { referenceImageCount: context.referenceImageCount }
      : {}),
    ...(context.addons ? { addons: context.addons } : {}),
  });
  return {
    facts: {
      engineId: engine.id,
      currency,
      vendorSubtotalExactCents: definitionFacts.vendorSubtotalExactCents,
      unit: definitionFacts.base.unit ?? 'sec',
      quantity: definitionFacts.base.seconds,
    },
    base: { ...definitionFacts.base },
    addons: definitionFacts.addons.map((addon) => ({ ...addon })),
    meta: { ...definitionFacts.meta },
    compatibilityProfileId: 'standard',
  };
}

export function buildPublicPricingFacts(context: PublicPricingFactsContext): PublicPricingFactsResult {
  const { engine, durationSec, resolution } = context;
  const mode = context.mode ?? (engine.modes.includes('t2i') ? 't2i' : 't2v');
  const currency = (engine.pricingDetails?.currency ?? engine.pricing?.currency ?? 'USD').toUpperCase();
  if (context.useStandardDefinitionFacts) {
    return buildStandardDefinitionFacts(context, currency);
  }

  if (engine.id === 'gemini-omni-flash') {
    const pricingInput = resolveGoogleOmniPricingInput({
      outputResolution: resolution,
      outputDurationSec: durationSec,
      inheritedDurationSec: context.inheritedDurationSec,
      mode,
      inputImageCount: context.inputImageCount,
      referenceImageCount: context.referenceImageCount,
      inputVideoDurationSec: context.inputVideoDurationSec,
    });
    const pricing = calculateGoogleOmniProviderCost(pricingInput);
    return resultFromExactFacts({
      engineId: engine.id,
      currency,
      exactCents: pricing.providerCostExactCents,
      presentedBaseCents: pricing.providerCostCents,
      quantity: pricingInput.outputDurationSec,
      unit: 'sec',
      rate: pricing.providerCostUsd / pricingInput.outputDurationSec,
      meta: {
        pricing_model: 'google_omni_tokens',
        provider_cost_source: GOOGLE_OMNI_PRICING_SOURCE,
        mode,
        output_resolution: pricingInput.outputResolution,
        output_duration_sec: pricingInput.outputDurationSec,
        input_image_count: pricingInput.inputImageCount,
        input_video_duration_sec: pricingInput.inputVideoDurationSec,
        cost_breakdown_usd: pricing,
      },
    });
  }

  if (isMinimaxH3MaxEngineId(engine.id)) {
    const reference = calculateMinimaxH3MaxProviderCost({
      mode: mode as 't2v' | 'i2v' | 'ref2v',
      durationSec,
      resolution: resolution as '480P' | '768P',
      verifiedReferenceTokenCount: context.verifiedReferenceTokenCount,
    });
    const referenceTokenCents = Math.round(reference.referenceTokenSubtotalUsd * 100);
    return resultFromExactFacts({
      engineId: engine.id,
      currency,
      exactCents: reference.providerCostExactCents,
      presentedBaseCents: Math.round(reference.outputSubtotalUsd * 100),
      quantity: durationSec,
      unit: 'sec',
      rate: reference.ratePerSecondUsd,
      addons: referenceTokenCents > 0
        ? [{ type: 'reference_tokens_above_4096', amountCents: referenceTokenCents }]
        : [],
      compatibilityProfileId: 'provider-reference-current',
      meta: {
        pricing_model: 'minimax_h3_max_output_plus_reference_tokens',
        provider_cost_source: MINIMAX_H3_MAX_PRICING_SOURCE,
        public_provider: 'MiniMax',
        public_family: 'Hailuo',
        mode,
        cost_breakdown_usd: reference,
      },
    });
  }

  if (isMinimaxH3EngineId(engine.id)) {
    const reference = calculateMinimaxH3ProviderPrice({
      durationSec,
      resolution: resolution as '768P' | '2K' | '4K',
      referenceImageCount: context.referenceImageCount,
    });
    const surchargeCents = Math.round(reference.breakdown.referenceImageSurchargeUsd * 100);
    return resultFromExactFacts({
      engineId: engine.id,
      currency,
      exactCents: Math.round(reference.subtotalUsd * 100),
      presentedBaseCents: Math.round(reference.breakdown.baseSubtotalUsd * 100),
      quantity: durationSec,
      unit: 'sec',
      rate: reference.breakdown.ratePerSecondUsd,
      addons: surchargeCents > 0
        ? [{ type: 'reference_images_above_five', amountCents: surchargeCents }]
        : [],
      compatibilityProfileId: 'provider-reference-current',
      meta: {
        pricing_model: 'fal_h3_resolution_plus_reference_images',
        provider_cost_source: 'fal_minimax_h3_pricing',
        cost_breakdown_usd: reference.breakdown,
        mode,
        reference_image_count: reference.breakdown.referenceImageCount,
        paid_reference_image_count: reference.breakdown.paidReferenceImages,
        reference_image_surcharge_usd: reference.breakdown.referenceImageSurchargeUsd,
      },
    });
  }

  if (isLumaAgentsImageEngineId(engine.id) && (mode === 't2i' || mode === 'i2i')) {
    const reference = calculateLumaAgentsImageReferencePrice({
      engineId: engine.id,
      mode,
      referenceImageCount: Math.max(0, Math.round(context.referenceImageCount ?? 0)),
    });
    return resultFromExactFacts({
      engineId: engine.id,
      currency,
      exactCents: reference.baseSubtotalUsd * 100,
      presentedBaseCents: Math.ceil(reference.baseSubtotalUsd * 100 - 1e-9),
      quantity: 1,
      unit: 'image',
      compatibilityProfileId: 'provider-reference-current',
      meta: { cost_breakdown_usd: reference.breakdown },
    });
  }

  if (isLumaRay32EngineId(engine.id) && isLumaRay32PublicMode(mode)) {
    const reference = calculateLumaRay32ReferencePrice({
      duration: context.durationOption ?? durationSec,
      resolution,
      hdr: booleanAddon(context.addons?.hdr),
      exrExport: booleanAddon(context.addons?.exr_export ?? context.addons?.exrExport),
    });
    return resultFromExactFacts({
      engineId: engine.id,
      currency,
      exactCents: reference.baseSubtotalUsd * 100,
      presentedBaseCents: Math.ceil(reference.baseSubtotalUsd * 100 - 1e-9),
      quantity: reference.breakdown.duration === '10s' ? 10 : 5,
      unit: 'sec',
      compatibilityProfileId: 'provider-reference-current',
      meta: { cost_breakdown_usd: reference.breakdown },
    });
  }

  if (isLumaRay2EngineId(engine.id) && isLumaRay2GenerateMode(mode)) {
    const isFlash = engine.id === 'lumaRay2_flash';
    const baseUsd =
      context.lumaRay2BasePriceUsd ??
      (isFlash ? DEFAULT_LUMA_RAY2_BASE_PRICE_USD.flash : DEFAULT_LUMA_RAY2_BASE_PRICE_USD.standard);
    const reference = calculateLumaRay2Price({
      engineId: isFlash ? 'luma-ray2-flash' : 'luma-ray2',
      baseUsd,
      duration: context.durationOption ?? durationSec,
      resolution,
    });
    return resultFromExactFacts({
      engineId: engine.id,
      currency,
      exactCents: reference.baseSubtotalUsd * 100,
      quantity: durationSec,
      unit: 'sec',
      meta: { cost_breakdown_usd: reference.breakdown },
    });
  }

  if (engine.id === 'gpt-image-2') {
    const tier = resolveGptImage2PricingTier(resolution);
    const quality = normalizeGptImage2Quality(context.quality ?? undefined);
    const quantity = Math.max(1, Math.round(durationSec));
    const exactCents = tier.prices[quality] * quantity;
    return resultFromExactFacts({
      engineId: engine.id,
      currency,
      exactCents,
      quantity,
      unit: 'image',
      rate: tier.prices[quality] / 100,
      meta: { quality, pricingTier: tier.billingKey },
    });
  }

  if (
    context.useFlatImageUnitFacts &&
    (mode === 't2i' || mode === 'i2i') &&
    engine.pricingDetails?.flatCents
  ) {
    const flat = engine.pricingDetails.flatCents;
    const unitCents = flat.byResolution?.[resolution] ?? flat.default;
    if (typeof unitCents === 'number' && Number.isFinite(unitCents) && unitCents >= 0) {
      const quantity = Math.max(1, Math.round(durationSec));
      return resultFromExactFacts({
        engineId: engine.id,
        currency,
        exactCents: unitCents * quantity,
        quantity,
        unit: 'image',
        rate: unitCents / 100,
      });
    }
  }

  if (isSeedance2TokenPricing(engine.pricingDetails)) {
    const reference = computeSeedance2TokenQuote({
      details: engine.pricingDetails,
      durationSec,
      resolution,
      aspectRatio: context.aspectRatio ?? engine.pricingDetails.tokenPricing.defaultAspectRatio,
      billingInputType:
        context.hasVideoInput === true
          ? 'video_input'
          : context.hasVideoInput === false
            ? 'no_video_input'
            : undefined,
    });
    return resultFromExactFacts({
      engineId: engine.id,
      currency,
      exactCents: reference.vendorCostUsd * 100,
      presentedBaseCents: Math.ceil(reference.vendorCostUsd * 100 - 1e-9),
      quantity: durationSec,
      unit: 'sec',
      compatibilityProfileId: 'provider-reference-current',
      meta: { cost_breakdown_usd: reference },
    });
  }

  return buildStandardDefinitionFacts(context, currency);
}

export function buildPublicUnitPricingFacts(input: {
  engineId: string;
  currency: string;
  unitPriceCents: number;
  quantity?: number;
  unit: string;
}): PublicPricingFactsResult {
  const quantity = Math.max(1, Math.round(input.quantity ?? 1));
  return resultFromExactFacts({
    engineId: input.engineId,
    currency: input.currency.toUpperCase(),
    exactCents: Math.max(0, input.unitPriceCents) * quantity,
    quantity,
    unit: input.unit,
    compatibilityProfileId: 'public-rounded-vendor-current',
    rate: input.unitPriceCents / 100,
  });
}

export function buildAuthoredPublicOfferFacts(input: {
  engineId: string;
  currency: string;
  amountCents: number;
}): PublicPricingFactsResult {
  return resultFromExactFacts({
    engineId: input.engineId,
    currency: input.currency.toUpperCase(),
    exactCents: Math.max(0, Math.round(input.amountCents)),
    quantity: 1,
    unit: 'offer',
    compatibilityProfileId: 'schema-current',
  });
}

export function buildFixedPublicProductFacts(input: {
  engineId: string;
  currency: string;
  amountCents: number;
  quantity: number;
  unit: string;
}): PublicPricingFactsResult {
  return resultFromExactFacts({
    engineId: input.engineId,
    currency: input.currency.toUpperCase(),
    exactCents: Math.max(0, Math.round(input.amountCents)),
    quantity: Math.max(1, input.quantity),
    unit: input.unit,
    compatibilityProfileId: 'fixed-product-current',
  });
}
