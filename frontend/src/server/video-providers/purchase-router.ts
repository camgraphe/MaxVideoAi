import {
  rankQuotedOffers,
  type PurchaseCandidate,
  type PurchaseLimits,
  type PurchaseRoutingEngineId,
  type PurchaseStrategy,
} from '@/lib/video-purchase-decision';
import type { VideoProviderKey } from './types';
import type { PurchaseRequest, PurchaseOffer } from './purchase/types';
import { isReviewedWanPilotRequest, WAN_OFFERS } from './purchase/wan';
import type { WanPurchaseCanary } from './router';
import { H3_FAL_OFFER, SEEDANCE_25_BYTEPLUS_OFFER } from './purchase/h3-seedance';
import { KLING_PRO_OFFERS } from './purchase/kling-pro';

export type { PurchaseOffer, PurchaseRequest } from './purchase/types';
export { WAN_OFFERS as WAN_PRIME_OFFERS, APIMART_PRIME_MICROS_PER_SECOND } from './purchase/wan';

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
const wan: EnginePurchasePolicy = { baseline: 'alibaba_model_studio', strategy: 'lowest-cost', offers: WAN_OFFERS };
const policies = new Map<string, EnginePurchasePolicy>([
  ['wan-3-prime', wan],
  ['wan-3', wan],
  ['minimax-h3', { baseline: 'fal', strategy: 'lowest-cost', offers: [H3_FAL_OFFER] }],
  ['seedance-2-5', { baseline: 'byteplus_modelark', strategy: 'lowest-cost', offers: [SEEDANCE_25_BYTEPLUS_OFFER] }],
  ['kling-3-pro', kling],
  ['kling-o3-pro', kling],
] satisfies [PurchaseRoutingEngineId, EnginePurchasePolicy][]);

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
export function planWanPurchase(
  request: PurchaseRequest, limits: Partial<PurchaseLimits> = {}, pilot?: WanPurchaseCanary
) {
  const quote = policies.get(request.engineId) === wan ? quoteVideoPurchase(request) : null;
  if (!quote) return { ...rankQuotedOffers<VideoProviderKey>([], { ceilingMicros: -1 }), canaryEligible: false };
  const installedOnly = pilot === 'alibaba-fal';
  const plan = selectPurchasePlan(quote, installedOnly ? {
    ...limits, unavailable: { ...limits.unavailable, apimart: 'Outside the Alibaba and Fal pilot' },
  } : limits);
  const permitted = request.engineId === 'wan-3-prime' || (request.engineId === 'wan-3' && installedOnly);
  return { ...plan, canaryEligible: permitted && isReviewedWanPilotRequest(request) };
}

export function planWanPrimePurchase(request: PurchaseRequest, limits: Partial<PurchaseLimits> = {}) {
  return request.engineId === 'wan-3-prime' ? planWanPurchase(request, limits)
    : { ...rankQuotedOffers<VideoProviderKey>([], { ceilingMicros: -1 }), canaryEligible: false };
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
