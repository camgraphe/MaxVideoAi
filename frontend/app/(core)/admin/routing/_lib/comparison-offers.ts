import { MINIMAX_H3_FIXED_ASPECT_RATIOS } from '@/config/fal-engines/minimax-h3';
import { MINIMAX_H3_MAX_RESOLUTIONS } from '@/config/fal-engines/minimax-h3-max';
import { calculateMinimaxH3MaxProviderCost } from '@/lib/minimax-h3-max-pricing';
import type { PurchaseCandidate, PurchaseProviderKey } from '@/lib/video-purchase-decision';
import { wanImageMode } from '@/server/video-providers/apimart/wan-image-mode';
import { quoteVideoPurchase, type PurchaseRequest } from '@/server/video-providers/purchase-router';

/** These facts describe the scenario. They never enter a submission or a historical replay. */
export type ComparisonRequest = PurchaseRequest & {
  referenceVideoSeconds?: readonly number[];
  promptCharacters?: number;
};

type CatalogueCandidate = PurchaseCandidate<PurchaseProviderKey>;

const wanRates: Record<string, number> = { '480p': 45_000, '720p': 90_000, '1080p': 180_000 };
const primeRates: Record<string, number> = { '480p': 67_500, '720p': 135_000, '1080p': 270_000 };
const h3Rates: Record<string, number> = { '768P': 57_120, '2K': 91_440 };
const h3MaxRates: Record<string, number> = { '480P': 37_680, '768P': 57_120, '1080P': 128_000 };

function waveSpeedQuote(request: ComparisonRequest): CatalogueCandidate {
  const prime = request.engineId === 'wan-3-prime';
  const rate = (prime ? primeRates : wanRates)[request.resolution.toLowerCase()];
  const roles = wanImageMode(request.mode, request.images, request.hasStartFrame === true, request.hasEndFrame);
  const path = { t2v: 'text-to-video', i2v: 'image-to-video', ref2v: 'reference-to-video' }[request.mode];
  const model = prime ? 'wan-3.0-prime' : 'wan-3.0';
  const offer: CatalogueCandidate = {
    provider: 'wavespeed',
    tariff: 'WaveSpeedAI · published offer · 2026-11-27',
    sourceUrl: 'https://wavespeed.ai/models/alibaba/' + model + '/' + (path ?? 'reference-to-video'),
    simulationOnly: true, costMicros: null, excluded: null,
  };
  if (!path || request.hasAudioReference || request.hasDocument || request.hasUnpricedOptions || request.requiresDirectControls)
    return { ...offer, excluded: 'Mode or options outside reviewed WaveSpeed endpoints' };
  if (!Number.isSafeInteger(rate) || !Number.isInteger(request.durationSec) || request.durationSec < 2 || request.durationSec > 30)
    return { ...offer, excluded: 'Unsupported resolution or output duration' };
  if (!(request.aspectRatio && ['16:9', '9:16', '1:1', '4:3', '3:4'].includes(request.aspectRatio))
      && !(request.mode === 'i2v' && [null, 'auto', 'adaptive'].includes(request.aspectRatio)))
    return { ...offer, excluded: 'Aspect ratio outside reviewed profile' };

  let inputSeconds = 0;
  if (request.hasVideo) {
    const clips = request.referenceVideoSeconds;
    if (request.mode !== 'ref2v' || request.hasStartFrame || request.hasEndFrame ||
        !Number.isInteger(request.images) || request.images < 0 || request.images > 10)
      return { ...offer, excluded: 'Expected reference media without frame controls' };
    if (!clips?.length || clips.length > 5 || clips.some(sec => !Number.isFinite(sec) || sec < 1 || sec > 15))
      return { ...offer, excluded: 'Each reference video needs a verified duration of 1 to 15 seconds' };
    const total = clips.reduce((sum, sec) => sum + sec, 0);
    if (request.inputVideoSeconds == null || !Number.isFinite(request.inputVideoSeconds) ||
        Math.abs(request.inputVideoSeconds - total) > 1e-9 || total > 15 || total + request.durationSec > 30)
      return { ...offer, excluded: 'Reference durations exceed limits or disagree with the source total' };
    inputSeconds = Math.ceil(total);
  } else if (!roles || request.referenceVideoSeconds?.length || (request.inputVideoSeconds ?? 0) !== 0) {
    return { ...offer, excluded: 'Unsupported combination of frames and references' };
  }
  return { ...offer, costMicros: rate * (request.durationSec + inputSeconds) };
}

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

function h3GoldQuote(request: ComparisonRequest, max: boolean): CatalogueCandidate {
  const rate = (max ? h3MaxRates : h3Rates)[request.resolution.toUpperCase()];
  let excluded = h3Profile(request);
  if (!excluded && !Number.isSafeInteger(rate)) excluded = 'Resolution absent from the APIMart Gold rate card';
  if (!excluded && (!Number.isInteger(request.promptCharacters) || !request.promptCharacters || request.promptCharacters < 1 || request.promptCharacters > 7000))
    excluded = 'APIMart requires a known prompt length of 1 to 7,000 characters';
  const extraImages = Math.max(0, request.images - (max ? 2 : 5));
  return {
    provider: 'apimart', tariff: 'APIMart Gold · 2026-11-27', simulationOnly: true,
    sourceUrl: 'https://apimart.ai/model/minimax-h3' + (max ? '-max' : ''),
    excluded, costMicros: excluded ? null : rate * request.durationSec + extraImages * (max ? 57_120 : 22_880),
  };
}

function h3MaxFalQuote(request: ComparisonRequest): PurchaseCandidate<'fal'> {
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

/** Import only in the admin lab. Transport and saved-replay planners retain their own reviewed offer set. */
export function quoteComparisonRequest(request: ComparisonRequest) {
  if (request.engineId === 'minimax-h3-max') {
    const baseline = h3MaxFalQuote(request);
    return { strategy: 'lowest-cost' as const, baselineMicros: baseline.costMicros ?? -1,
      candidates: [baseline, h3GoldQuote(request, true)] as CatalogueCandidate[] };
  }
  const quote = quoteVideoPurchase(request);
  if (!quote) return null;
  const candidates = quote.candidates.map<CatalogueCandidate>(row => {
    if (row.provider !== 'apimart') return row;
    const prime = request.engineId === 'wan-3-prime';
    return { ...row, simulationOnly: prime ? undefined : true, sourceUrl: 'https://apimart.ai/model/wan-3-0' + (prime ? '-prime' : '') };
  });
  if (request.engineId === 'wan-3' || request.engineId === 'wan-3-prime') candidates.push(waveSpeedQuote(request));
  if (request.engineId === 'minimax-h3') candidates.push(h3GoldQuote(request, false));
  return { ...quote, candidates };
}
