import assert from 'node:assert/strict';
import test from 'node:test';
import { Pool } from 'pg';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';
import { createProviderJobTracker } from '../frontend/app/api/generate/_lib/provider-job-tracker';
import { persistFinalVideoJobUpdate } from '../frontend/app/api/generate/_lib/final-job-persistence';
import { markJobAwaitingFal } from '../frontend/app/api/generate/_lib/fal-submission';
import { resolveFalJobQueue } from '../frontend/server/fal-job-queue';
import { submitFalQueueOnce } from '../frontend/src/lib/fal-queue-submit';
import { getFalClient } from '../frontend/src/lib/fal-client';
import type { query } from '../frontend/src/lib/db';

const endpoint = 'kling/v4/video-to-video/edit';
const requestId = 'accepted-durability-request';
const base = `https://queue.fal.run/${endpoint}/requests/${requestId}`;
const receipt = { request_id: requestId, status_url: `${base}/status`, response_url: base, cancel_url: `${base}/cancel` };
const inputSummary = { primaryImageUrl: null, primaryAudioUrl: null, referenceImageCount: 0, referenceVideoCount: 0,
  referenceAudioCount: 0, hasFirstFrame: false, hasLastFrame: false, inputSlots: [] };
const settings = { schemaVersion: 1, core: { durationSec: 5, resolution: '720p' } };
const price = { totalCents: 123, currency: 'USD', immutableQuote: 'offline-reserved-quote' };

async function database() {
  const db = await startDisposablePostgres('kling-receipt-durability');
  await createPaidGenerationTestSchema(db.pool);
  await db.pool.query(`ALTER TABLE app_jobs ADD COLUMN mcp_trial_outcome_disposition TEXT;
    CREATE TABLE fal_queue_log(id BIGSERIAL PRIMARY KEY, job_id TEXT, provider TEXT, provider_job_id TEXT,
      engine_id TEXT, status TEXT, payload JSONB, created_at TIMESTAMPTZ DEFAULT NOW());`);
  assert.equal((await db.pool.query('SHOW server_version_num')).rows[0].server_version_num.slice(0, 2), '17');
  return db;
}

async function seed(pool: Pool, jobId: string, engineId = 'kling-v4') {
  await pool.query(`INSERT INTO app_jobs(job_id, engine_id, provider, status, progress, settings_snapshot,
      final_price_cents, pricing_snapshot, payment_status, currency)
    VALUES ($1,$2,'fal','queued',0,$3::jsonb,123,$4::jsonb,'paid_wallet','USD')`,
  [jobId, engineId, JSON.stringify(settings), JSON.stringify(price)]);
  await pool.query(`INSERT INTO app_receipts(job_id,user_id,type,amount_cents,currency,pricing_snapshot)
    VALUES ($1,'offline-owner','charge',123,'USD',$2::jsonb)`, [jobId, JSON.stringify(price)]);
}

async function freshRecovery(databaseUrl: string, jobId: string, expected: 'blocked' | 'legacy') {
  // Separate connection and resolver: no submit closure, tracker cache, or caller metadata.
  const pool = new Pool({ connectionString: databaseUrl });
  let sdkReads = 0, networkReads = 0;
  const client = { queue: {
    status: async () => { sdkReads++; return { status: 'IN_PROGRESS' }; },
    result: async () => { sdkReads++; return { data: {} }; },
  } } as unknown as ReturnType<typeof getFalClient>;
  const queryFn: typeof query = async (sql, params) => (await pool.query(sql, params)).rows;
  try {
    const queue = await resolveFalJobQueue({ jobId, engineId: 'kling-v4', requestId, legacyModel: endpoint }, {
      queryFn, client, fetchFn: async () => { networkReads++; throw new Error('Unexpected transport'); },
    });
    if (expected === 'blocked') {
      await assert.rejects(queue.status(), /receipt metadata/);
      await assert.rejects(queue.result(), /receipt metadata/);
      assert.equal(sdkReads, 0);
    } else {
      assert.equal((await queue.status()).status, 'IN_PROGRESS');
      assert.equal(sdkReads, 1);
    }
    assert.equal(networkReads, 0);
  } finally { await pool.end(); }
}

