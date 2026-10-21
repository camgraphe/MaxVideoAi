import { labelCompareMetric } from './CompareScoreGrid';
import type { AppLocale } from '@/i18n/locales';
import { Link } from '@/i18n/navigation';
import { getBenchmarkScoreReviewCopy } from '@/lib/benchmark-score-review';
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
  engineScoreReviewsBySlug?: Record<string, 'editorial-estimated'>;
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
  engineScoreReviewsBySlug,
  entry,
  other,
  options,
  overall,
  side,
}: EngineHeroCardProps) {
  const estimated = engineScoreReviewsBySlug?.[entry.modelSlug] === 'editorial-estimated';
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
              engineScoreReviews={engineScoreReviewsBySlug}
            />
          </div>
          <div className="compare-model-score">
            <span>{estimated && overall != null ? '≈' : ''}{overall != null ? overall.toFixed(1) : '—'}</span><small>/10</small><em>{estimated ? getBenchmarkScoreReviewCopy(activeLocale).label : activeLocale === 'fr' ? 'Note éditoriale' : activeLocale === 'es' ? 'Nota editorial' : 'Editorial score'}</em>
          </div>
        </div>
        {estimated ? <Link href={{ pathname: '/benchmarks', hash: `review-${entry.modelSlug}` }} className="text-xs text-brand underline underline-offset-2">{getBenchmarkScoreReviewCopy(activeLocale).method}</Link> : null}
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
  engineScoreReviewsBySlug?: Record<string, 'editorial-estimated'>;
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
  engineScoreReviewsBySlug,
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
          engineScoreReviewsBySlug={engineScoreReviewsBySlug}
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
          engineScoreReviewsBySlug={engineScoreReviewsBySlug}
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
