import type { PurchaseCandidate, PurchaseProviderKey } from '@/lib/video-purchase-decision';
import { klingV4SandBasePlan } from '@/server/video-providers/videorouter/kling-v4';
import { minimaxH3WaveSpeedPlan } from '@/server/video-providers/videorouter/minimax-h3';
import { quoteVideoPurchase } from '@/server/video-providers/purchase-router';
import { apimartH3, h3MaxFalQuote, h3WaveSpeedInputsMatch } from './catalogue/minimax-h3';
import { waveSpeedWan } from './catalogue/wavespeed-wan';
import type { CatalogueCard, CatalogueQuote, ComparisonRequest } from './catalogue/types';

export type { ComparisonRequest } from './catalogue/types';

const catalogueCards: readonly CatalogueCard[] = [waveSpeedWan, apimartH3];

function baselineOffers(request: ComparisonRequest) {
  if (request.engineId === 'kling-v4') {
    if (request.mode !== 'ref2v' || request.images !== 3 ||
        request.resolution !== '720p' || request.aspectRatio !== '16:9' || request.hasStartFrame || request.hasEndFrame ||
        request.hasVideo || request.hasAudioReference || request.hasDocument || request.hasSeed === true ||
        request.audioEnabled === false || request.requiresDirectControls || request.hasUnpricedOptions ||
        !Number.isInteger(request.durationSec) || request.durationSec < 3 || request.durationSec > 30) return null;
    const plan = klingV4SandBasePlan(request.durationSec, Number.MAX_SAFE_INTEGER);
    // Fal's rate for this image-only profile is independent of image ownership and seed.
    const candidates = request.ownedReferenceImages === true && request.hasSeed === false
      ? plan.candidates : plan.candidates.filter(candidate => candidate.provider === 'fal');
    return { strategy: 'lowest-cost' as const, baselineMicros: plan.baselineMicros, candidates };
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
  if (h3WaveSpeedInputsMatch(request)) {
    const plan = minimaxH3WaveSpeedPlan(request.durationSec, Number.MAX_SAFE_INTEGER);
    const waveSpeed = plan.candidates.find(offer => offer.provider === 'videorouter')!;
    const qualifiedRatio = request.aspectRatio === '21:9';
    candidates.unshift({
      ...waveSpeed,
      tariff: waveSpeed.tariff + ' · prompt_extend=true as a proxy for Balanced',
      sourceUrl: 'https://videorouter.sh/video/minimax/h3/wavespeed',
      excluded: qualifiedRatio ? waveSpeed.excluded : 'The qualified WaveSpeed H3 profile requires 21:9 framing',
      costMicros: qualifiedRatio ? waveSpeed.costMicros : null,
    });
  }
  for (const card of cards) {
    if (card.engines.some(id => id === request.engineId)) {
      candidates.push({ ...card.quote(request), provider: card.provider, simulationOnly: true });
    }
  }
  return { ...quote, candidates };
}
