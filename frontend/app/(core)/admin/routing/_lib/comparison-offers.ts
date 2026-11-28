import type { PurchaseCandidate, PurchaseProviderKey } from '@/lib/video-purchase-decision';
import { klingV4SandBasePlan } from '@/server/video-providers/videorouter/kling-v4';
import { quoteVideoPurchase } from '@/server/video-providers/purchase-router';
import { apimartH3, h3MaxFalQuote, videoRouterWaveSpeedH3 } from './catalogue/minimax-h3';
import { waveSpeedWan } from './catalogue/wavespeed-wan';
import type { CatalogueCard, CatalogueQuote, ComparisonRequest } from './catalogue/types';

export type { ComparisonRequest } from './catalogue/types';

const catalogueCards: readonly CatalogueCard[] = [waveSpeedWan, apimartH3, videoRouterWaveSpeedH3];

function baselineOffers(request: ComparisonRequest) {
  if (request.engineId === 'kling-v4') {
    if (request.mode !== 'ref2v' || request.images !== 3 || !request.ownedReferenceImages ||
        request.resolution !== '720p' || request.aspectRatio !== '16:9' || request.hasStartFrame || request.hasEndFrame ||
        request.hasVideo || request.hasAudioReference || request.hasDocument || request.hasSeed !== false ||
        request.audioEnabled === false || request.requiresDirectControls || request.hasUnpricedOptions ||
        !Number.isInteger(request.durationSec) || request.durationSec < 3 || request.durationSec > 30) return null;
    const plan = klingV4SandBasePlan(request.durationSec, Number.MAX_SAFE_INTEGER);
    return { strategy: 'lowest-cost' as const, baselineMicros: plan.baselineMicros, candidates: plan.candidates };
  }
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
