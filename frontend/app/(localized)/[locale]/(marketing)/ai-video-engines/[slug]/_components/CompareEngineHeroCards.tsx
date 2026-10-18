import { labelCompareMetric } from './CompareScoreGrid';
import type { AppLocale } from '@/i18n/locales';
import type { SelectOption } from '@/components/ui/SelectMenu';
import { CompareEngineSelector } from '../CompareEngineSelector.client';
import type { ComparePageCopy } from '../_lib/compare-page-copy';
import {
  type CompareMetric,
} from '../_lib/compare-page-scorecard';
import {
  formatEngineName,
} from '../_lib/compare-page-helpers';
import type { EngineCatalogEntry } from '../_lib/compare-page-types';

type EngineHeroCardProps = {
  activeLocale: AppLocale;
  compareCopy: ComparePageCopy;
  comparisonMetrics: CompareMetric[];
  engineScoresBySlug: Record<string, number>;
  entry: EngineCatalogEntry;
  other: EngineCatalogEntry;
  options: SelectOption[];
  overall: number | null;
  side: 'left' | 'right';
};

function EngineHeroCard({
  activeLocale,
  comparisonMetrics,
  engineScoresBySlug,
  entry,
  other,
  options,
  overall,
  side,
}: EngineHeroCardProps) {
  const value = (metric: CompareMetric) => side === 'left' ? metric.leftValue : metric.rightValue;
  const strengths = comparisonMetrics.filter(metric => typeof value(metric) === 'number')
    .sort((a, b) => (value(b) ?? 0) - (value(a) ?? 0)).slice(0, 2)
    .map(metric => labelCompareMetric(metric, activeLocale)).join(', ');

  return (
    <article className={`compare-model-card compare-model-card--${side}`}>
      <div className="compare-model-identity">
        <div className="compare-model-main">
          <div className="compare-model-choice">
            <h2 className="sr-only">{formatEngineName(entry)}</h2>
            <CompareEngineSelector
              options={options}
              value={entry.modelSlug}
              otherValue={other.modelSlug}
              side={side}
              engineScores={engineScoresBySlug}
            />
          </div>
          <div className="compare-model-score">
            <span>{overall != null ? overall.toFixed(1) : '—'}</span><small>/10</small><em>{activeLocale === 'fr' ? 'Note éditoriale' : activeLocale === 'es' ? 'Nota editorial' : 'Editorial score'}</em>
          </div>
        </div>
        {strengths ? (
          <p className="compare-model-strengths">
            <span className="font-semibold text-text-primary">
              {activeLocale === 'fr' ? 'Mieux noté sur' : activeLocale === 'es' ? 'Mejor valorado en' : 'Higher-rated areas'}:
            </span>{' '}
            {strengths}
          </p>
        ) : null}
      </div>
    </article>
  );
}

type CompareEngineHeroCardsProps = {
  activeLocale: AppLocale;
  compareCopy: ComparePageCopy;
  comparisonMetrics: CompareMetric[];
  engineScoresBySlug: Record<string, number>;
  left: EngineCatalogEntry;
  leftOverall: number | null;
  resolvedLeftOptions: SelectOption[];
  resolvedRightOptions: SelectOption[];
  right: EngineCatalogEntry;
  rightOverall: number | null;
};

export function CompareEngineHeroCards({
  activeLocale,
  compareCopy,
  comparisonMetrics,
  engineScoresBySlug,
  left,
  leftOverall,
  resolvedLeftOptions,
  resolvedRightOptions,
  right,
  rightOverall,
}: CompareEngineHeroCardsProps) {
  return (
    <section className="compare-models">
      <div className="relative grid gap-4 md:grid-cols-2">
        <EngineHeroCard
          activeLocale={activeLocale}
          compareCopy={compareCopy}
          comparisonMetrics={comparisonMetrics}
          engineScoresBySlug={engineScoresBySlug}
          entry={left}
          options={resolvedLeftOptions}
          other={right}
          overall={leftOverall}
          side="left"
        />
        <EngineHeroCard
          activeLocale={activeLocale}
          compareCopy={compareCopy}
          comparisonMetrics={comparisonMetrics}
          engineScoresBySlug={engineScoresBySlug}
          entry={right}
          options={resolvedRightOptions}
          other={left}
          overall={rightOverall}
          side="right"
        />
      </div>
    </section>
  );
}
