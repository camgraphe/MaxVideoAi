import assert from 'node:assert/strict';
import test from 'node:test';
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
