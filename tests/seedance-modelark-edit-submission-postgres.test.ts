import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { ENV } from '../frontend/src/lib/env';
import { getDb } from '../frontend/src/lib/db';
import { submitBytePlusGenerateTask } from '../frontend/app/api/generate/_lib/byteplus-submission';
import { runBytePlusPoll } from '../frontend/server/byteplus-poll';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';
import { claimBytePlusLasSubmission, readOwnedBytePlusLasSubmission,
  recordBytePlusLasSubmissionAccepted, recordBytePlusLasSubmissionRejection,
  preserveBytePlusLasSubmission } from '../frontend/server/byteplus-submission-state';
import { getBytePlusLasDurableOutput, persistBytePlusLasOutputBeforeCompletion } from '../frontend/server/byteplus-output-persistence';
import { resolveBytePlusPollTransport } from '../frontend/src/server/video-providers/byteplus-modelark';
import type { LegacyJobMediaRow } from '../frontend/server/media-library-records';

test('Edit submission markers preserve the selected transport under concurrent claims and definitive rejection',
  { timeout: 90_000, concurrency: false }, async () => {
    const db = await startDisposablePostgres('modelark-edit-state');
    const query = async <T,>(sql: string, values?: unknown[]): Promise<T[]> => (await db.pool.query(sql, values)).rows;
    const claim = claimBytePlusLasSubmission as (jobId: string, userId: string,
      query: (sql: string, params?: unknown[]) => Promise<unknown>, transport?: 'modelark' | 'las') => Promise<boolean>;
    const pricing = { totalCents: 71, currency: 'USD', unchangedPaidSnapshot: true };
    try {
      await createPaidGenerationTestSchema(db.pool);
      for (const id of ['modern', 'rejected', 'legacy']) {
        await db.pool.query(`INSERT INTO app_jobs(job_id,user_id,engine_id,provider,status,progress,
          payment_status,final_price_cents,currency,pricing_snapshot,settings_snapshot)
          VALUES ($1,'owner','seedance-2-5','byteplus_modelark','pending',0,'paid_wallet',71,'USD',$2,$3)`,
        [id, pricing, { inputMode: 'v2v', core: { resolution: '480p', aspectRatio: '16:9' } }]);
        await db.pool.query(`INSERT INTO app_receipts(user_id,type,amount_cents,currency,job_id)
          VALUES ('owner','charge',71,'USD',$1)`, [id]);
      }
      assert.equal(await claim('modern', 'another-owner', query, 'modelark'), false);
      const attempts = await Promise.all(Array.from({ length: 4 }, () => claim('modern', 'owner', query, 'modelark')));
      assert.equal(attempts.filter(Boolean).length, 1);
      let modern = await readOwnedBytePlusLasSubmission('modern', 'owner', query);
      assert.equal((modern.settings_snapshot as Record<string, unknown>).byteplusTransport, 'modelark');
      await recordBytePlusLasSubmissionAccepted({ jobId: 'modern', userId: 'owner', providerJobId: 'cgt-owned-edit', queryFn: query });
      await preserveBytePlusLasSubmission({ jobId: 'modern', userId: 'owner', providerJobId: null, queryFn: query });
      modern = await readOwnedBytePlusLasSubmission('modern', 'owner', query);
      assert.equal(modern.provider_job_id, 'cgt-owned-edit');
      assert.equal(resolveBytePlusPollTransport({ providerJobId: modern.provider_job_id, settingsSnapshot: modern.settings_snapshot }), 'modelark');
      assert.deepEqual(modern.pricing_snapshot, pricing);
      assert.equal(await claim('modern', 'owner', query, 'modelark'), false);

      const rejection = { jobId: 'rejected', userId: 'owner', message: 'Known rejection',
        errorCode: 'InvalidParameter', attempted: false, queryFn: query, transport: 'modelark' as const };
      assert.equal(await recordBytePlusLasSubmissionRejection(rejection), true);
      const rejected = await readOwnedBytePlusLasSubmission('rejected', 'owner', query);
      assert.equal((rejected.settings_snapshot as Record<string, unknown>).byteplusTransport, 'modelark');
      assert.equal(await claim('rejected', 'owner', query, 'modelark'), false);
      assert.deepEqual(rejected.pricing_snapshot, pricing);
      assert.equal(rejected.final_price_cents, 71);
      assert.equal(await claim('legacy', 'owner', query), true);
      const legacy = await readOwnedBytePlusLasSubmission('legacy', 'owner', query);
      assert.equal(resolveBytePlusPollTransport({ providerJobId: 'lsd-old-task', settingsSnapshot: legacy.settings_snapshot }), 'las');
      assert.deepEqual((await db.pool.query('SELECT type,amount_cents FROM app_receipts WHERE job_id=$1', ['modern'])).rows,
        [{ type: 'charge', amount_cents: 71 }]);
    } finally { await db.cleanup(); }
  });