async function assertPaidUnchanged(pool: Pool, jobId: string, ledger: unknown) {
  const row = (await pool.query('SELECT * FROM app_jobs WHERE job_id=$1', [jobId])).rows[0];
  assert.equal(row.final_price_cents, 123);
  assert.deepEqual(row.pricing_snapshot, price);
  assert.equal(row.payment_status, 'paid_wallet');
  assert.equal(row.currency, 'USD');
  const { falQueueReceiptRequired: marker, ...remainingSettings } = row.settings_snapshot;
  assert.deepEqual(remainingSettings, settings);
  assert.deepEqual(marker, { requestId });
  assert.deepEqual((await pool.query('SELECT * FROM app_receipts WHERE job_id=$1', [jobId])).rows, ledger);
  assert.equal(JSON.stringify(row.settings_snapshot).includes('queue.fal.run'), false);
}

test('receipt INSERT failure after accepted association survives restart without SDK reconstruction or another POST', async (t) => {
  const db = await database();
  t.mock.method(console, 'warn', () => {});
  try {
    for (const [name, body] of Object.entries({ valid: receipt, missing: { request_id: requestId },
      invalid: { ...receipt, status_url: 'https://untrusted.example/private' } })) {
      const jobId = `write-failure-${name}`;
      await seed(db.pool, jobId);
      const ledger = (await db.pool.query('SELECT * FROM app_receipts WHERE job_id=$1', [jobId])).rows;
      let posts = 0, failedInserts = 0;
      await submitFalQueueOnce(endpoint, {}, jobId, async () => {
        posts++;
        return new Response(JSON.stringify(body), { status: 202 });
      }, async (id, identity) => {
        const tracker = createProviderJobTracker({ jobId, engineId: 'kling-v4', providerKey: 'fal', prompt: '', inputSummary,
          queryFn: async (sql, params) => {
            if (sql.includes('INSERT INTO fal_queue_log')) { failedInserts++; throw new Error('Injected receipt INSERT failure'); }
            return (await db.pool.query(sql, params)).rows;
          },
        });
        await tracker.persistProviderJobId(id, undefined, identity);
        assert.equal(tracker.getLastProviderJobId(), requestId);
      });
      assert.equal((await db.pool.query('SELECT provider_job_id FROM app_jobs WHERE job_id=$1', [jobId])).rows[0].provider_job_id, requestId);
      assert.equal(failedInserts, 1);
      assert.equal((await db.pool.query('SELECT * FROM fal_queue_log WHERE job_id=$1', [jobId])).rowCount, 0);
      await freshRecovery(db.databaseUrl, jobId, 'blocked');
      await assertPaidUnchanged(db.pool, jobId, ledger);
      assert.equal(posts, 1);
    }
  } finally { await db.cleanup(); }
});

test('accepted identity and receipt requirement are visible together before the next write and survive final snapshot replacement', async (t) => {
  const db = await database();
  t.mock.method(console, 'warn', () => {});
  try {
    const jobId = 'crash-boundary';
    await seed(db.pool, jobId);
    const ledger = (await db.pool.query('SELECT * FROM app_receipts WHERE job_id=$1', [jobId])).rows;
    let reachedInsert!: () => void, releaseInsert!: () => void;
    const atInsert = new Promise<void>(resolve => { reachedInsert = resolve; });
    const stop = new Promise<void>(resolve => { releaseInsert = resolve; });
    const tracker = createProviderJobTracker({ jobId, engineId: 'kling-v4', providerKey: 'fal', prompt: '', inputSummary,
      queryFn: async (sql, params) => {
        if (sql.includes('INSERT INTO fal_queue_log')) {
          reachedInsert(); await stop; throw new Error('Process discarded before receipt INSERT');
        }
        return (await db.pool.query(sql, params)).rows;
      },
    });
    const pending = tracker.persistProviderJobId(requestId);
    await atInsert;
    try {
      await freshRecovery(db.databaseUrl, jobId, 'blocked');
      await assertPaidUnchanged(db.pool, jobId, ledger);
    } finally { releaseInsert(); await pending; }
    await persistFinalVideoJobUpdate({ jobId, thumb: null, aspectRatio: null, previewFrame: null,
      etaSeconds: null, etaLabel: null, video: null, status: 'queued', progress: 0, providerJobId: requestId,
      finalPriceCents: 123, pricingSnapshotJson: JSON.stringify(price), costBreakdownJson: null, currency: 'USD',
      vendorAccountId: null, paymentStatus: 'paid_wallet', stripePaymentIntentId: null, stripeChargeId: null,
      visibility: 'private', indexable: false, message: null, settingsSnapshotJson: JSON.stringify(settings),
      queryFn: async (sql, params) => (await db.pool.query(sql, params)).rows });
    await freshRecovery(db.databaseUrl, jobId, 'blocked');
    await assertPaidUnchanged(db.pool, jobId, ledger);
  } finally { await db.cleanup(); }
});

