import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { getCompareEditorialCopy, getCompareDetailActions } from '../_lib/compare-editorial-copy';
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
  const pricingCopy = getCompareEditorialCopy(activeLocale);
  const actions = getCompareDetailActions(activeLocale);
  const copy = { title: pricingCopy.pricing, subtitle: pricingCopy.priceNote, comparable: activeLocale === 'fr' ? 'Références tarifaires de la grille' : activeLocale === 'es' ? 'Precios de referencia de la evaluación' : 'Scorecard price references' };
  const leftLines = getPricingLines(leftPricingDisplay);
  const rightLines = getPricingLines(rightPricingDisplay);
  const hasComparableLine = leftPricingDisplay.scoreLine && rightPricingDisplay.scoreLine;

  return (
    <section id="pricing" className="compare-price-panel">
      <div className="flex flex-col gap-1 text-center">
        <h2 className="text-lg font-semibold text-text-primary">{copy.title}</h2>
        <p className="text-sm text-text-secondary">{copy.subtitle}</p>
      </div>
      <div className="compare-price-tickets">
        {[
          { entry: left, lines: leftLines },
          { entry: right, lines: rightLines },
        ].map(({ entry, lines }) => (
          <article key={entry.modelSlug} className="compare-price-ticket">
            <h3><EngineIcon engine={{ id: entry.engineId, label: formatEngineName(entry), brandId: entry.brandId }} size={28} framed={false} />{formatEngineName(entry)}</h3>
            <dl>{lines.map(line => {
              const separator = line.indexOf(':');
              return <div key={line}>{separator > -1 ? <><dt>{line.slice(0, separator)}</dt><dd>{line.slice(separator + 1).trim()}</dd></> : <dd>{line}</dd>}</div>;
            })}</dl>
          </article>
        ))}
      </div>
      <div className="compare-price-next"><p>{actions.pricingNote}</p><Link href="/pricing">{actions.priceLink}<ArrowRight size={16} aria-hidden="true" /></Link></div>
      {hasComparableLine ? (
        <p className="mt-3 text-center text-xs font-semibold text-text-muted">
          {copy.comparable}: {leftPricingDisplay.scoreLine} vs {rightPricingDisplay.scoreLine}
        </p>
      ) : null}
    </section>
  );
}
