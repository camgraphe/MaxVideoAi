import assert from 'node:assert/strict';
import test from 'node:test';
import { executeImageGeneration } from '../frontend/src/server/images/execute-image-generation';
import { getDb } from '../frontend/src/lib/db';
import { startDisposablePostgres, createPaidGenerationTestSchema } from './helpers/disposable-postgres';

test('image execution recovers an owned paid job before live pricing, reference access or provider calls', async () => {
  const db = await startDisposablePostgres('paid-image-execution');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = db.databaseUrl;
  const pricing = { totalCents: 100, currency: 'USD',
    meta: { pricingMode: 'manual_tariff', customerTariffRevision: 7 } };
  try {
    await createPaidGenerationTestSchema(db.pool);
    await db.pool.query(`INSERT INTO app_jobs (job_id,user_id,surface,status,engine_id,engine_label,pricing_snapshot,payment_status)
      VALUES ('paid-image','user-1','image','pending','gpt-image-2','GPT Image',$1::jsonb,'paid_wallet')`, [JSON.stringify(pricing)]);
    await db.pool.query(`CREATE TABLE app_customer_tariff_state (singleton BOOLEAN PRIMARY KEY, revision BIGINT, active BOOLEAN);
      INSERT INTO app_customer_tariff_state VALUES (TRUE, 8, TRUE)`);
    await db.pool.query(`INSERT INTO app_receipts (user_id,type,amount_cents,currency,job_id,surface,pricing_snapshot)
      VALUES ('user-1','charge',100,'USD','paid-image','image',$1::jsonb)`, [JSON.stringify(pricing)]);
    // This body cannot execute as a new request: its model is unavailable and references are invalid.
    // Recovery must use the owned persisted job, not current model availability or current price.
    const result = await executeImageGeneration({ userId: 'user-1', walletReservation: 'reserve',
      customerTariffRevision: '7', body: { jobId: 'paid-image', engineId: 'retired-provider-model',
        mode: 'i2i', membershipTier: 'Pro', prompt: 'retry', imageUrls: ['not-a-url'] } });
    assert.equal(result.jobId, 'paid-image');
    assert.deepEqual(result.pricing, pricing);
    assert.equal(result.engineId, 'gpt-image-2');
    assert.equal((await db.pool.query('SELECT count(*) FROM app_receipts')).rows[0].count, '1');
    await assert.rejects(executeImageGeneration({ userId: 'foreign-user', walletReservation: 'reserve',
      body: { jobId: 'paid-image', engineId: 'retired-provider-model', mode: 'i2i' } }));
  } finally {
    await getDb().end().catch(() => undefined);
    await db.cleanup();
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});
