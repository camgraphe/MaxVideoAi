import { Activity, AlertTriangle, ChartLine, TrendingUp, Users, Wallet } from 'lucide-react';
import type { AdminMetricItem } from '@/components/admin-system/surfaces/AdminMetricGrid';
import type { AdminMetrics, AdminMetricsComparison } from '@/lib/admin/types';
import type { FocusMetric, PrioritySignal } from './insights-types';
import {
  formatCurrency,
  formatDeltaLabel,
  formatNarrativeDelta,
  formatNumber,
  formatPercent,
  formatSignedCurrency,
  resolveDeltaTone,
} from './insights-formatters';
import { buildInsightsHref, describeRange, FOCUS_OPTIONS } from './insights-navigation';
import { compareValues, sumAmountSeries, sumTimeSeries } from './insights-series-helpers';

export function buildExecutiveMetrics(
  metrics: AdminMetrics,
  comparison: AdminMetricsComparison,
  humanRange: string
): AdminMetricItem[] {
  const signupsCurrent = sumTimeSeries(comparison.current.signupsDaily);
  const signupsPrevious = sumTimeSeries(comparison.previous.signupsDaily);
  const signupsDelta = compareValues(signupsCurrent, signupsPrevious);
  const topupsCurrent = sumAmountSeries(comparison.current.topupsDaily);
  const topupsPrevious = sumAmountSeries(comparison.previous.topupsDaily);
  const topupsDelta = compareValues(topupsCurrent.amountUsd, topupsPrevious.amountUsd);
  const chargesCurrent = sumAmountSeries(comparison.current.chargesDaily);
  const chargesPrevious = sumAmountSeries(comparison.previous.chargesDaily);
  const chargesDelta = compareValues(chargesCurrent.amountUsd, chargesPrevious.amountUsd);
  const netCurrent = topupsCurrent.amountUsd - chargesCurrent.amountUsd;
  const netPrevious = topupsPrevious.amountUsd - chargesPrevious.amountUsd;
  const netDelta = compareValues(netCurrent, netPrevious);
  const activationGap = Math.max(0, metrics.funnels.totalTopupUsers - metrics.funnels.convertedWithin30dUsers);

  return [
    {
      label: 'Signups',
      value: formatNumber(signupsCurrent),
      helper: `${formatDeltaLabel(signupsDelta)} vs previous ${humanRange}`,
      tone: resolveDeltaTone(signupsDelta),
      icon: Users,
    },
    {
      label: 'Wallet top-ups',
      value: formatCurrency(topupsCurrent.amountUsd),
      helper: `${formatNumber(topupsCurrent.count)} loads · ${formatDeltaLabel(topupsDelta)} vs previous`,
      tone: resolveDeltaTone(topupsDelta),
      icon: Wallet,
    },
    {
      label: 'Render charges',
      value: formatCurrency(chargesCurrent.amountUsd),
      helper: `${formatNumber(chargesCurrent.count)} charges · ${formatDeltaLabel(chargesDelta)} vs previous`,
      tone: resolveDeltaTone(chargesDelta),
      icon: ChartLine,
    },
    {
      label: 'Net flow',
      value: formatSignedCurrency(netCurrent),
      helper: `Top-ups minus charges · previous ${formatSignedCurrency(netPrevious)}`,
      tone: resolveDeltaTone(netDelta),
      icon: TrendingUp,
    },
    {
      label: 'Activation gap',
      value: formatNumber(activationGap),
      helper: activationGap
        ? 'Wallet users still missing a first render within 30 days'
        : 'No activation gap on the current wallet cohort',
      tone: activationGap ? 'warning' : 'success',
      icon: Activity,
    },
    {
      label: 'Failure rate',
      value: formatPercent(metrics.health.failedRendersRate30d),
      helper: `${formatNumber(metrics.health.failedRenders30d)} unresolved failures`,
      tone: metrics.health.failedRenders30d ? 'warning' : 'success',
      icon: AlertTriangle,
    },
  ];
}

