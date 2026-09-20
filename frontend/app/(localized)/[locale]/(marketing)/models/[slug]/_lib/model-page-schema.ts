import type { AppLocale } from '@/i18n/locales';
import { formatModelPublicOffer } from './model-page-offer-display';
import { PARTNER_BRAND_MAP } from '@/lib/brand-partners';
import { isImageOnlyModel, supportsAudioGeneration, supportsVideoGeneration } from '@/lib/models/catalog';
import {
  buildAuthoredPublicOfferFacts,
  buildPublicPricingFacts,
  DEFAULT_LUMA_RAY2_BASE_PRICE_USD,
  type PublicPricingFactsResult,
} from '@/lib/pricing-public-facts';
import { quotePublicPricing } from '@/lib/pricing-public-quote';
import type { FalEngineEntry } from '@/config/falEngines';
import { isSeedance2TokenPricing } from '@/lib/seedance-2-pricing';
import type { EngineAvailability, EngineCaps, Resolution } from '@/types/engines';
import { getImagePresetQuote, getPresetQuote } from '../../../pricing/_lib/pricingHubData';

const PROVIDER_INFO_MAP: Record<string, { name: string; url: string }> = {
  bytedance: { name: 'ByteDance', url: 'https://www.bytedance.com/en/' },
  google: { name: 'Google DeepMind', url: 'https://deepmind.google/models/' },
  'google-gemini': { name: 'Google DeepMind', url: 'https://deepmind.google/models/' },
  xai: { name: 'xAI', url: 'https://x.ai/' },
  'black-forest-labs': { name: 'Black Forest Labs', url: 'https://bfl.ai/' },
  luma: { name: 'Luma AI', url: 'https://lumalabs.ai' },
  openai: { name: 'OpenAI', url: 'https://openai.com' },
  'google-veo': { name: 'Google DeepMind', url: 'https://deepmind.google/technologies/veo/' },
  pika: { name: 'Pika Labs', url: 'https://pika.art' },
  minimax: { name: 'MiniMax', url: 'https://www.minimaxi.com' },
  kling: { name: 'Kling by Kuaishou', url: 'https://www.kuaishou.com/en' },
  wan: { name: 'Wan AI', url: 'https://www.wan-ai.com' },
  lightricks: { name: 'Lightricks', url: 'https://www.lightricks.com' },
  alibaba: { name: 'Alibaba', url: 'https://www.alibabagroup.com' },
};

const AVAILABILITY_MAP: Record<EngineAvailability, string> = {
  available: 'https://schema.org/InStock',
  limited: 'https://schema.org/LimitedAvailability',
  waitlist: 'https://schema.org/PreOrder',
  paused: 'https://schema.org/Discontinued',
};

const MERCHANT_POLICY_COUNTRIES = [
  'US',
  'CA',
  'GB',
  'AU',
  'NZ',
  'FR',
  'BE',
  'CH',
  'LU',
  'ES',
  'MX',
  'AR',
  'CL',
  'CO',
  'PE',
  'DE',
  'AT',
  'IT',
  'NL',
  'IE',
  'PT',
  'SE',
  'NO',
  'DK',
  'FI',
  'PL',
  'CZ',
  'BR',
  'JP',
  'KR',
  'SG',
  'HK',
  'IN',
  'AE',
  'SA',
] as const;

export function resolveProviderInfo(engine: FalEngineEntry) {
  const fallback = PARTNER_BRAND_MAP.get(engine.brandId);
  const override = PROVIDER_INFO_MAP[engine.brandId];
  return {
    name: override?.name ?? fallback?.label ?? engine.brandId,
    url: override?.url ?? fallback?.availabilityLink,
  };
}

function parseDurationValue(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return Math.round(raw);
  }
  if (typeof raw === 'string') {
    const parsed = Number(raw.replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
  }
  return null;
}

function resolveOfferDurationSeconds(engine: EngineCaps, hintDuration?: number): number {
  if (typeof hintDuration === 'number' && Number.isFinite(hintDuration) && hintDuration > 0) {
    return Math.round(hintDuration);
  }
  const durationField =
    engine.inputSchema?.optional?.find((field) => field.id === 'duration_seconds') ??
    engine.inputSchema?.optional?.find((field) => field.id === 'duration');
  const defaultDuration = parseDurationValue(durationField?.default);
  if (defaultDuration) return defaultDuration;
  const firstOption = Array.isArray(durationField?.values) ? durationField.values.map(parseDurationValue).find(Boolean) : null;
  if (firstOption) return firstOption;
  return Math.max(1, Math.round(durationField?.min ?? engine.pricingDetails?.maxDurationSec ?? engine.maxDurationSec ?? 5));
}

