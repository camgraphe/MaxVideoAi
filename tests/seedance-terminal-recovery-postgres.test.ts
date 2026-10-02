import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runBytePlusPoll } from '../frontend/server/byteplus-poll';
import { getOwnedReadySeedanceDraftLink } from '../frontend/server/seedance-draft-links';
import { recoverTerminalSeedanceWorkflow } from '../frontend/server/seedance-workflow-terminal-recovery';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';
import { allowGenerationPoll } from './helpers/generation-poll-claim';

test('durable completed output survives a transient lineage failure and owned terminal reads repair eligibility', { timeout: 90_000 }, async () => {
  const db = await startDisposablePostgres('seedance-terminal');
  try {
    await createPaidGenerationTestSchema(db.pool);
    await db.pool.query('ALTER TABLE app_jobs ADD COLUMN mcp_trial_outcome_disposition text');
    for (const path of ['53_seedance_draft_links.sql', '59_seedance_draft_final_state.sql']) await db.pool.query(readFileSync(`neon/migrations/${path}`, 'utf8'));
    const settings = { core: { resolution: '480p', aspectRatio: '16:9', iterationCount: 1 }, inputMode: 't2v', seedanceWorkflow: { step: 'draft', validityStartedAt: new Date(Date.now()-60_000).toISOString(), providerModelId: 'model' } };
    await db.pool.query(`INSERT INTO app_jobs (job_id,user_id,engine_id,engine_label,provider,provider_job_id,status,duration_sec,thumb_url,aspect_ratio,has_audio,settings_snapshot,created_at,updated_at)
      VALUES ('draft','owner','seedance-2-5','Seedance','byteplus_modelark','cgt-draft','queued',5,'https://example.com/thumb.jpg','16:9',false,$1,now()-interval '1 minute',now()-interval '1 minute')`, [settings]);
    let lineageFails = true, projected = 0;
    const query = async <T,>(sql: string, values?: readonly unknown[]): Promise<T[]> => {
      if (lineageFails && sql.includes('INSERT INTO seedance_draft_links')) { lineageFails = false; throw new Error('transient lineage failure'); }
      return (await db.pool.query(sql, values as unknown[])).rows;
    };
    await runBytePlusPoll({ deps: { queryFn: query, claimPollFn: allowGenerationPoll,
      getBytePlusArkConfigFn: () => ({ seedance25ModelId: 'model' }) as never,
      getBytePlusModelArkClientFn: () => ({ retrieveTask: async () => ({ providerJobId: 'cgt-draft', status: 'completed', rawStatus: 'succeeded', videoUrl: 'https://provider.example/draft.mp4', raw: {} }) }) as never,
      ensureFastStartVideoFn: async () => 'https://maxvideoai.example/draft.mp4', upsertLegacyJobOutputsFn: async () => { projected++; },
      applyBytePlusTrialOutcomeSafelyFn: async () => undefined, generateAndPersistJobPreviewVideoFn: async () => null,
      generateAndPersistJobKeyframesFn: async () => [], recordBytePlusPollEventFn: async () => undefined } });
    assert.equal(projected, 1, 'a lineage outage cannot skip media output projection');
    const job = (await db.pool.query("SELECT * FROM app_jobs WHERE job_id = 'draft'")).rows[0];
    assert.equal(job.status, 'completed');
    assert.equal(await getOwnedReadySeedanceDraftLink('owner', 'draft', query), null);
    await recoverTerminalSeedanceWorkflow(job, query);
    assert.ok(await getOwnedReadySeedanceDraftLink('owner', 'draft', query));
    await db.pool.query(`INSERT INTO app_jobs (job_id,user_id,engine_id,provider,status,provider_job_id,final_price_cents,currency,payment_status,settings_snapshot)
      VALUES ('final','owner','seedance-2-5','byteplus_modelark','failed','cgt-final',651,'USD','refunded_wallet','{"seedanceWorkflow":{"step":"final","draftJobId":"draft"}}');
      INSERT INTO app_receipts (user_id,job_id,type,amount_cents,currency) VALUES ('owner','final','charge',651,'USD'),('owner','final','refund',651,'USD');
      UPDATE seedance_draft_links SET final_job_id = 'final', final_state = 'submitted'`);
    await recoverTerminalSeedanceWorkflow((await db.pool.query("SELECT * FROM app_jobs WHERE job_id = 'final'")).rows[0], query);
    assert.ok(await getOwnedReadySeedanceDraftLink('owner', 'draft', query), 'fully refunded terminal attempt repairs the missed release');
    let unrelatedQueries = 0;
    await recoverTerminalSeedanceWorkflow({ ...job, provider: 'fal' }, async () => { unrelatedQueries++; return []; });
    assert.equal(unrelatedQueries, 0);
  } finally { await db.cleanup(); }
});
