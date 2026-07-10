import type { AppLocale } from '@/i18n/locales';
import { formatEngineName } from '../_lib/compare-page-helpers';
import type { ComparePricingDisplay, EngineCatalogEntry } from '../_lib/compare-page-types';

type ComparePricingQuickSectionProps = {
  activeLocale: AppLocale;
  left: EngineCatalogEntry;
  leftPricingDisplay: ComparePricingDisplay;
  right: EngineCatalogEntry;
  rightPricingDisplay: ComparePricingDisplay;
};

function getPricingCopy(activeLocale: AppLocale) {
  if (activeLocale === 'fr') {
    return {
      title: 'Tarifs rapides',
      subtitle: 'Prix MaxVideoAI par seconde selon la resolution; le score pricing compare la meme ligne quand elle existe.',
      comparable: 'Ligne comparable du score',
    };
  }
  if (activeLocale === 'es') {
    return {
      title: 'Precios rapidos',
      subtitle: 'Precio MaxVideoAI por segundo segun resolucion; el score de pricing compara la misma linea cuando existe.',
      comparable: 'Linea comparable del score',
    };
  }
  return {
    title: 'Pricing snapshot',
    subtitle: 'MaxVideoAI price per second by resolution; the pricing score compares the same tier when possible.',
    comparable: 'Comparable score tier',
  };
}

function getPricingLines(display: ComparePricingDisplay) {
  const lines = [display.headline, ...(display.secondaryLines ?? (display.subline ? [display.subline] : []))];
  return Array.from(new Set(lines.filter(Boolean)));
}

export function ComparePricingQuickSection({
  activeLocale,
  left,
  leftPricingDisplay,
  right,
  rightPricingDisplay,
}: ComparePricingQuickSectionProps) {
  const copy = getPricingCopy(activeLocale);
  const leftLines = getPricingLines(leftPricingDisplay);
  const rightLines = getPricingLines(rightPricingDisplay);
  const hasComparableLine = leftPricingDisplay.scoreLine && rightPricingDisplay.scoreLine;

  return (
    <section className="mt-4 rounded-[16px] border border-hairline bg-surface p-4 shadow-card sm:p-6">
      <div className="flex flex-col gap-1 text-center">
        <h2 className="text-lg font-semibold text-text-primary">{copy.title}</h2>
        <p className="text-sm text-text-secondary">{copy.subtitle}</p>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {[
          { entry: left, lines: leftLines },
          { entry: right, lines: rightLines },
        ].map(({ entry, lines }) => (
          <div key={entry.modelSlug} className="rounded-[12px] border border-hairline px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">
              {formatEngineName(entry)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {lines.map((line) => (
                <span
                  key={line}
                  className="rounded-full border border-hairline bg-surface-2 px-3 py-1 text-xs font-semibold text-text-primary"
                >
                  {line}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      {hasComparableLine ? (
        <p className="mt-3 text-center text-xs font-semibold text-text-muted">
          {copy.comparable}: {leftPricingDisplay.scoreLine} vs {rightPricingDisplay.scoreLine}
        </p>
      ) : null}
    </section>
  );
}
