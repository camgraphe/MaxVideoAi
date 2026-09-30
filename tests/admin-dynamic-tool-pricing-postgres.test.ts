import assert from 'node:assert/strict';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { getDb, query, withDbTransaction } from '../frontend/src/lib/db';
import { computeBillingProductSnapshot, invalidateBillingProductsCache, loadBillingProductsWithExecutor,
  updateBillingProductWithExecutor } from '../frontend/src/lib/billing-products';
import { previewBillingProductChange, confirmBillingProductChange, type BillingProductChangeProposal,
  type BillingProductPricingServiceDependencies } from '../frontend/server/pricing-admin/billing-product-service';
import { getPricingChangeEventById, listPricingChangeEvents, insertPricingChangeEvent } from '../frontend/server/pricing-admin/event-store';
import { getUpscaleToolEngine } from '../frontend/src/config/tools-upscale-engines';
import { getBackgroundRemovalToolEngine } from '../frontend/src/config/tools-background-removal-engines';
import { resolveUpscalePricingContext } from '../frontend/src/server/tools/upscale-pricing-context';
import { resolveBackgroundRemovalPricingContext } from '../frontend/src/server/tools/background-removal-pricing-context';
import { matchesAcceptedToolQuote } from '../frontend/src/lib/toolbox/quote';
import { createBillingProductDraft, buildBillingProductProposal } from '../frontend/app/(core)/admin/billing-products/_lib/billing-products-admin-view-model';

