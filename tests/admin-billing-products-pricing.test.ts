import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  InsertPricingChangeEventInput,
  PricingChangeEvent,
} from '../frontend/lib/admin/pricing-change-contract';
import { ANGLE_TOOL_ENGINES } from '../frontend/src/config/tools-angle-engines';
import { BACKGROUND_REMOVAL_TOOL_ENGINES } from '../frontend/src/config/tools-background-removal-engines';
import { UPSCALE_TOOL_ENGINES } from '../frontend/src/config/tools-upscale-engines';
import {
  buildCanonicalFixedProductSnapshot,
  updateBillingProductWithExecutor,
} from '../frontend/src/lib/billing-products';
import type { QueryExecutor } from '../frontend/src/lib/db';
import { getBillingProductKey } from '../frontend/src/server/tools/character-builder/utils';
import { getAngleBillingProductKeyForEngine } from '../frontend/src/server/tools/angle-request-utils';
import type { BillingProductRecord } from '../frontend/types/billing';
import {
  confirmBillingProductChange,
  listReferencedBillingProductKeys,
  loadBillingProductHistory,
  loadBillingProductInventory,
  previewBillingProductChange,
  type BillingProductPricingServiceDependencies,
} from '../frontend/server/pricing-admin/billing-product-service';

const ACTOR_ID = '00000000-0000-0000-0000-000000000006';

const LIVE_PRODUCT: BillingProductRecord = {
  productKey: 'character-draft',
  surface: 'character',
  label: 'Character Draft',
  currency: 'USD',
  unitKind: 'image',
  unitPriceCents: 8,
  active: true,
  metadata: { seeded: true },
};

const LEGACY_PRODUCT: BillingProductRecord = {
  productKey: 'angle-single',
  surface: 'angle',
  label: 'Legacy Angle Single',
  currency: 'USD',
  unitKind: 'run',
  unitPriceCents: 3,
  active: false,
  metadata: { legacy: true },
};

function cloneProduct(product: BillingProductRecord): BillingProductRecord {
  return { ...product, metadata: product.metadata ? { ...product.metadata } : null };
}

function eventFromInput(input: InsertPricingChangeEventInput, id: string): PricingChangeEvent {
  return { id, ...input, createdAt: '2026-07-13T10:00:00.000Z' };
}

