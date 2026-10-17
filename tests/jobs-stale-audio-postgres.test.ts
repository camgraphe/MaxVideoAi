import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { getDb } from '../frontend/src/lib/db';
import { completeAudioJob, updateAudioJob } from '../frontend/src/server/audio/audio-generate-jobs';
import { expireStaleAudioJob, isStaleAudioJob } from '../frontend/app/api/jobs/_lib/jobs-stale-audio';
import type { JobRow } from '../frontend/app/api/jobs/_lib/jobs-route-types';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';

const userId = 'stale-audio-owner';
const pricingSnapshot = { totalCents: 45, currency: 'USD', source: 'fixture' };

test('stale Audio expiration revalidates the owned job and commits its exact refund atomically', { timeout: 60_000 }, async t => {
  const database = await startDisposablePostgres('aud-expiry');
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = database.databaseUrl;
  t.after(async () => {
    await getDb().end();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    await database.cleanup();
  });
  await createPaidGenerationTestSchema(database.pool);

  async function seed(jobId: string, paymentStatus = 'paid_wallet') {
    await database.pool.query(`INSERT INTO app_jobs
      (job_id,user_id,surface,billing_product_key,engine_id,status,payment_status,final_price_cents,currency,pricing_snapshot,settings_snapshot,message,updated_at)
      VALUES ($1,$2,'audio','audio:song','audio-song','running',$3,45,'USD',$4::jsonb,'{}','Generating',NOW()-INTERVAL '11 minutes')`,
    [jobId, userId, paymentStatus, JSON.stringify(pricingSnapshot)]);
    if (paymentStatus === 'paid_wallet') {
      await database.pool.query(`INSERT INTO app_receipts
        (user_id,type,amount_cents,currency,description,job_id,surface,billing_product_key,pricing_snapshot)
        VALUES ($1,'charge',45,'USD','Audio song',$2,'audio','audio:song',$3::jsonb)`,
      [userId, jobId, JSON.stringify(pricingSnapshot)]);
    }
    const row = (await database.pool.query<JobRow>('SELECT * FROM app_jobs WHERE job_id=$1', [jobId])).rows[0]!;
    assert.equal(isStaleAudioJob(row), true);
    return row;
  }

  async function state(jobId: string) {
    return (await database.pool.query(`SELECT status,payment_status,message,audio_url,video_url,
      (SELECT count(*)::int FROM app_receipts r WHERE r.job_id=j.job_id AND r.type='refund') AS refunds
      FROM app_jobs j WHERE job_id=$1`, [jobId])).rows[0];
  }

  async function insertRefund(jobId: string, amount = 45) {
    await database.pool.query(`INSERT INTO app_receipts
      (user_id,type,amount_cents,currency,description,job_id,surface,billing_product_key,pricing_snapshot)
      VALUES ($1,'refund',$2,'USD','Existing refund',$3,'audio','audio:song',$4::jsonb)`,
    [userId, amount, jobId, JSON.stringify(pricingSnapshot)]);
  }

  await t.test('completion after the feed snapshot remains completed and charged', async () => {
    const row = await seed('completed-after-read');
    assert.equal(await completeAudioJob(row.job_id, {
      progress: 100, message: 'Completed', audioUrl: 'https://example.invalid/completed.wav',
    }), true);
    const before = await state(row.job_id);
    const expired = await expireStaleAudioJob(row, userId);
    assert.deepEqual(await state(row.job_id), before);
    assert.equal(expired, false);
  });

  await t.test('expiration waiting for a concurrent completion rechecks the committed row', async () => {
    const row = await seed('completion-holds-lock');
    const completing = await database.pool.connect();
    let expiration: ReturnType<typeof expireStaleAudioJob> | undefined;
    try {
      await completing.query('BEGIN');
      await completing.query('SELECT job_id FROM app_jobs WHERE job_id=$1 FOR UPDATE', [row.job_id]);
      expiration = expireStaleAudioJob(row, userId);
      let waiting = false;
      for (let attempt = 0; attempt < 200; attempt += 1) {
        const locks = await database.pool.query(`SELECT 1 FROM pg_stat_activity
          WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%app_jobs%'
            AND pid<>pg_backend_pid()`);
        if (locks.rows.length) { waiting = true; break; }
        await delay(5);
      }
      assert.equal(waiting, true, 'expiration must wait for the current job lock');
      await completing.query(`UPDATE app_jobs SET status='completed', progress=100,
        audio_url='https://example.invalid/concurrent.wav', message='Completed', updated_at=NOW()
        WHERE job_id=$1`, [row.job_id]);
      await completing.query('COMMIT');
      assert.equal(await expiration, false);
      assert.equal((await state(row.job_id)).status, 'completed');
      assert.equal((await state(row.job_id)).refunds, 0);
    } finally {
      await completing.query('ROLLBACK');
      completing.release();
      await expiration?.catch(() => undefined);
    }
  });

  await t.test('recent progress after the feed snapshot prevents expiration', async () => {
    const row = await seed('progress-after-read');
    assert.equal(await updateAudioJob(row.job_id, { progress: 80, message: 'Mixing' }), true);
    const before = await state(row.job_id);
    const expired = await expireStaleAudioJob(row, userId);
    assert.deepEqual(await state(row.job_id), before);
    assert.equal(expired, false);
  });

  await t.test('a snapshot for another owner cannot mutate either job or ledger', async () => {
    const row = await seed('other-owner');
    const before = await state(row.job_id);
    const expired = await expireStaleAudioJob(row, 'different-user');
    assert.deepEqual(await state(row.job_id), before);
    assert.equal(expired, false);
    assert.equal((await database.pool.query("SELECT count(*)::int AS total FROM app_receipts WHERE user_id='different-user'")).rows[0].total, 0);
  });

  for (const [name, update] of [
    ['terminal state', "status='failed'"],
    ['non-audio surface', "surface='video'"],
    ['existing audio', "audio_url='https://example.invalid/existing.wav'"],
    ['existing video', "video_url='https://example.invalid/existing.mp4'"],
    ['changed owner', "user_id='new-owner'"],
  ]) {
    await t.test(`current ${name} prevents expiration despite the old feed snapshot`, async () => {
      const row = await seed(`changed-${name}`);
      await database.pool.query(`UPDATE app_jobs SET ${update} WHERE job_id=$1`, [row.job_id]);
      const before = await state(row.job_id);
      const expired = await expireStaleAudioJob(row, userId);
      assert.deepEqual(await state(row.job_id), before);
      assert.equal(expired, false);
    });
  }

  await t.test('the refund uses the persisted debit even if the feed snapshot has different amounts', async () => {
    const row = await seed('exact-charge');
    row.final_price_cents = 9000;
    row.currency = 'EUR';
    const expired = await expireStaleAudioJob(row, userId);
    assert.deepEqual((await database.pool.query(`SELECT amount_cents,currency,pricing_snapshot FROM app_receipts
      WHERE job_id=$1 AND type='refund'`, [row.job_id])).rows, [{ amount_cents: 45, currency: 'USD', pricing_snapshot: pricingSnapshot }]);
    assert.equal(expired, true);
    assert.equal((await state(row.job_id)).payment_status, 'refunded_wallet');
  });

  await t.test('concurrent expiration has one winner and one exact refund', async () => {
    const row = await seed('concurrent-expiry');
    const results = await Promise.all([expireStaleAudioJob(row, userId), expireStaleAudioJob(row, userId)]);
    assert.deepEqual(results.sort(), [false, true]);
    assert.equal((await state(row.job_id)).refunds, 1);
    assert.equal(await completeAudioJob(row.job_id, { progress: 100, message: 'Late completion' }), false);
  });

  await t.test('an existing exact refund is reconciled without a second credit', async () => {
    const row = await seed('existing-refund');
    await insertRefund(row.job_id);
    assert.equal(await expireStaleAudioJob(row, userId), true);
    assert.equal((await state(row.job_id)).refunds, 1);
    assert.equal((await state(row.job_id)).payment_status, 'refunded_wallet');
    assert.equal(await expireStaleAudioJob(row, userId), false);
  });

  await t.test('an inconsistent existing refund cannot terminate the job', async () => {
    const row = await seed('wrong-refund');
    await insertRefund(row.job_id, 90);
    const before = await state(row.job_id);
    await assert.rejects(expireStaleAudioJob(row, userId), /inconsistent/i);
    assert.deepEqual(await state(row.job_id), before);
  });

  await t.test('a missing paid debit leaves the job and wallet untouched', async () => {
    const row = await seed('missing-charge');
    await database.pool.query("DELETE FROM app_receipts WHERE job_id=$1 AND type='charge'", [row.job_id]);
    const before = await state(row.job_id);
    await assert.rejects(expireStaleAudioJob(row, userId), /missing or inconsistent/i);
    assert.deepEqual(await state(row.job_id), before);
  });

  await t.test('refund insertion failure rolls back the terminal job update', async () => {
    const row = await seed('refund-write-fails');
    const before = await state(row.job_id);
    await database.pool.query("ALTER TABLE app_receipts ADD CONSTRAINT reject_expiry_refund CHECK (job_id <> 'refund-write-fails' OR type <> 'refund')");
    try {
      await assert.rejects(expireStaleAudioJob(row, userId));
      assert.deepEqual(await state(row.job_id), before);
    } finally {
      await database.pool.query('ALTER TABLE app_receipts DROP CONSTRAINT reject_expiry_refund');
    }
  });

  await t.test('payment status write failure rolls back the inserted refund as well as the job', async () => {
    const row = await seed('job-write-fails');
    const before = await state(row.job_id);
    await database.pool.query("ALTER TABLE app_jobs ADD CONSTRAINT reject_expiry_status CHECK (job_id <> 'job-write-fails' OR payment_status <> 'refunded_wallet')");
    try {
      await assert.rejects(expireStaleAudioJob(row, userId));
      assert.deepEqual(await state(row.job_id), before);
    } finally {
      await database.pool.query('ALTER TABLE app_jobs DROP CONSTRAINT reject_expiry_status');
    }
  });

  for (const paymentStatus of ['pending', 'free']) {
    await t.test(`${paymentStatus} stale jobs expire without creating a wallet credit`, async () => {
      const row = await seed(`${paymentStatus}-expiry`, paymentStatus);
      assert.equal(await expireStaleAudioJob(row, userId), true);
      const current = await state(row.job_id);
      assert.equal(current.status, 'failed');
      assert.equal(current.payment_status, paymentStatus);
      assert.equal(current.refunds, 0);
    });
  }
});
