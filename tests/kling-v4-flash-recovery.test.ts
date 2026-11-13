import assert from 'node:assert/strict';
import test from 'node:test';
import { submitFalQueueOnce } from '../frontend/src/lib/fal-queue-submit';
import { parseFalQueueReceipt } from '../frontend/src/lib/fal-queue-receipt';
import { createProviderJobTracker } from '../frontend/app/api/generate/_lib/provider-job-tracker';
import { isKlingV4ReleaseBlocked } from '../frontend/src/server/video-generation/kling-v4-release-policy';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { resolveFalJobQueue } from '../frontend/server/fal-job-queue';
import { getRuntimeModelById } from '../frontend/config/model-runtime';

const endpoint = 'kling/v4/flash/text-to-video';
const requestId = 'flash-offline-request';
const base = `https://queue.fal.run/${endpoint}/requests/${requestId}`;
const receipt = { request_id: requestId, status_url: `${base}/status`, response_url: base, cancel_url: `${base}/cancel` };

for (const { mode, endpoint } of [
  { mode: 't2v', endpoint: 'kling/v4/flash/text-to-video' },
  { mode: 'v2v', endpoint: 'kling/v4/flash/video-to-video' },
]) test(`Flash ${mode} receipt survives persistence failure and restart without another POST`, async () => {
  const base = `https://queue.fal.run/${endpoint}/requests/${requestId}`;
  const receipt = { request_id: requestId, status_url: `${base}/status`, response_url: base, cancel_url: `${base}/cancel` };
  let posts = 0, writes = 0;
  const stored: unknown[][] = [];
  const tracker = createProviderJobTracker({ jobId: 'owned-job', engineId: 'kling-v4-flash', providerKey: 'fal', prompt: 'Offline',
    inputSummary: { primaryImageUrl: null, primaryAudioUrl: null, referenceImageCount: 0, referenceVideoCount: 0, referenceAudioCount: 0, hasFirstFrame: false, hasLastFrame: false, inputSlots: [] },
    queryFn: async (sql, args) => {
      if (sql.includes('UPDATE app_jobs')) {
        writes++;
        assert.match(sql, /falQueueReceiptRequired/);
        if (writes === 1) throw new Error('Simulated transient database failure');
        return [{ job_id: 'owned-job' }];
      }
      stored.push(args ?? []); return [];
    } });
  const accepted = await submitFalQueueOnce(endpoint, {}, 'owned-job', async (target, init) => {
    assert.equal(new URL(String(target)).pathname, `/${endpoint}`);
    assert.equal(init?.method, 'POST'); posts++;
    return new Response(JSON.stringify(receipt), { status: 202 });
  },
    (id, proof) => tracker.persistProviderJobId(id, undefined, proof));
  assert.equal(accepted, requestId); assert.equal(tracker.getLastProviderJobId(), requestId);
  const proof = parseFalQueueReceipt(endpoint, requestId, receipt);
  assert.equal(proof.metadataState, 'verified');
  await tracker.persistProviderJobId(requestId, undefined, proof);
  assert.equal(writes, 2); assert.equal(posts, 1);
  const persisted = JSON.parse(stored[0][5] as string);
  assert.equal(persisted.falQueueReceiptRequired, true);
  assert.equal(persisted.falQueueReceipt.endpoint, endpoint);
  const reads: string[] = [];
  const restarted = await resolveFalJobQueue({ jobId: 'owned-job', engineId: 'kling-v4-flash', requestId, legacyModel: endpoint }, {
    queryFn: async <T>(sql: string, args?: readonly unknown[]) => {
      assert.match(sql, /SELECT proof.receipt/);
      assert.deepEqual(args, ['owned-job', requestId, 'kling-v4-flash']);
      return [{ receipt: persisted.falQueueReceipt, receipt_present: true, receipt_required: true, legacy_enqueued: false }] as T[];
    },
    client: { queue: { status: async () => { throw new Error('Unexpected legacy fallback'); },
      result: async () => { throw new Error('Unexpected legacy fallback'); } } } as never,
    fetchFn: (async (target, init) => {
      assert.equal(init?.method, 'GET'); assert.equal(init?.redirect, 'error'); reads.push(String(target));
      if (String(target) === receipt.status_url) return new Response(JSON.stringify({ request_id: requestId, status: 'COMPLETED' }));
      assert.equal(String(target), receipt.response_url);
      return new Response(JSON.stringify({ video: { url: 'https://fal.media/recovered-offline.mp4' } }));
    }) as typeof fetch,
  });
  assert.equal((await restarted.status()).status, 'COMPLETED');
  assert.equal((await restarted.result()).data.video.url, 'https://fal.media/recovered-offline.mp4');
  assert.deepEqual(reads, [receipt.status_url, receipt.response_url]);
  assert.equal(posts, 1);
});

