import assert from 'node:assert/strict';
import test from 'node:test';

import type { PricingPolicyRule } from '@maxvideoai/pricing';
import type { QueryExecutor } from '../frontend/src/lib/db.ts';
import type {
  InsertPricingChangeEventInput,
  ListPricingChangeEventsInput,
  PricingChangeEvent,
} from '../frontend/lib/admin/pricing-change-contract.ts';
import { PricingAdminError } from '../frontend/server/pricing-admin/errors.ts';
import {
  confirmPricingPolicyChange,
  deriveRequestedPricingSurcharges,
  loadPricingPolicyHistory,
  loadPricingPolicyInventory,
  previewPricingPolicyChange,
  type PricingPolicyChangeProposal,
  type PricingPolicyServiceDependencies,
} from '../frontend/server/pricing-admin/policy-service.ts';
import { revalidatePricingChangeSurfaces } from '../frontend/server/pricing-admin/revalidation.ts';
import type { PricingRule } from '../frontend/src/lib/pricing-rule-store.ts';

const actorId = '00000000-0000-0000-0000-000000000001';

function policyRule(id: string, overrides: Partial<PricingPolicyRule> = {}): PricingPolicyRule {
  return {
    id,
    engineId: 'kling-3-pro',
    mode: 't2v',
    resolution: '1080p',
    marginPercent: 0.3,
    marginFlatCents: 0,
    surchargeAudioPercent: 0.2,
    surchargeUpscalePercent: 0.5,
    currency: 'USD',
    compatibilityProfile: 'standard',
    ...overrides,
  };
}

type MemoryHarness = {
  deps: PricingPolicyServiceDependencies;
  rules: PricingRule[];
  events: PricingChangeEvent[];
  order: string[];
  persistActors: string[];
  invalidateCalls: number;
  revalidateCalls: number;
  failEventInsert: boolean;
  failInvalidate: boolean;
  failRevalidate: boolean;
  transactionMutator: (() => void) | null;
  transactionLocalReads: number;
};

function cloneRule<T extends PricingPolicyRule | PricingRule>(value: T): T {
  return { ...value };
}

function createMemoryHarness(initialRules: PricingRule[] = [], initialEvents: PricingChangeEvent[] = []): MemoryHarness {
  const harness = {
    rules: initialRules.map(cloneRule),
    events: initialEvents.map((event) => ({ ...event })),
    order: [] as string[],
    persistActors: [] as string[],
    invalidateCalls: 0,
    revalidateCalls: 0,
    failEventInsert: false,
    failInvalidate: false,
    failRevalidate: false,
    transactionMutator: null,
    transactionLocalReads: 0,
  } as MemoryHarness;
  const executor: QueryExecutor = { query: async () => [] };

  harness.deps = {
    loadOverrides: async (transactionExecutor) => {
      if (transactionExecutor) harness.transactionLocalReads += 1;
      return {
        status: 'loaded',
        rules: harness.rules.map(({ vendorAccountId: _vendor, effectiveFrom: _effective, updatedAt: _at, updatedBy: _by, ...rule }) => rule),
        routingRules: harness.rules.map(cloneRule),
      };
    },
    getEvent: async (eventId, domain) =>
      harness.events.find((event) => event.id === eventId && event.domain === domain) ?? null,
    listEvents: async (filter: ListPricingChangeEventsInput = {}) =>
      harness.events
        .filter((event) => !filter.domain || event.domain === filter.domain)
        .filter((event) => !filter.targetId || event.targetId === filter.targetId)
        .slice(0, filter.limit ?? 50)
        .map((event) => ({ ...event })),
    withTransaction: async (callback) => {
      harness.transactionMutator?.();
      harness.transactionMutator = null;
      const rulesBefore = harness.rules.map(cloneRule);
      const eventsBefore = harness.events.map((event) => ({ ...event }));
      harness.order.push('transaction:start');
      try {
        const result = await callback(executor);
        harness.order.push('transaction:commit');
        return result;
      } catch (error) {
        harness.rules.splice(0, harness.rules.length, ...rulesBefore);
        harness.events.splice(0, harness.events.length, ...eventsBefore);
        harness.order.push('transaction:rollback');
        throw error;
      }
    },
    upsertRule: async (_executor, rule, serverActorId) => {
      harness.order.push('rule:upsert');
      harness.persistActors.push(serverActorId);
      const existingIndex = harness.rules.findIndex((candidate) => candidate.id === rule.id);
      const existing = existingIndex >= 0 ? harness.rules[existingIndex] : undefined;
      const persisted: PricingRule = {
        ...rule,
        ...(existing?.vendorAccountId ? { vendorAccountId: existing.vendorAccountId } : {}),
        updatedBy: serverActorId,
      };
      if (existingIndex >= 0) harness.rules[existingIndex] = persisted;
      else harness.rules.push(persisted);
      return cloneRule(persisted);
    },
    deleteRule: async (_executor, id) => {
      harness.order.push('rule:delete');
      const index = harness.rules.findIndex((candidate) => candidate.id === id);
      if (index < 0) throw new Error('Pricing rule not found');
      return harness.rules.splice(index, 1)[0]!;
    },
    insertEvent: async (_executor, input: InsertPricingChangeEventInput) => {
      harness.order.push('event:insert');
      if (harness.failEventInsert) throw new Error('event failed');
      const event: PricingChangeEvent = {
        ...input,
        id: `event-${harness.events.length + 1}`,
        createdAt: '2026-07-13T00:00:00.000Z',
      };
      harness.events.unshift(event);
      return { ...event };
    },
    invalidateCache: () => {
      harness.order.push('cache:invalidate');
      harness.invalidateCalls += 1;
      if (harness.failInvalidate) throw new Error('cache invalidation failed');
    },
    revalidate: () => {
      harness.order.push('paths:revalidate');
      harness.revalidateCalls += 1;
      if (harness.failRevalidate) throw new Error('path revalidation failed');
    },
  };
  return harness;
}