test('a recorded ModelArk rejection recovers one immutable wallet refund after a transaction outage',
  { timeout: 90_000, concurrency: false }, async () => {
    const db = await startDisposablePostgres('modelark-edit-refund');
    const previousUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = db.databaseUrl;
    const query = async <T,>(sql: string, values?: unknown[]): Promise<T[]> => (await db.pool.query(sql, values)).rows;
    try {
      await createPaidGenerationTestSchema(db.pool);
      await db.pool.query(`ALTER TABLE app_jobs ADD COLUMN mcp_trial_outcome_disposition text;
        CREATE TABLE fal_queue_log (job_id text,provider text,provider_job_id text,engine_id text,status text,payload jsonb);
        INSERT INTO app_jobs(job_id,user_id,engine_id,provider,status,progress,payment_status,final_price_cents,currency,
          pricing_snapshot,settings_snapshot)
        VALUES ('rejected','owner','seedance-2-5','byteplus_modelark','pending',0,'paid_wallet',71,'USD',
          '{"totalCents":71,"currency":"USD"}','{"inputMode":"v2v"}');
        INSERT INTO app_receipts(user_id,type,amount_cents,currency,job_id) VALUES ('owner','charge',71,'USD','rejected');`);
      await db.pool.query(readFileSync('neon/migrations/47_generation_poll_state.sql', 'utf8'));
      await recordBytePlusLasSubmissionRejection({ jobId: 'rejected', userId: 'owner', transport: 'modelark',
        attempted: false, message: 'The provider rejected the request.', errorCode: 'Unauthorized', queryFn: query });
      await db.pool.query(`CREATE FUNCTION reject_refund() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.type='refund' THEN RAISE EXCEPTION 'injected refund outage'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER refund_outage BEFORE INSERT ON app_receipts FOR EACH ROW EXECUTE FUNCTION reject_refund();`);
      const poll = async () => {
        await db.pool.query("UPDATE app_jobs SET updated_at=now()-interval '1 minute' WHERE job_id='rejected'");
        await db.pool.query("DELETE FROM generation_poll_state WHERE job_id='rejected'");
        return runBytePlusPoll({ jobId: 'rejected', deps: { queryFn: query } });
      };
      await poll();
      assert.equal((await readOwnedBytePlusLasSubmission('rejected', 'owner', query)).payment_status, 'paid_wallet');
      await db.pool.query('DROP TRIGGER refund_outage ON app_receipts');
      await Promise.all([poll(), poll()]);
      const job = await readOwnedBytePlusLasSubmission('rejected', 'owner', query);
      assert.equal(job.status, 'failed');
      assert.equal(job.payment_status, 'refunded_wallet');
      assert.deepEqual(job.pricing_snapshot, { totalCents: 71, currency: 'USD' });
      assert.deepEqual((await db.pool.query("SELECT type,amount_cents,currency FROM app_receipts WHERE job_id='rejected' ORDER BY type")).rows,
        [{ type: 'charge', amount_cents: 71, currency: 'USD' }, { type: 'refund', amount_cents: 71, currency: 'USD' }]);
    } finally { await getDb().end().catch(() => undefined); if (previousUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousUrl; await db.cleanup(); }
  });

test('the paid submission consumer sends source-preserving ModelArk Edit once and polling holds completion for durable output',
  { timeout: 90_000, concurrency: false }, async () => {
    const db = await startDisposablePostgres('modelark-edit-consumer');
    const query = async <T,>(sql: string, values?: unknown[]): Promise<T[]> => (await db.pool.query(sql, values)).rows;
    const flags = { BYTEPLUS_ARK_ENABLED: 'true', BYTEPLUS_ARK_API_KEY: 'fixture-existing-modelark',
      SEEDANCE_2_5_BYTEPLUS_ENABLED: 'true', SEEDANCE_2_5_PROVIDER: 'byteplus_modelark',
      SEEDANCE_2_5_EDIT_TRANSPORT: 'modelark', SEEDANCE_2_5_MODELARK_EDIT_ENABLED: 'true',
      SEEDANCE_2_5_LAS_ENABLED: 'false', BYTEPLUS_LAS_API_KEY: '' };
    const previous = Object.fromEntries(Object.keys(flags).map(key => [key, (ENV as unknown as Record<string, unknown>)[key]]));
    const fetchBefore = globalThis.fetch;
    const env = ENV as unknown as Record<string, unknown>;
    Object.assign(env, flags);
    let posts = 0;
    let gets = 0;
    let copies = 0;
    let projectionUnavailable = true;
    let projected: LegacyJobMediaRow | undefined;
    let keyframeDuration: number | null | undefined;
    const mediaFacts = { version: 1 as const, source: 'probe' as const, probe: 'ffprobe' as const,
      original: { url: 'https://media.example.test/durable-edit.mp4', sha256: 'a'.repeat(64), sizeBytes: 428632 },
      durationSec: 3.708333, videoDurationSec: 3.708333, containerDurationSec: 3.708333, audioDurationSec: null };
    let payload: Record<string, unknown> | undefined;
    globalThis.fetch = (async (input, init) => {
      assert.match(String(input), /^https:\/\/ark\.ap-southeast\.bytepluses\.com\/api\/v3\/contents\/generations\/tasks/);
      if (init?.method === 'POST') {
        posts++;
        payload = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ id: 'cgt-owned-edit', status: 'queued' }), { status: 202 });
      }
      gets++;
      return new Response(JSON.stringify({ id: 'cgt-owned-edit', status: 'succeeded', duration: 4, resolution: '480p',
        content: { video_url: 'https://provider.example.test/temporary.mp4' }, usage: { total_tokens: 100000 } }));
    }) as typeof fetch;
    try {
      await createPaidGenerationTestSchema(db.pool);
      await db.pool.query('ALTER TABLE app_jobs ADD COLUMN mcp_trial_outcome_disposition text');
      await db.pool.query(readFileSync('neon/migrations/47_generation_poll_state.sql', 'utf8'));
      await db.pool.query(`INSERT INTO app_jobs(job_id,user_id,engine_id,provider,status,progress,duration_sec,aspect_ratio,
        payment_status,final_price_cents,currency,pricing_snapshot,settings_snapshot)
        VALUES ('consumer','owner','seedance-2-5','byteplus_modelark','pending',0,4,'16:9',
          'paid_wallet',71,'USD','{"totalCents":71,"currency":"USD"}',
          '{"inputMode":"v2v","core":{"resolution":"480p","aspectRatio":"16:9"}}')`);
      const params = { jobId: 'consumer', userId: 'owner', engineId: 'seedance-2-5', engineLabel: 'Seedance 2.5',
        prompt: 'Edit Video1: change the square to green.', durationSec: 4, mode: 'v2v' as const,
        initialImageUrl: null, endImageUrl: null, normalizedReferenceImages: [], videoUrls: ['https://media.example.test/owned-original.mp4'],
        resolvedAudioUrl: null, audioUrls: [], effectiveResolution: '480p', aspectRatio: '16:9', audioEnabled: false,
        placeholderThumb: '/assets/frames/thumb-16x9.svg', pricing: { totalCents: 71, currency: 'USD' } as never,
        paymentStatus: 'paid_wallet', pendingReceipt: null, paymentMode: 'wallet' as const, walletChargeReserved: true,
        batchId: null, groupId: null, iterationIndex: null, iterationCount: null, renderIds: null, heroRenderId: null, localKey: null,
        deps: { queryFn: query } };
      assert.equal((await submitBytePlusGenerateTask(params)).ok, true);
      assert.equal(posts, 1);
      assert.equal(payload?.omni_reference_task_type, 'edit');
      assert.equal(payload?.duration, -1);
      assert.equal(payload?.ratio, 'adaptive');
      assert.equal((await readOwnedBytePlusLasSubmission('consumer', 'owner', query)).settings_snapshot?.byteplusTransport, 'modelark');
      assert.equal((await submitBytePlusGenerateTask(params)).ok, true);
      assert.equal(posts, 1);
      env.SEEDANCE_2_5_MODELARK_EDIT_ENABLED = 'false';
      const poll = async () => {
        await db.pool.query("UPDATE app_jobs SET updated_at=now()-interval '1 minute' WHERE job_id='consumer'");
        await db.pool.query("DELETE FROM generation_poll_state WHERE job_id='consumer'");
        await runBytePlusPoll({ jobId: 'consumer', deps: { queryFn: query,
          ensureFastStartVideoFn: async options => { copies++; options.onVideoMediaFacts?.(mediaFacts); return mediaFacts.original.url; },
          ensureJobThumbnailFn: async () => 'https://media.example.test/edit.jpg',
          upsertLegacyJobOutputsFn: async output => { if (projectionUnavailable) throw new Error('output projection unavailable'); projected = output; },
          recordBytePlusPollEventFn: async () => undefined, applyBytePlusTrialOutcomeSafelyFn: async () => undefined,
          generateAndPersistJobPreviewVideoFn: async () => null,
          generateAndPersistJobKeyframesFn: async options => { keyframeDuration = options.durationSec; return []; },
        } });
      };
      await poll();
      const processing = await readOwnedBytePlusLasSubmission('consumer', 'owner', query);
      assert.equal(processing.status, 'processing');
      assert.ok(getBytePlusLasDurableOutput(processing));
      projectionUnavailable = false;
      await poll();
      assert.equal((await readOwnedBytePlusLasSubmission('consumer', 'owner', query)).status, 'processing', 'Projection recovery honors its backoff.');
      await db.pool.query("UPDATE app_jobs SET settings_snapshot=jsonb_set(settings_snapshot,'{byteplusStorageCopy,nextRetryAt}',to_jsonb((now()-interval '1 second')::text),false) WHERE job_id='consumer'");
      await poll();
      assert.equal((await readOwnedBytePlusLasSubmission('consumer', 'owner', query)).status, 'completed');
      assert.equal(copies, 1);
      assert.equal(gets, 1, 'recovery must use durable output after the provider result expires');
      assert.equal(posts, 1);
      assert.equal(projected?.duration_sec, 3.708333, 'Projection recovery retains measured timing without another provider lookup or copy');
      assert.deepEqual(projected?.video_media_facts, mediaFacts);
      assert.equal(keyframeDuration, 3.708333, 'Keyframes use actual delivered media timing');
    } finally { globalThis.fetch = fetchBefore; Object.assign(env, previous); await db.cleanup(); }
  });

