import { PARTNER_BRAND_MAP } from '@/lib/brand-partners';
import {
  calculateLumaAgentsImageReferencePrice,
  calculateLumaRay32ReferencePrice,
} from '@/lib/luma-agents-pricing';
import { isImageOnlyModel, supportsAudioGeneration, supportsVideoGeneration } from '@/lib/models/catalog';
import type { FalEngineEntry } from '@/config/falEngines';
import { computeSeedance2TokenQuote, isSeedance2TokenPricing, roundUsdUpToCents } from '@/lib/seedance-2-pricing';
import type { EngineAvailability, EngineCaps } from '@/types/engines';
import { SITE } from './model-page-links';

const PROVIDER_INFO_MAP: Record<string, { name: string; url: string }> = {
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

const DEFAULT_SCHEMA_MARGIN_PERCENT = 0.3;
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
    url: override?.url ?? fallback?.availabilityLink ?? SITE,
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

function resolveOfferAmountCents(engine: FalEngineEntry, pricingEngine: EngineCaps): number | null {
  const hint = engine.pricingHint;
  if (typeof hint?.amountCents === 'number' && Number.isFinite(hint.amountCents) && hint.amountCents > 0) {
    return Math.round(hint.amountCents);
  }

  const lumaAgentsAmountCents = resolveLumaAgentsOfferAmountCents(engine);
  if (lumaAgentsAmountCents != null) {
    return lumaAgentsAmountCents;
  }

  const pricingDetails = pricingEngine.pricingDetails;
  const resolution = resolveOfferResolution(pricingEngine, hint?.resolution);
  const durationSeconds = resolveOfferDurationSeconds(pricingEngine, hint?.durationSeconds);

  if (pricingDetails && isSeedance2TokenPricing(pricingDetails) && resolution) {
    try {
      const quote = computeSeedance2TokenQuote({
        details: pricingDetails,
        durationSec: durationSeconds,
        resolution,
        aspectRatio: pricingDetails.tokenPricing.defaultAspectRatio,
      });
      return roundUsdUpToCents(quote.vendorCostUsd * (1 + DEFAULT_SCHEMA_MARGIN_PERCENT));
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
    return Math.round(perSecondCents * durationSeconds + flatCents);
  }
  if (typeof flatCents === 'number' && Number.isFinite(flatCents) && flatCents > 0) {
    return Math.round(flatCents);
  }

  return null;
}

function resolveLumaAgentsOfferAmountCents(engine: FalEngineEntry): number | null {
  try {
    if (engine.engine.id === 'luma-ray-3-2') {
      const quote = calculateLumaRay32ReferencePrice({ duration: '5s', resolution: '540p' });
      return roundUsdUpToCents(quote.totalUsd * (1 + DEFAULT_SCHEMA_MARGIN_PERCENT));
    }

    if (engine.engine.id === 'luma-uni-1' || engine.engine.id === 'luma-uni-1-max') {
      const quote = calculateLumaAgentsImageReferencePrice({
        engineId: engine.engine.id,
        mode: 't2i',
        referenceImageCount: 0,
      });
      return roundUsdUpToCents(quote.totalUsd * (1 + DEFAULT_SCHEMA_MARGIN_PERCENT));
    }
  } catch {
    return null;
  }

  return null;
}

function buildProductOffer(engine: FalEngineEntry, pricingEngine: EngineCaps, canonical: string) {
  const amountCents = resolveOfferAmountCents(engine, pricingEngine);
  if (amountCents == null || amountCents < 0) return undefined;
  const currency = engine.pricingHint?.currency ?? pricingEngine.pricingDetails?.currency ?? pricingEngine.pricing?.currency ?? 'USD';
  return {
    '@type': 'Offer',
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
    returnPolicyCountry: [...MERCHANT_POLICY_COUNTRIES],
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
}: {
  engine: FalEngineEntry;
  canonical: string;
  description: string;
  heroTitle: string;
  heroPosterAbsolute: string | null;
  pricingEngine?: EngineCaps;
}) {
  const provider = resolveProviderInfo(engine);
  const offerPayload: { offers?: ReturnType<typeof buildProductOffer> } = pricingEngine
    ? { offers: buildProductOffer(engine, pricingEngine, canonical) }
    : {};
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
    ...(offerPayload.offers ? { offers: offerPayload.offers } : {}),
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
