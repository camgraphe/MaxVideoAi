import assert from 'node:assert/strict';
import test from 'node:test';
import type { AdminMetrics, AdminMetricsComparison } from '../frontend/lib/admin/types';
import { buildEmptyMetrics } from '../frontend/server/admin-metrics/admin-metrics-helpers';
import { buildMemberPulseItems } from '../frontend/app/(core)/admin/users/[userId]/_lib/admin-user-detail-metrics';
import { buildExecutiveMetrics } from '../frontend/app/(core)/admin/insights/_lib/insights-executive-helpers';
import {
  buildMonthlyRows,
  buildRecentLedgerRows,
  buildRevenueBoardRows,
} from '../frontend/app/(core)/admin/insights/_lib/insights-revenue-helpers';

const range = {
  label: '24h' as const,
  days: 1,
  from: '2026-08-26T00:00:00.000Z',
  to: '2026-08-26T12:00:00.000Z',
};

const currentDate = '2026-08-26T00:00:00.000Z';
const previousDate = '2026-08-25T00:00:00.000Z';

const metrics = {
  totals: {
    totalAccounts: 1,
    payingAccounts: 1,
    activeAccounts30d: 1,
    allTimeTopUpsUsd: 100,
    allTimeRenderChargesUsd: 150,
    allTimeRefundsUsd: 100,
    allTimeNetRenderSpendUsd: 50,
  },
  range,
  timeseries: {
    signupsDaily: [{ date: currentDate, value: 1 }],
    activeAccountsDaily: [{ date: currentDate, value: 1 }],
    topupsDaily: [{ date: currentDate, count: 1, amountCents: 10_000 }],
    chargesDaily: [{ date: currentDate, count: 2, amountCents: 15_000 }],
    refundsDaily: [{ date: currentDate, count: 1, amountCents: 10_000 }],
  },
  monthly: {
    signupsMonthly: [{ date: currentDate, value: 1 }],
    topupsMonthly: [{ date: currentDate, count: 1, amountCents: 10_000 }],
    chargesMonthly: [{ date: currentDate, count: 2, amountCents: 15_000 }],
    refundsMonthly: [{ date: currentDate, count: 1, amountCents: 10_000 }],
  },
  engines: [],
  funnels: {
    signupToTopUpConversion: 1,
    totalTopupUsers: 1,
    topUpToRenderConversion30d: 1,
    convertedWithin30dUsers: 1,
    avgTimeSignupToFirstTopUpDays: 0,
    avgTimeTopUpToFirstRenderDays: 0,
  },
  behavior: {
    avgRendersPerPayingUser30d: 1,
    medianRendersPerPayingUser30d: 1,
    returningUsers7d: 1,
    whalesTop10: [],
  },
  health: {
    failedRenders30d: 0,
    failedRendersRate30d: 0,
    failedByEngine30d: [],
  },
} as unknown as AdminMetrics;

const comparison = {
  range,
  current: {
    signupsDaily: [{ date: currentDate, value: 1 }],
    activeAccountsDaily: [{ date: currentDate, value: 1 }],
    topupsDaily: [{ date: currentDate, count: 1, amountCents: 10_000 }],
    chargesDaily: [{ date: currentDate, count: 2, amountCents: 15_000 }],
    refundsDaily: [{ date: currentDate, count: 1, amountCents: 10_000 }],
  },
  previous: {
    signupsDaily: [{ date: previousDate, value: 1 }],
    activeAccountsDaily: [{ date: previousDate, value: 1 }],
    topupsDaily: [{ date: previousDate, count: 1, amountCents: 8_000 }],
    chargesDaily: [{ date: previousDate, count: 2, amountCents: 10_000 }],
    refundsDaily: [{ date: previousDate, count: 1, amountCents: 4_000 }],
  },
} as unknown as AdminMetricsComparison;

test('empty admin metrics expose zeroed refunds and net spend', () => {
  const empty = buildEmptyMetrics(range);

  assert.equal(empty.totals.allTimeRefundsUsd, 0);
  assert.equal(empty.totals.allTimeNetRenderSpendUsd, 0);
  assert.deepEqual(empty.timeseries.refundsDaily, [
    { date: range.to, count: 0, amountCents: 0 },
  ]);
  assert.deepEqual(empty.monthly.refundsMonthly, []);
});

test('admin insights distinguish gross charges, refunds, net spend, and wallet balance delta', () => {
  const executive = new Map(
    buildExecutiveMetrics(metrics, comparison, '24 hours').map((item) => [item.label, item])
  );

  assert.equal(executive.get('Gross render charges')?.value, '$150');
  assert.equal(executive.get('Refunds')?.value, '$100');
  assert.equal(executive.get('Net render spend')?.value, '$50');
  assert.equal(executive.get('Wallet balance delta')?.value, '+$50');

  const board = new Map(buildRevenueBoardRows(comparison).map((row) => [row.label, row]));
  assert.equal(board.get('Gross render charges')?.current, '$150');
  assert.equal(board.get('Refunds')?.current, '$100');
  assert.equal(board.get('Net render spend')?.current, '$50');
  assert.equal(board.get('Wallet balance delta')?.current, '+$50');
});

test('admin user detail exposes gross charges, refunds, and net spend as separate metrics', () => {
  const items = buildMemberPulseItems({
    userId: 'user-1',
    profile: null,
    wallet: { balanceCents: 5_000, stats: {} },
    usage: null,
    lifetimeTopupsUsd: 100,
    lifetimeChargesUsd: 150,
    lifetimeRefundsUsd: 100,
    lifetimeNetSpendUsd: 50,
  } as Parameters<typeof buildMemberPulseItems>[0] & {
    lifetimeRefundsUsd: number;
    lifetimeNetSpendUsd: number;
  });
  const byLabel = new Map(items.map((item) => [item.label, item.value]));

  assert.equal(byLabel.get('Lifetime top-ups'), '$100.00');
  assert.equal(byLabel.get('Gross charges'), '$150.00');
  assert.equal(byLabel.get('Refunds'), '$100.00');
  assert.equal(byLabel.get('Net render spend'), '$50.00');
});

test('daily and monthly ledger rows expose refunds and net render spend', () => {
  assert.deepEqual(buildRecentLedgerRows(metrics), [
    {
      date: '2026-08-26',
      signups: 1,
      active: 1,
      topupsUsd: 100,
      grossChargesUsd: 150,
      refundsUsd: 100,
      netSpendUsd: 50,
    },
  ]);

  assert.deepEqual(buildMonthlyRows(metrics), [
    {
      month: currentDate,
      signups: 1,
      topupsUsd: 100,
      grossChargesUsd: 150,
      refundsUsd: 100,
      netSpendUsd: 50,
    },
  ]);
});
