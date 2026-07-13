import assert from 'node:assert/strict';
import test from 'node:test';

import type { PricingPolicyRule } from '@maxvideoai/pricing';

import type {
  InsertPricingChangeEventInput,
  PricingChangeEvent,
} from '../frontend/lib/admin/pricing-change-contract';
import type { QueryExecutor } from '../frontend/src/lib/db';
import {
  DEFAULT_MEMBERSHIP_TIERS,
  upsertMembershipTiersWithExecutor,
  type MembershipTierConfig,
} from '../frontend/src/lib/membership';
import {
  confirmMembershipChange,
  loadMembershipHistory,
  loadMembershipInventory,
  previewMembershipChange,
  type MembershipPricingServiceDependencies,
} from '../frontend/server/pricing-admin/membership-service';

const ACTOR_ID = '00000000-0000-0000-0000-000000000005';

function cloneTiers(tiers: MembershipTierConfig[]): MembershipTierConfig[] {
  return tiers.map((tier) => ({ ...tier }));
}

function eventFromInput(input: InsertPricingChangeEventInput, id: string): PricingChangeEvent {
  return {
    id,
    ...input,
    createdAt: '2026-07-13T10:00:00.000Z',
  };
}

function buildHarness(input: {
  tiers?: MembershipTierConfig[];
  databaseStatus?: 'loaded' | 'unavailable';
  rules?: PricingPolicyRule[];
} = {}) {
  let tiers = cloneTiers(input.tiers ?? DEFAULT_MEMBERSHIP_TIERS);
  let rules = (input.rules ?? []).map((rule) => ({ ...rule }));
  const events: PricingChangeEvent[] = [];
  const order: string[] = [];
  let inTransaction = false;
  const executor: QueryExecutor = { query: async () => [] };

  const deps: MembershipPricingServiceDependencies = {
    loadTiers: async () => {
      order.push(inTransaction ? 'load-tiers:transaction' : 'load-tiers:preview');
      return input.databaseStatus === 'unavailable'
        ? { status: 'unavailable', tiers: cloneTiers(DEFAULT_MEMBERSHIP_TIERS) }
        : { status: 'loaded', tiers: cloneTiers(tiers) };
    },
    loadRules: async () => ({
      status: input.databaseStatus ?? 'loaded',
      rules: rules.map((rule) => ({ ...rule })),
      routingRules: [],
      warnings: [],
    }),
    getEvent: async (id, domain) => events.find((event) => event.id === id && event.domain === domain) ?? null,
    listEvents: async (filter) => events.filter((event) => event.domain === filter?.domain),
    withTransaction: async (callback) => {
      order.push('transaction:begin');
      inTransaction = true;
      try {
        const result = await callback(executor);
        order.push('transaction:commit');
        return result;
      } finally {
        inTransaction = false;
      }
    },
    upsertTiers: async (receivedExecutor, nextTiers, actorId) => {
      assert.equal(receivedExecutor, executor);
      assert.equal(inTransaction, true);
      assert.equal(actorId, ACTOR_ID);
      order.push('tiers:upsert');
      tiers = cloneTiers(nextTiers);
      return cloneTiers(tiers);
    },
    insertEvent: async (receivedExecutor, eventInput) => {
      assert.equal(receivedExecutor, executor);
      assert.equal(inTransaction, true);
      order.push('event:insert');
      const event = eventFromInput(eventInput, `event-${events.length + 1}`);
      events.push(event);
      return event;
    },
    invalidateCache: () => {
      assert.equal(inTransaction, false);
      order.push('cache:invalidate');
    },
    revalidate: () => {
      assert.equal(inTransaction, false);
      order.push('paths:revalidate');
    },
  };

  return {
    deps,
    events,
    order,
    get tiers() {
      return cloneTiers(tiers);
    },
    setRules(nextRules: PricingPolicyRule[]) {
      rules = nextRules.map((rule) => ({ ...rule }));
    },
  };
}

const CONCURRENT_GLOBAL_RULE: PricingPolicyRule = {
  id: 'concurrent-global',
  marginPercent: 0.31,
  marginFlatCents: 0,
  surchargeAudioPercent: 0.2,
  surchargeUpscalePercent: 0.5,
  currency: 'USD',
  compatibilityProfile: 'standard',
};

