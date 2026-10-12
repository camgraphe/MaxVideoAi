import type { HeroVideoShowcaseItem } from './HeroVideoShowcase';

function parsePriceAmount(value?: string | null) {
  if (!value) return null;
  const match = value.match(/([$€£])?\s*([0-9]+(?:[.,][0-9]+)?)/);
  if (!match) return null;
  const amount = Number(match[2].replace(',', '.'));
  if (!Number.isFinite(amount)) return null;
  return { amount, symbol: match[1] ?? '$' };
}

function parseDurationSeconds(value?: string | null) {
  if (!value) return null;
  const clock = value.match(/(\d+):(\d{2})/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const seconds = value.match(/(\d+(?:[.,]\d+)?)\s*s\b/i);
  if (seconds) {
    const parsed = Number(seconds[1].replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function buildRatePerSecondLabel(selected: HeroVideoShowcaseItem, primaryPrice: string, fallbackPrice: string | null) {
  const durationSeconds = parseDurationSeconds(selected.duration) ?? parseDurationSeconds(selected.estimateMeta);
  const total = parsePriceAmount(primaryPrice);
  if (durationSeconds && durationSeconds > 0 && total) {
    return `${total.symbol}${(total.amount / durationSeconds).toFixed(2)}/sec`;
  }

  const rateSource = selected.priceNote ?? fallbackPrice ?? selected.price;
  const rateAmount = parsePriceAmount(rateSource);
  const rateDurationSeconds = parseDurationSeconds(rateSource);
  if (rateAmount && rateDurationSeconds && rateDurationSeconds > 0) {
    return `${rateAmount.symbol}${(rateAmount.amount / rateDurationSeconds).toFixed(2)}/sec`;
  }
  return null;
}

function getDurationShortLabel(value: string) {
  const seconds = parseDurationSeconds(value);
  return seconds ? `${seconds}s` : value;
}

/** Only quote text crosses the streamed client boundary, never the media item. */
export function buildHeroVideoPriceDisplay(selected: HeroVideoShowcaseItem) {
  const primaryPrice = selected.estimateValue || selected.price;
  const ratePrice = selected.price && selected.price !== primaryPrice ? selected.price : null;
  const [modeLabel, , formatLabelFromMedia] = (selected.mediaInfo ?? '').split(' · ');
  const quoteRenderMeta = selected.quoteScenario ?? [getDurationShortLabel(selected.duration), modeLabel?.toLowerCase(), formatLabelFromMedia ?? selected.resolution]
    .filter(Boolean)
    .join(' · ');
  const ratePerSecond = selected.priceKind === 'reference' || selected.priceKind === 'unavailable'
    ? null
    : buildRatePerSecondLabel(selected, primaryPrice, ratePrice);

  return { label: selected.estimateLabel, amount: primaryPrice, scenario: quoteRenderMeta, rate: ratePerSecond };
}

export type HeroVideoPriceDisplay = ReturnType<typeof buildHeroVideoPriceDisplay>;
