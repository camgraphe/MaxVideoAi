import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getDb } from '../frontend/src/lib/db';
import { markBytePlusJobFailed } from '../frontend/server/byteplus-poll-failure';
import { runBytePlusPoll } from '../frontend/server/byteplus-poll';
import type { BytePlusPendingJob } from '../frontend/server/byteplus-poll-types';
import { captureSeedanceDraftValidityStart, getOwnedReadySeedanceDraftLink, markSeedanceDraftReady,
  markSeedanceFinalState, registerSeedanceDraftLink, reserveSeedanceDraftFinal } from '../frontend/server/seedance-draft-links';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';
import { allowGenerationPoll } from './helpers/generation-poll-claim';

async function fixture() {
  const db = await startDisposablePostgres('seedance-final-refund');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = db.databaseUrl;
  try {
    await createPaidGenerationTestSchema(db.pool);
    await db.pool.query(`ALTER TABLE app_jobs ADD COLUMN mcp_trial_outcome_disposition text;
      CREATE TABLE fal_queue_log (job_id text, provider text, provider_job_id text, engine_id text, status text, payload jsonb);
      INSERT INTO app_jobs (job_id,user_id,engine_id,engine_label,provider,provider_job_id,status,duration_sec,
        thumb_url,aspect_ratio,has_audio,final_price_cents,currency,payment_status,settings_snapshot,created_at,updated_at)
      VALUES ('draft','owner','seedance-2-5','Seedance 2.5','byteplus_modelark','cgt-draft','completed',4,
        'https://example.test/thumb.jpg','16:9',false,129,'USD','paid_wallet','{}',now()-interval '1 minute',now()-interval '1 minute'),
        ('final','owner','seedance-2-5','Seedance 2.5','byteplus_modelark','cgt-final','queued',4,
        'https://example.test/thumb.jpg','16:9',false,711,'USD','paid_wallet',
        '{"core":{"resolution":"1080p","aspectRatio":"16:9"},"seedanceWorkflow":{"step":"final","draftJobId":"draft"}}',
        now()-interval '1 minute',now()-interval '1 minute');
      INSERT INTO app_receipts (user_id,job_id,type,amount_cents,currency)
        VALUES ('owner','draft','charge',129,'USD'),('owner','final','charge',711,'USD');`);
    for (const name of ['53_seedance_draft_links.sql', '59_seedance_draft_final_state.sql']) {
      await db.pool.query(readFileSync(`neon/migrations/${name}`, 'utf8'));
    }
    const query = async <T = Record<string, unknown>,>(sql: string, values?: readonly unknown[]): Promise<T[]> =>
      (await db.pool.query(sql, values as unknown[])).rows;
    await registerSeedanceDraftLink({ userId: 'owner', draftJobId: 'draft', providerTaskId: 'cgt-draft',
      providerModelId: 'seedance-model', validityStart: captureSeedanceDraftValidityStart(() => new Date()) }, query);
    await markSeedanceDraftReady('owner', 'draft', query);
    await reserveSeedanceDraftFinal({ userId: 'owner', draftJobId: 'draft', finalJobId: 'final' }, query);
    await markSeedanceFinalState('owner', 'final', 'submitted', query);
    const job = async () => (await query<BytePlusPendingJob>("SELECT * FROM app_jobs WHERE job_id = 'final'"))[0];
    return { ...db, query, job, async cleanup() {
      await getDb().end();
      if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous;
      await db.cleanup();
    } };
  } catch (error) {
    if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous;
    await db.cleanup();
    throw error;
  }
}

async function assertRefundedFinalOnly(db: Awaited<ReturnType<typeof fixture>>) {
  assert.deepEqual((await db.query("SELECT user_id,job_id,amount_cents,currency FROM app_receipts WHERE type = 'refund'")),
    [{ user_id: 'owner', job_id: 'final', amount_cents: 711, currency: 'USD' }]);
  assert.deepEqual((await db.query("SELECT job_id,status,payment_status FROM app_jobs ORDER BY job_id")), [
    { job_id: 'draft', status: 'completed', payment_status: 'paid_wallet' },
    { job_id: 'final', status: 'failed', payment_status: 'refunded_wallet' },
  ]);
  assert.equal((await db.query("SELECT count(*)::int AS count FROM app_receipts WHERE type = 'charge'"))[0].count, 2);
  assert.ok(await getOwnedReadySeedanceDraftLink('owner', 'draft', db.query));
  assert.equal(await getOwnedReadySeedanceDraftLink('other', 'draft', db.query), null);
}

