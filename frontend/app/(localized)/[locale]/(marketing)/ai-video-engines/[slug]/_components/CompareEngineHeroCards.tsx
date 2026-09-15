import { EngineIcon } from '@/components/ui/EngineIcon';
import type { CSSProperties } from 'react';
import type { AppLocale } from '@/i18n/locales';
import type { SelectOption } from '@/components/ui/SelectMenu';
import { CompareEngineSelector } from '../CompareEngineSelector.client';
import type { ComparePageCopy } from '../_lib/compare-page-copy';
import {
  deriveCompareStrengths,
  type CompareMetric,
} from '../_lib/compare-page-scorecard';
import {
  formatEngineName,
  isPending,
  localizeBestFor,
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
  scoreStyle: CSSProperties;
  side: 'left' | 'right';
};

function EngineHeroCard({
  activeLocale,
  compareCopy,
  comparisonMetrics,
  engineScoresBySlug,
  entry,
  other,
  options,
  overall,
  scoreStyle,
  side,
}: EngineHeroCardProps) {
  const bestFor = localizeBestFor(entry.bestFor, activeLocale);
  const derived = deriveCompareStrengths(comparisonMetrics, side).join(', ');
  const strengths = bestFor && !isPending(bestFor) ? bestFor : derived;

  return (
    <article className="compare-model-card relative">
      <div className="compare-model-identity">
        <EngineIcon engine={{ id: entry.engineId, brandId: entry.brandId, label: formatEngineName(entry) }} size={40} framed={false} />
        <div className="compare-model-score" style={{ ...scoreStyle, background: 'transparent' }}>
          <span>{overall != null ? overall.toFixed(1) : '—'}</span><small>/10</small><em>{activeLocale === 'fr' ? 'Note globale' : activeLocale === 'es' ? 'Calificación global' : 'Overall score'}</em>
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-center gap-3 text-center">
          <h2 className="sr-only">
            {formatEngineName(entry)}
          </h2>
          <CompareEngineSelector
            options={options}
            value={entry.modelSlug}
            otherValue={other.modelSlug}
            side={side}
            engineScores={engineScoresBySlug}
          />
          {strengths ? (
            <p className="max-w-[280px] text-xs leading-5 text-text-secondary">
              <span className="font-semibold text-text-primary">
                {compareCopy.scorecard?.strengthsLabel ?? 'Strengths'}:
              </span>{' '}
              {strengths}
            </p>
          ) : null}
        </div>
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
  leftScoreStyle: CSSProperties;
  resolvedLeftOptions: SelectOption[];
  resolvedRightOptions: SelectOption[];
  right: EngineCatalogEntry;
  rightOverall: number | null;
  rightScoreStyle: CSSProperties;
};

export function CompareEngineHeroCards({
  activeLocale,
  compareCopy,
  comparisonMetrics,
  engineScoresBySlug,
  left,
  leftOverall,
  leftScoreStyle,
  resolvedLeftOptions,
  resolvedRightOptions,
  right,
  rightOverall,
  rightScoreStyle,
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
          scoreStyle={leftScoreStyle}
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
          scoreStyle={rightScoreStyle}
          side="right"
        />

      </div>
    </section>
  );
}
