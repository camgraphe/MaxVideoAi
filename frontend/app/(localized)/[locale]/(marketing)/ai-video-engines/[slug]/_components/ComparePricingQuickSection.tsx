import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { getCompareEditorialCopy, getCompareDetailActions } from '../_lib/compare-editorial-copy';
import type { AppLocale } from '@/i18n/locales';
import { formatEngineName } from '../_lib/compare-page-helpers';
import type { ComparePricingDisplay, EngineCatalogEntry } from '../_lib/compare-page-types';
import type { ComparePageOverride } from '../_lib/compare-page-overrides-types';

type ComparePricingQuickSectionProps = {
  activeLocale: AppLocale;
  pricingCreditLink?: ComparePageOverride['pricingCreditLink'];
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
  pricingCreditLink,
  left,
  leftPricingDisplay,
  right,
  rightPricingDisplay,
}: ComparePricingQuickSectionProps) {
  const pricingCopy = getCompareEditorialCopy(activeLocale);
  const actions = getCompareDetailActions(activeLocale);
  const copy = { title: pricingCopy.pricing, subtitle: pricingCopy.priceNote };
  const leftLines = getPricingLines(leftPricingDisplay);
  const rightLines = getPricingLines(rightPricingDisplay);
  const scenarioChips = (display: ComparePricingDisplay) => {
    const scenario = display.scenario;
    if (!scenario) return [];
    const mode = activeLocale === 'fr' ? 'Texte vers vidéo' : activeLocale === 'es' ? 'Texto a vídeo' : 'Text to video';
    const audio = scenario.audio
      ? activeLocale === 'fr' ? 'audio activé' : activeLocale === 'es' ? 'audio activado' : 'audio on'
      : activeLocale === 'fr' ? 'sans audio' : activeLocale === 'es' ? 'sin audio' : 'audio off';
    return [mode, `${scenario.durationSec} s`, scenario.aspectRatio, audio].filter(Boolean);
  };
  const perVideo = activeLocale === 'fr' ? 'par vidéo' : activeLocale === 'es' ? 'por vídeo' : 'per video';

  return (
    <section id="pricing" className="compare-price-panel">
      <div className="flex flex-col gap-1 text-center">
        <h2 className="text-lg font-semibold text-text-primary">{copy.title}</h2>
        <p className="text-sm text-text-secondary">{copy.subtitle}</p>
      </div>
      <div className="compare-price-tickets">
        {[
          { entry: left, lines: leftLines, display: leftPricingDisplay, side: 'left' },
          { entry: right, lines: rightLines, display: rightPricingDisplay, side: 'right' },
        ].map(({ entry, lines, display, side }) => (
          <article key={entry.modelSlug} className={`compare-price-ticket compare-price-ticket--${side}`}>
            <h3><EngineIcon engine={{ id: entry.engineId, label: formatEngineName(entry), brandId: entry.brandId }} size={28} framed={false} />{formatEngineName(entry)}</h3>
            {scenarioChips(display).length ? <div className="compare-price-scenario" aria-label={scenarioChips(display).join(', ')}>{scenarioChips(display).map(chip => <span key={chip}>{chip}</span>)}</div> : null}
            {display.priceRows?.length ? <dl>{display.priceRows.map(row => (
              <div key={row.resolution} className="compare-price-row"><dt><span>{row.resolution}</span></dt><dd><strong>{row.totalPrice}</strong><small>{perVideo} · <span className="compare-price-unit">{row.unitPrice}</span></small></dd></div>
            ))}</dl> : <dl>{lines.map(line => {
              const separator = line.indexOf(':');
              return <div key={line}>{separator > -1 ? <><dt>{line.slice(0, separator)}</dt><dd>{line.slice(separator + 1).trim()}</dd></> : <dd>{line}</dd>}</div>;
            })}</dl>}
            {display.quoteUnavailable ? <p className="compare-price-scenario">{activeLocale === 'fr' ? 'Le devis actuel ne peut pas être confirmé. Vérifiez les réglages dans l’app avant de générer.' : activeLocale === 'es' ? 'No se puede confirmar el precio actual. Revisa los ajustes en la app antes de generar.' : 'The current quote could not be confirmed. Check your settings in the app before generating.'}</p> : null}
          </article>
        ))}
      </div>
      <div className="compare-price-next">
        <p>{actions.pricingNote}</p>
        <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2">
          {pricingCreditLink ? <Link href={pricingCreditLink.href}>{pricingCreditLink.label}<ArrowRight size={16} aria-hidden="true" /></Link> : null}
          <Link href="/pricing">{actions.priceLink}<ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </div>
    </section>
  );
}