test('deferred association stamps the requirement even when earlier tracker writes were unavailable', async () => {
  const db = await database();
  try {
    const jobId = 'deferred-boundary';
    await seed(db.pool, jobId);
    const ledger = (await db.pool.query('SELECT * FROM app_receipts WHERE job_id=$1', [jobId])).rows;
    await markJobAwaitingFal({ jobId, engineId: 'kling-v4', providerJobId: requestId, message: null,
      statusLabel: 'deferred', attempt: 1, deps: { queryFn: async (sql, params) => (await db.pool.query(sql, params)).rows } });
    await freshRecovery(db.databaseUrl, jobId, 'blocked');
    await assertPaidUnchanged(db.pool, jobId, ledger);
  } finally { await db.cleanup(); }
});

test('ID-only compatibility requires affirmative matching historical enqueue evidence', async () => {
  const db = await database();
  try {
    const jobId = 'historical-job';
    await seed(db.pool, jobId);
    await db.pool.query('UPDATE app_jobs SET provider_job_id=$1 WHERE job_id=$2', [requestId, jobId]);
    await freshRecovery(db.databaseUrl, jobId, 'blocked');
    await db.pool.query(`INSERT INTO fal_queue_log(job_id, provider, provider_job_id, engine_id, status, payload)
      VALUES ($1,'fal',$2,'kling-v4','enqueue','{"at":"2026-10-01T00:00:00Z","provider":"fal","engineId":"kling-v4"}')`, [jobId, requestId]);
    await freshRecovery(db.databaseUrl, jobId, 'legacy');
    await freshRecovery(db.databaseUrl, 'unowned-job', 'blocked');
    await db.pool.query("UPDATE fal_queue_log SET provider_job_id='wrong-id'");
    await freshRecovery(db.databaseUrl, jobId, 'blocked');
    await db.pool.query(`UPDATE fal_queue_log SET provider_job_id=$1, payload='{"falQueueReceiptRequired":true}'`, [requestId]);
    await freshRecovery(db.databaseUrl, jobId, 'blocked');
  } finally { await db.cleanup(); }
});


test('a failed atomic association leaves neither an ID nor a marker and can retry persistence without another submit', async (t) => {
  const db = await database();
  t.mock.method(console, 'warn', () => {});
  try {
    const jobId = 'atomic-rollback';
    await seed(db.pool, jobId);
    const ledger = (await db.pool.query('SELECT * FROM app_receipts WHERE job_id=$1', [jobId])).rows;
    // PostgreSQL rejects the actual association statement after evaluating both assignments.
    await db.pool.query(`CREATE FUNCTION reject_association() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Injected association failure'; END; $$;
      CREATE TRIGGER reject_association BEFORE UPDATE ON app_jobs FOR EACH ROW EXECUTE FUNCTION reject_association();`);
    const tracker = createProviderJobTracker({ jobId, engineId: 'kling-v4', providerKey: 'fal', prompt: '', inputSummary,
      queryFn: async (sql, params) => (await db.pool.query(sql, params)).rows });
    let posts = 0;
    await submitFalQueueOnce(endpoint, {}, jobId, async () => {
      posts++; return new Response(JSON.stringify(receipt), { status: 202 });
    }, async (id, identity) => tracker.persistProviderJobId(id, undefined, identity));
    assert.equal(tracker.getLastProviderJobId(), requestId);
    const row = (await db.pool.query('SELECT provider_job_id,settings_snapshot FROM app_jobs WHERE job_id=$1', [jobId])).rows[0];
    assert.equal(row.provider_job_id, null);
    assert.deepEqual(row.settings_snapshot, settings);
    await freshRecovery(db.databaseUrl, jobId, 'blocked');
    await db.pool.query('DROP TRIGGER reject_association ON app_jobs');
    // Observing the ID earlier must not suppress a still-uncommitted requirement.
    tracker.setLastProviderJobId(requestId);
    await tracker.persistProviderJobId(requestId);
    await assertPaidUnchanged(db.pool, jobId, ledger);
    assert.equal(posts, 1);
  } finally { await db.cleanup(); }
});
