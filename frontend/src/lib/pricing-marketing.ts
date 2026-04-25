import type { EngineCaps } from '@/types/engines';
import { computePricingSnapshot } from '@/lib/pricing';
import {
  GPT_IMAGE_2_CANONICAL_SIZE_VALUES,
  type GptImage2Quality,
} from '@/lib/image/gptImage2';

type MemberTier = 'member' | 'plus' | 'pro';

const DEFAULT_DURATION_SEC = 5;
const PREFERRED_RESOLUTIONS = ['720p', '1080p', '4k', '1440p', '768p', '512p'];
const GPT_IMAGE_2_MARKETING_QUALITIES: GptImage2Quality[] = ['low', 'medium', 'high'];

function isPerImageEngine(engine: EngineCaps) {
  return engine.pricing?.unit === 'image' || engine.modes.every((mode) => mode === 't2i' || mode === 'i2i');
}

function selectMarketingResolutions(resolutions: string[], limit = 3): string[] {
  const normalized = resolutions.filter((value) => value && value !== 'auto');
  if (!normalized.length) return [];
  const byKey = new Map(normalized.map((value) => [value.toLowerCase(), value]));
  const ordered: string[] = [];
  PREFERRED_RESOLUTIONS.forEach((key) => {
    const match = byKey.get(key);
    if (match) ordered.push(match);
  });
  normalized.forEach((value) => {
    if (!ordered.includes(value)) ordered.push(value);
  });
  return limit > 0 ? ordered.slice(0, limit) : ordered;
}

export type MarketingPricePoint = {
  resolution: string;
  cents: number;
  currency: string;
  quality?: string;
};

export async function computeMarketingPricePoints(
  engine: EngineCaps,
  options?: { durationSec?: number; memberTier?: MemberTier; limit?: number | null }
): Promise<MarketingPricePoint[]> {
  const durationSec = isPerImageEngine(engine) ? 1 : options?.durationSec ?? DEFAULT_DURATION_SEC;
  const memberTier = options?.memberTier ?? 'member';
  const resolutionLimit = options?.limit === null ? 0 : options?.limit ?? 3;
  const resolutions =
    engine.id === 'gpt-image-2'
      ? [...GPT_IMAGE_2_CANONICAL_SIZE_VALUES]
      : selectMarketingResolutions(engine.resolutions ?? [], resolutionLimit);
  if (!resolutions.length) return [];
  const qualities: Array<GptImage2Quality | undefined> =
    engine.id === 'gpt-image-2' ? GPT_IMAGE_2_MARKETING_QUALITIES : [undefined];

  const points: MarketingPricePoint[] = [];
  for (const resolution of resolutions) {
    for (const quality of qualities) {
      try {
        const snapshot = await computePricingSnapshot({
          engine,
          durationSec,
          resolution,
          membershipTier: memberTier,
          quality,
        });
        const units = isPerImageEngine(engine)
          ? durationSec
          : typeof snapshot.base.seconds === 'number'
            ? snapshot.base.seconds
            : durationSec;
        if (!units) continue;
        const unitCents = Math.round(snapshot.totalCents / units);
        points.push({
          resolution,
          quality,
          cents: unitCents,
          currency: snapshot.currency ?? 'USD',
        });
      } catch {
        // ignore pricing failures for marketing surfaces
      }
    }
  }
  return points;
}

export type MarketingPriceRange = {
  currency: string;
  min: MarketingPricePoint;
  max: MarketingPricePoint;
};

export async function computeMarketingPriceRange(
  engine: EngineCaps,
  options?: { durationSec?: number; memberTier?: MemberTier; limit?: number | null }
): Promise<MarketingPriceRange | null> {
  const points = await computeMarketingPricePoints(engine, options);
  if (!points.length) return null;
  const sorted = [...points].sort((a, b) => a.cents - b.cents);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  return {
    currency: min.currency,
    min,
    max,
  };
}
