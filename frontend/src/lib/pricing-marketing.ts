import type { EngineCaps } from '@/types/engines';
import { computePricingSnapshot } from '@/lib/pricing';

type MemberTier = 'member' | 'plus' | 'pro';

const DEFAULT_DURATION_SEC = 5;
const PREFERRED_RESOLUTIONS = ['720p', '1080p', '4k', '1440p', '768p', '512p'];

function selectMarketingResolutions(resolutions: string[]): string[] {
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
  return ordered.slice(0, 3);
}

export type MarketingPricePoint = {
  resolution: string;
  cents: number;
  currency: string;
};

export async function computeMarketingPricePoints(
  engine: EngineCaps,
  options?: { durationSec?: number; memberTier?: MemberTier }
): Promise<MarketingPricePoint[]> {
  const durationSec = options?.durationSec ?? DEFAULT_DURATION_SEC;
  const memberTier = options?.memberTier ?? 'member';
  const resolutions = selectMarketingResolutions(engine.resolutions ?? []);
  if (!resolutions.length) return [];

  const points: MarketingPricePoint[] = [];
  for (const resolution of resolutions) {
    try {
      const snapshot = await computePricingSnapshot({
        engine,
        durationSec,
        resolution,
        membershipTier: memberTier,
      });
      const seconds = typeof snapshot.base.seconds === 'number' ? snapshot.base.seconds : durationSec;
      if (!seconds) continue;
      const perSecondCents = Math.round(snapshot.totalCents / seconds);
      points.push({
        resolution,
        cents: perSecondCents,
        currency: snapshot.currency ?? 'USD',
      });
    } catch {
      // ignore pricing failures for marketing surfaces
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
  options?: { durationSec?: number; memberTier?: MemberTier }
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