test('ModelArk Edit retains durable bytes and accounting when output promotion must be retried',
  { timeout: 90_000, concurrency: false }, async () => {
    const db = await startDisposablePostgres('modelark-edit-durable');
    const query = async <T,>(sql: string, values?: unknown[]): Promise<T[]> => (await db.pool.query(sql, values)).rows;
    try {
      await createPaidGenerationTestSchema(db.pool);
      await db.pool.query(`INSERT INTO app_jobs(job_id,user_id,engine_id,provider,status,progress,provider_job_id,
        payment_status,final_price_cents,currency,settings_snapshot)
        VALUES ('modern','owner','seedance-2-5','byteplus_modelark','running',50,'cgt-owned-edit',
          'paid_wallet',71,'USD','{"inputMode":"v2v","byteplusTransport":"modelark"}')`);
      const job = await readOwnedBytePlusLasSubmission('modern', 'owner', query);
      const cost = { provider: 'byteplus_modelark', provider_cost_source: 'published_modelark_rate', total_tokens: 123456 };
      await assert.rejects(persistBytePlusLasOutputBeforeCompletion({ job,
        videoUrl: 'https://media.example.test/durable-edit.mp4', thumbUrl: 'https://media.example.test/edit.jpg',
        costBreakdown: cost, queryFn: query, upsertOutputsFn: async () => { throw new Error('projection temporarily unavailable'); } }),
      /projection temporarily unavailable/);
      const stored = await readOwnedBytePlusLasSubmission('modern', 'owner', query);
      assert.equal(stored.status, 'processing');
      assert.deepEqual(getBytePlusLasDurableOutput(stored), { videoUrl: 'https://media.example.test/durable-edit.mp4',
        thumbUrl: 'https://media.example.test/edit.jpg', costBreakdown: cost });
      assert.equal(stored.final_price_cents, 71);
      assert.equal(getBytePlusLasDurableOutput({ ...stored, provider_job_id: 'cgt-unrelated' }), null);
      assert.equal(getBytePlusLasDurableOutput({ ...stored, settings_snapshot: { ...stored.settings_snapshot as object, inputMode: 'ref2v' } }), null);
    } finally { await db.cleanup(); }
  });