export function buildPrioritySignals(
  metrics: AdminMetrics,
  comparison: AdminMetricsComparison,
  humanRange: string
): PrioritySignal[] {
  const topupsCurrent = sumAmountSeries(comparison.current.topupsDaily);
  const chargesCurrent = sumAmountSeries(comparison.current.chargesDaily);
  const netUsd = topupsCurrent.amountUsd - chargesCurrent.amountUsd;
  const activationGap = Math.max(0, metrics.funnels.totalTopupUsers - metrics.funnels.convertedWithin30dUsers);
  const flaggedEngines = metrics.health.failedByEngine30d.filter((row) => row.failedCount30d > 0);
  const topEngine = metrics.engines[0];

  return [
    {
      label: 'Revenue balance',
      value: formatSignedCurrency(netUsd),
      helper: `${formatCurrency(topupsCurrent.amountUsd)} in top-ups vs ${formatCurrency(chargesCurrent.amountUsd)} in charges across ${humanRange}.`,
      href: '/admin/transactions',
      tone: netUsd >= 0 ? 'success' : 'warning',
    },
    {
      label: 'Activation leak',
      value: formatNumber(activationGap),
      helper: activationGap
        ? 'Users loaded wallet but still have not completed a first render within 30 days.'
        : 'Current wallet cohort has no unresolved activation leak.',
      href: '/admin/users',
      tone: activationGap ? 'warning' : 'success',
    },
    {
      label: 'Open failures',
      value: metrics.health.failedRenders30d ? formatNumber(metrics.health.failedRenders30d) : 'Clear',
      helper: flaggedEngines.length
        ? `${formatNumber(flaggedEngines.length)} engine${flaggedEngines.length > 1 ? 's' : ''} still impacted by unresolved failures.`
        : 'No unresolved failures in the current 30-day health window.',
      href: '/admin/jobs',
      tone: metrics.health.failedRenders30d ? 'warning' : 'success',
    },
    {
      label: 'Revenue concentration',
      value: topEngine ? formatPercent(topEngine.shareOfTotalRevenue30d) : '—',
      helper: topEngine
        ? `${topEngine.engineLabel} is the current lead engine by 30-day charge volume.`
        : 'No engine demand recorded yet.',
      href: '/admin/engines',
      tone: topEngine && topEngine.shareOfTotalRevenue30d > 0.55 ? 'warning' : 'default',
    },
  ];
}

export function buildInsightsRailItems(
  metrics: AdminMetrics,
  comparison: AdminMetricsComparison,
  excludeAdmin: boolean,
  focus: FocusMetric
) {
  const topupsCurrent = sumAmountSeries(comparison.current.topupsDaily);
  return [
    { label: 'Users', href: '/admin/users', meta: formatNumber(metrics.totals.totalAccounts) },
    { label: 'Transactions', href: '/admin/transactions', meta: formatCurrency(topupsCurrent.amountUsd) },
    { label: 'Jobs', href: '/admin/jobs', meta: metrics.health.failedRenders30d ? formatNumber(metrics.health.failedRenders30d) : 'Clear' },
    { label: 'Engines', href: '/admin/engines', meta: formatNumber(metrics.engines.length) },
    {
      label: 'Focus',
      href: buildInsightsHref({ range: metrics.range.label, excludeAdmin, focus }),
      active: true,
      meta: FOCUS_OPTIONS.find((option) => option.key === focus)?.label ?? focus,
    },
  ];
}

export function buildQuickInsights(metrics: AdminMetrics, comparison: AdminMetricsComparison): string[] {
  const insights: string[] = [];
  const humanRange = describeRange(metrics.range.label);
  const signupsDelta = compareValues(sumTimeSeries(comparison.current.signupsDaily), sumTimeSeries(comparison.previous.signupsDaily));
  const topupsCurrent = sumAmountSeries(comparison.current.topupsDaily);
  const chargesCurrent = sumAmountSeries(comparison.current.chargesDaily);
  const netUsd = topupsCurrent.amountUsd - chargesCurrent.amountUsd;
  const topEngine = metrics.engines[0];
  const flaggedEngines = metrics.health.failedByEngine30d.filter((row) => row.failedCount30d > 0);

  insights.push(`Signups are ${formatNarrativeDelta(signupsDelta)} versus the previous ${humanRange}.`);
  insights.push(
    `Wallet flow in the current ${humanRange}: ${formatCurrency(topupsCurrent.amountUsd)} in top-ups against ${formatCurrency(chargesCurrent.amountUsd)} in charges (${netUsd >= 0 ? '+' : ''}${formatCurrency(netUsd)} net).`
  );
  insights.push(
    `Funnel today: ${formatPercent(metrics.funnels.signupToTopUpConversion)} signup → top-up, then ${formatPercent(metrics.funnels.topUpToRenderConversion30d)} top-up → first render within 30 days.`
  );

  if (topEngine) {
    insights.push(
      `${topEngine.engineLabel} leads the engine mix with ${formatCurrency(topEngine.rendersAmount30dUsd)} and ${formatPercent(topEngine.shareOfTotalRevenue30d)} of 30-day revenue.`
    );
  }

  if (flaggedEngines.length) {
    insights.push(`${formatNumber(flaggedEngines.length)} engine${flaggedEngines.length > 1 ? 's' : ''} still show unresolved failures.`);
  } else {
    insights.push('No unresolved failures detected in the last 30 days.');
  }

  return insights;
}
