import { wanImageMode } from '@/server/video-providers/apimart/wan-image-mode';
import type { CatalogueCard, CatalogueQuote, ComparisonRequest } from './types';

const wanRates: Record<string, number> = { '480p': 45_000, '720p': 90_000, '1080p': 180_000 };
const primeRates: Record<string, number> = { '480p': 67_500, '720p': 135_000, '1080p': 270_000 };

function waveSpeedQuote(request: ComparisonRequest): CatalogueQuote {
  const prime = request.engineId === 'wan-3-prime';
  const rate = (prime ? primeRates : wanRates)[request.resolution.toLowerCase()];
  const roles = wanImageMode(request.mode, request.images, request.hasStartFrame === true, request.hasEndFrame);
  const path = { t2v: 'text-to-video', i2v: 'image-to-video', ref2v: 'reference-to-video' }[request.mode];
  const model = prime ? 'wan-3.0-prime' : 'wan-3.0';
  const offer: CatalogueQuote = {
    tariff: 'WaveSpeedAI · published offer · 2026-11-27',
    sourceUrl: 'https://wavespeed.ai/models/alibaba/' + model + '/' + (path ?? 'reference-to-video'),
    costMicros: null, excluded: null,
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

export const waveSpeedWan: CatalogueCard = {
  provider: 'wavespeed',
  engines: ['wan-3', 'wan-3-prime'],
  quote: waveSpeedQuote,
};