test('create preview normalizes the complete rule and quotes through the canonical projector', async () => {
  const harness = createMemoryHarness();
  const preview = await previewPricingPolicyChange(
    {
      operation: 'create',
      rule: {
        ...policyRule(' db-kling '),
        id: ' db-kling ',
        engineId: ' kling-3-pro ',
        mode: ' t2v ',
        resolution: ' 1080p ',
        currency: ' usd ',
      },
    },
    harness.deps
  );

  assert.equal(preview.operation, 'create');
  assert.equal(preview.currentState, null);
  assert.deepEqual(preview.proposedState, policyRule('db-kling'));
  assert.ok(preview.rows.length > 0);
  assert.ok(preview.affectedScenarioIds.length > 0);
  assert.match(preview.previewFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(harness.rules.length, 0, 'preview must not persist');
});

test('update and delete previews use fresh database state and default deletion is forbidden', async () => {
  const existing = policyRule('db-kling');
  const harness = createMemoryHarness([existing]);
  const update = await previewPricingPolicyChange(
    { operation: 'update', targetId: existing.id, rule: { ...existing, marginFlatCents: 5, vendorAccountId: 'ignored' } },
    harness.deps
  );
  const deletion = await previewPricingPolicyChange({ operation: 'delete', targetId: existing.id }, harness.deps);

  assert.equal((update.currentState as Record<string, unknown>).marginFlatCents, 0);
  assert.equal((update.currentState as Record<string, unknown>).vendorAccountId, undefined);
  assert.equal((update.proposedState as Record<string, unknown>).vendorAccountId, undefined);
  assert.equal(deletion.proposedState, null);
  await assert.rejects(
    previewPricingPolicyChange({ operation: 'delete', targetId: 'default' }, harness.deps),
    (error: unknown) => error instanceof PricingAdminError && error.code === 'default_rule_delete_forbidden'
  );
});

test('delete refuses a routed row instead of silently deleting settlement routing', async () => {
  const routed = { ...policyRule('db-kling'), vendorAccountId: 'acct-routing' };
  const harness = createMemoryHarness([routed]);

  await assert.rejects(
    previewPricingPolicyChange({ operation: 'delete', targetId: routed.id }, harness.deps),
    (error: unknown) => error instanceof PricingAdminError && error.code === 'routing_conflict'
  );
  assert.equal(harness.rules[0]?.vendorAccountId, 'acct-routing');
});

test('rollback refuses to recreate routing from historical pricing state', async () => {
  const previous = { ...policyRule('db-kling'), vendorAccountId: 'acct-historical-routing' };
  const event: PricingChangeEvent = {
    id: 'event-routed-delete',
    domain: 'policy_rule',
    operation: 'delete',
    targetId: previous.id,
    actorId,
    previousState: previous,
    nextState: null,
    previewSummary: {},
    affectedScenarioIds: [],
    createdAt: '2026-07-01T00:00:00.000Z',
  };
  const harness = createMemoryHarness([], [event]);

  await assert.rejects(
    previewPricingPolicyChange({ operation: 'rollback', eventId: event.id }, harness.deps),
    (error: unknown) => error instanceof PricingAdminError && error.code === 'routing_conflict'
  );
  assert.equal(harness.rules.length, 0);
});

test('rollback derives the proposal from immutable event previousState and ignores client state', async () => {
  const current = policyRule('db-kling', { marginFlatCents: 9 });
  const previous = policyRule('db-kling', { marginFlatCents: 2 });
  const sourceEvent: PricingChangeEvent = {
    id: 'event-source',
    domain: 'policy_rule',
    operation: 'update',
    targetId: current.id,
    actorId,
    previousState: previous,
    nextState: current,
    previewSummary: {},
    affectedScenarioIds: [],
    createdAt: '2026-07-12T00:00:00.000Z',
  };
  const harness = createMemoryHarness([current], [sourceEvent]);
  const proposal = {
    operation: 'rollback',
    eventId: sourceEvent.id,
    rule: policyRule('client-forgery', { marginFlatCents: 999 }),
  } as unknown as PricingPolicyChangeProposal;

  const preview = await previewPricingPolicyChange(proposal, harness.deps);

  assert.equal(preview.targetId, current.id);
  assert.deepEqual(preview.proposedState, previous);
  assert.equal(preview.rollbackEventId, sourceEvent.id);

  const confirmation = await confirmPricingPolicyChange(
    proposal,
    preview.previewFingerprint,
    actorId,
    harness.deps
  );
  assert.equal(confirmation.event.operation, 'rollback');
  assert.equal(harness.rules[0]?.marginFlatCents, 2);
  assert.equal(harness.events.length, 2, 'rollback appends one event without rewriting history');
  assert.ok(harness.events.some((event) => event.id === sourceEvent.id));
});

test('surcharge-only previews request selector-aware canonical coverage', async () => {
  const current = policyRule('db-kling');
  const harness = createMemoryHarness([current]);
  const preview = await previewPricingPolicyChange(
    { operation: 'update', targetId: current.id, rule: { ...current, surchargeAudioPercent: 0.35 } },
    harness.deps
  );

  assert.ok(preview.rows.some((row) => row.scenarioId.startsWith('admin-surcharge:audio:kling-3-pro')));
});

test('global surcharge changes expand into engine-specific authoritative coverage requests', () => {
  const current = policyRule('db-global', {
    engineId: undefined,
    mode: undefined,
    resolution: undefined,
  });
  const proposed = { ...current, surchargeAudioPercent: 0.35, surchargeUpscalePercent: 0.6 };
  const requests = deriveRequestedPricingSurcharges({
    selector: {},
    currentRules: [current],
    proposedRules: [proposed],
  });
  const audio = requests.filter((request) => request.kind === 'audio');
  const upscale = requests.filter((request) => request.kind === 'upscale');

  assert.ok(audio.length > 1);
  assert.ok(upscale.length > 1);
  assert.ok(requests.every((request) => Boolean(request.selector.engineId)));
  assert.equal(new Set(audio.map((request) => request.selector.engineId)).size, audio.length);
  assert.equal(new Set(upscale.map((request) => request.selector.engineId)).size, upscale.length);
});

test('database unavailability fails previews explicitly and does not fall back to versioned state', async () => {
  const harness = createMemoryHarness();
  harness.deps.loadOverrides = async () => ({ status: 'unavailable', rules: [], errorCode: 'pricing_rules_query_failed' });

  await assert.rejects(
    previewPricingPolicyChange({ operation: 'create', rule: policyRule('db-kling') }, harness.deps),
    (error: unknown) => error instanceof PricingAdminError && error.code === 'database_unavailable'
  );
});

test('confirmation recomputes server state and rejects a stale fingerprint without side effects', async () => {
  const current = policyRule('db-kling');
  const harness = createMemoryHarness([current]);
  const proposal: PricingPolicyChangeProposal = {
    operation: 'update',
    targetId: current.id,
    rule: { ...current, marginFlatCents: 3 },
  };
  const preview = await previewPricingPolicyChange(proposal, harness.deps);
  harness.rules[0] = { ...harness.rules[0]!, marginPercent: 0.31 };

  await assert.rejects(
    confirmPricingPolicyChange(proposal, preview.previewFingerprint, actorId, harness.deps),
    (error: unknown) => error instanceof PricingAdminError && error.code === 'preview_stale'
  );
  assert.equal(harness.persistActors.length, 0);
  assert.equal(harness.invalidateCalls, 0);
  assert.equal(harness.revalidateCalls, 0);
});

test('confirmation fingerprint becomes stale when another relevant database override changes', async () => {
  const engineRule = policyRule('db-kling-engine', { mode: undefined, resolution: undefined, marginFlatCents: 1 });
  const current = policyRule('db-kling');
  const harness = createMemoryHarness([engineRule, current]);
  const proposal: PricingPolicyChangeProposal = {
    operation: 'update',
    targetId: current.id,
    rule: { ...current, marginFlatCents: 3 },
  };
  const preview = await previewPricingPolicyChange(proposal, harness.deps);
  harness.rules[0] = { ...harness.rules[0]!, marginFlatCents: 2 };

  await assert.rejects(
    confirmPricingPolicyChange(proposal, preview.previewFingerprint, actorId, harness.deps),
    (error: unknown) => error instanceof PricingAdminError && error.code === 'preview_stale'
  );
  assert.equal(harness.events.length, 0);
  assert.equal(harness.invalidateCalls, 0);
});

test('transaction-local preview check closes changes after outer recomputation without overwriting state', async () => {
  const current = policyRule('db-kling');
  const harness = createMemoryHarness([current]);
  const proposal: PricingPolicyChangeProposal = {
    operation: 'update',
    targetId: current.id,
    rule: { ...current, marginFlatCents: 3 },
  };
  const preview = await previewPricingPolicyChange(proposal, harness.deps);
  harness.transactionMutator = () => {
    harness.rules[0] = { ...harness.rules[0]!, marginPercent: 0.31 };
  };

  await assert.rejects(
    confirmPricingPolicyChange(proposal, preview.previewFingerprint, actorId, harness.deps),
    (error: unknown) => error instanceof PricingAdminError && error.code === 'preview_stale'
  );
  assert.equal(harness.transactionLocalReads, 1);
  assert.equal(harness.rules[0]?.marginPercent, 0.31);
  assert.equal(harness.rules[0]?.marginFlatCents, 0);
  assert.equal(harness.events.length, 0);
  assert.equal(harness.invalidateCalls, 0);
});

test('confirmation commits one actor-owned event, preserves routing, then invalidates caches and paths', async () => {
  const current = { ...policyRule('db-kling'), vendorAccountId: 'acct-routing' };
  const harness = createMemoryHarness([current]);
  const proposal: PricingPolicyChangeProposal = {
    operation: 'update',
    targetId: current.id,
    rule: { ...current, marginFlatCents: 4 },
  };
  const preview = await previewPricingPolicyChange(proposal, harness.deps);
  const confirmation = await confirmPricingPolicyChange(
    proposal,
    preview.previewFingerprint,
    actorId,
    harness.deps
  );

  assert.equal(confirmation.event.actorId, actorId);
  assert.equal(confirmation.committed, true);
  assert.deepEqual(confirmation.operationalWarnings, []);
  assert.equal(confirmation.event.operation, 'update');
  assert.equal(harness.events.length, 1);
  assert.deepEqual(harness.persistActors, [actorId]);
  assert.equal(harness.rules[0]?.vendorAccountId, 'acct-routing');
  assert.deepEqual(harness.order, [
    'transaction:start',
    'rule:upsert',
    'event:insert',
    'transaction:commit',
    'cache:invalidate',
    'paths:revalidate',
  ]);
});

test('post-commit revalidation failure returns committed success with an explicit operational warning', async () => {
  const current = policyRule('db-kling');
  const harness = createMemoryHarness([current]);
  harness.failRevalidate = true;
  const proposal: PricingPolicyChangeProposal = {
    operation: 'update',
    targetId: current.id,
    rule: { ...current, marginFlatCents: 4 },
  };
  const preview = await previewPricingPolicyChange(proposal, harness.deps);

  const confirmation = await confirmPricingPolicyChange(
    proposal,
    preview.previewFingerprint,
    actorId,
    harness.deps
  );

  assert.equal(confirmation.committed, true);
  assert.deepEqual(confirmation.operationalWarnings, [
    { code: 'path_revalidation_failed', message: 'Pricing change committed; public path revalidation failed.' },
  ]);
  assert.equal(harness.rules[0]?.marginFlatCents, 4);
  assert.equal(harness.events.length, 1);
});

test('event persistence failure rolls back the rule and performs no post-commit invalidation', async () => {
  const current = policyRule('db-kling');
  const harness = createMemoryHarness([current]);
  const proposal: PricingPolicyChangeProposal = {
    operation: 'update',
    targetId: current.id,
    rule: { ...current, marginFlatCents: 8 },
  };
  const preview = await previewPricingPolicyChange(proposal, harness.deps);
  harness.failEventInsert = true;

  await assert.rejects(
    confirmPricingPolicyChange(proposal, preview.previewFingerprint, actorId, harness.deps),
    (error: unknown) => error instanceof PricingAdminError && error.code === 'persistence_failed'
  );
  assert.equal(harness.rules[0]?.marginFlatCents, 0);
  assert.equal(harness.events.length, 0);
  assert.equal(harness.invalidateCalls, 0);
  assert.equal(harness.revalidateCalls, 0);
  assert.equal(harness.order.at(-1), 'transaction:rollback');
});

test('inventory and history expose policy provenance, routing context, representative quotes, and last event', async () => {
  const current = { ...policyRule('db-kling'), vendorAccountId: 'acct-routing' };
  const event: PricingChangeEvent = {
    id: 'event-1',
    domain: 'policy_rule',
    operation: 'create',
    targetId: current.id,
    actorId,
    previousState: null,
    nextState: current,
    previewSummary: {},
    affectedScenarioIds: [],
    createdAt: '2026-07-13T00:00:00.000Z',
  };
  const harness = createMemoryHarness([current], [event]);

  const inventory = await loadPricingPolicyInventory(harness.deps);
  const history = await loadPricingPolicyHistory({ targetId: current.id }, harness.deps);
  const row = inventory.rows.find((candidate) => candidate.databaseOverride?.id === current.id);
  const versionedOnlyRow = inventory.rows.find((candidate) => candidate.selector.engineId === 'veo-3-1');

  assert.equal(inventory.databaseStatus, 'loaded');
  assert.ok(row?.effectiveProvenance);
  assert.equal(row?.versionedRule?.id, 'default');
  assert.equal(row?.routingContext?.vendorAccountId, 'acct-routing');
  assert.ok(row?.representativeQuotes.length);
  assert.equal(row?.lastEvent?.id, event.id);
  assert.equal(versionedOnlyRow?.databaseOverride, null);
  assert.equal(versionedOnlyRow?.versionedRule?.id, 'default');
  assert.equal(versionedOnlyRow?.effectiveProvenance?.source, 'versioned');
  assert.deepEqual(history, [event]);
});

test('inventory scenario rows inherit the effective database override routing and event metadata', async () => {
  const engineRule = {
    ...policyRule('db-kling-engine', { mode: undefined, resolution: undefined }),
    vendorAccountId: 'acct-engine-routing',
  };
  const event: PricingChangeEvent = {
    id: 'event-engine',
    domain: 'policy_rule',
    operation: 'update',
    targetId: engineRule.id,
    actorId,
    previousState: null,
    nextState: engineRule,
    previewSummary: {},
    affectedScenarioIds: [],
    createdAt: '2026-07-13T00:00:00.000Z',
  };
  const harness = createMemoryHarness([engineRule], [event]);

  const inventory = await loadPricingPolicyInventory(harness.deps);
  const inherited = inventory.rows.find(
    (row) => row.selector.engineId === 'kling-3-pro' && row.selector.mode === 't2v' && row.selector.resolution === '1080p'
  );

  assert.equal(inherited?.databaseOverride?.id, engineRule.id);
  assert.equal(inherited?.routingContext?.vendorAccountId, 'acct-engine-routing');
  assert.equal(inherited?.lastEvent?.id, event.id);
});

test('rollback uses direct event lookup beyond the 200-row history window and recreates only unrouted state', async () => {
  const deleted = policyRule('db-kling', { marginFlatCents: 2 });
  const source: PricingChangeEvent = {
    id: 'event-old-delete',
    domain: 'policy_rule',
    operation: 'delete',
    targetId: deleted.id,
    actorId,
    previousState: deleted,
    nextState: null,
    previewSummary: {},
    affectedScenarioIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  const newer = Array.from({ length: 201 }, (_, index): PricingChangeEvent => ({
    ...source,
    id: `event-newer-${index}`,
    targetId: `unrelated-${index}`,
    createdAt: `2026-07-13T00:${String(index % 60).padStart(2, '0')}:00.000Z`,
  }));
  const harness = createMemoryHarness([], [...newer, source]);
  const forged = {
    operation: 'rollback',
    eventId: source.id,
    vendorAccountId: 'client-routing-forgery',
  } as unknown as PricingPolicyChangeProposal;

  const preview = await previewPricingPolicyChange(forged, harness.deps);
  const confirmation = await confirmPricingPolicyChange(
    forged,
    preview.previewFingerprint,
    actorId,
    harness.deps
  );

  assert.equal(confirmation.event.operation, 'rollback');
  assert.equal(harness.rules[0]?.id, deleted.id);
  assert.equal(harness.rules[0]?.vendorAccountId, undefined);
});

test('targeted revalidation maps pricing hub and model rows to exact localized public paths only', () => {
  const paths: string[] = [];
  revalidatePricingChangeSurfaces(
    {
      domain: 'policy_rule',
      operation: 'update',
      targetId: 'db-kling',
      currentState: policyRule('db-kling'),
      proposedState: policyRule('db-kling', { marginFlatCents: 1 }),
      previewFingerprint: 'fingerprint',
      affectedScenarioIds: ['pricing-hub:kling-3-pro:default', 'model-page:kling-3-pro:decision'],
      affectedSurfaces: ['pricing-hub', 'model-page'],
      rows: [
        {
          scenarioId: 'model-page:kling-3-pro:decision',
          engineId: 'kling-3-pro',
          surface: 'model-page',
          currentTotalCents: 1,
          proposedTotalCents: 2,
          deltaCents: 1,
          deltaPercent: 1,
          currentProvenance: { source: 'versioned', matchedBy: 'global', sourceRuleId: 'default', compatibilityProfile: 'standard' },
          proposedProvenance: { source: 'database', matchedBy: 'precise', sourceRuleId: 'db-kling', compatibilityProfile: 'standard' },
          compatibilityProfile: 'standard',
        },
      ],
      warnings: [],
    },
    (path) => paths.push(path)
  );

  assert.deepEqual(paths, [
    '/pricing',
    '/fr/tarifs',
    '/es/precios',
    '/models/kling-3-pro',
    '/fr/modeles/kling-3-pro',
    '/es/modelos/kling-3-pro',
  ]);
  assert.ok(paths.every((path) => !path.includes('/admin') && !path.includes('/blog') && !path.includes('/app')));
});