function resolveOfferResolution(engine: EngineCaps, hintResolution?: string): string | null {
  const allowed = new Set<string>((engine.resolutions ?? []).filter((value) => value && value !== 'auto'));
  if (hintResolution && (!allowed.size || allowed.has(hintResolution))) {
    return hintResolution;
  }
  const resolutionField =
    engine.inputSchema?.optional?.find((field) => field.id === 'resolution') ??
    engine.inputSchema?.required?.find((field) => field.id === 'resolution');
  const defaultResolution = typeof resolutionField?.default === 'string' ? resolutionField.default : null;
  if (defaultResolution && defaultResolution !== 'auto') return defaultResolution;
  return Array.from(allowed)[0] ?? null;
}

function quoteModelOfferFacts(
  facts: PublicPricingFactsResult,
  input: { mode?: string; resolution?: string }
): number {
  return quotePublicPricing({
    facts: facts.facts,
    scenario: {
      id: `json-ld:${facts.facts.engineId}:offer`,
      engineId: facts.facts.engineId,
      ...(input.mode ? { mode: input.mode } : {}),
      ...(input.resolution ? { resolution: input.resolution } : {}),
      membershipTier: 'member',
    },
    compatibilityProfileId: facts.compatibilityProfileId,
  }).customerTotalCents;
}

export type ModelPublicOfferScenario = {
  mode: 't2v' | 't2i';
  resolution: string;
  durationSeconds: number;
  audio: boolean;
  quantity: 1;
  quality?: 'high';
  aspectRatio?: string;
  referenceImageCount: 0;
};

export type ModelPublicOffer = {
  amountCents: number;
  currency: string;
  scenario: ModelPublicOfferScenario;
};

function resolveModelOfferScenario(engine: FalEngineEntry, pricingEngine: EngineCaps): ModelPublicOfferScenario | null {
  const hint = engine.pricingHint;
  const resolution = resolveOfferResolution(pricingEngine, hint?.resolution);
  if (!resolution) return null;
  const image = engine.category === 'image';
  const lumaVideo = ['lumaRay2', 'lumaRay2_flash', 'luma-ray-3-2'].includes(pricingEngine.id);
  const details = pricingEngine.pricingDetails;
  const qualityField = [...(pricingEngine.inputSchema?.required ?? []), ...(pricingEngine.inputSchema?.optional ?? [])]
    .find((field) => field.id === 'quality');
  return {
    mode: image ? 't2i' : 't2v',
    resolution: lumaVideo ? '540p' : image ? hint?.resolution ?? resolution : resolution,
    durationSeconds: image ? 1 : lumaVideo ? 5 : resolveOfferDurationSeconds(pricingEngine, hint?.durationSeconds),
    audio: !image && pricingEngine.audio,
    quantity: 1,
    ...(image && qualityField?.values?.includes('high') ? { quality: 'high' as const } : {}),
    ...(details && isSeedance2TokenPricing(details) ? { aspectRatio: details.tokenPricing.defaultAspectRatio } : {}),
    referenceImageCount: 0,
  };
}

export function resolveModelPublicOffer(engine: FalEngineEntry, pricingEngine: EngineCaps): ModelPublicOffer | null {
  if (!engine.surfaces.app.enabled) return null;
  const scenario = resolveModelOfferScenario(engine, pricingEngine);
  if (!scenario) return null;
  const amountCents = quoteModelOfferAmountCents(engine, pricingEngine, scenario);
  if (amountCents == null || amountCents < 0) return null;
  return {
    amountCents,
    currency: engine.pricingHint?.currency ?? pricingEngine.pricingDetails?.currency ?? pricingEngine.pricing?.currency ?? 'USD',
    scenario,
  };
}

// Preserve the amount-only public audit contract, including historical offline prices.
export function resolveModelOfferAmountCents(engine: FalEngineEntry, pricingEngine: EngineCaps): number | null {
  const scenario = resolveModelOfferScenario(engine, pricingEngine);
  return scenario ? quoteModelOfferAmountCents(engine, pricingEngine, scenario) : null;
}

