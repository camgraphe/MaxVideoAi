import {
  computePricingSnapshot as computeKernelSnapshot,
  type PricingEngineDefinition,
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
  aspectRatio?: string | null;
  quality?: string | null;
  referenceImageCount?: number;
  hasVideoInput?: boolean;
  addons?: Record<string, boolean | number | undefined>;
  lumaRay2BasePriceUsd?: number;
  useFlatImageUnitFacts?: boolean;
  useStandardDefinitionFacts?: boolean;
};

const ZERO_DISCOUNTS: PricingEngineDefinition['memberTierDiscounts'] = {
  member: 0,
  plus: 0,
  pro: 0,
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
    addons: [],
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
  const exactCents =
    snapshot.base.amountCents + snapshot.addons.reduce((sum, addon) => sum + addon.amountCents, 0);
  return {
    facts: {
      engineId: engine.id,
      currency,
      vendorSubtotalExactCents: exactCents,
      unit: snapshot.base.unit ?? 'sec',
      quantity: snapshot.base.seconds,
    },
    base: { ...snapshot.base },
    addons: snapshot.addons.map((addon) => ({ ...addon })),
    meta: { ...(snapshot.meta ?? {}) },
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
