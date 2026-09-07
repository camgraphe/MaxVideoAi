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
import { PricingAdminError } from '../frontend/server/pricing-admin/errors';

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

test('retired membership update and rollback refuse preview and confirmation before any dependency work', async () => {
  for (const operation of ['update', 'rollback'] as const) {
    for (const databaseStatus of ['loaded', 'unavailable'] as const) {
      const harness = buildHarness({ databaseStatus });
      const proposal = operation === 'update'
        ? { operation, tiers: DEFAULT_MEMBERSHIP_TIERS }
        : { operation, targetId: 'membership-tiers', eventId: 'historical-event' };
      const retired = (error: unknown) => error instanceof PricingAdminError
        && error.code === 'membership_retired' && error.status === 410;
      await assert.rejects(previewMembershipChange(proposal, harness.deps), retired);
      await assert.rejects(confirmMembershipChange(proposal, 'old-preview', ACTOR_ID, harness.deps), retired);
      assert.deepEqual(harness.order, []);
    }
  }
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
