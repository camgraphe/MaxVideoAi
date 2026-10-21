import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { invalidateBillingProductsCache } from '../frontend/src/lib/billing-products';
import { getDb, withDbTransaction } from '../frontend/src/lib/db';
import { resolveImageGenerationPricingSnapshot } from '../frontend/src/server/images/image-generation-pricing';
import { createInitialImageJobInExecutor, type CreateImageInitialJobParams } from '../frontend/src/server/images/image-initial-job';
import type { PricingSnapshot } from '../frontend/types/engines';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';

function initialJob(jobId: string, engineId: string, productKey: string, pricing: PricingSnapshot): CreateImageInitialJobParams {
  return {
    userId: 'character-user', mode: 'i2i', jobId, surface: 'character', billingProductKey: productKey,
    description: 'Character reference', amountCents: pricing.totalCents, currency: 'USD',
    pricingSnapshotJson: JSON.stringify(pricing), auditPricingSnapshot: pricing,
    applicationFeeCents: null, vendorAccountId: null, engineId, engineLabel: 'Character engine',
    durationSec: 0, prompt: 'Keep the identity and add a walking cane', aspectRatio: '16:9',
    canUpscale: false, finalPriceCents: pricing.totalCents, costBreakdownJson: null,
    settingsSnapshotJson: '{}', visibility: 'private', indexable: false,
    preferredCurrency: 'usd', walletReservation: 'reserve',
  };
}

test('Character Builder reserves its fixed product price while model tariffs are active', async (t) => {
  const database = await startDisposablePostgres('character-product-pricing');
  const previous = { DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV };
  Object.assign(process.env, { DATABASE_URL: database.databaseUrl, NODE_ENV: 'production' });
  invalidateBillingProductsCache();
  try {
    await createPaidGenerationTestSchema(database.pool);
    await database.pool.query(`
      CREATE TABLE app_customer_tariff_state (singleton BOOLEAN PRIMARY KEY, revision BIGINT, active BOOLEAN);
      INSERT INTO app_customer_tariff_state VALUES (TRUE, 8, TRUE);
      CREATE TABLE app_billing_products (
        product_key TEXT PRIMARY KEY, surface TEXT, label TEXT, currency TEXT, unit_kind TEXT,
        unit_price_cents INTEGER, active BOOLEAN, metadata JSONB
      );
      INSERT INTO app_billing_products VALUES
        ('character-draft', 'character', 'Character Draft', 'USD', 'image', 12, TRUE, '{}'),
        ('character-final', 'character', 'Character Final', 'USD', 'image', 25, TRUE, '{}');
      INSERT INTO app_receipts (user_id, type, amount_cents, currency)
        VALUES ('character-user', 'topup', 1000, 'USD');
    `);

    const scenarios = [
      { id: 'draft-single', engineId: 'nano-banana-2', productKey: 'character-draft', count: 1, cents: 12 },
      { id: 'draft-four', engineId: 'nano-banana-2', productKey: 'character-draft', count: 4, cents: 48 },
      { id: 'final-single', engineId: 'nano-banana-pro', productKey: 'character-final', count: 1, cents: 25 },
      { id: 'final-four', engineId: 'nano-banana-pro', productKey: 'character-final', count: 4, cents: 100 },
    ];
    let sample!: CreateImageInitialJobParams;
    for (const scenario of scenarios) {
      const { pricing } = await resolveImageGenerationPricingSnapshot({
        engine: getFalEngineById(scenario.engineId)!.engine, mode: 'i2i', durationSec: 0,
        resolution: '1k', customImageSize: null, quality: null, combinedImageCount: 2,
        enableWebSearch: false, numImages: scenario.count, billingProductKey: scenario.productKey,
        billingQuantityMultiplier: 1, jobSurface: 'character', source: undefined, metadata: null,
        includedKlingFirstFrameParentJobId: null, resolvedAspectRatio: '16:9', trustedQuotedBilling: undefined,
      });
      const params = initialJob(scenario.id, scenario.engineId, scenario.productKey, pricing);
      sample = params;
      await t.test(`${scenario.id} charges the tool price once and preserves its receipt`, async () => {
        assert.equal(pricing.totalCents, scenario.cents);
        assert.equal(pricing.meta?.pricingModel, 'billing-product');
        assert.equal((await withDbTransaction(executor => createInitialImageJobInExecutor(executor, params))).kind, 'created');
        assert.equal((await withDbTransaction(executor => createInitialImageJobInExecutor(executor, params))).kind, 'existing_job');
        const charges = await database.pool.query('SELECT amount_cents, pricing_snapshot FROM app_receipts WHERE job_id = $1', [scenario.id]);
        assert.equal(charges.rows.length, 1);
        assert.equal(charges.rows[0].amount_cents, scenario.cents);
        assert.deepEqual(charges.rows[0].pricing_snapshot, pricing);
        const jobs = await database.pool.query('SELECT final_price_cents, billing_product_key, payment_status FROM app_jobs WHERE job_id = $1', [scenario.id]);
        assert.deepEqual(jobs.rows, [{ final_price_cents: scenario.cents, billing_product_key: scenario.productKey, payment_status: 'paid_wallet' }]);
      });
    }

    await t.test('model quotes and mismatched product context still fail before any debit', async () => {
      const fixed = sample.auditPricingSnapshot as PricingSnapshot;
      for (const [index, changes] of [
        { billingProductKey: null },
        { billingProductKey: 'character-draft' },
        { surface: 'image' as const },
        { auditPricingSnapshot: { ...fixed, meta: { ...fixed.meta, pricingMode: 'manual_tariff', customerTariffRevision: 7 } } },
        { auditPricingSnapshot: { ...fixed, meta: { ...fixed.meta, pricingModel: undefined } } },
      ].entries()) {
        const jobId = `rejected-${index}`;
        await assert.rejects(withDbTransaction(executor => createInitialImageJobInExecutor(executor, { ...sample, ...changes, jobId })),
          (error: unknown) => (error as { code?: string }).code === 'PRICING_REFRESH_REQUIRED');
        assert.equal((await database.pool.query('SELECT count(*) FROM app_jobs WHERE job_id = $1', [jobId])).rows[0].count, '0');
        assert.equal((await database.pool.query('SELECT count(*) FROM app_receipts WHERE job_id = $1', [jobId])).rows[0].count, '0');
      }
    });

    await t.test('fixed character pricing still enforces wallet funds', async () => {
      await assert.rejects(withDbTransaction(executor => createInitialImageJobInExecutor(executor, {
        ...sample, jobId: 'unfunded-character', userId: 'unfunded-user',
      })), (error: unknown) => (error as { code?: string }).code === 'insufficient_funds');
      assert.equal((await database.pool.query("SELECT count(*) FROM app_jobs WHERE job_id = 'unfunded-character'")).rows[0].count, '0');
      assert.equal((await database.pool.query("SELECT count(*) FROM app_receipts WHERE user_id = 'unfunded-user'")).rows[0].count, '0');
    });
  } finally {
    invalidateBillingProductsCache();
    await getDb().end().catch(() => undefined);
    await database.cleanup();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
