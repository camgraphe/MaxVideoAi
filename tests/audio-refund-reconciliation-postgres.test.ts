import assert from 'node:assert/strict';
import test from 'node:test';
import { getDb } from '../frontend/src/lib/db';
import { refundAudioCharge } from '../frontend/src/server/audio/audio-generate-receipts';
import { createPaidGenerationTestSchema, missingDisposablePostgresCommand, startDisposablePostgres } from './helpers/disposable-postgres';

const userId = 'audio-refund-owner';
const pricingSnapshot = { totalCents: 45, currency: 'USD', source: 'fixture' };

type ReconcileAudioCharge = (params: { userId: string; jobId: string }) => Promise<unknown>;
const reconcileAudioCharge = refundAudioCharge as unknown as ReconcileAudioCharge;

test('Audio refunds reconcile the exact persisted charge transactionally on disposable PostgreSQL', { timeout: 60_000 }, async t => {
  const missing = missingDisposablePostgresCommand();
  if (missing) return t.skip(`${missing} is unavailable`);
  const database = await startDisposablePostgres('aud-refund');
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = database.databaseUrl;
  t.after(async () => {
    await getDb().end();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    await database.cleanup();
  });
  await createPaidGenerationTestSchema(database.pool);

  async function seed(jobId: string, overrides: { jobAmount?: number; chargeAmount?: number; jobStatus?: string } = {}) {
    await database.pool.query(`INSERT INTO app_jobs
      (job_id,user_id,surface,billing_product_key,engine_id,status,payment_status,final_price_cents,currency,pricing_snapshot,settings_snapshot,message)
      VALUES ($1,$2,'audio','audio:song','audio-song',$3,'paid_wallet',$4,'USD',$5::jsonb,'{}','Fixture provider failure')`,
    [jobId, userId, overrides.jobStatus ?? 'failed', overrides.jobAmount ?? 45, JSON.stringify(pricingSnapshot)]);
    await database.pool.query(`INSERT INTO app_receipts
      (user_id,type,amount_cents,currency,description,job_id,surface,billing_product_key,pricing_snapshot)
      VALUES ($1,'charge',$2,'USD','Audio song',$3,'audio','audio:song',$4::jsonb)`,
    [userId, overrides.chargeAmount ?? 45, jobId, JSON.stringify(pricingSnapshot)]);
  }

  async function state(jobId: string) {
    return (await database.pool.query(`SELECT status,payment_status,message,
      (SELECT count(*)::int FROM app_receipts r WHERE r.job_id=j.job_id AND r.type='refund') AS refunds
      FROM app_jobs j WHERE job_id=$1`, [jobId])).rows[0];
  }

  await t.test('caller values cannot over-credit and replay remains exact once', async () => {
    await seed('exact-charge');
    const legacyCaller = refundAudioCharge as unknown as (params: {
      userId: string; jobId: string; amountCents: number; currency: string; pricingSnapshotJson: string;
    }) => Promise<unknown>;
    await Promise.all([
      legacyCaller({ userId, jobId: 'exact-charge', amountCents: 9000, currency: 'EUR', pricingSnapshotJson: '{"totalCents":9000}' }),
      reconcileAudioCharge({ userId, jobId: 'exact-charge' }),
    ]);
    await reconcileAudioCharge({ userId, jobId: 'exact-charge' });
    assert.deepEqual((await database.pool.query(`SELECT amount_cents,currency,pricing_snapshot,surface,billing_product_key
      FROM app_receipts WHERE job_id='exact-charge' AND type='refund'`)).rows, [{
      amount_cents: 45,
      currency: 'USD',
      pricing_snapshot: pricingSnapshot,
      surface: 'audio',
      billing_product_key: 'audio:song',
    }]);
    assert.deepEqual(await state('exact-charge'), {
      status: 'failed', payment_status: 'refunded_wallet', message: 'Fixture provider failure', refunds: 1,
    });
  });

  await t.test('a refund insert constraint leaves the provider failure observable and reconciliation pending', async () => {
    await seed('refund-write-fails');
    await database.pool.query("ALTER TABLE app_receipts ADD CONSTRAINT reject_audio_refund CHECK (job_id <> 'refund-write-fails' OR type <> 'refund')");
    await assert.rejects(reconcileAudioCharge({ userId, jobId: 'refund-write-fails' }));
    assert.deepEqual(await state('refund-write-fails'), {
      status: 'failed', payment_status: 'paid_wallet', message: 'Fixture provider failure', refunds: 0,
    });
    await database.pool.query('ALTER TABLE app_receipts DROP CONSTRAINT reject_audio_refund');
  });

  await t.test('job and charge inconsistencies cannot create a refund', async () => {
    await seed('mismatched-charge', { chargeAmount: 90 });
    await assert.rejects(reconcileAudioCharge({ userId, jobId: 'mismatched-charge' }), /inconsistent/i);
    assert.deepEqual(await state('mismatched-charge'), {
      status: 'failed', payment_status: 'paid_wallet', message: 'Fixture provider failure', refunds: 0,
    });
  });

  await t.test('a completed job wins before refund reconciliation and remains charged', async () => {
    await seed('completed-first', { jobStatus: 'completed' });
    await assert.rejects(reconcileAudioCharge({ userId, jobId: 'completed-first' }), /completed/i);
    assert.deepEqual(await state('completed-first'), {
      status: 'completed', payment_status: 'paid_wallet', message: 'Fixture provider failure', refunds: 0,
    });
  });
});
