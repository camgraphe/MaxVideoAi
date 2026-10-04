import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getDb, withDbTransaction } from '../frontend/src/lib/db';
import { createInitialVideoJobInExecutor, type CreateVideoInitialJobParams } from '../frontend/app/api/generate/_lib/initial-video-job';
import { startDisposablePostgres, createPaidGenerationTestSchema } from './helpers/disposable-postgres';
import { captureSeedanceDraftValidityStart, registerSeedanceDraftLink, markSeedanceDraftReady } from '../frontend/server/seedance-draft-links';

function params(jobId: string, draftJobId = 'draft'): CreateVideoInitialJobParams & { seedanceFinal: { draftJobId: string; providerTaskId: string; providerModelId: string } } {
  const quote = { totalCents: 711, meta: { pricingMode: 'manual_tariff', customerTariffRevision: 4 } };
  return { jobId, userId: 'user-1', paymentMode: 'wallet', walletReservation: 'reserve',
    funding: { kind: 'wallet', reservation: 'reserve' }, preferredCurrency: 'usd', resolvedCurrencyLower: 'usd',
    seedanceFinal: { draftJobId, providerTaskId: 'cgt-draft', providerModelId: 'seedance-model' },
    pendingReceipt: { userId: 'user-1', jobId, amountCents: 711, currency: 'USD', description: 'Final 1080p',
      snapshot: quote, auditPricingSnapshot: quote, applicationFeeCents: null, vendorAccountId: null },
    jobInsert: { jobId, userId: 'user-1', engineId: 'seedance-2-5', engineLabel: 'Seedance 2.5', durationSec: 5,
      prompt: 'test', thumbUrl: '/thumb.svg', aspectRatio: '16:9', hasAudio: false, canUpscale: false,
      previewFrame: '/thumb.svg', batchId: null, groupId: null, iterationIndex: null, iterationCount: 1,
      renderIdsJson: null, heroRenderId: null, localKey: null, message: null, etaSeconds: null, etaLabel: null,
      provider: 'byteplus_modelark', finalPriceCents: 711, pricingSnapshotJson: JSON.stringify(quote), costBreakdownJson: null,
      settingsSnapshotJson: JSON.stringify({ seedanceWorkflow: { step: 'final', draftJobId } }), currency: 'USD',
      vendorAccountId: null, paymentStatus: 'paid_wallet', stripePaymentIntentId: null, stripeChargeId: null,
      visibility: 'private', indexable: false } };
}

test('final eligibility and single-winner reservation share the wallet transaction', { timeout: 90_000 }, async () => {
  const db = await startDisposablePostgres('seedance-final-charge');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = db.databaseUrl;
  try {
    await createPaidGenerationTestSchema(db.pool);
    await db.pool.query('CREATE TABLE app_customer_tariff_state (singleton BOOLEAN PRIMARY KEY, revision BIGINT, active BOOLEAN); INSERT INTO app_customer_tariff_state VALUES (TRUE,4,TRUE)');
    await db.pool.query(readFileSync('neon/migrations/53_seedance_draft_links.sql', 'utf8'));
    await db.pool.query(`INSERT INTO app_receipts (user_id,type,amount_cents,currency,surface) VALUES ('user-1','topup',10000,'USD','wallet');
      INSERT INTO app_jobs (job_id,user_id,engine_id,provider,provider_job_id,status) VALUES ('draft','user-1','seedance-2-5','byteplus_modelark','cgt-draft','completed')`);
    const query = async <T,>(sql: string, values?: readonly unknown[]): Promise<T[]> => (await db.pool.query(sql, values as unknown[])).rows;
    await registerSeedanceDraftLink({ userId: 'user-1', draftJobId: 'draft', providerTaskId: 'cgt-draft',
      providerModelId: 'seedance-model', validityStart: captureSeedanceDraftValidityStart() }, query);
    await markSeedanceDraftReady('user-1', 'draft', query);
    await assert.rejects(withDbTransaction(executor => createInitialVideoJobInExecutor(executor, params('foreign', 'not-owned'))), /Draft/i);
    assert.equal((await db.pool.query("SELECT count(*) FROM app_receipts WHERE type = 'charge'")).rows[0].count, '0');
    const attempts = await Promise.allSettled(['final-a', 'final-b'].map(jobId =>
      withDbTransaction(executor => createInitialVideoJobInExecutor(executor, params(jobId)))));
    assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1);
    const finalJob = (await db.pool.query("SELECT job_id FROM app_jobs WHERE job_id <> 'draft'")).rows[0].job_id;
    const repeated = await withDbTransaction(executor => createInitialVideoJobInExecutor(executor, params(finalJob)));
    assert.equal(repeated.kind, 'existing_job');
    assert.deepEqual((await db.pool.query("SELECT job_id,amount_cents FROM app_receipts WHERE type = 'charge'")).rows,
      [{ job_id: finalJob, amount_cents: 711 }]);
    assert.equal((await db.pool.query('SELECT final_job_id FROM seedance_draft_links')).rows[0].final_job_id, finalJob);
  } finally {
    await getDb().end().catch(() => undefined); await db.cleanup();
    if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous;
  }
});
