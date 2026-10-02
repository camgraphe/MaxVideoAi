import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { getDb, withDbTransaction } from '../frontend/src/lib/db';
import { createInitialVideoJobInExecutor, type CreateVideoInitialJobParams } from '../frontend/app/api/generate/_lib/initial-video-job';
import { createInitialImageJobInExecutor, type CreateImageInitialJobParams } from '../frontend/src/server/images/image-initial-job';
import { startDisposablePostgres, createPaidGenerationTestSchema } from './helpers/disposable-postgres';

const oldQuote = { meta: { pricingMode: 'manual_tariff', customerTariffRevision: 7 } };
function imageParams(jobId: string): CreateImageInitialJobParams {
  return { userId: 'user-1', mode: 't2i', jobId, surface: 'image', billingProductKey: null,
    description: 'Image', amountCents: 100, currency: 'USD', pricingSnapshotJson: JSON.stringify(oldQuote),
    auditPricingSnapshot: oldQuote, applicationFeeCents: null, vendorAccountId: null,
    engineId: 'gpt-image-2', engineLabel: 'Image', durationSec: 0, prompt: 'test', aspectRatio: '1:1',
    canUpscale: false, finalPriceCents: 100, costBreakdownJson: null, settingsSnapshotJson: '{}',
    visibility: 'private', indexable: false, preferredCurrency: 'usd', walletReservation: 'reserve' };
}
function videoParams(jobId: string): CreateVideoInitialJobParams {
  return { userId: 'user-1', jobId, paymentMode: 'wallet', walletReservation: 'reserve',
    funding: { kind: 'wallet', reservation: 'reserve' },
    preferredCurrency: 'usd', resolvedCurrencyLower: 'usd', pendingReceipt: {
      userId: 'user-1', jobId, amountCents: 100, currency: 'USD', description: 'Video', snapshot: {},
      auditPricingSnapshot: oldQuote, applicationFeeCents: null, vendorAccountId: null,
    }, jobInsert: {
      userId: 'user-1', jobId, engineId: 'pika-text-to-video', engineLabel: 'Video', durationSec: 5,
      prompt: 'test', thumbUrl: '/thumb.svg', aspectRatio: '16:9', hasAudio: false, canUpscale: false,
      previewFrame: '/thumb.svg', batchId: null, groupId: null, iterationIndex: null, iterationCount: null,
      renderIdsJson: null, heroRenderId: null, localKey: null, message: null, etaSeconds: null, etaLabel: null,
      provider: 'mock', finalPriceCents: 100, pricingSnapshotJson: JSON.stringify(oldQuote),
      costBreakdownJson: null, settingsSnapshotJson: '{}', currency: 'USD', vendorAccountId: null,
      paymentStatus: 'paid_wallet', stripePaymentIntentId: null, stripeChargeId: null, visibility: 'private', indexable: false,
    } };
}

test('stale image and video quotes cannot debit or insert a new job; previously charged reservations keep their historical price', async () => {
  const db = await startDisposablePostgres('initial-tariff');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = db.databaseUrl;
  try {
    await createPaidGenerationTestSchema(db.pool);
    await db.pool.query('CREATE TABLE app_customer_tariff_state (singleton BOOLEAN PRIMARY KEY, revision BIGINT, active BOOLEAN); INSERT INTO app_customer_tariff_state VALUES (TRUE, 8, TRUE)');
    await assert.rejects(withDbTransaction(executor => createInitialVideoJobInExecutor(executor, videoParams('new-video'))), /review the current price/i);
    await assert.rejects(withDbTransaction(executor => createInitialImageJobInExecutor(executor, imageParams('new-image'))), /review the current price/i);
    assert.equal((await db.pool.query('SELECT count(*) FROM app_jobs')).rows[0].count, '0');
    assert.equal((await db.pool.query('SELECT count(*) FROM app_receipts')).rows[0].count, '0');
    for (const surface of ['video', 'image']) {
      await db.pool.query(`INSERT INTO app_receipts (user_id, type, amount_cents, currency, job_id, surface, pricing_snapshot)
        VALUES ('user-1', 'charge', 100, 'USD', $1, $2, $3::jsonb)`, [`paid-${surface}`, surface, JSON.stringify(oldQuote)]);
    }
    const video = videoParams('paid-video');
    video.walletReservation = 'already_reserved';
    video.funding = { kind: 'wallet', reservation: 'already_reserved' };
    const image = imageParams('paid-image');
    image.walletReservation = 'already_reserved';
    assert.equal((await withDbTransaction(executor => createInitialVideoJobInExecutor(executor, video))).kind, 'created');
    assert.equal((await withDbTransaction(executor => createInitialImageJobInExecutor(executor, image))).kind, 'created');
    assert.equal((await db.pool.query('SELECT count(*) FROM app_receipts')).rows[0].count, '2');
    assert.deepEqual((await db.pool.query('SELECT amount_cents, pricing_snapshot FROM app_receipts ORDER BY job_id')).rows,
      [{ amount_cents: 100, pricing_snapshot: oldQuote }, { amount_cents: 100, pricing_snapshot: oldQuote }]);
  } finally {
    await getDb().end().catch(() => undefined); await db.cleanup();
    if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous;
  }
});


