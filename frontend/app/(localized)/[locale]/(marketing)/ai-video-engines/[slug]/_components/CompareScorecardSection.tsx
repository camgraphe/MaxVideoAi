import { getCompareEditorialCopy, getCompareDetailActions } from '../_lib/compare-editorial-copy';
import { ChevronDown } from 'lucide-react';
import { BenchmarkMethodologyLink } from '@/components/marketing/BenchmarkMethodologyLink';
import type { AppLocale } from '@/i18n/locales';
import type { CompareDetailLabels, ComparePageCopy } from '../_lib/compare-page-copy';
import type { EngineAccent } from '../_lib/compare-page-helpers';
import {
  formatEngineName,
  formatTemplate,
} from '../_lib/compare-page-helpers';
import type { CompareMetric } from '../_lib/compare-page-scorecard';
import type { EngineCatalogEntry } from '../_lib/compare-page-types';
import { CompareGenerateCard } from './CompareGenerateCard';
import { CompareScoreGrid, describeCompareMetric, formatCompareScoreValue, labelCompareMetric, orderCompareMetrics } from './CompareScoreGrid';
import { CompareScoreActions } from './CompareScoreActions.client';

const SCORE_TEXT = {
  en: {
    subtitle: 'We scored each model separately on the dates below. These are not same-prompt test results; watch the videos and check the controls too.',
    formula: 'The overall scores above average prompt adherence, motion realism and temporal consistency. Small differences are directional, not a verdict.',
    pricing: 'For cost, compare the current quotes and settings below. Prices are not graded on this scale.',
    source: 'Source: MaxVideoAI benchmark methodology.',
    updated: 'Score records last updated',
    missingDate: 'date unavailable',
  },
  fr: {
    subtitle: 'Nous avons noté chaque modèle séparément aux dates ci-dessous. Ce ne sont pas les résultats d’un test avec le même prompt ; regardez aussi les vidéos et les réglages.',
    formula: 'Les notes globales ci-dessus sont la moyenne du respect du prompt, du mouvement et de la cohérence temporelle. Un petit écart donne une tendance, pas un verdict.',
    pricing: 'Pour le coût, comparez les devis et leurs réglages ci-dessous. Les prix ne reçoivent pas de note sur cette échelle.',
    source: 'Source : méthodologie MaxVideoAI.',
    updated: 'Dernière mise à jour des fiches de notes',
    missingDate: 'date indisponible',
  },
  es: {
    subtitle: 'Evaluamos cada modelo por separado en las fechas indicadas. No son resultados obtenidos con el mismo prompt; mira también los videos y los controles.',
    formula: 'Las notas globales anteriores promedian fidelidad al prompt, movimiento y coherencia temporal. Una diferencia pequeña indica una tendencia, no un veredicto.',
    pricing: 'Para comparar costes, consulta los presupuestos actuales y sus ajustes abajo. El precio no recibe una nota en esta escala.',
    source: 'Fuente: metodología de MaxVideoAI.',
    updated: 'Última actualización de las fichas de notas',
    missingDate: 'fecha no disponible',
  },
} as const;

function formatScoreDate(value: string | null, locale: AppLocale, missing: string) {
  if (!value) return missing;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  const language = { en: 'en-US', fr: 'fr-FR', es: 'es-ES' }[locale];
  return new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

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
  leftScoreUpdated: string | null;
  right: EngineCatalogEntry;
  rightAccent: EngineAccent;
  rightCanGenerate: boolean;
  rightScoreUpdated: string | null;
  scorecardCriteriaLabel: string;
  scorecardProvisionalNote: string | null;
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
  leftScoreUpdated,
  right,
  rightCanGenerate,
  rightScoreUpdated,
  scorecardCriteriaLabel,
  scorecardProvisionalNote,
}: CompareScorecardSectionProps) {
  const copy = getCompareEditorialCopy(activeLocale);
  const actions = getCompareDetailActions(activeLocale);
  const text = SCORE_TEXT[activeLocale];
  const orderedMetrics = orderCompareMetrics(comparisonMetrics);
  const mainMetrics = orderedMetrics.slice(0, 6);
  const remainingMetrics = orderedMetrics.slice(6);
  const leftName = formatEngineName(left);
  const rightName = formatEngineName(right);
  const markdown = [
    `# ${leftName} vs ${rightName}`,
    `${text.updated}: ${leftName} ${leftScoreUpdated ?? text.missingDate}; ${rightName} ${rightScoreUpdated ?? text.missingDate}.`,
    text.subtitle,
    text.formula,
    '',
    `| ${scorecardCriteriaLabel} (0–10) | ${leftName} | ${rightName} |`,
    '| --- | ---: | ---: |',
    ...orderedMetrics.map((metric) => `| ${labelCompareMetric(metric, activeLocale).replaceAll('|', '\\|')} — ${describeCompareMetric(metric, activeLocale).replaceAll('|', '\\|')} | ${formatCompareScoreValue(metric.leftValue, labels.na)} | ${formatCompareScoreValue(metric.rightValue, labels.na)} |`),
    '',
    text.pricing,
    `${text.source} https://maxvideoai.com/benchmarks`,
  ].join('\n');
  return (
    <>
      <div id="scores" className="compare-score-panel">
        <div className="compare-score-intro">
          <h2 className="text-xl font-semibold text-text-primary">
            {copy.scoreTitle}
          </h2>
          <p>{text.subtitle}</p>
          <p className="compare-score-dates">{text.updated}: {leftName} {leftScoreUpdated ? <time dateTime={leftScoreUpdated}>{formatScoreDate(leftScoreUpdated, activeLocale, text.missingDate)}</time> : text.missingDate} · {rightName} {rightScoreUpdated ? <time dateTime={rightScoreUpdated}>{formatScoreDate(rightScoreUpdated, activeLocale, text.missingDate)}</time> : text.missingDate}</p>
          <BenchmarkMethodologyLink locale={activeLocale} />
          {scorecardProvisionalNote ? (
            <p className="mt-2 text-xs font-semibold text-text-muted">{scorecardProvisionalNote}</p>
          ) : null}
        </div>
        <CompareScoreGrid metrics={mainMetrics} locale={activeLocale} leftName={leftName} rightName={rightName} missingLabel={labels.na} />

        {remainingMetrics.length ? <details className="compare-more-scores">
          <summary className="compare-disclosure-trigger">
            <span className="compare-disclosure-copy">
              <small className="compare-when-closed">{actions.shown.replace('{shown}', String(mainMetrics.length)).replace('{total}', String(criteriaCount))}</small>
              <small className="compare-when-open">{actions.shown.replace('{shown}', String(orderedMetrics.length)).replace('{total}', String(criteriaCount))}</small>
              <strong className="compare-when-closed">{actions.more.replace('{count}', String(remainingMetrics.length))}</strong>
              <strong className="compare-when-open">{actions.fewer}</strong>
            </span>
            <span className="compare-disclosure-arrow"><ChevronDown size={22} aria-hidden="true" /></span>
          </summary>
          <CompareScoreGrid metrics={remainingMetrics} locale={activeLocale} leftName={leftName} rightName={rightName} missingLabel={labels.na} />
        </details> : null}

        <div className="compare-score-footer">
          <div>
            <p>{text.formula}</p>
            <p>{text.pricing}</p>
          </div>
          <CompareScoreActions locale={activeLocale} markdown={markdown} />
        </div>

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
