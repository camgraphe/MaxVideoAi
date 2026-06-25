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
    <article className="relative flex overflow-visible rounded-[16px] border border-hairline bg-surface p-6 shadow-card">
      <div className={`flex w-full flex-col items-center gap-5 ${side === 'left' ? 'sm:flex-row-reverse' : 'sm:flex-row'}`}>
        <div
          className="relative isolate grid h-[96px] w-[96px] shrink-0 place-items-center rounded-full p-[3px]"
          style={scoreStyle}
        >
          <span
            className="pointer-events-none absolute -inset-5 -z-10 rounded-full opacity-75 blur-2xl"
            style={{ background: 'color-mix(in srgb, var(--compare-accent) 45%, transparent)' }}
            aria-hidden
          />
          <div className="grid h-full w-full place-items-center rounded-full border border-white/80 bg-surface text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:border-white/10 dark:bg-surface-2">
            <div className="leading-none">
              <span className="text-[28px] font-semibold tracking-normal text-text-primary">
                {overall != null ? overall.toFixed(1) : '-'}
              </span>
              <span className="ml-0.5 align-super text-[10px] font-semibold text-text-muted">/10</span>
              <span className="mt-1 block text-[8px] font-semibold uppercase tracking-[0.22em] text-text-muted">
                Score
              </span>
            </div>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-center gap-3 text-center">
          <h2 className="text-2xl font-semibold tracking-normal text-text-primary">
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
    <section className="mx-auto max-w-[940px]">
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
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 hidden -translate-x-1/2 -translate-y-1/2 md:flex">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border-4 border-bg bg-brand text-[11px] font-semibold uppercase tracking-micro text-on-brand shadow-[0_16px_34px_rgba(46,99,216,0.28)]">
            VS
          </div>
        </div>
      </div>
    </section>
  );
}
