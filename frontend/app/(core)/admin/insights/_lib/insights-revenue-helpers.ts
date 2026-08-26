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
import {
  compareValues,
  findPeakAmountSeriesPoint,
  findPeakTimeSeriesPoint,
  summarizeWalletFlow,
  sumAmountSeries,
  sumTimeSeries,
} from './insights-series-helpers';

export function buildRevenueBoardRows(comparison: AdminMetricsComparison): RevenueBoardRow[] {
  const signupsCurrent = sumTimeSeries(comparison.current.signupsDaily);
  const signupsPrevious = sumTimeSeries(comparison.previous.signupsDaily);
  const activeCurrent = sumTimeSeries(comparison.current.activeAccountsDaily);
  const activePrevious = sumTimeSeries(comparison.previous.activeAccountsDaily);
  const currentFlow = summarizeWalletFlow({
    topups: comparison.current.topupsDaily,
    grossCharges: comparison.current.chargesDaily,
    refunds: comparison.current.refundsDaily,
  });
  const previousFlow = summarizeWalletFlow({
    topups: comparison.previous.topupsDaily,
    grossCharges: comparison.previous.chargesDaily,
    refunds: comparison.previous.refundsDaily,
  });

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
      current: currentFlow.topups.amountUsd,
      previous: previousFlow.topups.amountUsd,
      formatValue: (value) => formatCurrency(value),
      helper: `${formatNumber(currentFlow.topups.count)} current loads vs ${formatNumber(previousFlow.topups.count)} previous`,
    },
    {
      label: 'Gross render charges',
      current: currentFlow.grossCharges.amountUsd,
      previous: previousFlow.grossCharges.amountUsd,
      formatValue: (value) => formatCurrency(value),
      helper: `${formatNumber(currentFlow.grossCharges.count)} current debits vs ${formatNumber(previousFlow.grossCharges.count)} previous`,
    },
    {
      label: 'Refunds',
      current: currentFlow.refunds.amountUsd,
      previous: previousFlow.refunds.amountUsd,
      formatValue: (value) => formatCurrency(value),
      helper: `${formatNumber(currentFlow.refunds.count)} current credits vs ${formatNumber(previousFlow.refunds.count)} previous`,
      positiveIsGood: false,
    },
    {
      label: 'Net render spend',
      current: currentFlow.netSpendUsd,
      previous: previousFlow.netSpendUsd,
      formatValue: (value) => formatCurrency(value),
      helper: 'Gross render charges minus refunds within each comparison window',
    },
    {
      label: 'Wallet balance delta',
      current: currentFlow.walletBalanceDeltaUsd,
      previous: previousFlow.walletBalanceDeltaUsd,
      formatValue: (value) => formatSignedCurrency(value),
      helper: 'Top-ups plus refunds minus gross charges within each comparison window',
    },
    {
      label: 'Avg wallet ticket',
      current: currentFlow.topups.count ? currentFlow.topups.amountUsd / currentFlow.topups.count : 0,
      previous: previousFlow.topups.count ? previousFlow.topups.amountUsd / previousFlow.topups.count : 0,
      formatValue: (value) => (value ? formatCurrency(value, { precise: true }) : '—'),
      helper: 'Average amount per wallet load',
    },
    {
      label: 'Avg charge ticket',
      current: currentFlow.grossCharges.count ? currentFlow.grossCharges.amountUsd / currentFlow.grossCharges.count : 0,
      previous: previousFlow.grossCharges.count ? previousFlow.grossCharges.amountUsd / previousFlow.grossCharges.count : 0,
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
  const currentFlow = summarizeWalletFlow({
    topups: comparison.current.topupsDaily,
    grossCharges: comparison.current.chargesDaily,
    refunds: comparison.current.refundsDaily,
  });
  const previousFlow = summarizeWalletFlow({
    topups: comparison.previous.topupsDaily,
    grossCharges: comparison.previous.chargesDaily,
    refunds: comparison.previous.refundsDaily,
  });

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
      label: 'Gross render charges',
      current: currentFlow.grossCharges.amountUsd,
      previous: previousFlow.grossCharges.amountUsd,
      formatValue: (value) => formatCurrency(value),
      helper: chargesPeak
        ? `${formatNumber(currentFlow.grossCharges.count)} debits · ${formatCurrency(currentFlow.refunds.amountUsd)} refunded · ${formatCurrency(currentFlow.netSpendUsd)} net spend · peak ${formatDay(chargesPeak.date)}`
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
  const refundsMap = new Map(metrics.timeseries.refundsDaily.map((point) => [point.date.slice(0, 10), point.amountCents / 100]));

  const dates = Array.from(
    new Set([
      ...metrics.timeseries.signupsDaily.map((point) => point.date.slice(0, 10)),
      ...metrics.timeseries.activeAccountsDaily.map((point) => point.date.slice(0, 10)),
      ...metrics.timeseries.topupsDaily.map((point) => point.date.slice(0, 10)),
      ...metrics.timeseries.chargesDaily.map((point) => point.date.slice(0, 10)),
      ...metrics.timeseries.refundsDaily.map((point) => point.date.slice(0, 10)),
    ])
  )
    .sort((a, b) => a.localeCompare(b))
    .slice(-7)
    .reverse();

  return dates.map((date) => {
    const grossChargesUsd = chargesMap.get(date) ?? 0;
    const refundsUsd = refundsMap.get(date) ?? 0;
    return {
      date,
      signups: signupsMap.get(date) ?? 0,
      active: activeMap.get(date) ?? 0,
      topupsUsd: topupsMap.get(date) ?? 0,
      grossChargesUsd,
      refundsUsd,
      netSpendUsd: grossChargesUsd - refundsUsd,
    };
  });
}

export function buildMonthlyRows(metrics: AdminMetrics) {
  const map = new Map<
    string,
    {
      month: string;
      signups: number;
      topupsUsd: number;
      grossChargesUsd: number;
      refundsUsd: number;
      netSpendUsd: number;
    }
  >();

  const emptyRow = (month: string) => ({
    month,
    signups: 0,
    topupsUsd: 0,
    grossChargesUsd: 0,
    refundsUsd: 0,
    netSpendUsd: 0,
  });

  metrics.monthly.signupsMonthly.forEach((point) => {
    const key = point.date.slice(0, 7);
    const existing = map.get(key) ?? emptyRow(point.date);
    existing.signups = point.value;
    map.set(key, existing);
  });

  metrics.monthly.topupsMonthly.forEach((point) => {
    const key = point.date.slice(0, 7);
    const existing = map.get(key) ?? emptyRow(point.date);
    existing.topupsUsd = point.amountCents / 100;
    map.set(key, existing);
  });

  metrics.monthly.chargesMonthly.forEach((point) => {
    const key = point.date.slice(0, 7);
    const existing = map.get(key) ?? emptyRow(point.date);
    existing.grossChargesUsd = point.amountCents / 100;
    existing.netSpendUsd = existing.grossChargesUsd - existing.refundsUsd;
    map.set(key, existing);
  });

  metrics.monthly.refundsMonthly.forEach((point) => {
    const key = point.date.slice(0, 7);
    const existing = map.get(key) ?? emptyRow(point.date);
    existing.refundsUsd = point.amountCents / 100;
    existing.netSpendUsd = existing.grossChargesUsd - existing.refundsUsd;
    map.set(key, existing);
  });

  return Array.from(map.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6)
    .reverse();
}
