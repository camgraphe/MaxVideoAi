import { MINIMAX_H3_FIXED_ASPECT_RATIOS } from '@/config/fal-engines/minimax-h3';
import { MINIMAX_H3_MAX_RESOLUTIONS } from '@/config/fal-engines/minimax-h3-max';
import { calculateMinimaxH3MaxProviderCost } from '@/lib/minimax-h3-max-pricing';
import type { PurchaseCandidate } from '@/lib/video-purchase-decision';
import type { CatalogueCard, CatalogueQuote, ComparisonRequest } from './types';

const h3Rates: Record<string, number> = { '768P': 57_120, '2K': 91_440 };
const h3MaxRates: Record<string, number> = { '480P': 37_680, '768P': 57_120, '1080P': 128_000 };

function h3Profile(request: ComparisonRequest): string | null {
  if (!Number.isInteger(request.durationSec) || request.durationSec < 5 || request.durationSec > 15)
    return 'The shared output range is 5 to 15 whole seconds';
  if (request.hasVideo || request.hasAudioReference || request.hasDocument || request.hasEndFrame ||
      request.hasUnpricedOptions || request.requiresDirectControls || request.audioEnabled === false)
    return 'Outside reviewed H3 generation options';
  if (request.mode === 'i2v')
    return request.hasStartFrame && request.images === 1 && request.aspectRatio === null
      ? null : 'A start-frame clip follows the image aspect ratio';
  if (request.hasStartFrame || !MINIMAX_H3_FIXED_ASPECT_RATIOS.some(ratio => ratio === request.aspectRatio))
    return 'Expected a fixed supported aspect ratio with no frame control';
  if (request.mode === 't2v' && request.images === 0) return null;
  if (request.mode === 'ref2v' && Number.isInteger(request.images) && request.images >= 1 && request.images <= 9) return null;
  return 'Unsupported combination of frames and references';
}

function h3GoldQuote(request: ComparisonRequest): CatalogueQuote {
  const max = request.engineId === 'minimax-h3-max';
  const rate = (max ? h3MaxRates : h3Rates)[request.resolution.toUpperCase()];
  let excluded = h3Profile(request);
  if (!excluded && !Number.isSafeInteger(rate)) excluded = 'Resolution absent from the APIMart Gold rate card';
  if (!excluded && request.h3PromptExpansion !== 'disabled')
    excluded = 'APIMart has no reviewed equivalent for the Fal prompt expansion setting';
  if (!excluded && (!Number.isInteger(request.promptCharacters) || !request.promptCharacters || request.promptCharacters < 1 || request.promptCharacters > 7000))
    excluded = 'APIMart requires a known prompt length of 1 to 7,000 characters';
  const extraImages = Math.max(0, request.images - (max ? 2 : 5));
  return {
    tariff: 'APIMart Gold · 2026-11-27',
    ...(excluded && (!Number.isSafeInteger(rate) || ['balanced', 'quality', 'fast'].includes(request.h3PromptExpansion ?? ''))
      ? { excludedAtEveryRatio: true } : {}),
    sourceUrl: 'https://apimart.ai/model/minimax-h3' + (max ? '-max' : ''),
    excluded, costMicros: excluded ? null : rate * request.durationSec + extraImages * (max ? 57_120 : 22_880),
  };
}

export function h3MaxFalQuote(request: ComparisonRequest): PurchaseCandidate<'fal'> {
  const resolution = MINIMAX_H3_MAX_RESOLUTIONS.find(value => value === request.resolution.toUpperCase());
  const mode = request.mode;
  const supported = mode === 't2v' || mode === 'i2v';
  const excluded = h3Profile(request) ?? (!supported ? 'Fal reference mode requires a trusted token budget' : null)
    ?? (!resolution ? 'Unsupported H3 Max resolution' : null);
  const cost = !excluded && supported && resolution
    ? calculateMinimaxH3MaxProviderCost({ mode, resolution, durationSec: request.durationSec }) : null;
  return { provider: 'fal', terminal: true, tariff: 'Fal MiniMax H3 Max · standard rate', excluded,
    sourceUrl: 'https://fal.ai/models/minimax/h3-max/' + (mode === 't2v' ? 'text-to-video' : mode === 'ref2v' ? 'reference-to-video' : 'image-to-video'),
    costMicros: cost ? Math.round(cost.providerCostUsd * 1e6) : null };
}

export const apimartH3: CatalogueCard = {
  provider: 'apimart',
  engines: ['minimax-h3', 'minimax-h3-max'],
  quote: h3GoldQuote,
};

export const videoRouterWaveSpeedH3: CatalogueCard = {
  provider: 'videorouter_wavespeed',
  engines: ['minimax-h3'],
  quote(request) {
    const quotedProfile = !h3Profile(request) && request.mode === 'ref2v' && request.images === 2 &&
      request.durationSec === 15 && request.resolution.toLowerCase() === '480p' && request.aspectRatio === '21:9' &&
      request.h3PromptExpansion === 'balanced' && !request.hasSeed && request.inputVideoSeconds === 0 &&
      !request.referenceVideoSeconds?.length && request.promptExpansionEnabled !== false;
    // VideoRouter quoted a $0.60 subtotal with prompt_extend=true. Neither API specifies Fal's balanced mode.
    return {
      tariff: 'VideoRouter · WaveSpeed native H3 · $0.60 plus 2.5% standard fee · 2026-11-28',
      sourceUrl: 'https://videorouter.sh/video/minimax/h3/wavespeed',
      costMicros: quotedProfile ? 615_000 : null,
      excluded: quotedProfile
        ? 'Balanced expansion unverified. The 4 s test delivered 4.46 s. Account quote $0.6075 at 1.25%, displayed price at 2.5%.'
        : 'Outside the quoted WaveSpeed H3 profile',
      excludedAtEveryRatio: true,
    };
  },
};
