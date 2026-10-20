import type { SeedanceEditSourceFacts } from './seedance-edit-source';

export function seedanceEditSourceLabel(source: SeedanceEditSourceFacts | undefined, locale: string) {
  const language = locale === 'fr' || locale === 'es' ? locale : 'en';
  const copy = language === 'fr' ? { source: 'Format source', tariff: 'Tarif', pending: 'Durée et format de la source · 4–30 s', output: 'Sortie ≈ source' }
    : language === 'es' ? { source: 'Formato original', tariff: 'Tarifa', pending: 'Duración y formato originales · 4–30 s', output: 'Salida ≈ original' }
    : { source: 'Source format', tariff: 'Price bracket', pending: 'Source duration and format · 4–30s', output: 'Output ≈ source' };
  if (!source) return `${copy.pending} · ${copy.output}`;
  const duration = new Intl.NumberFormat(language, { maximumFractionDigits: 6 }).format(source.durationSec);
  return `${duration}s · ${copy.source}${source.durationSec !== source.billedDurationSec ? ` · ${copy.tariff} ${source.billedDurationSec}s` : ''} · ${copy.output}`;
}
