import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ENV } from '../frontend/src/lib/env';
import { getDb, withDbTransaction } from '../frontend/src/lib/db';
import { getWalletBalanceCents } from '../frontend/src/lib/wallet';
import { createInitialVideoJobInExecutor, type CreateVideoInitialJobParams } from '../frontend/app/api/generate/_lib/initial-video-job';
import { submitBytePlusGenerateTask } from '../frontend/app/api/generate/_lib/byteplus-submission';
import { BytePlusModelArkError } from '../frontend/src/server/video-providers/byteplus-modelark-error';
import { runBytePlusPoll } from '../frontend/server/byteplus-poll';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';

test('LAS jobs retain one debit across uncertain submission and terminal recovery', { timeout: 90_000, concurrency: false }, async t => {
  const db = await startDisposablePostgres('seedance25-las-reliability');
  const previousUrl = process.env.DATABASE_URL;
  const keys = ['BYTEPLUS_ARK_ENABLED', 'SEEDANCE_2_5_BYTEPLUS_ENABLED', 'SEEDANCE_2_5_PROVIDER', 'SEEDANCE_2_5_LAS_ENABLED'] as const;
  const previous = keys.map(key => ENV[key]);
  process.env.DATABASE_URL = db.databaseUrl;
  ENV.BYTEPLUS_ARK_ENABLED = 'true';
  ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = 'true';
  ENV.SEEDANCE_2_5_PROVIDER = 'byteplus_modelark';
  ENV.SEEDANCE_2_5_LAS_ENABLED = 'true';
  const query = async <T = Record<string, unknown>,>(sql: string, values?: unknown[]): Promise<T[]> => (await db.pool.query(sql, values)).rows;
  const pricing = { totalCents: 711, currency: 'USD', meta: { pricingMode: 'manual_tariff', customerTariffRevision: 7 } };
  const initial = (jobId: string): CreateVideoInitialJobParams => ({
    jobId, userId: 'owner', paymentMode: 'wallet', walletReservation: 'reserve', funding: { kind: 'wallet', reservation: 'reserve' },
    preferredCurrency: 'usd', resolvedCurrencyLower: 'usd', pendingReceipt: {
      jobId, userId: 'owner', amountCents: 711, currency: 'USD', description: 'LAS Edit', snapshot: pricing,
      auditPricingSnapshot: pricing, applicationFeeCents: null, vendorAccountId: null,
    }, jobInsert: {
      jobId, userId: 'owner', engineId: 'seedance-2-5', engineLabel: 'Seedance 2.5', durationSec: 5,
      prompt: 'Keep the scene, change the light.', thumbUrl: '/thumb.svg', aspectRatio: '16:9', hasAudio: false,
      canUpscale: false, previewFrame: '/thumb.svg', batchId: null, groupId: null, iterationIndex: null, iterationCount: 1,
      renderIdsJson: null, heroRenderId: null, localKey: jobId, message: null, etaSeconds: null, etaLabel: null,
      provider: 'byteplus_modelark', finalPriceCents: 711, pricingSnapshotJson: JSON.stringify(pricing), costBreakdownJson: null,
      settingsSnapshotJson: JSON.stringify({ inputMode: 'v2v', byteplusInputVideoDurationSec: 3, core: { resolution: '480p', aspectRatio: '16:9' } }),
      currency: 'USD', vendorAccountId: null, paymentStatus: 'paid_wallet', stripePaymentIntentId: null, stripeChargeId: null,
      visibility: 'private', indexable: false,
    },
  });
  const reserve = (jobId: string) => withDbTransaction(executor => createInitialVideoJobInExecutor(executor, initial(jobId)));
  const job = async (jobId: string) => (await query<{ status: string; payment_status: string; provider_job_id: string | null; settings_snapshot: Record<string, unknown>; video_url: string | null }>('SELECT * FROM app_jobs WHERE job_id = $1', [jobId]))[0];
  const receipts = (jobId: string) => query<{ type: string; amount_cents: number; currency: string }>('SELECT type,amount_cents,currency FROM app_receipts WHERE job_id=$1 ORDER BY type', [jobId]);
  const submit = (jobId: string, create: () => Promise<unknown>, queryFn = query, paymentMode: 'wallet' | 'direct' = 'wallet') => submitBytePlusGenerateTask({
    jobId, userId: 'owner', engineId: 'seedance-2-5', engineLabel: 'Seedance 2.5', prompt: 'Keep the scene, change the light.',
    durationSec: 5, mode: 'v2v', initialImageUrl: null, endImageUrl: null, normalizedReferenceImages: [],
    videoUrls: ['https://example.test/source.mp4'], resolvedAudioUrl: null, audioUrls: [], effectiveResolution: '480p',
    aspectRatio: '16:9', audioEnabled: false, placeholderThumb: '/thumb.svg', pricing: pricing as never,
    paymentStatus: 'paid_wallet', pendingReceipt: jobId === 'rejected'
      ? { ...initial(jobId).pendingReceipt!, amountCents: 9999, currency: 'EUR' } : initial(jobId).pendingReceipt,
    paymentMode, walletChargeReserved: paymentMode === 'wallet', batchId: null, groupId: null, iterationIndex: null, iterationCount: 1,
    renderIds: null, heroRenderId: null, localKey: jobId,
    deps: { queryFn, getBytePlusArkConfigFn: () => ({ seedance25ModelId: 'seedance-model' }) as never,
      getBytePlusModelArkClientFn: transport => { assert.equal(transport, 'las'); return { createSeedanceFastTask: create } as never; } },
  });
  const poll = (jobId: string, retrieve: () => Promise<unknown>, copy: () => Promise<string | null> = async () => 'https://cdn.maxvideoai.com/stored.mp4') => runBytePlusPoll({ jobId, deps: {
    queryFn: query, getBytePlusArkConfigFn: () => ({ seedance25ModelId: 'seedance-model' }) as never,
    getBytePlusModelArkClientFn: transport => { assert.equal(transport, 'las'); return { retrieveTask: retrieve } as never; },
    ensureFastStartVideoFn: copy, ensureJobThumbnailFn: async () => 'https://cdn.maxvideoai.com/thumb.jpg',
    upsertLegacyJobOutputsFn: async () => undefined, generateAndPersistJobPreviewVideoFn: async () => null,
    generateAndPersistJobKeyframesFn: async () => [], applyBytePlusTrialOutcomeSafelyFn: async () => undefined,
    recordBytePlusPollEventFn: async () => undefined,
  } });
  const age = (jobId: string) => query("UPDATE app_jobs SET updated_at=now()-interval '1 minute' WHERE job_id=$1", [jobId]);
  try {
    await createPaidGenerationTestSchema(db.pool);
    await db.pool.query(`ALTER TABLE app_jobs ADD COLUMN mcp_trial_outcome_disposition text;
      CREATE TABLE fal_queue_log (job_id text, provider text, provider_job_id text, engine_id text, status text, payload jsonb);
      CREATE TABLE app_customer_tariff_state (singleton boolean PRIMARY KEY, revision bigint, active boolean);
      INSERT INTO app_customer_tariff_state VALUES (true,7,true);
      INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES ('owner','topup',20000,'USD');`);
    await db.pool.query(readFileSync('neon/migrations/47_generation_poll_state.sql', 'utf8'));
    await t.test('network ambiguity persists transport before POST and cannot debit or submit the same job again', async () => {
      await reserve('network');
      let posts = 0;
      const create = async () => {
        posts++;
        const persisted = await job('network');
        assert.equal(persisted.settings_snapshot.byteplusTransport, 'las', 'transport must commit before provider work');
        assert.ok((persisted.settings_snapshot.byteplusSubmission as { startedAt?: string })?.startedAt);
        throw new Error('connection reset after request write');
      };
      const result = await submit('network', create);
      assert.equal(result.body.error, 'BYTEPLUS_SUBMISSION_UNCERTAIN');
      assert.equal((await job('network')).status, 'provider_polling_stalled');
      assert.equal((await job('network')).payment_status, 'paid_wallet');
      assert.equal((await reserve('network')).kind, 'existing_job');
      await submit('network', create);
      assert.equal(posts, 1);
      assert.deepEqual(await receipts('network'), [{ type: 'charge', amount_cents: 711, currency: 'USD' }]);
    });
    await t.test('HTTP 503 and successful responses without an ID retain reservations', async () => {
      for (const [id, status] of [['http503', 503], ['noid', 200]] as const) {
        await reserve(id);
        await submit(id, async () => { throw new BytePlusModelArkError('unknown acceptance', { status }); });
        assert.equal((await job(id)).status, 'provider_polling_stalled');
        assert.deepEqual(await receipts(id), [{ type: 'charge', amount_cents: 711, currency: 'USD' }]);
      }
    });
    await t.test('accepted ID survives persistence failure and finishes after submission flags turn off', async () => {
      await reserve('accepted');
      let failUpdate = true;
      let durableIdBeforeFinalization: string | null = null;
      const failingQuery = async <T,>(sql: string, values?: unknown[]): Promise<T[]> => {
        if (failUpdate && values?.includes('Render submitted.')) {
          durableIdBeforeFinalization = (await job('accepted')).provider_job_id;
          failUpdate = false;
          throw new Error('injected accepted write outage');
        }
        return query<T>(sql, values);
      };
      const result = await submit('accepted', async () => ({ providerJobId: 'lsd-accepted', status: 'queued' }), failingQuery);
      assert.equal(durableIdBeforeFinalization, 'lsd-accepted', 'accepted task identity must commit independently of the final response update');
      assert.equal(result.body.error, 'BYTEPLUS_SUBMISSION_UNCERTAIN');
      assert.equal((await job('accepted')).provider_job_id, 'lsd-accepted');
      assert.equal((await job('accepted')).settings_snapshot.byteplusTransport, 'las');
      ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = 'false'; ENV.SEEDANCE_2_5_LAS_ENABLED = 'false';
      await age('accepted');
      await query("UPDATE app_jobs SET status='provider_polling_stalled' WHERE job_id='accepted'");
      const completed = async () => ({ providerJobId: 'lsd-accepted', status: 'completed', rawStatus: 'succeeded',
        videoUrl: 'https://provider.example.test/ephemeral.mp4', usage: { totalTokens: 999999 }, raw: { duration: 5, resolution: '480p' } });
      await poll('accepted', completed, async () => null);
      assert.equal((await job('accepted')).status, 'processing');
      assert.equal((await job('accepted')).video_url, null, 'ephemeral supplier URL must never become the completed output');
      await query("UPDATE app_jobs SET updated_at=now()-interval '1 minute',settings_snapshot=jsonb_set(settings_snapshot,'{byteplusStorageCopy,nextRetryAt}','\"2000-01-01T00:00:00Z\"') WHERE job_id='accepted'");
      await query("DELETE FROM generation_poll_state WHERE job_id='accepted'");
      await poll('accepted', completed);
      assert.equal((await job('accepted')).status, 'completed');
      assert.equal((await job('accepted')).video_url, 'https://cdn.maxvideoai.com/stored.mp4');
      assert.deepEqual(await receipts('accepted'), [{ type: 'charge', amount_cents: 711, currency: 'USD' }]);
      const after = await job('accepted');
      await poll('accepted', completed);
      assert.deepEqual(await job('accepted'), after);
      ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = 'true'; ENV.SEEDANCE_2_5_LAS_ENABLED = 'true';
    });
    await t.test('definite rejection refund failure remains recoverable and refunds the stored charge exactly once', async () => {
      await reserve('rejected');
      await db.pool.query(`CREATE FUNCTION reject_refund() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.type='refund' THEN RAISE EXCEPTION 'injected refund outage'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER refund_outage BEFORE INSERT ON app_receipts FOR EACH ROW EXECUTE FUNCTION reject_refund();`);
      await submit('rejected', async () => { throw new BytePlusModelArkError('invalid source', { status: 400, code: 'InvalidParameter' }); });
      assert.equal((await job('rejected')).status, 'pending', 'failed status must roll back together with an uncommitted refund');
      assert.equal((await job('rejected')).payment_status, 'paid_wallet');
      assert.equal((await job('rejected')).settings_snapshot.byteplusTransport, 'las');
      await db.pool.query('DROP TRIGGER refund_outage ON app_receipts');
      ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = 'false'; ENV.SEEDANCE_2_5_LAS_ENABLED = 'false';
      await age('rejected');
      const noLookup = async () => { assert.fail('a definitive submit rejection has no provider task to poll'); };
      await Promise.all([poll('rejected', noLookup), poll('rejected', noLookup)]);
      assert.equal((await job('rejected')).status, 'failed');
      assert.equal((await job('rejected')).payment_status, 'refunded_wallet');
      assert.deepEqual(await receipts('rejected'), [{ type: 'charge', amount_cents: 711, currency: 'USD' }, { type: 'refund', amount_cents: 711, currency: 'USD' }]);
      await poll('rejected', noLookup);
      assert.equal((await receipts('rejected')).length, 2);
      ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = 'true'; ENV.SEEDANCE_2_5_LAS_ENABLED = 'true';
    });
    await t.test('terminal provider failure under concurrent polling refunds the persisted charge once', async () => {
      await reserve('failed');
      await submit('failed', async () => ({ providerJobId: 'lsd-failed', status: 'queued' }));
      await age('failed');
      const failed = async () => ({ providerJobId: 'lsd-failed', status: 'failed', rawStatus: 'failed', message: 'Provider failed.', raw: {} });
      await Promise.all([poll('failed', failed), poll('failed', failed)]);
      assert.equal((await job('failed')).status, 'failed');
      assert.equal((await job('failed')).payment_status, 'refunded_wallet');
      assert.deepEqual(await receipts('failed'), [{ type: 'charge', amount_cents: 711, currency: 'USD' }, { type: 'refund', amount_cents: 711, currency: 'USD' }]);
      await poll('failed', failed);
      assert.equal((await receipts('failed')).length, 2);
    });
    await t.test('unsupported legacy direct funding cannot issue a LAS request or fake a wallet refund', async () => {
      await query(`INSERT INTO app_jobs(job_id,user_id,engine_id,provider,status,final_price_cents,payment_status,currency,settings_snapshot)
        VALUES ('direct','owner','seedance-2-5','byteplus_modelark','pending',711,'paid_direct','USD','{}')`);
      await query(`INSERT INTO app_receipts(user_id,job_id,type,amount_cents,currency,stripe_payment_intent_id)
        VALUES ('owner','direct','charge',711,'USD','pi_direct')`);
      let posts = 0;
      await submit('direct', async () => { posts++; return { providerJobId: 'lsd-direct', status: 'queued' }; }, query, 'direct');
      assert.equal(posts, 0);
      assert.equal((await job('direct')).payment_status, 'paid_direct');
      assert.equal((await job('direct')).status, 'provider_polling_stalled');
      await age('direct');
      await poll('direct', async () => { assert.fail('unsupported card funding requires review'); });
      assert.equal((await job('direct')).payment_status, 'paid_direct');
      assert.deepEqual(await receipts('direct'), [{ type: 'charge', amount_cents: 711, currency: 'USD' }]);
    });
    assert.equal((await getWalletBalanceCents('owner')).balanceCents, 20000 - 4 * 711);
  } finally {
    await getDb().end().catch(() => undefined);
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    keys.forEach((key, i) => { ENV[key] = previous[i] as never; });
    await db.cleanup();
  }
});