function quoteModelOfferAmountCents(engine: FalEngineEntry, pricingEngine: EngineCaps, scenario: ModelPublicOfferScenario): number | null {
  const hint = engine.pricingHint;
  // Hints select a scenario, but their historical amounts mix provider costs
  // and stale customer prices. Reuse the public quote owner for sale prices.
  // Preserve the explicit Luma offer scenarios and Seedance token profiles below.
  const hasSpecializedOffer = ['lumaRay2', 'lumaRay2_flash', 'luma-ray-3-2', 'luma-uni-1', 'luma-uni-1-max'].includes(pricingEngine.id)
    || (pricingEngine.pricingDetails && isSeedance2TokenPricing(pricingEngine.pricingDetails));
  if (engine.surfaces.app.enabled && !hasSpecializedOffer) {
    const resolution = scenario.resolution;
    const entry = { ...engine, engine: pricingEngine };
    const quote = engine.category === 'image'
      ? getImagePresetQuote(entry, {
          id: 'model-schema-offer',
          resolution,
          quantity: scenario.quantity,
          quality: 'high',
          mode: 't2i',
          referenceImageCount: 0,
        }, 'en')
      : getPresetQuote(entry, {
          id: 'model-schema-offer', label: '', subLabel: '',
          durationSec: scenario.durationSeconds,
          resolution: resolution as Resolution,
          mode: 't2v',
          audio: scenario.audio,
          referenceImageCount: 0,
        }, 'en');
    return quote.status === 'exact' ? quote.amountCents ?? null : null;
  }
  if (typeof hint?.amountCents === 'number' && Number.isFinite(hint.amountCents) && hint.amountCents > 0) {
    return quoteModelOfferFacts(
      buildAuthoredPublicOfferFacts({
        engineId: engine.id,
        currency: hint.currency ?? pricingEngine.pricingDetails?.currency ?? 'USD',
        amountCents: hint.amountCents,
      }),
      { resolution: hint.resolution }
    );
  }

  const pricingDetails = pricingEngine.pricingDetails;
  const resolution = scenario.resolution;
  const durationSeconds = scenario.durationSeconds;
  const mode = engine.category === 'image' ? 't2i' : 't2v';

  if (pricingEngine.id === 'lumaRay2' || pricingEngine.id === 'lumaRay2_flash') {
    try {
      const facts = buildPublicPricingFacts({
        engine: pricingEngine,
        durationSec: scenario.durationSeconds,
        durationOption: '5s',
        resolution,
        mode: 't2v',
        lumaRay2BasePriceUsd:
          pricingEngine.id === 'lumaRay2_flash'
            ? DEFAULT_LUMA_RAY2_BASE_PRICE_USD.flash
            : DEFAULT_LUMA_RAY2_BASE_PRICE_USD.standard,
      });
      return quoteModelOfferFacts(facts, { mode: 't2v', resolution });
    } catch {
      return null;
    }
  }

  if (pricingEngine.id === 'luma-ray-3-2') {
    try {
      const facts = buildPublicPricingFacts({
        engine: pricingEngine,
        durationSec: scenario.durationSeconds,
        durationOption: '5s',
        resolution,
        mode: 't2v',
      });
      return quoteModelOfferFacts(facts, { mode: 't2v', resolution });
    } catch {
      return null;
    }
  }

  if (pricingEngine.id === 'luma-uni-1' || pricingEngine.id === 'luma-uni-1-max') {
    try {
      const facts = buildPublicPricingFacts({
        engine: pricingEngine,
        durationSec: 1,
        resolution: resolution ?? '2k',
        mode: 't2i',
        referenceImageCount: 0,
      });
      return quoteModelOfferFacts(facts, { mode: 't2i', resolution: resolution ?? '2k' });
    } catch {
      return null;
    }
  }

  if (pricingDetails && isSeedance2TokenPricing(pricingDetails) && resolution) {
    try {
      const facts = buildPublicPricingFacts({
        engine: pricingEngine,
        durationSec: durationSeconds,
        resolution,
        aspectRatio: scenario.aspectRatio,
        mode: 't2v',
      });
      return quoteModelOfferFacts(facts, { mode: 't2v', resolution });
    } catch {
      return null;
    }
  }

  const perSecondCents =
    (resolution ? pricingDetails?.perSecondCents?.byResolution?.[resolution] : undefined) ??
    pricingDetails?.perSecondCents?.default;
  const flatCents =
    (resolution ? pricingDetails?.flatCents?.byResolution?.[resolution] : undefined) ??
    pricingDetails?.flatCents?.default ??
    0;

  if (typeof perSecondCents === 'number' && Number.isFinite(perSecondCents) && perSecondCents > 0) {
    return quoteModelOfferFacts(
      buildAuthoredPublicOfferFacts({
        engineId: pricingEngine.id,
        currency: pricingDetails?.currency ?? pricingEngine.pricing?.currency ?? 'USD',
        amountCents: Math.round(perSecondCents * durationSeconds + flatCents),
      }),
      { mode, resolution: resolution ?? undefined }
    );
  }
  if (typeof flatCents === 'number' && Number.isFinite(flatCents) && flatCents > 0) {
    return quoteModelOfferFacts(
      buildAuthoredPublicOfferFacts({
        engineId: pricingEngine.id,
        currency: pricingDetails?.currency ?? pricingEngine.pricing?.currency ?? 'USD',
        amountCents: Math.round(flatCents),
      }),
      { mode, resolution: resolution ?? undefined }
    );
  }

  return null;
}

