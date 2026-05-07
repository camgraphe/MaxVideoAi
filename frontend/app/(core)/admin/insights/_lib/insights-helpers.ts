import { Activity, AlertTriangle, ChartLine, TrendingUp, Users, Wallet } from 'lucide-react';
import type { AdminMetricItem } from '@/components/admin-system/surfaces/AdminMetricGrid';
import type {
  AdminMetrics,
  AdminMetricsComparison,
  AmountSeriesPoint,
  MetricsRangeLabel,
  TimeSeriesPoint,
} from '@/lib/admin/types';
import type {
  ChartTheme,
  DeltaSnapshot,
  FocusMetric,
  FocusMetricData,
  FunnelStep,
  LedgerRow,
  PrioritySignal,
  PulseCard,
  RevenueBoardRow,
  SmallStat,
} from './insights-types';

const dayFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });
const fullDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const preciseCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const numberFormatter = new Intl.NumberFormat('en-US');
const compactNumberFormatter = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const percentFormatter = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });

export const CHART_THEMES: Record<FocusMetric, ChartTheme> = {
  signups: {
    bar: '#2563EB',
    line: '#94A3B8',
  },
  active: {
    bar: '#0F766E',
    line: '#94A3B8',
  },
  topups: {
    bar: '#CA8A04',
    line: '#94A3B8',
  },
  charges: {
    bar: '#EA580C',
    line: '#94A3B8',
  },
};

export const FOCUS_OPTIONS: Array<{ key: FocusMetric; label: string }> = [
  { key: 'signups', label: 'Signups' },
  { key: 'active', label: 'Active' },
  { key: 'topups', label: 'Top-ups' },
  { key: 'charges', label: 'Charges' },
];

export function toneBadgeClass(tone: SmallStat['tone']) {
  if (tone === 'success') {
    return 'bg-success-bg text-success';
  }
  if (tone === 'warning') {
    return 'bg-error-bg text-error';
  }
  return 'bg-surface-hover text-text-secondary';
}

export function toneValueClass(tone: SmallStat['tone']) {
  if (tone === 'success') {
    return 'text-success';
  }
  if (tone === 'warning') {
    return 'text-error';
  }
  return 'text-text-primary';
}

export function resolveFocusParam(value: string | string[] | undefined): FocusMetric {
  const resolved = Array.isArray(value) ? value[value.length - 1] : value;
  if (resolved === 'active' || resolved === 'topups' || resolved === 'charges') {
    return resolved;
  }
  return 'signups';
}

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

export function buildRevenueBoardRows(comparison: AdminMetricsComparison): RevenueBoardRow[] {
  const signupsCurrent = sumTimeSeries(comparison.current.signupsDaily);
  const signupsPrevious = sumTimeSeries(comparison.previous.signupsDaily);
  const activeCurrent = sumTimeSeries(comparison.current.activeAccountsDaily);
  const activePrevious = sumTimeSeries(comparison.previous.activeAccountsDaily);
  const topupsCurrent = sumAmountSeries(comparison.current.topupsDaily);
  const topupsPrevious = sumAmountSeries(comparison.previous.topupsDaily);
  const chargesCurrent = sumAmountSeries(comparison.current.chargesDaily);
  const chargesPrevious = sumAmountSeries(comparison.previous.chargesDaily);
  const netCurrent = topupsCurrent.amountUsd - chargesCurrent.amountUsd;
  const netPrevious = topupsPrevious.amountUsd - chargesPrevious.amountUsd;

  const rows: Array<{
    label: string;
    current: number;
    previous: number;
    formatValue: (value: number) => string;
    helper: string;
    positiveIsGood?: boolean;
  }> = [
    {
      label: 'New accounts',
      current: signupsCurrent,
      previous: signupsPrevious,
      formatValue: formatNumber,
      helper: 'Total signups recorded in the current and previous window',
    },
    {
      label: 'Active account-days',
      current: activeCurrent,
      previous: activePrevious,
      formatValue: formatNumber,
      helper: 'Summed daily activity counts, useful as a pace indicator',
    },
    {
      label: 'Wallet top-ups',
      current: topupsCurrent.amountUsd,
      previous: topupsPrevious.amountUsd,
      formatValue: (value) => formatCurrency(value),
      helper: `${formatNumber(topupsCurrent.count)} current loads vs ${formatNumber(topupsPrevious.count)} previous`,
    },
    {
      label: 'Render charges',
      current: chargesCurrent.amountUsd,
      previous: chargesPrevious.amountUsd,
      formatValue: (value) => formatCurrency(value),
      helper: `${formatNumber(chargesCurrent.count)} current charges vs ${formatNumber(chargesPrevious.count)} previous`,
    },
    {
      label: 'Net flow',
      current: netCurrent,
      previous: netPrevious,
      formatValue: (value) => formatSignedCurrency(value),
      helper: 'Top-ups minus charges within each comparison window',
    },
    {
      label: 'Avg wallet ticket',
      current: topupsCurrent.count ? topupsCurrent.amountUsd / topupsCurrent.count : 0,
      previous: topupsPrevious.count ? topupsPrevious.amountUsd / topupsPrevious.count : 0,
      formatValue: (value) => (value ? formatCurrency(value, { precise: true }) : '—'),
      helper: 'Average amount per wallet load',
    },
    {
      label: 'Avg charge ticket',
      current: chargesCurrent.count ? chargesCurrent.amountUsd / chargesCurrent.count : 0,
      previous: chargesPrevious.count ? chargesPrevious.amountUsd / chargesPrevious.count : 0,
      formatValue: (value) => (value ? formatCurrency(value, { precise: true }) : '—'),
      helper: 'Average amount per render charge event',
    },
  ];

  return rows.map((row) => {
    const delta = compareValues(row.current, row.previous);
    return {
      label: row.label,
      current: row.formatValue(row.current),
      previous: row.formatValue(row.previous),
      delta: formatDeltaLabel(delta),
      helper: row.helper,
      tone: resolveDeltaTone(delta, row.positiveIsGood),
    };
  });
}