test('membership inventory exposes exactly the canonical member, plus, and pro tiers', async () => {
  const harness = buildHarness();
  const inventory = await loadMembershipInventory(harness.deps);

  assert.equal(inventory.databaseStatus, 'loaded');
  assert.deepEqual(inventory.tiers, DEFAULT_MEMBERSHIP_TIERS);
  assert.deepEqual(inventory.tiers.map((tier) => tier.tier), ['member', 'plus', 'pro']);
});

test('membership proposals require exactly three unique canonical tiers', async () => {
  const harness = buildHarness();
  const missingPro = DEFAULT_MEMBERSHIP_TIERS.filter((tier) => tier.tier !== 'pro');
  const duplicateMember = [
    DEFAULT_MEMBERSHIP_TIERS[0]!,
    DEFAULT_MEMBERSHIP_TIERS[0]!,
    DEFAULT_MEMBERSHIP_TIERS[2]!,
  ];
  const unknown = [
    DEFAULT_MEMBERSHIP_TIERS[0]!,
    DEFAULT_MEMBERSHIP_TIERS[1]!,
    { tier: 'enterprise', spendThresholdCents: 20_000, discountPercent: 0.1 },
  ];

  await assert.rejects(() => previewMembershipChange({ tiers: missingPro }, harness.deps), /exactly member, plus, and pro/i);
  await assert.rejects(() => previewMembershipChange({ tiers: duplicateMember }, harness.deps), /exactly member, plus, and pro/i);
  await assert.rejects(() => previewMembershipChange({ tiers: unknown }, harness.deps), /exactly member, plus, and pro/i);
});

test('membership proposals reject negative, unordered, fractional thresholds and discounts outside [0, 1]', async () => {
  const harness = buildHarness();
  const cases: MembershipTierConfig[][] = [
    [
      { tier: 'member', spendThresholdCents: -1, discountPercent: 0 },
      DEFAULT_MEMBERSHIP_TIERS[1]!,
      DEFAULT_MEMBERSHIP_TIERS[2]!,
    ],
    [
      DEFAULT_MEMBERSHIP_TIERS[0]!,
      { tier: 'plus', spendThresholdCents: 20_001, discountPercent: 0.05 },
      DEFAULT_MEMBERSHIP_TIERS[2]!,
    ],
    [
      DEFAULT_MEMBERSHIP_TIERS[0]!,
      { tier: 'plus', spendThresholdCents: 5_000.5, discountPercent: 0.05 },
      DEFAULT_MEMBERSHIP_TIERS[2]!,
    ],
    [
      DEFAULT_MEMBERSHIP_TIERS[0]!,
      { tier: 'plus', spendThresholdCents: 5_000, discountPercent: 1.01 },
      DEFAULT_MEMBERSHIP_TIERS[2]!,
    ],
  ];

  for (const tiers of cases) {
    await assert.rejects(() => previewMembershipChange({ tiers }, harness.deps), /threshold|discount/i);
  }
});

test('membership preview normalizes discount precision exactly like persistence', async () => {
  const harness = buildHarness();
  const proposed = cloneTiers(DEFAULT_MEMBERSHIP_TIERS);
  proposed[1] = { ...proposed[1]!, discountPercent: 0.05000009 };

  const preview = await previewMembershipChange({ tiers: proposed }, harness.deps);
  const proposedState = preview.proposedState as Array<{ tier: string; discountPercent: number }>;

  assert.equal(proposedState.find((tier) => tier.tier === 'plus')?.discountPercent, 0.05);
  assert.equal(preview.rows.length, 0);
});

test('discount preview reports canonical current and proposed totals only for affected tiers', async () => {
  const harness = buildHarness();
  const proposed = cloneTiers(DEFAULT_MEMBERSHIP_TIERS);
  proposed[1] = { ...proposed[1]!, discountPercent: 0.06 };

  const preview = await previewMembershipChange({ tiers: proposed }, harness.deps);

  assert.equal(preview.domain, 'membership');
  assert.equal(preview.operation, 'update');
  assert.ok(preview.rows.length > 0);
  assert.ok(preview.rows.every((row) => row.scenarioId.includes(':plus')));
  assert.ok(preview.rows.some((row) => row.currentTotalCents !== row.proposedTotalCents));
  assert.ok(preview.affectedScenarioIds.every((scenarioId) => scenarioId.includes(':plus')));
});