test('Flash rollback closes admission and transport never retries timeout or rejection', async (t) => {
  const app = getRuntimeModelById('kling-v4-flash')!.publication.app;
  const published = app.published;
  t.after(() => { app.published = published; });
  app.published = false;
  assert.equal(isKlingV4ReleaseBlocked('kling-v4-flash'), true);
  for (const failure of ['timeout', 'rejection']) {
    let posts = 0;
    await assert.rejects(submitFalQueueOnce(endpoint, {}, 'offline', async () => {
      posts++;
      if (failure === 'timeout') throw new Error('Timeout');
      return new Response('{}', { status: 422 });
    }));
    assert.equal(posts, 1);
  }
  assert.equal(parseFalQueueReceipt(endpoint, requestId, { ...receipt, status_url: receipt.status_url.replace('/flash/', '/') }).metadataState, 'invalid');
});

test('Flash recovers the stored receipt after restart and refuses missing evidence', async () => {
  const db = await startDisposablePostgres('kling-flash-receipt');
  try {
    await db.pool.query(`CREATE TABLE app_jobs(job_id TEXT PRIMARY KEY, provider TEXT, provider_job_id TEXT, engine_id TEXT, settings_snapshot JSONB, updated_at TIMESTAMPTZ);
      CREATE TABLE fal_queue_log(id BIGSERIAL PRIMARY KEY, job_id TEXT, provider TEXT, provider_job_id TEXT, engine_id TEXT, status TEXT, payload JSONB, created_at TIMESTAMPTZ DEFAULT NOW());
      INSERT INTO app_jobs(job_id,engine_id) VALUES ('owned-job','kling-v4-flash');`);
    const queryFn = async <T>(sql: string, args?: readonly unknown[]) => (await db.pool.query(sql, args as unknown[])).rows as T[];
    const tracker = createProviderJobTracker({ jobId: 'owned-job', engineId: 'kling-v4-flash', providerKey: 'fal', prompt: 'Offline',
      inputSummary: { primaryImageUrl: null, primaryAudioUrl: null, referenceImageCount: 0, referenceVideoCount: 0, referenceAudioCount: 0, hasFirstFrame: false, hasLastFrame: false, inputSlots: [] }, queryFn });
    await tracker.persistProviderJobId(requestId, undefined, parseFalQueueReceipt(endpoint, requestId, receipt));
    const stored = (await db.pool.query('SELECT * FROM app_jobs')).rows[0];
    assert.equal(stored.provider_job_id, requestId);
    assert.equal(stored.settings_snapshot.falQueueReceiptRequired.requestId, requestId);
    let reads = 0;
    const deps = { queryFn, fetchFn: (async (target, init) => {
      assert.equal(init?.method, 'GET'); assert.equal(init?.redirect, 'error'); reads++;
      if (String(target) === receipt.status_url) return new Response(JSON.stringify({ request_id: requestId, status: 'COMPLETED' }));
      assert.equal(String(target), receipt.response_url);
      return new Response(JSON.stringify({ video: { url: 'https://fal.media/offline.mp4' } }));
    }) as typeof fetch };
    const job = { jobId: 'owned-job', engineId: 'kling-v4-flash', requestId, legacyModel: endpoint };
    const restarted = await resolveFalJobQueue(job, deps);
    assert.equal((await restarted.status()).status, 'COMPLETED');
    assert.equal((await restarted.result()).data.video.url, 'https://fal.media/offline.mp4');
    await db.pool.query('DELETE FROM fal_queue_log');
    const missing = await resolveFalJobQueue(job, deps);
    await assert.rejects(missing.status(), /receipt metadata/);
    assert.equal(reads, 2);
  } finally { await db.cleanup(); }
});
