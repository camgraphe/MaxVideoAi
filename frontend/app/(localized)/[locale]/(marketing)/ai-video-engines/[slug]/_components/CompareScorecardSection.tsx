import clsx from 'clsx';
import { Trophy } from 'lucide-react';
import { CompareScoreboard } from '../CompareScoreboard.client';
import type { CompareDetailLabels, ComparePageCopy } from '../_lib/compare-page-copy';
import type { EngineAccent } from '../_lib/compare-page-helpers';
import {
  formatEngineName,
  formatTemplate,
  replaceCriteriaCount,
} from '../_lib/compare-page-helpers';
import type { CompareMetric, CompareSummaryRow } from '../_lib/compare-page-scorecard';
import {
  formatWinnerSummaryValue,
  resolveSummaryLabelClass,
  resolveSummaryMarker,
} from '../_lib/compare-page-scorecard';
import type { EngineCatalogEntry } from '../_lib/compare-page-types';
import { CompareGenerateCard } from './CompareGenerateCard';

type CompareScorecardSectionProps = {
  compareCopy: ComparePageCopy;
  comparisonMetrics: CompareMetric[];
  criteriaCount: number;
  generateWithLabel: string;
  labels: CompareDetailLabels;
  left: EngineCatalogEntry;
  leftAccent: EngineAccent;
  leftCanGenerate: boolean;
  right: EngineCatalogEntry;
  rightAccent: EngineAccent;
  rightCanGenerate: boolean;
  scorecardCriteriaLabel: string;
  scorecardProvisionalNote: string | null;
  summaryRows: CompareSummaryRow[];
  winnerSummaryHeading: string;
};

export function CompareScorecardSection({
  compareCopy,
  comparisonMetrics,
  criteriaCount,
  generateWithLabel,
  labels,
  left,
  leftAccent,
  leftCanGenerate,
  right,
  rightAccent,
  rightCanGenerate,
  scorecardCriteriaLabel,
  scorecardProvisionalNote,
  summaryRows,
  winnerSummaryHeading,
}: CompareScorecardSectionProps) {
  return (
    <>
      <div className="mt-4 rounded-[16px] border border-hairline bg-surface p-4 shadow-card sm:p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-text-primary">
            {compareCopy.scorecard?.title ?? 'Scorecard (Side-by-Side)'}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {replaceCriteriaCount(
              compareCopy.scorecard?.subtitle ??
                `Scores reflect quality and control on MaxVideoAI across ${criteriaCount} criteria.`,
              criteriaCount
            )}
          </p>
          {scorecardProvisionalNote ? (
            <p className="mt-2 text-xs font-semibold text-text-muted">{scorecardProvisionalNote}</p>
          ) : null}
        </div>
        <div className="mt-6 hidden items-center gap-3 text-[11px] font-semibold uppercase tracking-micro sm:grid sm:grid-cols-[minmax(0,1.6fr)_minmax(190px,1fr)_minmax(0,1.6fr)] sm:gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(210px,1fr)_minmax(0,2fr)]">
          <span className="text-center text-brand">{formatEngineName(left)}</span>
          <span className="text-center text-text-muted">{scorecardCriteriaLabel}</span>
          <span className="text-center text-brand">{formatEngineName(right)}</span>
        </div>
        <CompareScoreboard
          metrics={comparisonMetrics}
          className="mt-4"
          naLabel={labels.na}
          pendingLabel={labels.pending}
        />

        <div className="mx-auto mt-7 w-full">
          <div className="relative overflow-hidden rounded-[18px] border border-[#cfe0ff] bg-[#eef5ff] px-5 pb-5 pt-5 text-center shadow-[0_16px_34px_rgba(46,99,216,0.10),inset_0_1px_0_rgba(255,255,255,0.9)] dark:border-white/10 dark:bg-[#172338] dark:shadow-[0_16px_34px_rgba(0,0,0,0.24)]">
            <div
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#eaf2ff_0%,#f7fbff_58%,#ffffff_100%)] dark:bg-[linear-gradient(180deg,rgba(46,99,216,0.22)_0%,rgba(18,26,37,0.94)_58%,rgba(18,26,37,0.98)_100%)]"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute left-1/2 top-0 h-28 w-[340px] -translate-x-1/2 rounded-full bg-white/80 blur-2xl dark:bg-white/10"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/30"
              aria-hidden
            />
            <div className="relative z-10 flex items-center justify-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/80 bg-white text-brand shadow-[0_12px_26px_rgba(46,99,216,0.14),inset_0_1px_0_rgba(255,255,255,0.95)] dark:border-white/10 dark:bg-white/8 dark:text-white">
                <Trophy className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="text-lg font-semibold text-text-primary">{winnerSummaryHeading}</h3>
            </div>
            <div className="relative z-10 mt-4 grid gap-4">
              {summaryRows.slice(0, 1).map((row) => (
                <div key={row.id} className="flex flex-col items-center gap-2 text-center">
                  <div className="flex items-center gap-2">
                    <span className={clsx('h-2 w-2 opacity-90', resolveSummaryMarker(row.id, row.accent, leftAccent, rightAccent))} />
                    <span className={clsx('text-[10px] font-semibold uppercase tracking-micro', resolveSummaryLabelClass(row.id))}>
                      {row.label}
                    </span>
                  </div>
                  <p className="max-w-[620px] text-sm leading-6 text-text-secondary">{formatWinnerSummaryValue(row)}</p>
                </div>
              ))}
              <div className="grid gap-3 border-t border-[#dbe7fb] pt-4 sm:grid-cols-2 sm:divide-x sm:divide-[#dbe7fb] dark:border-white/10 dark:sm:divide-white/10">
                {summaryRows.slice(1).map((row) => (
                  <div key={row.id} className="flex flex-col items-center gap-2 px-3 text-center">
                    <div className="flex items-center gap-2">
                      <span className={clsx('h-2 w-2 opacity-90', resolveSummaryMarker(row.id, row.accent, leftAccent, rightAccent))} />
                      <span className={clsx('text-[10px] font-semibold uppercase tracking-micro', resolveSummaryLabelClass(row.id))}>
                        {row.label}
                      </span>
                    </div>
                    <p className="text-sm leading-5 text-text-secondary">{row.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <CompareGenerateCard
          canGenerate={leftCanGenerate}
          entry={left}
          fullProfileLabel={compareCopy.scorecard?.fullProfile ?? 'Full engine profile'}
          generateButtonLabel={formatTemplate(compareCopy.scorecard?.generateWith ?? 'Generate with {engine}', {
            engine: formatEngineName(left),
          })}
          generateWithLabel={generateWithLabel}
          side="left"
        />
        <CompareGenerateCard
          canGenerate={rightCanGenerate}
          entry={right}
          fullProfileLabel={compareCopy.scorecard?.fullProfile ?? 'Full engine profile'}
          generateButtonLabel={formatTemplate(compareCopy.scorecard?.generateWith ?? 'Generate with {engine}', {
            engine: formatEngineName(right),
          })}
          generateWithLabel={generateWithLabel}
          side="right"
        />
      </div>
    </>
  );
}