test('a captured direct quote at revision 7 can create its original job at revision 8 and preserves refund amounts', async () => {
  const db = await startDisposablePostgres('captured-initial-tariff');
  const previous = process.env.DATABASE_URL; process.env.DATABASE_URL = db.databaseUrl;
  try {
    await createPaidGenerationTestSchema(db.pool);
    await db.pool.query(readFileSync('neon/migrations/56_direct_payment_quotes.sql', 'utf8'));
    await db.pool.query('CREATE TABLE app_customer_tariff_state (singleton BOOLEAN PRIMARY KEY, revision BIGINT, active BOOLEAN); INSERT INTO app_customer_tariff_state VALUES (TRUE, 8, TRUE)');
    const original = { totalCents: 100, currency: 'USD', meta: { ...oldQuote.meta, directPaymentQuoteId: 'paid-quote' } };
    const quote = { id: 'paid-quote', userId: 'user-1', jobId: 'paid-direct', scenario: { engineId: 'pika-text-to-video' }, pricing: original };
    await db.pool.query('INSERT INTO app_direct_payment_quotes (id, user_id, job_id, quote_json) VALUES ($1,$2,$3,$4)', [quote.id, quote.userId, quote.jobId, quote]);
    const wallet = videoParams('paid-direct');
    const { funding: _funding, ...base } = wallet;
    const direct: CreateVideoInitialJobParams = { ...base, paymentMode: 'direct',
      pendingReceipt: { ...wallet.pendingReceipt!, snapshot: original, auditPricingSnapshot: original, stripePaymentIntentId: 'pi_paid' },
      jobInsert: { ...wallet.jobInsert, paymentStatus: 'paid_direct', stripePaymentIntentId: 'pi_paid', pricingSnapshotJson: JSON.stringify(original) } };
    const created = await withDbTransaction(executor => createInitialVideoJobInExecutor(executor, direct));
    assert.equal(created.kind, 'created');
    await assert.rejects(withDbTransaction(executor => createInitialVideoJobInExecutor(executor, {
      ...direct, pendingReceipt: { ...direct.pendingReceipt!, stripePaymentIntentId: 'pi_second' },
      jobInsert: { ...direct.jobInsert, stripePaymentIntentId: 'pi_second' },
    })), /another payment/i);
    const job = (await db.pool.query('SELECT final_price_cents, pricing_snapshot FROM app_jobs WHERE job_id = $1', ['paid-direct'])).rows[0];
    assert.equal(job.final_price_cents, 100);
    assert.equal(job.pricing_snapshot.meta.customerTariffRevision, 7);
    await db.pool.query('CREATE UNIQUE INDEX app_receipts_unique_pi ON app_receipts (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL');
    await db.pool.query('CREATE UNIQUE INDEX app_receipts_unique_charge ON app_receipts (stripe_charge_id) WHERE stripe_charge_id IS NOT NULL');
    const { persistFinalChargeReceipt } = await import('../frontend/app/api/generate/_lib/final-receipts');
    await persistFinalChargeReceipt({ pendingReceipt: direct.pendingReceipt!, walletChargeReserved: false,
      queryFn: async (sql, params) => (await db.pool.query(sql, params)).rows });
    const { persistRefundReceipt } = await import('../frontend/app/api/generate/_lib/payment-rollback');
    await persistRefundReceipt({ receipt: direct.pendingReceipt!, description: 'Refund after tariff edit', stripeRefundId: 're_paid', priceOnly: true,
      queryFn: async (sql, params) => (await db.pool.query(sql, params)).rows });
    const refund = (await db.pool.query("SELECT amount_cents, pricing_snapshot, metadata FROM app_receipts WHERE type = 'refund'")).rows[0];
    assert.ok(refund, 'a direct refund must coexist with its charged PaymentIntent');
    assert.equal(refund.amount_cents, 100);
    assert.equal(refund.metadata?.original_stripe_payment_intent_id, 'pi_paid');
    assert.equal(refund.pricing_snapshot.meta.customerTariffRevision, 7);
    // A refunded captured payment cannot be resubmitted after a lost provisional job.
    await db.pool.query("DELETE FROM app_jobs WHERE job_id = 'paid-direct'");
    await assert.rejects(withDbTransaction(executor => createInitialVideoJobInExecutor(executor, direct)), /already refunded/i);
  } finally {
    await getDb().end().catch(() => undefined); await db.cleanup();
    if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous;
  }
});
