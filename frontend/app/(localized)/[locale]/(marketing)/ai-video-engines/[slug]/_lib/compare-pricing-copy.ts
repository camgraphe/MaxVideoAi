import type { AppLocale } from '@/i18n/locales';
import type { ComparePricingDisplay } from './compare-page-types';

export function compareScenarioChips(display: ComparePricingDisplay, locale: AppLocale): string[] {
  const scenario = display.scenario;
  if (!scenario) return [];
  const mode = locale === 'fr' ? 'Texte vers vidéo' : locale === 'es' ? 'Texto a vídeo' : 'Text to video';
  const audio = scenario.audio
    ? locale === 'fr' ? 'audio activé' : locale === 'es' ? 'audio activado' : 'audio on'
    : locale === 'fr' ? 'sans audio' : locale === 'es' ? 'sin audio' : 'audio off';
  return [mode, `${scenario.durationSec} s`, scenario.aspectRatio, audio].filter((value): value is string => typeof value === 'string' && value.length > 0);
}

export function comparePriceLines(display: ComparePricingDisplay, locale: AppLocale): string[] {
  if (display.quoteUnavailable) return [locale === 'fr' ? 'Devis actuel indisponible ; vérifiez les réglages avant de générer.' : locale === 'es' ? 'Precio actual no disponible; comprueba los ajustes antes de generar.' : 'Current quote unavailable; check settings before generating.'];
  const unit = locale === 'fr' ? 'par vidéo' : locale === 'es' ? 'por vídeo' : 'per video';
  return display.priceRows?.length
    ? [compareScenarioChips(display, locale).join(' · '), ...display.priceRows.map(row => `${row.resolution}: ${row.totalPrice} ${unit} (${row.unitPrice})`)]
    : Array.from(new Set([display.headline, ...(display.secondaryLines ?? (display.subline ? [display.subline] : []))].filter(Boolean)));
}
