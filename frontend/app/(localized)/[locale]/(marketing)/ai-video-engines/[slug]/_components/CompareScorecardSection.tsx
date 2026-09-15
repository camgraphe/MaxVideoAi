import { getCompareEditorialCopy, getCompareDetailActions } from '../_lib/compare-editorial-copy';
import { ChevronDown } from 'lucide-react';
import { BenchmarkMethodologyLink } from '@/components/marketing/BenchmarkMethodologyLink';
import type { AppLocale } from '@/i18n/locales';
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
} from '../_lib/compare-page-scorecard';
import type { EngineCatalogEntry } from '../_lib/compare-page-types';
import { CompareGenerateCard } from './CompareGenerateCard';

type CompareScorecardSectionProps = {
  activeLocale: AppLocale;
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
  activeLocale,
  compareCopy,
  comparisonMetrics,
  criteriaCount,
  generateWithLabel,
  labels,
  left,
  leftCanGenerate,
  right,
  rightCanGenerate,
  scorecardCriteriaLabel,
  scorecardProvisionalNote,
  summaryRows,
  winnerSummaryHeading,
}: CompareScorecardSectionProps) {
  const copy = getCompareEditorialCopy(activeLocale);
  const actions = getCompareDetailActions(activeLocale);
  return (
    <>
      <div id="scores" className="compare-score-panel">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-text-primary">
            {copy.scoreTitle}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {replaceCriteriaCount(
              compareCopy.scorecard?.subtitle ??
                `Scores reflect quality and control on MaxVideoAI across ${criteriaCount} criteria.`,
              criteriaCount
            )}
          </p>
          <BenchmarkMethodologyLink locale={activeLocale} className="mt-3" />
          {scorecardProvisionalNote ? (
            <p className="mt-2 text-xs font-semibold text-text-muted">{scorecardProvisionalNote}</p>
          ) : null}
        </div>
        <div className="paired-legend mt-6">
          <span className="score-left">● {formatEngineName(left)}</span>
          <span className="text-text-muted">{scorecardCriteriaLabel} · /10</span>
          <span className="score-right">◆ {formatEngineName(right)}</span>
        </div>
        <CompareScoreboard
          metrics={comparisonMetrics.slice(0, 3)}
          className="mt-4"
          naLabel={labels.na}
          pendingLabel={labels.pending}
        />

        {comparisonMetrics.length > 3 ? <details className="compare-more-scores">
          <summary className="compare-disclosure-trigger">
            <span className="compare-disclosure-copy">
              <small className="compare-when-closed">{actions.shown.replace('{shown}', '3').replace('{total}', String(comparisonMetrics.length))}</small>
              <small className="compare-when-open">{actions.shown.replace('{shown}', String(comparisonMetrics.length)).replace('{total}', String(comparisonMetrics.length))}</small>
              <strong className="compare-when-closed">{actions.more.replace('{count}', String(comparisonMetrics.length - 3))}</strong>
              <strong className="compare-when-open">{actions.fewer}</strong>
              <span className="compare-disclosure-tags">{comparisonMetrics.slice(3, 6).map(metric => <span key={metric.id}>{metric.label}</span>)}<span aria-hidden="true">…</span></span>
            </span>
            <span className="compare-disclosure-arrow"><ChevronDown size={22} aria-hidden="true" /></span>
          </summary>
          <CompareScoreboard metrics={comparisonMetrics.slice(3)} className="mt-4" naLabel={labels.na} pendingLabel={labels.pending} />
        </details> : null}

        <aside className="mt-8 border-t border-hairline pt-6">
          <h3 className="text-lg font-medium text-text-primary">{winnerSummaryHeading}</h3>
          <dl className="mt-4 grid gap-5 sm:grid-cols-3">
            {summaryRows.map((row, index) => <div key={row.id}>
              <dt className="text-xs font-semibold uppercase tracking-micro text-text-muted">{row.label}</dt>
              <dd className="mt-2 text-sm leading-6 text-text-secondary">{index === 0 ? formatWinnerSummaryValue(row) : row.value}</dd>
            </div>)}
          </dl>
        </aside>
      </div>

      <div id="create" className="compare-generate-links mt-4 grid gap-4 sm:grid-cols-2">
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