export function buildPulseCards(metrics: AdminMetrics, comparison: AdminMetricsComparison): PulseCard[] {
  const signupsCurrent = sumTimeSeries(comparison.current.signupsDaily);
  const signupsPrevious = sumTimeSeries(comparison.previous.signupsDaily);
  const activeCurrent = sumTimeSeries(comparison.current.activeAccountsDaily);
  const activePrevious = sumTimeSeries(comparison.previous.activeAccountsDaily);
  const topupsCurrent = sumAmountSeries(comparison.current.topupsDaily);
  const topupsPrevious = sumAmountSeries(comparison.previous.topupsDaily);
  const chargesCurrent = sumAmountSeries(comparison.current.chargesDaily);
  const chargesPrevious = sumAmountSeries(comparison.previous.chargesDaily);

  const signupsPeak = findPeakTimeSeriesPoint(comparison.current.signupsDaily);
  const activePeak = findPeakTimeSeriesPoint(comparison.current.activeAccountsDaily);
  const chargesPeak = findPeakAmountSeriesPoint(comparison.current.chargesDaily);

  return [
    createPulseCard({
      label: 'Signups',
      current: signupsCurrent,
      previous: signupsPrevious,
      formatValue: formatNumber,
      helper: signupsPeak
        ? `Peak ${formatDay(signupsPeak.date)} · ${formatAverage(signupsCurrent / metrics.range.days)} per day`
        : `No signup peak in the current ${describeRange(metrics.range.label)}`,
    }),
    createPulseCard({
      label: 'Active account-days',
      current: activeCurrent,
      previous: activePrevious,
      formatValue: formatNumber,
      helper: activePeak
        ? `Peak ${formatDay(activePeak.date)} · summed daily activity, not distinct users`
        : 'No activity in this range',
    }),
    createPulseCard({
      label: 'Wallet top-ups',
      current: topupsCurrent.amountUsd,
      previous: topupsPrevious.amountUsd,
      formatValue: (value) => formatCurrency(value),
      helper: topupsCurrent.count
        ? `${formatNumber(topupsCurrent.count)} loads · avg ${formatAverageTicket(topupsCurrent)}`
        : 'No wallet loads in the current range',
    }),
    createPulseCard({
      label: 'Render charges',
      current: chargesCurrent.amountUsd,
      previous: chargesPrevious.amountUsd,
      formatValue: (value) => formatCurrency(value),
      helper: chargesPeak
        ? `${formatNumber(chargesCurrent.count)} charges · peak ${formatDay(chargesPeak.date)}`
        : 'No render charges in the current range',
    }),
  ];
}

