import type { AdminMetrics, AdminMetricsComparison } from '@/lib/admin/types';
import type { LedgerRow, PulseCard, RevenueBoardRow } from './insights-types';
import {
  formatAverage,
  formatAverageTicket,
  formatCurrency,
  formatDay,
  formatDeltaLabel,
  formatNumber,
  formatSignedCurrency,
  resolveDeltaTone,
} from './insights-formatters';
import { describeRange } from './insights-navigation';
import { compareValues, findPeakAmountSeriesPoint, findPeakTimeSeriesPoint, sumAmountSeries, sumTimeSeries } from './insights-series-helpers';

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
