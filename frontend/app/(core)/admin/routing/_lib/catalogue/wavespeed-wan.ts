import { wanFlatExclusion } from '@/lib/video-routing/wan-request';
import type { CatalogueCard, CatalogueQuote, ComparisonRequest } from './types';

const wanRates: Record<string, number> = { '480p': 45_000, '720p': 90_000, '1080p': 180_000 };
const primeRates: Record<string, number> = { '480p': 67_500, '720p': 135_000, '1080p': 270_000 };

function waveSpeedQuote(request: ComparisonRequest): CatalogueQuote {
  const prime = request.engineId === 'wan-3-prime';
  const rate = (prime ? primeRates : wanRates)[request.resolution.toLowerCase()];
  const path = { t2v: 'text-to-video', i2v: 'image-to-video', ref2v: 'reference-to-video' }[request.mode];
  const model = prime ? 'wan-3.0-prime' : 'wan-3.0';
  const offer: CatalogueQuote = {
    tariff: 'WaveSpeedAI · published offer · 2026-11-27',
    sourceUrl: 'https://wavespeed.ai/models/alibaba/' + model + '/' + (path ?? 'reference-to-video'),
    costMicros: null, excluded: null,
  };
  const excluded = wanFlatExclusion('wavespeed', request);
  if (excluded) return { ...offer, excluded };
  const inputSeconds = Math.ceil(request.inputVideoSeconds ?? 0);
  return { ...offer, costMicros: rate * (request.durationSec + inputSeconds) };
}

export const waveSpeedWan: CatalogueCard = {
  provider: 'wavespeed',
  engines: ['wan-3', 'wan-3-prime'],
  quote: waveSpeedQuote,
};