export function createPulseCard({
  label,
  current,
  previous,
  formatValue,
  helper,
  positiveIsGood = true,
}: {
  label: string;
  current: number;
  previous: number;
  formatValue: (value: number) => string;
  helper: string;
  positiveIsGood?: boolean;
}): PulseCard {
  const delta = compareValues(current, previous);
  return {
    label,
    value: formatValue(current),
    previousValue: formatValue(previous),
    delta: formatDeltaLabel(delta),
    helper,
    tone: resolveDeltaTone(delta, positiveIsGood),
  };
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

export function buildRecentLedgerRows(metrics: AdminMetrics): LedgerRow[] {
  const signupsMap = new Map(metrics.timeseries.signupsDaily.map((point) => [point.date.slice(0, 10), point.value]));
  const activeMap = new Map(metrics.timeseries.activeAccountsDaily.map((point) => [point.date.slice(0, 10), point.value]));
  const topupsMap = new Map(metrics.timeseries.topupsDaily.map((point) => [point.date.slice(0, 10), point.amountCents / 100]));
  const chargesMap = new Map(metrics.timeseries.chargesDaily.map((point) => [point.date.slice(0, 10), point.amountCents / 100]));

  const dates = Array.from(
    new Set([
      ...metrics.timeseries.signupsDaily.map((point) => point.date.slice(0, 10)),
      ...metrics.timeseries.activeAccountsDaily.map((point) => point.date.slice(0, 10)),
      ...metrics.timeseries.topupsDaily.map((point) => point.date.slice(0, 10)),
      ...metrics.timeseries.chargesDaily.map((point) => point.date.slice(0, 10)),
    ])
  )
    .sort((a, b) => a.localeCompare(b))
    .slice(-7)
    .reverse();

  return dates.map((date) => ({
    date,
    signups: signupsMap.get(date) ?? 0,
    active: activeMap.get(date) ?? 0,
    topupsUsd: topupsMap.get(date) ?? 0,
    chargesUsd: chargesMap.get(date) ?? 0,
  }));
}

export function buildMonthlyRows(metrics: AdminMetrics) {
  const map = new Map<
    string,
    {
      month: string;
      signups: number;
      topupsUsd: number;
      chargesUsd: number;
    }
  >();

  metrics.monthly.signupsMonthly.forEach((point) => {
    const key = point.date.slice(0, 7);
    const existing = map.get(key) ?? { month: point.date, signups: 0, topupsUsd: 0, chargesUsd: 0 };
    existing.signups = point.value;
    map.set(key, existing);
  });

  metrics.monthly.topupsMonthly.forEach((point) => {
    const key = point.date.slice(0, 7);
    const existing = map.get(key) ?? { month: point.date, signups: 0, topupsUsd: 0, chargesUsd: 0 };
    existing.topupsUsd = point.amountCents / 100;
    map.set(key, existing);
  });

  metrics.monthly.chargesMonthly.forEach((point) => {
    const key = point.date.slice(0, 7);
    const existing = map.get(key) ?? { month: point.date, signups: 0, topupsUsd: 0, chargesUsd: 0 };
    existing.chargesUsd = point.amountCents / 100;
    map.set(key, existing);
  });

  return Array.from(map.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6)
    .reverse();
}

export function buildBehaviorStats(metrics: AdminMetrics): SmallStat[] {
  return [
    {
      label: 'Signup → Top-up',
      value: formatPercent(metrics.funnels.signupToTopUpConversion),
      helper: `${formatNumber(metrics.funnels.totalTopupUsers)} users reached their first wallet load`,
    },
    {
      label: 'Top-up → First render',
      value: formatPercent(metrics.funnels.topUpToRenderConversion30d),
      helper: `${formatNumber(metrics.funnels.convertedWithin30dUsers)} users converted within 30 days`,
    },
    {
      label: 'Avg days to first top-up',
      value: formatDays(metrics.funnels.avgTimeSignupToFirstTopUpDays),
      helper: 'From signup to first wallet load',
    },
    {
      label: 'Avg days to first render',
      value: formatDays(metrics.funnels.avgTimeTopUpToFirstRenderDays),
      helper: 'From first top-up to first completed render',
    },
    {
      label: 'Avg renders / paying user',
      value: formatAverage(metrics.behavior.avgRendersPerPayingUser30d),
      helper: `Median ${formatAverage(metrics.behavior.medianRendersPerPayingUser30d)} over 30 days`,
    },
    {
      label: 'Returning users (7d)',
      value: formatNumber(metrics.behavior.returningUsers7d),
      helper: 'Completed renders in both the last 7 days and the previous 7 days',
      tone: metrics.behavior.returningUsers7d ? 'success' : 'default',
    },
  ];
}

export function buildFunnelSteps(metrics: AdminMetrics): FunnelStep[] {
  const rawSteps = [
    {
      label: 'Signed up',
      value: metrics.totals.totalAccounts,
      helper: 'All synced accounts in the workspace',
      accent: '#2563EB',
    },
    {
      label: 'Loaded wallet',
      value: metrics.funnels.totalTopupUsers,
      helper: 'At least one wallet top-up recorded',
      accent: '#CA8A04',
    },
    {
      label: 'First render within 30d',
      value: metrics.funnels.convertedWithin30dUsers,
      helper: 'Reached first completed render within 30 days of first top-up',
      accent: '#EA580C',
    },
  ];

  const startValue = rawSteps[0]?.value ?? 0;

  return rawSteps.map((step, index) => {
    const previousValue = index > 0 ? rawSteps[index - 1].value : 0;
    return {
      ...step,
      shareOfStart: startValue ? step.value / startValue : 0,
      conversionFromPrevious: index === 0 ? null : previousValue ? step.value / previousValue : 0,
    };
  });
}

export function buildFocusMetricData(
  focus: FocusMetric,
  metrics: AdminMetrics,
  comparison: AdminMetricsComparison,
  humanRange: string
): FocusMetricData {
  if (focus === 'active') {
    return {
      key: 'active',
      label: 'Active account-days',
      description: 'Mesure d’usage journalier cumulé. Ce n’est pas un distinct user count, mais un vrai rythme d’activité.',
      theme: CHART_THEMES.active,
      currentPoints: comparison.current.activeAccountsDaily.map((point) => ({
        label: formatDay(point.date),
        value: point.value,
      })),
      previousPoints: comparison.previous.activeAccountsDaily.map((point) => ({
        label: formatDay(point.date),
        value: point.value,
      })),
      stats: buildCountSeriesStats(comparison.current.activeAccountsDaily, comparison.previous.activeAccountsDaily, humanRange, {
        totalLabel: 'Current total',
        totalHelper: 'Summed daily active-account counts',
        peakEmptyLabel: 'No activity',
      }),
    };
  }

  if (focus === 'topups') {
    return {
      key: 'topups',
      label: 'Wallet top-ups',
      description: 'Cash-in par jour. Le tracé précédent garde la cadence historique visible sans surcharger le graph.',
      theme: CHART_THEMES.topups,
      currentPoints: comparison.current.topupsDaily.map((point) => ({
        label: formatDay(point.date),
        value: point.amountCents / 100,
      })),
      previousPoints: comparison.previous.topupsDaily.map((point) => ({
        label: formatDay(point.date),
        value: point.amountCents / 100,
      })),
      stats: buildAmountSeriesStats(comparison.current.topupsDaily, comparison.previous.topupsDaily, humanRange, 'loads'),
      axisFormatter: formatAxisCurrency,
      tooltipFormatter: (value) => formatCurrency(value, { precise: value < 100 }),
    };
  }

  if (focus === 'charges') {
    return {
      key: 'charges',
      label: 'Render charges',
      description: 'Consommation par jour. Les pics restent visibles, mais la comparaison n’oblige plus à faire le calcul mental.',
      theme: CHART_THEMES.charges,
      currentPoints: comparison.current.chargesDaily.map((point) => ({
        label: formatDay(point.date),
        value: point.amountCents / 100,
      })),
      previousPoints: comparison.previous.chargesDaily.map((point) => ({
        label: formatDay(point.date),
        value: point.amountCents / 100,
      })),
      stats: buildAmountSeriesStats(comparison.current.chargesDaily, comparison.previous.chargesDaily, humanRange, 'charges'),
      axisFormatter: formatAxisCurrency,
      tooltipFormatter: (value) => formatCurrency(value, { precise: value < 100 }),
    };
  }

  return {
    key: 'signups',
    label: 'Signups per day',
    description: 'Nouvelle acquisition dans la fenêtre. C’est la meilleure lecture de tendance en haut de funnel.',
    theme: CHART_THEMES.signups,
    currentPoints: comparison.current.signupsDaily.map((point) => ({
      label: formatDay(point.date),
      value: point.value,
    })),
    previousPoints: comparison.previous.signupsDaily.map((point) => ({
      label: formatDay(point.date),
      value: point.value,
    })),
    stats: buildCountSeriesStats(comparison.current.signupsDaily, comparison.previous.signupsDaily, humanRange),
  };
}

export function buildCountSeriesStats(
  currentPoints: TimeSeriesPoint[],
  previousPoints: TimeSeriesPoint[],
  humanRange: string,
  options?: {
    totalLabel?: string;
    totalHelper?: string;
    peakEmptyLabel?: string;
  }
): SmallStat[] {
  const currentTotal = sumTimeSeries(currentPoints);
  const previousTotal = sumTimeSeries(previousPoints);
  const delta = compareValues(currentTotal, previousTotal);
  const average = currentPoints.length ? currentTotal / currentPoints.length : 0;
  const peak = findPeakTimeSeriesPoint(currentPoints);
  const activeDays = currentPoints.filter((point) => point.value > 0).length;

  return [
    {
      label: options?.totalLabel ?? 'Current total',
      value: formatNumber(currentTotal),
      helper: options?.totalHelper ?? `Across ${humanRange}`,
    },
    {
      label: 'Vs previous',
      value: formatDeltaLabel(delta),
      helper: `Previous ${formatNumber(previousTotal)}`,
      tone: resolveDeltaTone(delta),
    },
    {
      label: 'Avg / day',
      value: formatAverage(average),
      helper: `${formatNumber(activeDays)} active days`,
    },
    {
      label: 'Peak day',
      value: peak ? formatDay(peak.date) : '—',
      helper: peak ? formatNumber(peak.value) : options?.peakEmptyLabel ?? 'No activity',
    },
  ];
}

export function buildAmountSeriesStats(
  currentPoints: AmountSeriesPoint[],
  previousPoints: AmountSeriesPoint[],
  humanRange: string,
  countLabel: string
): SmallStat[] {
  const currentTotals = sumAmountSeries(currentPoints);
  const previousTotals = sumAmountSeries(previousPoints);
  const delta = compareValues(currentTotals.amountUsd, previousTotals.amountUsd);
  const peak = findPeakAmountSeriesPoint(currentPoints);

  return [
    {
      label: 'Current amount',
      value: formatCurrency(currentTotals.amountUsd),
      helper: `${formatNumber(currentTotals.count)} ${countLabel} across ${humanRange}`,
    },
    {
      label: 'Vs previous',
      value: formatDeltaLabel(delta),
      helper: `Previous ${formatCurrency(previousTotals.amountUsd)}`,
      tone: resolveDeltaTone(delta),
    },
    {
      label: 'Avg ticket',
      value: currentTotals.count ? formatAverageTicket(currentTotals) : '—',
      helper: currentTotals.count ? 'Per recorded transaction' : 'No transactions',
    },
    {
      label: 'Peak day',
      value: peak ? formatDay(peak.date) : '—',
      helper: peak ? formatCurrency(peak.amountCents / 100) : 'No activity',
    },
  ];
}

export function compareValues(current: number, previous: number): DeltaSnapshot {
  const absoluteChange = current - previous;
  return {
    current,
    previous,
    absoluteChange,
    ratioChange: previous === 0 ? null : absoluteChange / previous,
  };
}

export function formatDeltaLabel(delta: DeltaSnapshot) {
  if (delta.current === 0 && delta.previous === 0) {
    return 'Flat';
  }
  if (delta.previous === 0) {
    return delta.current > 0 ? 'New' : 'Flat';
  }
  if (delta.absoluteChange === 0) {
    return 'Flat';
  }
  return formatSignedPercent(delta.ratioChange ?? 0);
}

export function formatNarrativeDelta(delta: DeltaSnapshot) {
  if (delta.current === 0 && delta.previous === 0) {
    return 'flat';
  }
  if (delta.previous === 0) {
    return delta.current > 0 ? 'up from a zero base' : 'flat';
  }
  if (delta.absoluteChange === 0) {
    return 'flat';
  }
  return formatSignedPercent(delta.ratioChange ?? 0);
}

export function resolveDeltaTone(delta: DeltaSnapshot, positiveIsGood = true): SmallStat['tone'] {
  if (delta.current === 0 && delta.previous === 0) {
    return 'default';
  }
  if (delta.previous === 0) {
    return delta.current > 0 ? (positiveIsGood ? 'success' : 'warning') : 'default';
  }
  if (delta.absoluteChange === 0) {
    return 'default';
  }
  const improved = positiveIsGood ? delta.absoluteChange > 0 : delta.absoluteChange < 0;
  return improved ? 'success' : 'warning';
}

export function sumTimeSeries(points: TimeSeriesPoint[]): number {
  return points.reduce((sum, point) => sum + point.value, 0);
}

export function sumAmountSeries(points: AmountSeriesPoint[]): { amountUsd: number; count: number } {
  return points.reduce(
    (accumulator, point) => ({
      amountUsd: accumulator.amountUsd + point.amountCents / 100,
      count: accumulator.count + point.count,
    }),
    { amountUsd: 0, count: 0 }
  );
}

export function findPeakTimeSeriesPoint(points: TimeSeriesPoint[]): TimeSeriesPoint | null {
  if (!points.length) return null;
  const peak = [...points].sort((a, b) => b.value - a.value)[0];
  return peak?.value > 0 ? peak : null;
}

export function findPeakAmountSeriesPoint(points: AmountSeriesPoint[]): AmountSeriesPoint | null {
  if (!points.length) return null;
  const peak = [...points].sort((a, b) => b.amountCents - a.amountCents)[0];
  return peak?.amountCents > 0 ? peak : null;
}

export function buildChartTicks(maxValue: number): number[] {
  if (!Number.isFinite(maxValue) || maxValue <= 0) {
    return [0, 1];
  }

  const roughStep = maxValue / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const residual = roughStep / magnitude;
  let niceStep = 1;

  if (residual <= 1) {
    niceStep = 1;
  } else if (residual <= 2) {
    niceStep = 2;
  } else if (residual <= 5) {
    niceStep = 5;
  } else {
    niceStep = 10;
  }

  const step = niceStep * magnitude;
  const niceMax = Math.ceil(maxValue / step) * step;
  const tickCount = Math.max(2, Math.round(niceMax / step));

  return Array.from({ length: tickCount + 1 }, (_, index) => Number((index * step).toFixed(4)));
}

export function buildInsightsHref({
  range,
  excludeAdmin,
  focus,
}: {
  range: MetricsRangeLabel;
  excludeAdmin: boolean;
  focus: FocusMetric;
}) {
  const params = new URLSearchParams();
  params.set('range', range);
  params.set('excludeAdmin', excludeAdmin ? '1' : '0');
  params.set('focus', focus);
  return `/admin/insights?${params.toString()}`;
}

export function describeRange(label: MetricsRangeLabel) {
  switch (label) {
    case '24h':
      return '24 hours';
    case '7d':
      return '7 days';
    case '90d':
      return '90 days';
    default:
      return '30 days';
  }
}

export function formatCurrency(amount: number, options?: { precise?: boolean }) {
  if (options?.precise) {
    return preciseCurrencyFormatter.format(amount);
  }
  return currencyFormatter.format(amount);
}

export function formatSignedCurrency(amount: number) {
  if (!Number.isFinite(amount)) {
    return '$0';
  }
  if (amount === 0) {
    return '$0';
  }
  const absolute = formatCurrency(Math.abs(amount));
  return `${amount > 0 ? '+' : '-'}${absolute}`;
}

export function formatAverageTicket(totals: { amountUsd: number; count: number }) {
  return formatCurrency(totals.amountUsd / totals.count, { precise: true });
}

export function formatNumber(value: number) {
  return numberFormatter.format(value);
}

export function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 1000) return compactNumberFormatter.format(value);
  if (Number.isInteger(value)) return numberFormatter.format(value);
  return value.toFixed(1);
}

export function formatAxisCurrency(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1000) {
    return `$${(value / 1000).toFixed(absolute >= 10000 ? 0 : 1)}k`;
  }
  if (absolute >= 10) {
    return `$${Math.round(value)}`;
  }
  return `$${value.toFixed(1)}`;
}

export function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return '0%';
  }
  return percentFormatter.format(value);
}

export function formatSignedPercent(value: number) {
  if (!Number.isFinite(value)) {
    return '0%';
  }
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${percentFormatter.format(Math.abs(value))}`;
}

export function formatDay(value: string) {
  return dayFormatter.format(new Date(value));
}

export function formatMonth(value: string) {
  return monthFormatter.format(new Date(value));
}

export function formatFullDate(value: string | null) {
  if (!value) return '—';
  return fullDateFormatter.format(new Date(value));
}

export function formatDays(value: number | null) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toFixed(1)} days`;
}

export function formatAverage(value: number) {
  if (!Number.isFinite(value)) {
    return '0.0';
  }
  return value.toFixed(1);
}