function buildProductOffer(engine: FalEngineEntry, offer: ModelPublicOffer | null, canonical: string, locale: AppLocale) {
  if (!offer) return undefined;
  const { amountCents, currency } = offer;
  return {
    '@type': 'Offer',
    name: formatModelPublicOffer(offer, locale).name,
    url: canonical,
    priceCurrency: currency,
    price: (amountCents / 100).toFixed(2),
    availability: AVAILABILITY_MAP[engine.availability] ?? AVAILABILITY_MAP.limited,
    shippingDetails: buildDigitalShippingDetails(currency),
    hasMerchantReturnPolicy: buildDigitalReturnPolicy(),
  };
}

function buildDigitalShippingDetails(currency: string) {
  return {
    '@type': 'OfferShippingDetails',
    shippingRate: {
      '@type': 'MonetaryAmount',
      value: '0',
      currency,
    },
    shippingDestination: MERCHANT_POLICY_COUNTRIES.map((addressCountry) => ({
      '@type': 'DefinedRegion',
      addressCountry,
    })),
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: {
        '@type': 'QuantitativeValue',
        minValue: 0,
        maxValue: 0,
        unitCode: 'DAY',
      },
      transitTime: {
        '@type': 'QuantitativeValue',
        minValue: 0,
        maxValue: 0,
        unitCode: 'DAY',
      },
    },
  };
}

function buildDigitalReturnPolicy() {
  return {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: [...MERCHANT_POLICY_COUNTRIES],
    returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
  };
}

export function buildProductSchema({
  engine,
  canonical,
  description,
  heroTitle,
  heroPosterAbsolute,
  pricingEngine,
  publicOffer,
  locale = 'en',
}: {
  engine: FalEngineEntry;
  canonical: string;
  description: string;
  heroTitle: string;
  heroPosterAbsolute: string | null;
  pricingEngine?: EngineCaps;
  publicOffer?: ModelPublicOffer | null;
  locale?: AppLocale;
}) {
  // Historical pages retain WebPage/FAQ/breadcrumb data, but cannot sell a
  // generation when the registry's app publication explicitly disables it.
  if (!engine.surfaces.app.enabled) return null;
  const provider = resolveProviderInfo(engine);
  const offerPayload: { offers?: ReturnType<typeof buildProductOffer> } =
    pricingEngine
    ? { offers: buildProductOffer(engine, publicOffer === undefined ? resolveModelPublicOffer(engine, pricingEngine) : publicOffer, canonical, locale) }
    : {};
  if (!offerPayload.offers) return null;
  const category = isImageOnlyModel(engine)
    ? 'AI Image Generator'
    : supportsAudioGeneration(engine) && !supportsVideoGeneration(engine)
      ? 'AI Audio Generator'
      : 'AI Video Generator';
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: heroTitle,
    description,
    category,
    url: canonical,
    image: heroPosterAbsolute ? [heroPosterAbsolute] : undefined,
    offers: offerPayload.offers,
    brand: {
      '@type': 'Brand',
      name: provider.name,
      url: provider.url,
    },
    manufacturer: {
      '@type': 'Organization',
      name: provider.name,
      url: provider.url,
    },
  };
}
