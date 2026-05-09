import type { AdminMetrics } from '@/lib/admin/types';
import type { FunnelStep, SmallStat } from './insights-types';
import { formatAverage, formatDays, formatNumber, formatPercent } from './insights-formatters';

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
