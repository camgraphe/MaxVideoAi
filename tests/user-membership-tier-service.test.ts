import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import type { QueryExecutor } from '../frontend/src/lib/db';
import type { MembershipTierConfig } from '../frontend/src/lib/membership';
import {
  getUserMembershipStatus,
  resolveAuthoritativeMembershipTier,
} from '../frontend/src/server/membership/user-membership-status';

const tiers: MembershipTierConfig[] = [
  { tier: 'member', spendThresholdCents: 0, discountPercent: 0 },
  { tier: 'plus', spendThresholdCents: 5_000, discountPercent: 0.05 },
  { tier: 'pro', spendThresholdCents: 20_000, discountPercent: 0.1 },
];

test('authoritative membership tier uses standard pricing regardless of historical thresholds', () => {
  assert.equal(resolveAuthoritativeMembershipTier(0, tiers).tier, 'member');
  assert.equal(resolveAuthoritativeMembershipTier(4_999, tiers).tier, 'member');
  assert.equal(resolveAuthoritativeMembershipTier(5_000, tiers).tier, 'member');
  assert.equal(resolveAuthoritativeMembershipTier(19_999, tiers).tier, 'member');
  assert.equal(resolveAuthoritativeMembershipTier(20_000, tiers).tier, 'member');
});

test('membership status reads only the user-scoped rolling receipt ledger and returns pricing provenance', async () => {
  const calls: Array<{ sql: string; params?: ReadonlyArray<unknown> }> = [];
  const executor: QueryExecutor = {
    async query<TRecord>(sql, params) {
      calls.push({ sql, params });
      return [{ sum_30: '7250', sum_today: '125' }] as TRecord[];
    },
  };
  const status = await getUserMembershipStatus('user-1', {
    executor,
    getMembershipTiers: async () => tiers,
  });

  assert.deepEqual(status.pricing, {
    tier: 'member',
    source: 'app_receipts_rolling_30d',
    spent30Cents: 7_250,
    thresholdCents: 0,
    discountPercent: 0,
  });
  assert.equal(status.spentTodayCents, 125);
  assert.deepEqual(status.tiers, []);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, ['user-1']);
  assert.match(calls[0].sql, /FROM app_receipts/i);
  assert.match(calls[0].sql, /WHERE user_id = \$1/i);
  assert.match(calls[0].sql, /interval '30 days'/i);
  assert.match(calls[0].sql, /type = 'charge'[\s\S]*type = 'refund'/i);
  assert.doesNotMatch(calls[0].sql, /prompt|reference|provider|token/i);
});

test('membership lookup fails closed for malformed spend and account inputs, but ignores retired tier configuration', async () => {
  const executor = (row: Record<string, unknown>): QueryExecutor => ({
    async query<TRecord>() {
      return [row] as TRecord[];
    },
  });
  await assert.rejects(
    getUserMembershipStatus('user-1', {
      executor: executor({ sum_30: 'not-money', sum_today: '0' }),
      getMembershipTiers: async () => tiers,
    }),
    /membership/i,
  );
  const retired = await getUserMembershipStatus('user-1', {
    executor: executor({ sum_30: '90000', sum_today: '20' }),
    getMembershipTiers: async () => { throw new Error('Dormant tiers must never be loaded'); },
  });
  assert.equal(retired.pricing.tier, 'member');
  assert.equal(retired.pricing.discountPercent, 0);
  assert.equal(retired.spent30Cents, 90000);
  await assert.rejects(
    getUserMembershipStatus(' ', {
      executor: executor({ sum_30: '0', sum_today: '0' }),
      getMembershipTiers: async () => tiers,
    }),
    /membership/i,
  );
});

test('member-status and visitor adapters delegate to the shared server-owned tier calculation', () => {
  const route = readFileSync('frontend/app/api/member-status/route.ts', 'utf8');
  const visitor = readFileSync('frontend/server/visitor-workspace.ts', 'utf8');
  assert.match(route, /getUserMembershipStatus\(userId\)/);
  assert.doesNotMatch(route, /FROM app_receipts|SUM\(|getMembershipTiers/);
  assert.match(visitor, /resolveAuthoritativeMembershipTier\(spent30Cents, tiers\)/);
  assert.doesNotMatch(visitor, /function resolveActiveTier/);
});
