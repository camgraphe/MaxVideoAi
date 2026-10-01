import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runBytePlusPoll } from '../frontend/server/byteplus-poll';
import { getOwnedReadySeedanceDraftLink } from '../frontend/server/seedance-draft-links';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';
import { allowGenerationPoll } from './helpers/generation-poll-claim';

test('a 2.5 Draft is ready only after its durable output completes, without a provider draft flag', { timeout: 90_000 }, async () => {
  const db = await startDisposablePostgres('seedance-draft-poll');
  try {
    await createPaidGenerationTestSchema(db.pool);
    await db.pool.query('ALTER TABLE app_jobs ADD COLUMN mcp_trial_outcome_disposition text');
    await db.pool.query(readFileSync('neon/migrations/53_seedance_draft_links.sql', 'utf8'));
    const start = new Date(Date.now() - 60_000).toISOString();
    await db.pool.query(`INSERT INTO app_jobs (job_id,user_id,engine_id,engine_label,provider,provider_job_id,status,duration_sec,
      thumb_url,aspect_ratio,has_audio,settings_snapshot,created_at,updated_at)
      VALUES ('draft','owner','seedance-2-5','Seedance 2.5','byteplus_modelark','cgt-draft','queued',5,
      'https://example.com/thumb.jpg','16:9',false,$1,now()-interval '1 minute',now()-interval '1 minute')`, [{
        core: { resolution: '480p', aspectRatio: '16:9' },
        seedanceWorkflow: { step: 'draft', validityStartedAt: start, providerModelId: 'seedance-model' },
      }]);
    const query = async <T,>(sql: string, values?: readonly unknown[]): Promise<T[]> => (await db.pool.query(sql, values as unknown[])).rows;
    assert.equal(await getOwnedReadySeedanceDraftLink('owner', 'draft', query), null);
    const response = await runBytePlusPoll({ deps: { queryFn: query, claimPollFn: allowGenerationPoll,
      getBytePlusArkConfigFn: () => ({ seedance25ModelId: 'seedance-model' }) as never,
      getBytePlusModelArkClientFn: () => ({ retrieveTask: async () => ({ providerJobId: 'cgt-draft', status: 'completed',
        rawStatus: 'succeeded', videoUrl: 'https://provider.example/draft.mp4', usage: { completionTokens: 48038 }, raw: {} }) }) as never,
      ensureFastStartVideoFn: async () => 'https://maxvideoai.example/owned-draft.mp4',
      upsertLegacyJobOutputsFn: async () => undefined, applyBytePlusTrialOutcomeSafelyFn: async () => undefined,
      generateAndPersistJobPreviewVideoFn: async () => null, generateAndPersistJobKeyframesFn: async () => [],
      recordBytePlusPollEventFn: async () => undefined } });
    assert.equal((await response.json()).updates, 1);
    assert.ok(await getOwnedReadySeedanceDraftLink('owner', 'draft', query));
    assert.equal((await db.pool.query("SELECT video_url FROM app_jobs WHERE job_id = 'draft'")).rows[0].video_url,
      'https://maxvideoai.example/owned-draft.mp4');
    assert.equal((await db.pool.query('SELECT validity_started_at FROM seedance_draft_links')).rows[0].validity_started_at.toISOString(), start);
  } finally { await db.cleanup(); }
});
