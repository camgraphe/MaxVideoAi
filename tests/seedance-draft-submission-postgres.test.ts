import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { submitBytePlusGenerateTask } from '../frontend/app/api/generate/_lib/byteplus-submission';
import { BytePlusModelArkError } from '../frontend/src/server/video-providers/byteplus-modelark-error';
import { ENV } from '../frontend/src/lib/env';
import { markSeedanceDraftReady, reserveSeedanceDraftFinal } from '../frontend/server/seedance-draft-links';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';

test('Draft and final submission use stored owned lineage and uncertain submissions cannot refund or retry', { timeout: 90_000 }, async () => {
  const db = await startDisposablePostgres('seedance-workflow-submit');
  const previous = { enabled: ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED, provider: ENV.SEEDANCE_2_5_PROVIDER };
  ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = 'true'; ENV.SEEDANCE_2_5_PROVIDER = 'byteplus_modelark';
  try {
    await createPaidGenerationTestSchema(db.pool);
    await db.pool.query('ALTER TABLE app_jobs ADD COLUMN mcp_trial_outcome_disposition text');
    await db.pool.query(readFileSync('neon/migrations/53_seedance_draft_links.sql', 'utf8'));
    await db.pool.query(readFileSync('neon/migrations/59_seedance_draft_final_state.sql', 'utf8'));
    const query = async <T,>(sql: string, values?: readonly unknown[]): Promise<T[]> => (await db.pool.query(sql, values as unknown[])).rows;
    const payloads: unknown[] = [];
    let refunds = 0;
    let failureStatus: number | null = null;
    const submit = async (jobId: string, step: 'draft' | 'final') => submitBytePlusGenerateTask({
      jobId, userId: 'owner', engineId: 'seedance-2-5', engineLabel: 'Seedance 2.5', prompt: 'A wave',
      durationSec: 5, mode: 't2v', initialImageUrl: null, endImageUrl: null, normalizedReferenceImages: [],
      videoUrls: [], resolvedAudioUrl: null, audioUrls: [], effectiveResolution: step === 'draft' ? '480p' : '1080p',
      aspectRatio: '16:9', audioEnabled: false, placeholderThumb: '/thumb.svg',
      pricing: { totalCents: 711, currency: 'USD' } as never, paymentStatus: 'paid_wallet',
      pendingReceipt: { userId: 'owner', jobId, amountCents: 711, currency: 'USD', description: 'Final', snapshot: {}, applicationFeeCents: null, vendorAccountId: null },
      paymentMode: 'wallet', walletChargeReserved: true, batchId: null, groupId: null, iterationIndex: null,
      iterationCount: 1, renderIds: null, heroRenderId: null, localKey: null,
      seedanceWorkflow: { step, ...(step === 'final' ? { draftJobId: 'draft' } : {}) },
      deps: { queryFn: query, getBytePlusArkConfigFn: () => ({ seedance25ModelId: 'seedance-model' }) as never,
        rollbackPendingPaymentFn: async ({ pendingReceipt }) => {
          refunds++;
          await query("INSERT INTO app_receipts (user_id,job_id,type,amount_cents,currency) VALUES ($1,$2,'refund',$3,$4) ON CONFLICT DO NOTHING",
            [pendingReceipt!.userId, pendingReceipt!.jobId, pendingReceipt!.amountCents, pendingReceipt!.currency]);
        }, getBytePlusModelArkClientFn: (transport) => {
          assert.equal(transport, 'modelark');
          return { createSeedanceFastTask: async (payload: unknown) => {
            payloads.push(payload);
            if (failureStatus) throw new BytePlusModelArkError('submission rejected', { status: failureStatus });
            return { providerJobId: step === 'draft' ? 'cgt-draft' : 'cgt-final', status: 'queued' };
          } } as never;
        } },
    } as Parameters<typeof submitBytePlusGenerateTask>[0]);
    await db.pool.query(`INSERT INTO app_jobs (job_id,user_id,engine_id,provider,status,settings_snapshot)
      VALUES ('draft','owner','seedance-2-5','byteplus_modelark','pending','{"seedanceWorkflow":{"step":"draft"}}')`);
    assert.equal((await submit('draft', 'draft')).ok, true);
    assert.equal((payloads[0] as { draft?: boolean }).draft, true);
    assert.equal((await db.pool.query('SELECT draft_state FROM seedance_draft_links')).rows[0]?.draft_state, 'pending');
    await db.pool.query("UPDATE app_jobs SET status = 'completed' WHERE job_id = 'draft'");
    await markSeedanceDraftReady('owner', 'draft', query);
    await db.pool.query(`INSERT INTO app_jobs (job_id,user_id,engine_id,provider,status,settings_snapshot)
      VALUES ('final','owner','seedance-2-5','byteplus_modelark','pending','{"seedanceWorkflow":{"step":"final","draftJobId":"draft"}}')`);
    await reserveSeedanceDraftFinal({ userId: 'owner', draftJobId: 'draft', finalJobId: 'final' }, query);
    assert.equal((await submit('final', 'final')).ok, true);
    assert.deepEqual(payloads[1], { model: 'seedance-model', content: [{ type: 'draft_task', draft_task: { id: 'cgt-draft' } }], resolution: '1080p', watermark: false });
    assert.equal((await db.pool.query('SELECT final_state FROM seedance_draft_links')).rows[0].final_state, 'submitted');
    failureStatus = 503;
    await db.pool.query(`INSERT INTO app_jobs (job_id,user_id,engine_id,provider,status,settings_snapshot)
      VALUES ('uncertain','owner','seedance-2-5','byteplus_modelark','pending','{"seedanceWorkflow":{"step":"draft"}}')`);
    assert.equal((await submit('uncertain', 'draft')).ok, false);
    assert.equal(refunds, 0);
    assert.equal((await db.pool.query("SELECT status FROM app_jobs WHERE job_id = 'uncertain'")).rows[0].status, 'provider_polling_stalled');
    failureStatus = 400;
    await db.pool.query("UPDATE app_jobs SET status = 'pending', provider_job_id = NULL, final_price_cents = 711, currency = 'USD', payment_status = 'paid_wallet' WHERE job_id = 'final'");
    await db.pool.query("UPDATE seedance_draft_links SET final_state = 'reserved'");
    await db.pool.query("INSERT INTO app_receipts (user_id,job_id,type,amount_cents,currency) VALUES ('owner','final','charge',711,'USD')");
    const rejected = await submit('final', 'final');
    assert.equal(rejected.ok, false);
    assert.equal(rejected.body.paymentStatus, 'refunded_wallet');
    const link = (await db.pool.query('SELECT draft_state, final_state, final_job_id FROM seedance_draft_links')).rows[0];
    assert.deepEqual(link, { draft_state: 'ready', final_state: 'none', final_job_id: null });
    assert.equal((await db.pool.query("SELECT status FROM app_jobs WHERE job_id = 'draft'")).rows[0].status, 'completed');
    assert.equal((await db.pool.query("SELECT * FROM app_receipts WHERE job_id = 'draft' AND type = 'refund'")).rowCount, 0);

  } finally {
    ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = previous.enabled; ENV.SEEDANCE_2_5_PROVIDER = previous.provider;
    await db.cleanup();
  }
});
