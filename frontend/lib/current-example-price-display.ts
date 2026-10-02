import { localeRegions, type AppLocale } from '@/i18n/locales';
import type { CurrentExamplePrice } from '@/server/current-example-price';

const LABELS = {
  en: { current: 'Current price', from: 'From', mode: 'Text to video' },
  fr: { current: 'Prix actuel', from: 'Dès', mode: 'Texte vers vidéo' },
  es: { current: 'Precio actual', from: 'Desde', mode: 'Texto a vídeo' },
} as const;

export function formatCurrentExampleAmount(price: CurrentExamplePrice, locale: AppLocale): string | null {
  if (price.kind === 'unavailable') return null;
  try {
    return new Intl.NumberFormat(localeRegions[locale] ?? 'en-US', {
      style: 'currency', currency: price.currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(price.amountCents / 100);
  } catch {
    return null;
  }
}

export function formatCurrentExampleScenario(price: CurrentExamplePrice, locale: AppLocale): string | null {
  if (price.kind === 'unavailable') return null;
  return price.scenarioLabel
    .replace(/^Text to video/, LABELS[locale].mode)
    .replace(/(\d+)s(\b|$)/g, (_, duration: string, boundary: string) => `${duration}${locale === 'fr' || locale === 'es' ? ' ' : ''}s${boundary}`);
}

export function formatCurrentExamplePrice(price: CurrentExamplePrice | undefined, locale: AppLocale): string | null {
  if (!price || price.kind === 'unavailable') return null;
  const amount = formatCurrentExampleAmount(price, locale);
  if (!amount) return null;
  if (price.kind === 'exact') return `${LABELS[locale].current} ${amount}`;
  return `${LABELS[locale].from} ${amount} · ${formatCurrentExampleScenario(price, locale)}`;
}