test('a refund write failure rolls back final failure; concurrent retry refunds only its persisted charge once',
  { timeout: 90_000, concurrency: false }, async () => {
    const db = await fixture();
    try {
      await db.pool.query(`CREATE FUNCTION reject_final_refund() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.type = 'refund' THEN RAISE EXCEPTION 'injected refund outage'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER refund_outage BEFORE INSERT ON app_receipts FOR EACH ROW EXECUTE FUNCTION reject_final_refund();`);
      await assert.rejects(markBytePlusJobFailed(await db.job(), 'Provider failed.'), /injected refund outage/);
      assert.deepEqual((await db.query("SELECT status,payment_status FROM app_jobs WHERE job_id = 'final'"))[0],
        { status: 'queued', payment_status: 'paid_wallet' }, 'failed job must not commit before its wallet refund');
      assert.equal((await db.query("SELECT * FROM app_receipts WHERE type = 'refund'")).length, 0);
      assert.equal((await db.query('SELECT final_state FROM seedance_draft_links'))[0].final_state, 'submitted');
      await db.pool.query('DROP TRIGGER refund_outage ON app_receipts');
      const staleJob = { ...await db.job(), user_id: 'other', final_price_cents: 9999, currency: 'EUR' };
      await Promise.all([markBytePlusJobFailed(staleJob, 'Provider failed.'), markBytePlusJobFailed(staleJob, 'Provider failed.')]);
      await assertRefundedFinalOnly(db);
      await markBytePlusJobFailed(staleJob, 'Repeated terminal callback.');
      await assertRefundedFinalOnly(db);
    } finally { await db.cleanup(); }
  });

test('final storage retry exhaustion refunds only the final and retains the ready paid Draft',
  { timeout: 90_000, concurrency: false }, async () => {
    const db = await fixture();
    try {
      let copies = 0;
      const poll = () => runBytePlusPoll({ jobId: 'final', deps: { queryFn: db.query, claimPollFn: allowGenerationPoll,
        getBytePlusArkConfigFn: () => ({ seedance25ModelId: 'seedance-model' }) as never,
        getBytePlusModelArkClientFn: () => ({ retrieveTask: async () => ({ providerJobId: 'cgt-final', status: 'completed',
          rawStatus: 'succeeded', videoUrl: 'https://provider.example.test/final.mp4', raw: {} }) }) as never,
        ensureFastStartVideoFn: async () => { copies++; return null; }, recordBytePlusPollEventFn: async () => undefined } });
      assert.equal((await (await poll()).json()).updates, 1);
      assert.equal((await db.job()).status, 'processing');
      assert.equal((await db.job()).payment_status, 'paid_wallet');
      assert.equal((await db.query("SELECT * FROM app_receipts WHERE type = 'refund'")).length, 0);
      assert.equal((await db.query('SELECT final_state FROM seedance_draft_links'))[0].final_state, 'submitted');
      await db.pool.query(`UPDATE app_jobs SET updated_at = now()-interval '1 minute',
        settings_snapshot = jsonb_set(settings_snapshot,'{byteplusStorageCopy}',
          '{"attempts":5,"firstFailedAt":"2000-01-01T00:00:00Z","nextRetryAt":"2000-01-01T00:00:00Z"}') WHERE job_id = 'final'`);
      assert.equal((await (await poll()).json()).updates, 1);
      assert.equal(copies, 2);
      await assertRefundedFinalOnly(db);
      assert.equal((await (await poll()).json()).checked, 0);
      assert.equal(copies, 2, 'terminal failure must not repeat the storage copy');
    } finally { await db.cleanup(); }
  });