test('threshold-only change produces an explicit eligibility preview row even when totals do not change', async () => {
  const harness = buildHarness();
  const proposed = cloneTiers(DEFAULT_MEMBERSHIP_TIERS);
  proposed[1] = { ...proposed[1]!, spendThresholdCents: 6_000 };

  const preview = await previewMembershipChange({ tiers: proposed }, harness.deps);

  assert.deepEqual(preview.rows.map((row) => row.scenarioId), ['membership-eligibility:plus']);
  assert.equal(preview.rows[0]?.currentTotalCents, preview.rows[0]?.proposedTotalCents);
  assert.match(preview.warnings.join('\n'), /threshold.*5,000.*6,000/i);
});

test('threshold-only preview becomes stale when its displayed eligibility quote changes concurrently', async () => {
  const harness = buildHarness();
  const proposed = cloneTiers(DEFAULT_MEMBERSHIP_TIERS);
  proposed[1] = { ...proposed[1]!, spendThresholdCents: 6_000 };
  const proposal = { tiers: proposed };
  const preview = await previewMembershipChange(proposal, harness.deps);

  harness.setRules([CONCURRENT_GLOBAL_RULE]);

  await assert.rejects(
    () => confirmMembershipChange(proposal, preview.previewFingerprint, ACTOR_ID, harness.deps),
    (error: unknown) => error instanceof Error && /stale/i.test(error.message)
  );
  assert.equal(harness.events.length, 0);
});

test('confirmation recomputes the fingerprint, persists all tiers and one immutable event transactionally', async () => {
  const harness = buildHarness();
  const proposed = cloneTiers(DEFAULT_MEMBERSHIP_TIERS);
  proposed[2] = { ...proposed[2]!, discountPercent: 0.11 };
  const proposal = { tiers: proposed };
  const preview = await previewMembershipChange(proposal, harness.deps);

  const confirmation = await confirmMembershipChange(proposal, preview.previewFingerprint, ACTOR_ID, harness.deps);

  assert.equal(confirmation.committed, true);
  assert.deepEqual(harness.tiers, proposed);
  assert.equal(harness.events.length, 1);
  assert.equal(harness.events[0]?.actorId, ACTOR_ID);
  assert.equal(harness.events[0]?.domain, 'membership');
  assert.equal(harness.events[0]?.operation, 'update');
  assert.equal(
    harness.events[0]?.previewSummary.deltaCents,
    preview.rows.reduce((sum, row) => sum + row.deltaCents, 0)
  );
  assert.deepEqual(harness.events[0]?.previousState, DEFAULT_MEMBERSHIP_TIERS);
  assert.deepEqual(harness.events[0]?.nextState, proposed);
  assert.deepEqual(harness.order.slice(-5), [
    'tiers:upsert',
    'event:insert',
    'transaction:commit',
    'cache:invalidate',
    'paths:revalidate',
  ]);
});

test('confirmation rejects a stale preview before persistence', async () => {
  const harness = buildHarness();
  const proposed = cloneTiers(DEFAULT_MEMBERSHIP_TIERS);
  proposed[1] = { ...proposed[1]!, discountPercent: 0.06 };

  await assert.rejects(
    () => confirmMembershipChange({ tiers: proposed }, 'stale-fingerprint', ACTOR_ID, harness.deps),
    (error: unknown) => error instanceof Error && error.message.toLowerCase().includes('stale')
  );
  assert.equal(harness.order.includes('transaction:begin'), false);
  assert.equal(harness.events.length, 0);
});

test('preview and confirmation reject unavailable membership persistence', async () => {
  const harness = buildHarness({ databaseStatus: 'unavailable' });

  await assert.rejects(
    () => previewMembershipChange({ tiers: DEFAULT_MEMBERSHIP_TIERS }, harness.deps),
    (error: unknown) => error instanceof Error && /unavailable/i.test(error.message)
  );
  assert.equal(harness.events.length, 0);
});

