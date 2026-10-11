import assert from 'node:assert/strict';
import test from 'node:test';
import {getDb} from '../frontend/src/lib/db';
import {
  claimQueuedTimelineExportById,
  createTimelineExportJob,
  updateTimelineExportProgress,
} from '../frontend/src/server/timeline-exports/repository';
import {startDisposablePostgres, type DisposablePostgres} from './helpers/disposable-postgres';

async function withRenderingExport(run: (fixture: {database: DisposablePostgres; exportId: string}) => Promise<void>) {
  const database = await startDisposablePostgres('timeline-export-progress');
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = database.databaseUrl;
  try {
    const job = await createTimelineExportJob({
      userId: 'progress-owner',idempotencyKey: 'progress:fixture',projectName: 'Progress fixture',durationSec: 5,
      resolution: '720p',fps: 30,qualityPreset: 'standard',amountCents: 0,currency: 'USD',
      billingKind: 'free',billingStatus: 'free_reserved',renderManifest: {},exportSettings: {},
    });
    assert.equal((await claimQueuedTimelineExportById(job.id))?.status,'rendering');
    await run({database,exportId: job.id});
  } finally {
    await getDb().end();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    await database.cleanup();
  }
}

test('rendering progress updates its message and timestamp while preserving billing and artifact fields',async () => {
  await withRenderingExport(async ({database,exportId}) => {
    const read = async () => (await database.pool.query(`SELECT progress,message,updated_at::text AS updated_at,
      (to_jsonb(e) - ARRAY['progress','message','updated_at'])::text AS preserved
      FROM app_timeline_exports e WHERE id=$1`,[exportId])).rows[0];
    const before = await read();
    await updateTimelineExportProgress({exportId,progress: 36.7,message: 'Rendering MP4.'});
    const after = await read();
    assert.equal(after.progress,37);
    assert.equal(after.message,'Rendering MP4.');
    assert.notEqual(after.updated_at,before.updated_at);
    assert.equal(after.preserved,before.preserved);
  });
});

for (const status of ['failed','completed'] as const) {
  test(`progress delayed behind a ${status} transition cannot rewrite the terminal export`,async () => {
    await withRenderingExport(async ({database,exportId}) => {
      const transition = await database.pool.connect();
      let delayedProgress: Promise<void> | undefined;
      try {
        await transition.query('BEGIN');
        await transition.query('SELECT id FROM app_timeline_exports WHERE id=$1 FOR UPDATE',[exportId]);
        delayedProgress = updateTimelineExportProgress({exportId,progress: 91,message: 'Rendering MP4.'});
        // Wait for the real progress UPDATE to block behind the terminal writer.
        const deadline = Date.now()+5000;
        let blocked = false;
        do {
          blocked = (await database.pool.query(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity
            WHERE datname=current_database() AND wait_event_type='Lock'
              AND ltrim(query) LIKE 'UPDATE app_timeline_exports%SET progress%') AS blocked`)).rows[0].blocked;
          if (!blocked) await new Promise(resolve => setTimeout(resolve,10));
        } while (!blocked && Date.now()<deadline);
        assert.equal(blocked,true,'The late progress UPDATE must be in flight before the terminal transition.');

        // Controlled terminal facts; the production progress query remains real.
        await transition.query(`UPDATE app_timeline_exports SET status=$2,progress=$3,message=$4,
          billing_status=$5,output_url=$6,output_asset_id=$7,output_size_bytes=$8,output_mime_type=$9,
          updated_at=NOW() WHERE id=$1`,[
          exportId,status,status === 'completed' ? 100 : 35,
          status === 'completed' ? 'Export ready.' : 'Renderer failed: original diagnostic.',
          status === 'completed' ? 'free_completed' : 'free_released',
          status === 'completed' ? 'https://media.maxvideoai.com/timeline-exports/progress-owner/film.mp4' : null,
          status === 'completed' ? 'owned-output' : null,status === 'completed' ? 1234 : null,
          status === 'completed' ? 'video/mp4' : null,
        ]);
        const before = (await transition.query('SELECT to_jsonb(e)::text AS snapshot FROM app_timeline_exports e WHERE id=$1',[exportId])).rows[0].snapshot;
        await transition.query('COMMIT');
        await delayedProgress;
        // Also cover a callback which only starts after the terminal commit.
        await updateTimelineExportProgress({exportId,progress: 98,message: 'Late rendering progress.'});
        const after = (await database.pool.query('SELECT to_jsonb(e)::text AS snapshot FROM app_timeline_exports e WHERE id=$1',[exportId])).rows[0].snapshot;
        assert.equal(after,before,'Delayed progress must preserve the entire terminal row, including diagnostic, progress, timestamp, billing and artifact.');
      } finally {
        await transition.query('ROLLBACK');
        await delayedProgress?.catch(() => undefined);
        transition.release();
      }
    });
  });
}
