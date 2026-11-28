import type { PurchaseCandidate, PurchaseProviderKey } from '@/lib/video-purchase-decision';
import { quoteVideoPurchase } from '@/server/video-providers/purchase-router';
import { apimartH3, h3MaxFalQuote } from './catalogue/minimax-h3';
import { waveSpeedWan } from './catalogue/wavespeed-wan';
import type { CatalogueCard, CatalogueQuote, ComparisonRequest } from './catalogue/types';

export type { ComparisonRequest } from './catalogue/types';

const catalogueCards: readonly CatalogueCard[] = [waveSpeedWan, apimartH3];

function baselineOffers(request: ComparisonRequest) {
  if (request.engineId !== 'minimax-h3-max') return quoteVideoPurchase(request, 'comparison');
  const baseline = h3MaxFalQuote(request);
  return { strategy: 'lowest-cost' as const, baselineMicros: baseline.costMicros ?? -1, candidates: [baseline] };
}

/** Both admin views use this registry. A catalogue card has no submission capability. */
export function quoteComparisonRequest(request: ComparisonRequest, cards = catalogueCards) {
  const quote = baselineOffers(request);
  if (!quote) return null;
  const candidates: (PurchaseCandidate<PurchaseProviderKey> & Pick<CatalogueQuote, 'excludedAtEveryRatio'>)[] = [...quote.candidates];
  for (const card of cards) {
    if (card.engines.some(id => id === request.engineId)) {
      candidates.push({ ...card.quote(request), provider: card.provider, simulationOnly: true });
    }
  }
  return { ...quote, candidates };
}
