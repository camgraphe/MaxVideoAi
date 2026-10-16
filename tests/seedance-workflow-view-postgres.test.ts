import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as views from '../frontend/server/seedance-workflow-view';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';

test('workflow reads expose owned eligibility and expiry without provider identifiers or mutable billing history', { timeout: 90_000 }, async () => {
  const db = await startDisposablePostgres('seedance-view');
  try {
    await createPaidGenerationTestSchema(db.pool);
    await db.pool.query(readFileSync('neon/migrations/53_seedance_draft_links.sql', 'utf8'));
    await db.pool.query(readFileSync('neon/migrations/59_seedance_draft_final_state.sql', 'utf8'));
    await db.pool.query(`INSERT INTO app_jobs (job_id,user_id,engine_id,provider,provider_job_id,status,final_price_cents,currency,duration_sec,aspect_ratio,has_audio,settings_snapshot)
      VALUES ('draft','owner','seedance-2-5','byteplus_modelark','private-provider-task','completed',129,'USD',5,'16:9',false,
      '{"seedanceWorkflow":{"step":"draft"},"inputMode":"t2v","core":{"resolution":"480p","iterationCount":1}}');
      INSERT INTO seedance_draft_links (draft_job_id,user_id,provider_task_id,provider_model_id,validity_started_at,validity_start_source,expires_at,draft_state)
      VALUES ('draft','owner','private-provider-task','private-model',now(),'server_request_started',now()+interval '1 day','ready');`);
    const query = async <T,>(sql: string, values?: readonly unknown[]): Promise<T[]> => (await db.pool.query(sql, values as unknown[])).rows;
    assert.equal(await views.readOwnedSeedanceWorkflowView('other', 'draft', query), null);
    const ready = await views.readOwnedSeedanceWorkflowView('owner', 'draft', query);
    assert.equal(ready?.eligibility, 'ready');
    assert.equal(ready?.draft.amountCents, 129);
    assert.equal(ready?.settings.resolution, '480p');
    assert.ok(ready?.expiresAt);
    assert.equal(JSON.stringify(ready).includes('private-provider-task'), false);
    assert.equal(JSON.stringify(ready).includes('private-model'), false);
    await db.pool.query("UPDATE seedance_draft_links SET validity_started_at = now()-interval '8 days', expires_at = now()-interval '1 hour'");
    assert.equal((await views.readOwnedSeedanceWorkflowView('owner', 'draft', query))?.eligibility, 'expired');
    await db.pool.query("UPDATE seedance_draft_links SET expires_at = now()+interval '1 day', final_job_id = 'final', final_state = 'submitted'");
    assert.equal((await views.readOwnedSeedanceWorkflowView('owner', 'draft', query))?.eligibility, 'unavailable', 'orphan final references fail closed');
    await db.pool.query(`INSERT INTO app_jobs (job_id,user_id,engine_id,provider,status,final_price_cents,currency,settings_snapshot)
      VALUES ('final','owner','seedance-2-5','byteplus_modelark','running',651,'USD','{"seedanceWorkflow":{"step":"final","draftJobId":"draft"}}')`);
    assert.equal((await views.readOwnedSeedanceWorkflowView('owner', 'draft', query))?.eligibility, 'finalizing');
    await db.pool.query("UPDATE app_jobs SET status = 'completed' WHERE job_id = 'final'; UPDATE seedance_draft_links SET final_state = 'completed'");
    const final = await views.readOwnedSeedanceWorkflowView('owner', 'draft', query);
    assert.equal(final?.eligibility, 'finalized');
    assert.equal(final?.draft.amountCents, 129);
    assert.equal(final?.final?.amountCents, 651);
    await db.pool.query(`UPDATE app_jobs SET status = 'failed', payment_status = 'refunded_wallet',
      message = 'Private provider error: req_private https://private.example/token',
      settings_snapshot = settings_snapshot || '{"providerFailure":{"failureCode":"seedance_output_copyright_restricted","providerErrorCode":"private-provider-code"}}'::jsonb
      WHERE job_id = 'draft'`);
    const failed = await views.readOwnedSeedanceWorkflowView('owner', 'draft', query);
    assert.equal(failed?.eligibility, 'failed');
    assert.match(failed?.draft.message ?? '', /copyright/i);
    assert.equal(failed?.draft.paymentStatus, 'refunded_wallet');
    assert.doesNotMatch(JSON.stringify(failed), /req_private|private\.example|private-provider-code|private-provider-task/);
    assert.equal(await views.readOwnedSeedanceWorkflowView('other', 'draft', query), null);
    await db.pool.query(`UPDATE app_jobs SET settings_snapshot = settings_snapshot - 'providerFailure',
      message = 'Seedance stopped this render because its output checks detected possible copyright-restricted content.'
      WHERE job_id = 'draft'`);
    assert.match((await views.readOwnedSeedanceWorkflowView('owner', 'draft', query))?.draft.message ?? '', /copyright/i);
    await db.pool.query(`UPDATE app_jobs SET message = 'Unrecognized private failure: req_private' WHERE job_id = 'draft'`);
    assert.equal((await views.readOwnedSeedanceWorkflowView('owner', 'draft', query))?.draft.message, null);
    for (const mode of ['i2v', 'ref2v', 'v2v', 'extend']) {
      const image = { name: 'owned', type: 'image/png', size: 100, kind: 'image', slotId: 'image_url', url: 'https://cdn.example/image.png', assetId: 'image' };
      const video = { name: 'owned', type: 'video/mp4', size: 100, kind: 'video', slotId: 'video_urls', url: 'https://cdn.example/video.mp4', assetId: 'video' };
      const facts = { schemaVersion: 1, mode, durationSec: 30, durationOption: 'auto', aspectRatio: 'auto',
        hasVideoInput: mode !== 'i2v', ...(mode !== 'i2v' ? { inputVideoDurationSec: 5 } : {}),
        attachments: [mode === 'i2v' ? image : video], trustedMediaReferences: [] };
      await db.pool.query(`UPDATE app_jobs SET status='completed', duration_sec=5.2, aspect_ratio=NULL,
        settings_snapshot=$1::jsonb WHERE job_id='draft'`, [JSON.stringify({ inputMode: mode,
          core: { durationSec: 30, resolution: '480p', iterationCount: 1 }, seedanceWorkflow: { step: 'draft', mediaFacts: facts } })]);
      await db.pool.query("UPDATE seedance_draft_links SET final_job_id=NULL, final_state='none'");
      const inherited = await views.readOwnedSeedanceWorkflowView('owner', 'draft', query);
      assert.equal(inherited?.eligibility, 'ready');
      assert.equal(inherited?.settings.mode, mode);
      assert.equal(inherited?.settings.durationSec, 30, 'a measured fractional output does not erase the original Auto price facts');
      assert.equal(inherited?.settings.aspectRatio, 'auto');
      assert.equal(inherited?.settings.durationOption, 'auto');
      assert.doesNotMatch(JSON.stringify(inherited), /cdn\.example|private-provider-task/);
    }
  } finally { await db.cleanup(); }
});