test('rollback derives tiers from immutable event state and appends a rollback event', async () => {
  const harness = buildHarness();
  const changed = cloneTiers(DEFAULT_MEMBERSHIP_TIERS);
  changed[2] = { ...changed[2]!, discountPercent: 0.11 };
  const firstPreview = await previewMembershipChange({ tiers: changed }, harness.deps);
  await confirmMembershipChange({ tiers: changed }, firstPreview.previewFingerprint, ACTOR_ID, harness.deps);

  const rollbackProposal = {
    operation: 'rollback' as const,
    targetId: 'membership-tiers',
    eventId: harness.events[0]!.id,
  };
  const rollbackPreview = await previewMembershipChange(rollbackProposal, harness.deps);
  assert.deepEqual(rollbackPreview.proposedState, DEFAULT_MEMBERSHIP_TIERS);
  assert.equal(rollbackPreview.rollbackEventId, harness.events[0]!.id);

  await confirmMembershipChange(rollbackProposal, rollbackPreview.previewFingerprint, ACTOR_ID, harness.deps);
  assert.deepEqual(harness.tiers, DEFAULT_MEMBERSHIP_TIERS);
  assert.equal(harness.events.length, 2);
  assert.equal(harness.events[1]?.operation, 'rollback');
});

test('rollback rejects a client target that does not match membership history', async () => {
  const harness = buildHarness();
  harness.events.push(eventFromInput({
    domain: 'membership',
    operation: 'update',
    targetId: 'membership-tiers',
    actorId: ACTOR_ID,
    previousState: DEFAULT_MEMBERSHIP_TIERS,
    nextState: DEFAULT_MEMBERSHIP_TIERS,
    previewSummary: {},
    affectedScenarioIds: [],
  }, 'rollback-source'));

  await assert.rejects(
    () => previewMembershipChange(
      { operation: 'rollback', targetId: 'different-target', eventId: 'rollback-source' },
      harness.deps
    ),
    /not found/i
  );
});

test('rollback fingerprint cannot be substituted between events with identical previous state', async () => {
  const harness = buildHarness();
  for (const id of ['rollback-source-a', 'rollback-source-b']) {
    harness.events.push(eventFromInput({
      domain: 'membership',
      operation: 'update',
      targetId: 'membership-tiers',
      actorId: ACTOR_ID,
      previousState: DEFAULT_MEMBERSHIP_TIERS,
      nextState: DEFAULT_MEMBERSHIP_TIERS,
      previewSummary: {},
      affectedScenarioIds: [],
    }, id));
  }
  const preview = await previewMembershipChange(
    { operation: 'rollback', targetId: 'membership-tiers', eventId: 'rollback-source-a' },
    harness.deps
  );

  await assert.rejects(
    () => confirmMembershipChange(
      { operation: 'rollback', targetId: 'membership-tiers', eventId: 'rollback-source-b' },
      preview.previewFingerprint,
      ACTOR_ID,
      harness.deps
    ),
    (error: unknown) => error instanceof Error && /stale/i.test(error.message)
  );
  assert.equal(harness.events.length, 2);
});

test('membership history is fixed to the membership domain', async () => {
  const harness = buildHarness();
  await loadMembershipHistory({ limit: 25 }, harness.deps);
  const event = eventFromInput({
    domain: 'membership',
    operation: 'update',
    targetId: 'membership-tiers',
    actorId: ACTOR_ID,
    previousState: DEFAULT_MEMBERSHIP_TIERS,
    nextState: DEFAULT_MEMBERSHIP_TIERS,
    previewSummary: {},
    affectedScenarioIds: [],
  }, 'history-event');
  harness.events.push(event);
  assert.deepEqual(await loadMembershipHistory({}, harness.deps), [event]);
});

test('executor-aware persistence writes every tier with the server actor and does not touch caches', async () => {
  const queries: Array<{ sql: string; params?: ReadonlyArray<unknown> }> = [];
  const executor: QueryExecutor = {
    query: async (sql, params) => {
      queries.push({ sql, params });
      return [];
    },
  };

  const persisted = await upsertMembershipTiersWithExecutor(
    executor,
    DEFAULT_MEMBERSHIP_TIERS,
    ACTOR_ID
  );

  assert.deepEqual(persisted, DEFAULT_MEMBERSHIP_TIERS);
  assert.equal(queries.length, 3);
  assert.deepEqual(queries.map((entry) => entry.params?.at(-1)), [ACTOR_ID, ACTOR_ID, ACTOR_ID]);
  assert.ok(queries.every((entry) => /ON CONFLICT \(tier\)/.test(entry.sql)));
});
