import type { AppLocale } from '@/i18n/locales';
import type { CompareSpecRow } from './compare-page-spec-rows';
import type { CompareMetric } from './compare-page-scorecard';
import type { ComparePricingDisplay } from './compare-page-types';
import { localizeSpecDetailValue } from './compare-page-spec-values';
import { comparePriceLines } from './compare-pricing-copy';
import { SCORE_TEXT } from './compare-score-copy';
import { describeCompareMetric, formatCompareScoreValue, labelCompareMetric, orderCompareMetrics } from '../_components/CompareScoreGrid';

export function publicComparisonUrl(path: string): string {
  const url = new URL(path, 'https://maxvideoai.com');
  return `https://maxvideoai.com${url.pathname}#scores`;
}
const escapeCell = (value: string) => value.replaceAll('|', '\\|').replaceAll('\n', ' ');
export function buildComparisonExport(input: {
  locale: AppLocale; path: string; leftName: string; rightName: string;
  metrics: CompareMetric[]; specRows: CompareSpecRow[]; leftUpdated: string | null; rightUpdated: string | null;
  leftPricing: ComparePricingDisplay; rightPricing: ComparePricingDisplay; priceSnapshotAt: string;
  labels: { pending: string; supported: string; notSupported: string; na: string };
  sources: Array<{ name: string; urls: string[] }>; summary?: string;
}): string {
  const { locale, leftName, rightName, labels } = input;
  const text = SCORE_TEXT[locale];
  const headings = {
    en: { scores: 'Editorial scores (0–10)', specs: 'Capabilities in MaxVideoAI', pricing: 'Estimated prices · USD', snapshot: 'Price snapshot generated', source: 'Capability sources', caveat: 'These are configuration limits, not a guarantee of output quality. Provider verification dates are not recorded here; consult the linked model documentation.', criterion: 'Criterion' },
    fr: { scores: 'Notes éditoriales (0–10)', specs: 'Capacités dans MaxVideoAI', pricing: 'Prix estimés · USD', snapshot: 'Relevé tarifaire généré', source: 'Sources des capacités', caveat: 'Ce sont des limites de configuration, pas une garantie de qualité. Les dates de vérification fournisseur ne sont pas consignées ici ; consultez les documentations liées.', criterion: 'Critère' },
    es: { scores: 'Notas editoriales (0–10)', specs: 'Capacidades en MaxVideoAI', pricing: 'Precios estimados · USD', snapshot: 'Instantánea de precios generada', source: 'Fuentes de capacidades', caveat: 'Son límites de configuración, no una garantía de calidad. Las fechas de verificación del proveedor no se registran aquí; consulta la documentación enlazada.', criterion: 'Criterio' },
  }[locale];
  const specCell = (value: string, lines?: string[], line?: string | null) => escapeCell([localizeSpecDetailValue(value, locale, labels), ...(lines ?? (line ? [line] : []))].join('; '));
  return [
    `# ${leftName} vs ${rightName}`, input.summary ?? '', publicComparisonUrl(input.path), '',
    `## ${headings.scores}`, text.subtitle, text.formula,
    `${text.updated}: ${leftName}: ${input.leftUpdated ?? text.missingDate}; ${rightName}: ${input.rightUpdated ?? text.missingDate}.`,
    `| ${headings.criterion} | ${leftName} | ${rightName} |`, '| --- | --- | --- |',
    ...orderCompareMetrics(input.metrics).map(metric => `| ${escapeCell(labelCompareMetric(metric, locale))} — ${escapeCell(describeCompareMetric(metric, locale))} | ${formatCompareScoreValue(metric.leftValue, labels.na)} | ${formatCompareScoreValue(metric.rightValue, labels.na)} |`),
    text.pricing, `${text.source} https://maxvideoai.com/benchmarks`, '',
    `## ${headings.specs}`, `| ${headings.criterion} | ${leftName} | ${rightName} |`, '| --- | --- | --- |',
    ...input.specRows.map(row => `| ${escapeCell(row.label)} | ${specCell(row.left, row.sublines, row.subline)} | ${specCell(row.right, row.rightSublines, row.rightSubline)} |`),
    headings.caveat, '', `## ${headings.pricing}`, `${headings.snapshot}: ${input.priceSnapshotAt}.`,
    ...[{ name: leftName, pricing: input.leftPricing }, { name: rightName, pricing: input.rightPricing }].flatMap(({ name, pricing }) => [`### ${name}`, ...comparePriceLines(pricing, locale).map(line => `- ${line}`)]),
    '', `## ${headings.source}`, ...input.sources.flatMap(source => [`### ${source.name}`, ...source.urls.map(url => `- ${url}`)]),
    '', publicComparisonUrl(input.path),
  ].filter(line => line !== undefined).join('\n');
}