function buildHarness(input: { databaseStatus?: 'loaded' | 'unavailable' } = {}) {
  let products = [cloneProduct(LIVE_PRODUCT), cloneProduct(LEGACY_PRODUCT)];
  const events: PricingChangeEvent[] = [];
  const order: string[] = [];
  const executor: QueryExecutor = { query: async () => [] };
  let inTransaction = false;

  const dependencies: BillingProductPricingServiceDependencies = {
    loadProducts: async (receivedExecutor) => {
      order.push(receivedExecutor ? 'load:transaction' : 'load:preview');
      return input.databaseStatus === 'unavailable'
        ? { status: 'unavailable', products: [] }
        : { status: 'loaded', products: products.map(cloneProduct) };
    },
    getEvent: async (id, domain) => events.find((event) => event.id === id && event.domain === domain) ?? null,
    listEvents: async (filter) => events.filter((event) => event.domain === filter?.domain),
    withTransaction: async (callback) => {
      order.push('transaction:begin');
      inTransaction = true;
      const before = products.map(cloneProduct);
      try {
        const result = await callback(executor);
        order.push('transaction:commit');
        return result;
      } catch (error) {
        products = before;
        order.push('transaction:rollback');
        throw error;
      } finally {
        inTransaction = false;
      }
    },
    updateProduct: async (receivedExecutor, proposal) => {
      assert.equal(receivedExecutor, executor);
      assert.equal(inTransaction, true);
      order.push('product:update');
      const index = products.findIndex((product) => product.productKey === proposal.productKey);
      assert.notEqual(index, -1);
      products[index] = { ...products[index]!, ...proposal };
      return cloneProduct(products[index]!);
    },
    insertEvent: async (receivedExecutor, input) => {
      assert.equal(receivedExecutor, executor);
      assert.equal(inTransaction, true);
      order.push('event:insert');
      const event = eventFromInput(input, `event-${events.length + 1}`);
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
    dependencies,
    events,
    order,
    get liveProduct() {
      return cloneProduct(products.find((product) => product.productKey === LIVE_PRODUCT.productKey)!);
    },
    mutateLiveProduct(patch: Partial<BillingProductRecord>) {
      const index = products.findIndex((product) => product.productKey === LIVE_PRODUCT.productKey);
      products[index] = { ...products[index]!, ...patch };
    },
  };
}

test('live billing product inventory is derived from every active product-key producer', () => {
  const keys = listReferencedBillingProductKeys();
  const expected = new Set<string>([
    getBillingProductKey('draft'),
    getBillingProductKey('final'),
    ...ANGLE_TOOL_ENGINES.flatMap((engine) => [
      getAngleBillingProductKeyForEngine(engine.id, false),
      getAngleBillingProductKeyForEngine(engine.id, true),
    ]),
    ...UPSCALE_TOOL_ENGINES.map((engine) => engine.billingProductKey),
    ...BACKGROUND_REMOVAL_TOOL_ENGINES.map((engine) => engine.billingProductKey),
  ]);

  assert.deepEqual([...keys].sort(), [...expected].sort());
  assert.equal(keys.has('angle-single'), false);
  assert.equal(keys.has('background-removal-realtime'), false);
});

test('inventory exposes only referenced controls while preserving historical database rows', async () => {
  const harness = buildHarness();
  const inventory = await loadBillingProductInventory(harness.dependencies);

  assert.equal(inventory.databaseStatus, 'loaded');
  assert.deepEqual(inventory.products.map((product) => product.productKey), ['character-draft']);
  assert.equal(inventory.historicalProductCount, 1);
  assert.equal(harness.liveProduct.productKey, 'character-draft');
});

test('the fixed-product projector remains the canonical production projection', () => {
  const snapshot = buildCanonicalFixedProductSnapshot({
    engineId: 'character-draft',
    currency: 'USD',
    amountCents: 8,
    quantity: 1,
    unit: 'image',
    unitRate: 0.08,
    memberTier: 'member',
    discountPercent: 0,
    meta: { billingProductKey: 'character-draft' },
  });

  assert.equal(snapshot.totalCents, 8);
  assert.equal(snapshot.meta?.pricingPolicy && typeof snapshot.meta.pricingPolicy === 'object', true);
});

test('preview projects price, label and active changes without client-authored totals', async () => {
  const harness = buildHarness();
  const preview = await previewBillingProductChange({
    operation: 'update',
    productKey: 'character-draft',
    label: 'Character Draft Reviewed',
    currency: 'USD',
    unitPriceCents: 9,
    active: false,
  }, harness.dependencies);

  assert.equal(preview.domain, 'billing_product');
  assert.equal(preview.targetId, 'character-draft');
  assert.equal(preview.rows.length, 1);
  assert.equal(preview.rows[0]?.surface, 'character');
  assert.equal(preview.rows[0]?.currentTotalCents, 8);
  assert.equal(preview.rows[0]?.proposedTotalCents, 9);
  assert.equal(preview.rows[0]?.deltaPercent, 1 / 8);
  assert.match(preview.warnings.join('\n'), /deactivated/i);
  assert.deepEqual(preview.proposedState, {
    ...LIVE_PRODUCT,
    label: 'Character Draft Reviewed',
    unitPriceCents: 9,
    active: false,
  });
});

test('proposals reject unreferenced product IDs, unsupported currencies and invalid amounts', async () => {
  const harness = buildHarness();
  await assert.rejects(
    () => previewBillingProductChange({ productKey: 'angle-single', unitPriceCents: 3 }, harness.dependencies),
    /not referenced|not editable/i
  );
  await assert.rejects(
    () => previewBillingProductChange({ productKey: 'character-draft', currency: 'EUR' }, harness.dependencies),
    /currency/i
  );
  for (const unitPriceCents of [-1, 1.5, Number.NaN]) {
    await assert.rejects(
      () => previewBillingProductChange({ productKey: 'character-draft', unitPriceCents }, harness.dependencies),
      /non-negative integer/i
    );
  }
});

test('confirmation recomputes in transaction and commits one product plus one immutable event', async () => {
  const harness = buildHarness();
  const proposal = { productKey: 'character-draft', unitPriceCents: 9 };
  const preview = await previewBillingProductChange(proposal, harness.dependencies);
  const confirmation = await confirmBillingProductChange(
    proposal,
    preview.previewFingerprint,
    ACTOR_ID,
    harness.dependencies
  );

  assert.equal(confirmation.committed, true);
  assert.equal(harness.liveProduct.unitPriceCents, 9);
  assert.equal(harness.events.length, 1);
  assert.equal(harness.events[0]?.actorId, ACTOR_ID);
  assert.equal(harness.events[0]?.domain, 'billing_product');
  assert.equal(harness.events[0]?.operation, 'update');
  assert.deepEqual(harness.order.slice(-6), [
    'load:transaction',
    'product:update',
    'event:insert',
    'transaction:commit',
    'cache:invalidate',
    'paths:revalidate',
  ]);
});

test('confirmation rejects stale state and unavailable persistence without mutation or invalidation', async () => {
  const staleHarness = buildHarness();
  const proposal = { productKey: 'character-draft', unitPriceCents: 9 };
  const preview = await previewBillingProductChange(proposal, staleHarness.dependencies);
  staleHarness.mutateLiveProduct({ label: 'Concurrent label' });

  await assert.rejects(
    () => confirmBillingProductChange(proposal, preview.previewFingerprint, ACTOR_ID, staleHarness.dependencies),
    /stale/i
  );
  assert.equal(staleHarness.events.length, 0);
  assert.equal(staleHarness.order.includes('cache:invalidate'), false);

  const unavailableHarness = buildHarness({ databaseStatus: 'unavailable' });
  await assert.rejects(
    () => previewBillingProductChange(proposal, unavailableHarness.dependencies),
    /unavailable/i
  );
  assert.equal(unavailableHarness.order.includes('transaction:begin'), false);
});

test('failed event persistence rolls back the product and leaves caches untouched', async () => {
  const harness = buildHarness();
  const proposal = { productKey: 'character-draft', unitPriceCents: 9 };
  const preview = await previewBillingProductChange(proposal, harness.dependencies);
  const dependencies: BillingProductPricingServiceDependencies = {
    ...harness.dependencies,
    insertEvent: async () => {
      throw new Error('event unavailable');
    },
  };

  await assert.rejects(
    () => confirmBillingProductChange(proposal, preview.previewFingerprint, ACTOR_ID, dependencies),
    /failed to persist/i
  );
  assert.equal(harness.liveProduct.unitPriceCents, 8);
  assert.equal(harness.events.length, 0);
  assert.equal(harness.order.at(-1), 'transaction:rollback');
  assert.equal(harness.order.includes('cache:invalidate'), false);
});

test('post-commit cache and revalidation failures return operational warnings without undoing the change', async () => {
  const harness = buildHarness();
  const proposal = { productKey: 'character-draft', unitPriceCents: 9 };
  const preview = await previewBillingProductChange(proposal, harness.dependencies);
  const dependencies: BillingProductPricingServiceDependencies = {
    ...harness.dependencies,
    invalidateCache: () => {
      throw new Error('cache unavailable');
    },
    revalidate: () => {
      throw new Error('revalidation unavailable');
    },
  };

  const confirmation = await confirmBillingProductChange(
    proposal,
    preview.previewFingerprint,
    ACTOR_ID,
    dependencies
  );
  assert.equal(harness.liveProduct.unitPriceCents, 9);
  assert.deepEqual(confirmation.operationalWarnings.map((warning) => warning.code), [
    'cache_invalidation_failed',
    'path_revalidation_failed',
  ]);
});

test('rollback restores immutable previous state through preview and appends a rollback event', async () => {
  const harness = buildHarness();
  const update = { productKey: 'character-draft', unitPriceCents: 9 };
  const updatePreview = await previewBillingProductChange(update, harness.dependencies);
  await confirmBillingProductChange(update, updatePreview.previewFingerprint, ACTOR_ID, harness.dependencies);

  const rollback = { operation: 'rollback' as const, productKey: 'character-draft', eventId: harness.events[0]!.id };
  const rollbackPreview = await previewBillingProductChange(rollback, harness.dependencies);
  assert.equal((rollbackPreview.proposedState as { unitPriceCents: number }).unitPriceCents, 8);
  await confirmBillingProductChange(rollback, rollbackPreview.previewFingerprint, ACTOR_ID, harness.dependencies);

  assert.equal(harness.liveProduct.unitPriceCents, 8);
  assert.equal(harness.events.length, 2);
  assert.equal(harness.events[1]?.operation, 'rollback');
  assert.equal(harness.events[1]?.previewSummary.rollbackEventId, harness.events[0]?.id);
  assert.equal((await loadBillingProductHistory({}, harness.dependencies)).length, 2);
});

test('executor mutation owns SQL persistence but never invalidates its caller cache', async () => {
  const calls: string[] = [];
  const executor: QueryExecutor = {
    query: async <TRecord>(sql: string, params?: ReadonlyArray<unknown>) => {
      calls.push(sql);
      assert.deepEqual(params, ['character-draft', 'Updated', 'USD', 9, false]);
      return [{
        product_key: 'character-draft',
        surface: 'character',
        label: 'Updated',
        currency: 'USD',
        unit_kind: 'image',
        unit_price_cents: 9,
        active: false,
        metadata: { seeded: true },
      }] as TRecord[];
    },
  };

  const updated = await updateBillingProductWithExecutor(executor, {
    productKey: 'character-draft',
    label: 'Updated',
    currency: 'USD',
    unitPriceCents: 9,
    active: false,
  });

  assert.equal(updated.unitPriceCents, 9);
  assert.equal(calls.length, 1);
});
