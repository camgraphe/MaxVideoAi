import type { AppLocale } from '@/i18n/locales';
import { computeMarketingPriceRange } from '@/lib/pricing-marketing';
import { applyDisplayedPriceMarginCents } from '@/lib/pricing-display';
import type { EngineCaps } from '@/types/engines';
import type { ComparePricingDisplay, EngineCatalogEntry } from './compare-page-types';

export function getPricePerSecondCents(entry: EngineCatalogEntry): number | null {
  const perSecond = entry.engine?.pricingDetails?.perSecondCents;
  const byResolution = perSecond?.byResolution ? Object.values(perSecond.byResolution) : [];
  const cents = perSecond?.default ?? (byResolution.length ? Math.min(...byResolution) : null);
  if (typeof cents === 'number') {
    return applyDisplayedPriceMarginCents(cents);
  }
  const base = entry.engine?.pricing?.base;
  if (typeof base === 'number') {
    return applyDisplayedPriceMarginCents(Math.round(base * 100));
  }
  return null;
}

export function resolveAudioOffPrice(entry: EngineCatalogEntry): string | null {
  const perSecond = entry.engine?.pricingDetails?.perSecondCents;
  if (!perSecond || typeof perSecond.default !== 'number') return null;
  const audioOffDelta = entry.engine?.pricingDetails?.addons?.audio_off?.perSecondCents;
  if (typeof audioOffDelta !== 'number') return null;
  const total = applyDisplayedPriceMarginCents(perSecond.default + audioOffDelta);
  return `Audio off: $${(total / 100).toFixed(2)}/s`;
}

const PRICING_SCORE_MIN = 0.03;
const PRICING_SCORE_MAX = 1.0;

export function computePricingScore(prices: number[]): number | null {
  if (!prices.length) return null;
  const avg = prices.reduce((sum, value) => sum + value, 0) / prices.length;
  const normalized =
    10 * (PRICING_SCORE_MAX - avg) / (PRICING_SCORE_MAX - PRICING_SCORE_MIN);
  const clamped = Math.max(0, Math.min(10, normalized));
  return Math.round(clamped * 10) / 10;
}

export function parseResolutionLabel(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes('4k')) return 2160;
  const match = normalized.match(/(\d{3,4})/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isNaN(value) ? null : value;
}

export function formatPriceLabel(label: string) {
  const normalized = label.trim().toLowerCase();
  if (normalized === '4k') return '4K';
  if (normalized === '2k') return '2K';
  if (normalized === '1k') return '1K';
  return label;
}

export function formatPriceLine(label: string | null, cents: number) {
  const value = `$${(cents / 100).toFixed(2)}/s`;
  return label ? `${formatPriceLabel(label)}: ${value}` : value;
}

export function getPrelaunchPricingLabel(locale: AppLocale) {
  if (locale === 'fr') return 'Confirmé au lancement';
  if (locale === 'es') return 'Confirmado en lanzamiento';
  return 'TBD at launch';
}

export function isPrelaunchAvailability(entry: EngineCatalogEntry) {
  const availability = String(entry.availability ?? '').toLowerCase();
  return availability === 'waitlist' || availability === 'limited';
}

export function getPrelaunchCompareNotice(locale: AppLocale) {
  if (locale === 'fr') {
    return {
      title: 'Comparaison pré-lancement',
      body: 'Un modèle de cette page est en pré-lancement. Les rendus runtime ne sont pas encore disponibles; les prix et sorties finales sont confirmés au lancement.',
    };
  }
  if (locale === 'es') {
    return {
      title: 'Comparación de prelanzamiento',
      body: 'Un motor de esta página está en prelanzamiento. Los renders runtime aún no están disponibles; los precios y resultados finales se confirman en el lanzamiento.',
    };
  }
  return {
    title: 'Pre-launch comparison',
    body: 'At least one engine on this page is pre-launch. Runtime renders are not available yet; final pricing and outputs are confirmed at launch.',
  };
}

export function isEngineGeneratable(entry: EngineCatalogEntry) {
  const availability = String(entry.availability ?? '').toLowerCase();
  return availability === 'available' || availability === 'limited';
}

export async function resolvePricingDisplay(
  entry: EngineCatalogEntry,
  locale: AppLocale,
  pricingEngine?: EngineCaps | null
): Promise<ComparePricingDisplay> {
  const availability = String(entry.availability ?? '').toLowerCase();
  if (availability === 'waitlist') {
    return {
      headline: getPrelaunchPricingLabel(locale),
      subline: null,
      prices: [],
    };
  }

  if (pricingEngine) {
    const range = await computeMarketingPriceRange(pricingEngine, { durationSec: 5, memberTier: 'member' });
    if (range) {
      const headline = formatPriceLine(range.min.resolution, range.min.cents);
      const prices = [range.min.cents / 100];
      let subline: string | null = null;
      if (range.max.cents !== range.min.cents || range.max.resolution !== range.min.resolution) {
        subline = formatPriceLine(range.max.resolution, range.max.cents);
        prices.push(range.max.cents / 100);
      }
      return { headline, subline, prices };
    }
  }
  const perSecond = entry.engine?.pricingDetails?.perSecondCents;
  const byResolution = perSecond?.byResolution ?? {};
  const resolutionEntries = Object.entries(byResolution)
    .map(([label, cents]) => ({
      label,
      cents: typeof cents === 'number' ? applyDisplayedPriceMarginCents(cents) : null,
      order: parseResolutionLabel(label),
    }))
    .filter((entry): entry is { label: string; cents: number; order: number | null } => entry.cents != null);
  const distinctValues = Array.from(new Set(resolutionEntries.map((entry) => entry.cents)));

  if (resolutionEntries.length && distinctValues.length > 1) {
    const sorted = [...resolutionEntries].sort((a, b) => {
      const aKey = a.order ?? a.cents;
      const bKey = b.order ?? b.cents;
      return aKey - bKey;
    });
    const minEntry = sorted[0];
    const maxEntry = sorted[sorted.length - 1];
    const headline = formatPriceLine(minEntry.label, minEntry.cents);
    const subline = formatPriceLine(maxEntry.label, maxEntry.cents);
    return {
      headline,
      subline,
      prices: [minEntry.cents / 100, maxEntry.cents / 100],
    };
  }

  const baseCents = getPricePerSecondCents(entry);
  if (typeof baseCents === 'number') {
    const audioOff = resolveAudioOffPrice(entry);
    const audioOffDelta = entry.engine?.pricingDetails?.addons?.audio_off?.perSecondCents;
    const audioOffCents =
      typeof audioOffDelta === 'number' && typeof perSecond?.default === 'number'
        ? applyDisplayedPriceMarginCents(perSecond.default + audioOffDelta)
        : null;
    const prices = [baseCents / 100];
    if (typeof audioOffCents === 'number') {
      prices.push(audioOffCents / 100);
    }
    return {
      headline: formatPriceLine(null, baseCents),
      subline: audioOff,
      prices,
    };
  }

  return {
    headline: 'Data pending',
    subline: null,
    prices: [],
  };
}
