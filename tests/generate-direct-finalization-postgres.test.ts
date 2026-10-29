import assert from 'node:assert/strict';
import test from 'node:test';
import { executePreparedVideoGeneration } from '../frontend/src/server/video-generation/execute-prepared-video-generation';
import { getDb } from '../frontend/src/lib/db';
import { persistFinalVideoJobUpdate } from '../frontend/app/api/generate/_lib/final-job-persistence';
import { withWalletFailureSettlement } from '../frontend/server/fal-webhook-refunds';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';

test('completeDirect responds from the winning completed job without failed effects', { timeout: 90_000 }, async (t) => {
  const db = await startDisposablePostgres('direct-finalization');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = db.databaseUrl;
  t.after(async () => {
    await getDb().end();
    if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous;
    await db.cleanup();
  });
  t.mock.method(console, 'error', () => {});
  await createPaidGenerationTestSchema(db.pool);
  await db.pool.query('CREATE TABLE fal_queue_log(job_id text, provider text, provider_job_id text, engine_id text, status text, payload jsonb)');
  await db.pool.query('ALTER TABLE app_jobs ADD COLUMN mcp_trial_outcome_disposition text');
  await db.pool.query(`INSERT INTO app_jobs(job_id,user_id,engine_id,engine_label,status,progress,
    payment_status,provider,provider_job_id,video_url,thumb_url,pricing_snapshot)
    VALUES('winner','owner','minimax-h3','MiniMax H3','completed',100,'paid_wallet','fal','request-winner',
      'https://cdn.maxvideoai.com/winner.mp4','/ready.webp','{"totalCents":100,"currency":"USD"}')`);
  const before = (await db.pool.query("SELECT * FROM app_jobs WHERE job_id='winner'")).rows[0];
  const metrics: string[] = [];
  let providerCalls = 0;
  const media = { thumb: '/placeholder.svg', previewFrame: '/placeholder.svg', video: null, videoAsset: null,
    providerMode: 'fal', status: 'failed', progress: 0, providerJobId: 'request-winner',
    settingsSnapshotJson: '{}', message: 'Stale copy failure', sourceVideoUrl: null };
  const execute = (jobId = 'winner') => executePreparedVideoGeneration({
    body: {}, userId: 'owner', localKey: null, requestStartedAt: Date.now(), logMetric: kind => { metrics.push(kind); },
    routeContext: { engine: { id: 'minimax-h3', label: 'MiniMax H3', upscale4k: false }, isBytePlusV1a: false,
      jobId, mode: 't2v', payment: { mode: 'wallet' }, providerKey: 'fal',
      providerRoutingPlan: { kind: 'fal_only', primaryProvider: 'fal', fallbackEnabled: false } } as never,
    requestOptions: { prompt: 'test', audioEnabled: false, aspectRatio: '16:9', batchId: null,
      groupId: null, iterationIndex: null, iterationCount: null, renderIds: null, heroRenderId: null,
      etaSeconds: 60, etaLabel: '60s', isLumaRay2: false, loop: false, effectiveResolution: '720p', message: null } as never,
    walletReservation: 'already_reserved', preReservedInitialState: { kind: 'created', jobId, walletChargeReserved: true },
    adapters: {
      submitGenerateProviderTask: async () => { providerCalls++; return { kind: 'generation_result', generationResult: {} }; },
      submitBytePlusGenerateTask: async () => { throw new Error('Unexpected provider'); },
      buildInitialProviderMediaState: () => media, resolveProviderMediaState: async () => media,
      buildMissingProviderJobIdResponse: async () => { throw new Error('Unexpected missing ID'); },
    } as never,
    billing: { preferredCurrency: 'usd', resolvedCurrencyLower: 'usd', resolvedCurrencyUpper: 'USD',
      pricing: { totalCents: 100, currency: 'USD' }, priceOnlyReceipts: true, costBreakdownUsd: null,
      receiptSnapshot: {}, pricingSnapshotJson: '{"totalCents":100,"currency":"USD"}', costBreakdownJson: null,
      vendorAccountId: null, applicationFeeCents: 0, visibility: 'private', indexable: false,
      paymentMode: 'wallet', pendingReceipt: { userId: 'owner', jobId, amountCents: 100,
        currency: 'USD', description: 'Run', snapshot: {}, vendorAccountId: null, applicationFeeCents: null },
      paymentStatus: 'paid_wallet', stripePaymentIntentId: null, stripeChargeId: null } as never,
    effectiveDurationSec: 5, effectiveDurationLabel: '5s', initialImageUrl: null, resolvedFirstFrameUrl: null,
    endImageUrl: null, normalizedReferenceImages: [], videoUrls: [], resolvedAudioUrl: null, audioUrls: [],
    placeholderThumb: '/placeholder.svg', falPayload: {} as never, falInputSummary: {} as never, settingsSnapshot: {},
  });
  const result = await execute();
  assert.equal(result.body.status, 'completed');
  assert.equal(result.body.videoUrl, 'https://cdn.maxvideoai.com/winner.mp4');
  assert.equal(result.body.paymentStatus, 'paid_wallet');
  assert.equal(providerCalls, 1);
  assert.deepEqual(metrics, []);
  assert.deepEqual((await db.pool.query("SELECT * FROM app_jobs WHERE job_id='winner'")).rows[0], before);
  assert.equal((await db.pool.query("SELECT COUNT(*)::int AS count FROM app_receipts WHERE type='refund'")).rows[0].count, 0);
  assert.equal((await db.pool.query("SELECT COUNT(*)::int AS count FROM fal_queue_log")).rows[0].count, 0);

  const seedPaid = async (jobId: string) => {
    await db.pool.query(`INSERT INTO app_jobs(job_id,user_id,engine_id,engine_label,status,payment_status,
      provider,provider_job_id,final_price_cents,currency,pricing_snapshot)
      VALUES($1,'owner','minimax-h3','MiniMax H3','running','paid_wallet','fal',$2,125,'USD','{}')`, [jobId, `request-${jobId}`]);
    await db.pool.query(`INSERT INTO app_receipts(user_id,type,amount_cents,currency,job_id)
      VALUES('owner','charge',125,'USD',$1)`, [jobId]);
  };
  const finalize = (jobId: string, status: string, settlement = withWalletFailureSettlement) => persistFinalVideoJobUpdate({
    jobId, thumb: '/ready.webp', aspectRatio: '16:9', previewFrame: '/ready.webp', etaSeconds: null,
    etaLabel: null, video: status === 'completed' ? 'https://cdn.maxvideoai.com/late.mp4' : null,
    status, progress: status === 'completed' ? 100 : 0, providerJobId: `request-${jobId}`,
    finalPriceCents: 999, pricingSnapshotJson: '{}', costBreakdownJson: null, currency: 'USD',
    vendorAccountId: null, paymentStatus: 'paid_wallet', stripePaymentIntentId: null, stripeChargeId: null,
    visibility: 'private', indexable: false, message: null, settingsSnapshotJson: '{}', withFailureSettlementFn: settlement,
  });
  await t.test('a late success keeps the actual refund and never charges again', async () => {
    await seedPaid('late-success');
    const failed = await finalize('late-success', 'failed');
    assert.equal(failed.job.payment_status, 'refunded_wallet');
    const completed = await finalize('late-success', 'completed');
    assert.equal(completed.kind, 'applied');
    assert.equal(completed.job.status, 'completed');
    assert.equal(completed.job.payment_status, 'refunded_wallet');
    assert.deepEqual((await db.pool.query(`SELECT type,amount_cents FROM app_receipts WHERE job_id='late-success' ORDER BY type`)).rows,
      [{ type: 'charge', amount_cents: 125 }, { type: 'refund', amount_cents: 125 }]);
  });
  await t.test('completion after the refund commit supersedes stale failed effects', async () => {
    await seedPaid('after-settlement');
    const result = await finalize('after-settlement', 'failed', async (jobId, context, persist) => {
      const result = await withWalletFailureSettlement(jobId, context, persist);
      await db.pool.query("UPDATE app_jobs SET status='completed',video_url='https://cdn.maxvideoai.com/after.mp4' WHERE job_id=$1", [jobId]);
      return result;
    });
    assert.equal(result.kind, 'superseded');
    assert.equal(result.job.status, 'completed');
    assert.equal(result.job.payment_status, 'refunded_wallet');
  });

  await t.test('an applied result renders the stored fields even when the status is unchanged', async () => {
    await seedPaid('same-state');
    await db.pool.query(`CREATE FUNCTION canonical_job_fields() RETURNS trigger AS $$ BEGIN
      IF NEW.job_id='same-state' THEN NEW.progress=64; NEW.thumb_url='/stored.webp';
        NEW.provider_job_id='canonical-same'; NEW.message='Stored state'; END IF;
      RETURN NEW; END $$ LANGUAGE plpgsql;
      CREATE TRIGGER canonical_job_fields BEFORE UPDATE ON app_jobs FOR EACH ROW EXECUTE FUNCTION canonical_job_fields()`);
    media.status = 'running'; media.progress = 12; media.providerJobId = 'request-same-state';
    const response = await execute('same-state');
    assert.equal(response.body.status, 'running');
    assert.equal(response.body.progress, 64);
    assert.equal(response.body.thumbUrl, '/stored.webp');
    assert.equal(response.body.providerJobId, 'canonical-same');
    assert.equal(response.body.message, 'Stored state');
  });
});
