import {
  rankQuotedOffers,
  type PurchaseCandidate,
  type PurchaseLimits,
  type PurchaseStrategy,
} from '@/lib/video-purchase-decision';
import type { VideoProviderKey } from './types';
import type { PurchaseRequest, PurchaseOffer } from './purchase/types';
import { WAN_PRIME_OFFERS } from './purchase/wan-prime';
import { KLING_PRO_OFFERS } from './purchase/kling-pro';

export type { PurchaseOffer, PurchaseRequest } from './purchase/types';
export { WAN_PRIME_OFFERS, APIMART_PRIME_MICROS_PER_SECOND } from './purchase/wan-prime';

type EnginePurchasePolicy = {
  baseline: VideoProviderKey;
  strategy: PurchaseStrategy;
  offers: readonly PurchaseOffer[];
};

const kling: EnginePurchasePolicy = {
  baseline: 'kling_direct',
  strategy: 'preserve-fallback',
  offers: KLING_PRO_OFFERS,
};
const policies = new Map<string, EnginePurchasePolicy>([
  ['wan-3-prime', { baseline: 'alibaba_model_studio', strategy: 'lowest-cost', offers: WAN_PRIME_OFFERS }],
  ['kling-3-pro', kling],
  ['kling-o3-pro', kling],
]);

export function usesPurchaseBaseline(engineId: string, provider: VideoProviderKey) {
  return policies.get(engineId)?.baseline === provider;
}

function quoteOffers(request: PurchaseRequest, offers: readonly PurchaseOffer[]): PurchaseCandidate[] {
  return offers.map((offer) => ({
    provider: offer.provider,
    tariff: offer.tariff,
    costMicros: offer.quote(request),
    excluded: offer.exclude(request),
    ...(offer.terminal ? { terminal: true } : {}),
  }));
}

export function rankPurchaseOffers(
  request: PurchaseRequest,
  offers: readonly PurchaseOffer[],
  limits: PurchaseLimits
) {
  return rankQuotedOffers(quoteOffers(request, offers), limits);
}

/** Retain raw capability/price facts so the simulator can reapply availability, budget and ordering. */
export function quoteVideoPurchase(request: PurchaseRequest) {
  const policy = policies.get(request.engineId);
  if (!policy) return null;
  const candidates = quoteOffers(request, policy.offers);
  const baseline = candidates.find((row) => row.provider === policy.baseline);
  return {
    engineId: request.engineId,
    strategy: policy.strategy,
    candidates,
    baselineProvider: policy.baseline,
    baselineMicros: baseline?.costMicros ?? -1,
  };
}

function selectPurchasePlan(
  quote: NonNullable<ReturnType<typeof quoteVideoPurchase>>,
  limits: Partial<PurchaseLimits>
) {
  return {
    engineId: quote.engineId,
    baselineProvider: quote.baselineProvider,
    ...rankQuotedOffers(quote.candidates, {
      ...limits,
      strategy: limits.strategy ?? quote.strategy,
      ceilingMicros: Math.min(quote.baselineMicros, limits.ceilingMicros ?? quote.baselineMicros),
    }),
  };
}

export function planVideoPurchase(request: PurchaseRequest, limits: Partial<PurchaseLimits> = {}) {
  const quote = quoteVideoPurchase(request);
  return quote ? selectPurchasePlan(quote, limits) : null;
}

/** The preproduction transport is qualified independently of a price comparison. */
export function planWanPrimePurchase(request: PurchaseRequest, limits: Partial<PurchaseLimits> = {}) {
  const quote = request.engineId === 'wan-3-prime' ? quoteVideoPurchase(request) : null;
  if (!quote) return { ...rankQuotedOffers([], { ceilingMicros: -1 }), canaryEligible: false };
  const pilot = quote.candidates.find((row) => row.provider === 'apimart');
  const plan = selectPurchasePlan(quote, limits);
  return { ...plan, canaryEligible: Boolean(pilot && !pilot.excluded && pilot.costMicros !== null) };
}

export function customerPurchaseCeiling(pricing: { currency?: string | null; totalCents: number }) {
  const micros = pricing.totalCents * 10_000;
  return pricing.currency?.toUpperCase() === 'USD' &&
    Number.isSafeInteger(pricing.totalCents) &&
    Number.isSafeInteger(micros) &&
    micros >= 0
    ? micros
    : -1;
}