test('dynamic tool edits persist through preview, stale rejection and rollback while paid quotes retain original totals', async () => {
  const db = await startDisposablePostgres('dynamic-tools');
  const previousUrl = process.env.DATABASE_URL;
  const actor = '11111111-1111-4111-8111-111111111111';
  try {
    await db.pool.query(`CREATE TABLE app_billing_products(product_key text PRIMARY KEY, surface text, label text,
      currency text, unit_kind text, unit_price_cents int, active boolean, metadata jsonb, updated_at timestamptz);
      INSERT INTO app_billing_products VALUES
        ('upscale-video-topaz','upscale','Topaz video','USD','run',3,true,'{"seeded":true,"routing":"keep"}',NOW()),
        ('background-removal-video-v3','background-removal','Background removal','USD','run',3,true,NULL,NOW()),
        ('upscale-image-topaz','upscale','Topaz image','USD','image',15,true,NULL,NOW());
      CREATE TABLE app_pricing_change_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), domain text,
        operation text, target_id text, actor_id uuid, previous_state jsonb, next_state jsonb,
        preview_summary jsonb, affected_scenario_ids jsonb, created_at timestamptz DEFAULT NOW());
      CREATE TABLE app_jobs(id text PRIMARY KEY, pricing_snapshot jsonb);`);
    process.env.DATABASE_URL = db.databaseUrl;
    invalidateBillingProductsCache();
    const dependencies: BillingProductPricingServiceDependencies = {
      loadProducts: async executor => ({ status: 'loaded', products: await loadBillingProductsWithExecutor(executor ?? { query }, { lock: Boolean(executor) }) }),
      getEvent: getPricingChangeEventById, listEvents: listPricingChangeEvents, withTransaction: withDbTransaction,
      updateProduct: updateBillingProductWithExecutor, insertEvent: insertPricingChangeEvent,
      invalidateCache: invalidateBillingProductsCache, revalidate: () => {},
    };
    const upscale = () => resolveUpscalePricingContext({ billingProductKey: 'upscale-video-topaz',
      engine: getUpscaleToolEngine('topaz-video', 'video'), input: { mediaType: 'video' },
      targetResolution: '1080p', upscaleFactor: 2,
      videoMetadata: { width: 1280, height: 720, durationSec: 10, fps: 30 } });
    const background = () => resolveBackgroundRemovalPricingContext({ billingProductKey: 'background-removal-video-v3',
      engine: getBackgroundRemovalToolEngine(), outputCodec: 'webm_vp9',
      videoMetadata: { width: 1280, height: 720, durationSec: 10.25, fps: 30 } });
    const before = (await upscale()).pricing;
    assert.equal(before.totalCents, 80);
    await db.pool.query('INSERT INTO app_jobs VALUES ($1,$2::jsonb)', ['paid-tool', JSON.stringify(before)]);
    const proposal = { operation: 'update', productKey: 'upscale-video-topaz', dynamicPriceMultiplier: 2.5 } as unknown as BillingProductChangeProposal;
    const preview = await previewBillingProductChange(proposal, dependencies);
    const sample = preview.rows.find(row => row.scenarioId.includes('10s') && row.scenarioId.includes('1080p'));
    assert.ok(sample, 'preview must show actual processing totals as well as its unchanged minimum');
    assert.equal(sample.currentTotalCents, 80);
    assert.equal(sample.proposedTotalCents, 50);
    assert.equal((await upscale()).pricing.totalCents, 80, 'preview never mutates a price');
    const committed = await confirmBillingProductChange(proposal, preview.previewFingerprint, actor, dependencies);
    const current = (await upscale()).pricing;
    assert.equal(current.totalCents, 50);
    assert.equal(current.meta?.dynamicMultiplier, 2.5);
    assert.equal(current.meta?.providerEstimateUsd, 0.2, 'supplier cost is unaffected');
    assert.equal(matchesAcceptedToolQuote(before, current), false, 'old client acceptance must be refreshed');
    assert.equal((await computeBillingProductSnapshot({ productKey: 'upscale-video-topaz' })).totalCents, 3, 'public minimum remains the product price');
    const product = (await loadBillingProductsWithExecutor({ query })).find(row => row.productKey === 'upscale-video-topaz')!;
    assert.deepEqual(product.metadata, { seeded: true, routing: 'keep', dynamicPriceMultiplier: 2.5 });
    const draft = createBillingProductDraft(product);
    assert.equal((draft as unknown as { dynamicPriceMultiplier: string }).dynamicPriceMultiplier, '2.5');
    assert.equal((buildBillingProductProposal(draft) as unknown as { dynamicPriceMultiplier: number }).dynamicPriceMultiplier, 2.5);
    const bgProposal = { operation: 'update', productKey: 'background-removal-video-v3', dynamicPriceMultiplier: 3 } as unknown as BillingProductChangeProposal;
    assert.equal((await background()).pricing.totalCents, 10);
    const bgPreview = await previewBillingProductChange(bgProposal, dependencies);
    await confirmBillingProductChange(bgProposal, bgPreview.previewFingerprint, actor, dependencies);
    assert.equal((await background()).pricing.totalCents, 15);
    for (const value of [0, 0.99, 1001, null, '3', Number.NaN, Number.POSITIVE_INFINITY]) {
      await assert.rejects(previewBillingProductChange({ ...proposal, dynamicPriceMultiplier: value } as BillingProductChangeProposal, dependencies), /multiplier|coefficient/i);
    }
    await assert.rejects(previewBillingProductChange({ ...proposal, productKey: 'upscale-image-topaz' }, dependencies), /dynamic|coefficient/i);
    const changed = { ...proposal, dynamicPriceMultiplier: 3 } as BillingProductChangeProposal;
    const stale = await previewBillingProductChange(changed, dependencies);
    await db.pool.query(`UPDATE app_billing_products SET metadata = metadata || '{"routing":"changed"}'::jsonb WHERE product_key='upscale-video-topaz'`);
    await assert.rejects(confirmBillingProductChange(changed, stale.previewFingerprint, actor, dependencies), /stale/i);
    assert.equal((await listPricingChangeEvents()).length, 2);
    const rollback = { operation: 'rollback', targetId: 'upscale-video-topaz', eventId: committed.event.id } as const;
    const rollbackPreview = await previewBillingProductChange(rollback, dependencies);
    await confirmBillingProductChange(rollback, rollbackPreview.previewFingerprint, actor, dependencies);
    assert.equal((await upscale()).pricing.totalCents, 80);
    const restored = (await loadBillingProductsWithExecutor({ query })).find(row => row.productKey === 'upscale-video-topaz')!;
    assert.equal(restored.metadata?.routing, 'changed', 'rollback restores pricing, preserves operational metadata');
    const paid = (await db.pool.query("SELECT pricing_snapshot FROM app_jobs WHERE id='paid-tool'")).rows[0].pricing_snapshot;
    assert.deepEqual(paid, before, 'a paid job retains its entire original snapshot');
    invalidateBillingProductsCache();
    await db.pool.query('DROP TABLE app_billing_products');
    await assert.rejects(upscale(), /compute upscale pricing/i, 'current DB failure never falls back to a default product');
  } finally {
    if (process.env.DATABASE_URL === db.databaseUrl) await getDb().end();
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    invalidateBillingProductsCache();
    await db.cleanup();
  }
});
