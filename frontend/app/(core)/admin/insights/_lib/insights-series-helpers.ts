import type { AdminMetrics, AdminMetricsComparison, AmountSeriesPoint, TimeSeriesPoint } from '@/lib/admin/types';
import type { ChartTheme, DeltaSnapshot, FocusMetric, FocusMetricData, SmallStat } from './insights-types';
import {
  formatAverage,
  formatAverageTicket,
  formatCurrency,
  formatDay,
  formatDeltaLabel,
  formatNumber,
  resolveDeltaTone,
} from './insights-formatters';

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
      description: 'Sum of daily active accounts. An account active on several days is counted on each day.',
      theme: CHART_THEMES.active,
      currentPoints: comparison.current.activeAccountsDaily.map((point) => ({
        date: point.date,
        label: formatDay(point.date),
        value: point.value,
      })),
      previousPoints: comparison.previous.activeAccountsDaily.map((point) => ({
        date: point.date,
        label: formatDay(point.date),
        value: point.value,
      })),
      valueKind: 'count',
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
      description: 'Daily wallet loads, including manual credits.',
      theme: CHART_THEMES.topups,
      currentPoints: comparison.current.topupsDaily.map((point) => ({
        date: point.date,
        label: formatDay(point.date),
        value: point.amountCents / 100,
      })),
      previousPoints: comparison.previous.topupsDaily.map((point) => ({
        date: point.date,
        label: formatDay(point.date),
        value: point.amountCents / 100,
      })),
      valueKind: 'currency',
      stats: buildAmountSeriesStats(comparison.current.topupsDaily, comparison.previous.topupsDaily, humanRange, 'loads'),
    };
  }

  if (focus === 'charges') {
    return {
      key: 'charges',
      label: 'Gross render charges',
      description: 'Daily generation charges before refunds. Refunds and net spend appear in the wallet table.',
      theme: CHART_THEMES.charges,
      currentPoints: comparison.current.chargesDaily.map((point) => ({
        date: point.date,
        label: formatDay(point.date),
        value: point.amountCents / 100,
      })),
      previousPoints: comparison.previous.chargesDaily.map((point) => ({
        date: point.date,
        label: formatDay(point.date),
        value: point.amountCents / 100,
      })),
      valueKind: 'currency',
      stats: buildAmountSeriesStats(comparison.current.chargesDaily, comparison.previous.chargesDaily, humanRange, 'gross debits'),
    };
  }

  return {
    key: 'signups',
    label: 'Signups per day',
    description: 'Daily signups recorded in synchronized account profiles.',
    theme: CHART_THEMES.signups,
    currentPoints: comparison.current.signupsDaily.map((point) => ({
      date: point.date,
      label: formatDay(point.date),
      value: point.value,
    })),
    previousPoints: comparison.previous.signupsDaily.map((point) => ({
      date: point.date,
      label: formatDay(point.date),
      value: point.value,
    })),
    valueKind: 'count',
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

export function summarizeWalletFlow({
  topups,
  grossCharges,
  refunds,
}: {
  topups: AmountSeriesPoint[];
  grossCharges: AmountSeriesPoint[];
  refunds: AmountSeriesPoint[];
}) {
  const topupTotals = sumAmountSeries(topups);
  const grossChargeTotals = sumAmountSeries(grossCharges);
  const refundTotals = sumAmountSeries(refunds);
  const netSpendUsd = grossChargeTotals.amountUsd - refundTotals.amountUsd;

  return {
    topups: topupTotals,
    grossCharges: grossChargeTotals,
    refunds: refundTotals,
    netSpendUsd,
    walletBalanceDeltaUsd: topupTotals.amountUsd - netSpendUsd,
  };
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
