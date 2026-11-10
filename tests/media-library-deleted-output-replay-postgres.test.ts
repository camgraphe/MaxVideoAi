import assert from 'node:assert/strict';
import test from 'node:test';
import type { JobOutputRecord } from '../frontend/server/media-library-records';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test('deleted output identities survive provider replay and stale job projections', { timeout: 120_000 }, async t => {
  const pg = await startDisposablePostgres('deleted-output-replay');
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  const db = await import('../frontend/src/lib/db');
  t.after(async () => { await db.getDb().end(); process.env.DATABASE_URL = previousUrl; await pg.cleanup(); });
  const { ensureMediaLibrarySchema } = await import('../frontend/src/lib/schema');
  await ensureMediaLibrarySchema();
  await pg.pool.query(`CREATE TABLE app_jobs(job_id text PRIMARY KEY,user_id text,hidden boolean DEFAULT false,status text);
    CREATE TABLE mcp_generation_quotes(quote_id uuid PRIMARY KEY,user_id text,job_id text,state text)`);
  const { upsertJobOutputs, upsertLegacyJobOutputs, listJobOutputsByJobIds, applyOutputsToJobPayload } = await import('../frontend/server/media-library/job-outputs');
  const { resolveStudioMedia } = await import('../frontend/src/server/studio/media-resolver');
  const makeOutput = (jobId: string, kind: JobOutputRecord['kind'], position = 0): JobOutputRecord => ({
    id: `${jobId}:${kind}:${position}`, jobId, userId: 'replay-owner', kind,
    url: `https://storage.googleapis.com/provider-output/${jobId}-${position}.${kind === 'image' ? 'png' : kind === 'audio' ? 'mp3' : 'mp4'}`,
    storageUrl: null, thumbUrl: `https://storage.googleapis.com/provider-output/${jobId}-${position}.webp`,
    previewUrl: kind === 'video' ? `https://storage.googleapis.com/provider-output/${jobId}-preview.mp4` : null,
    mimeType: kind === 'image' ? 'image/png' : kind === 'audio' ? 'audio/mpeg' : 'video/mp4',
    width: 1280, height: 720, durationSec: 5, position, status: 'ready', metadata: {},
  });
  const seed = async (outputs: JobOutputRecord[]) => {
    await pg.pool.query("INSERT INTO app_jobs(job_id,user_id,status) VALUES($1,'replay-owner','completed')", [outputs[0].jobId]);
    await upsertJobOutputs(outputs);
  };
  const erase = async (id: string) => { await pg.pool.query("UPDATE job_outputs SET status='deleted' WHERE id=$1", [id]); };

  await t.test('a repeated callback acknowledges a tombstone without changing any stored output field', async () => {
    const output = makeOutput('deleted-external', 'image');
    await seed([output]); await erase(output.id);
    const before = (await pg.pool.query('SELECT to_jsonb(o) AS snapshot FROM job_outputs o WHERE id=$1', [output.id])).rows[0].snapshot;
    await assert.doesNotReject(upsertJobOutputs([{ ...output, url: 'https://storage.googleapis.com/provider-output/replacement.png' }]));
    await assert.doesNotReject(upsertJobOutputs([output]));
    assert.deepEqual((await pg.pool.query('SELECT to_jsonb(o) AS snapshot FROM job_outputs o WHERE id=$1', [output.id])).rows[0].snapshot, before);
    await assert.rejects(resolveStudioMedia('replay-owner', { type: 'job-output', jobId: output.jobId, outputId: output.id, kind: 'image' }), /MEDIA_DELETED/);
    await assert.rejects(upsertJobOutputs([{ ...output, userId: 'foreign-owner' }]), /ownership/);
  });

  await t.test('a known tombstone never reaches a storage persistence trigger', async () => {
    const output = makeOutput('deleted-storage', 'video');
    await seed([output]); await erase(output.id);
    await pg.pool.query(`CREATE FUNCTION reject_replayed_deleted_output() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF EXISTS(SELECT 1 FROM job_outputs WHERE job_id=NEW.job_id AND kind=NEW.kind AND position=NEW.position AND status='deleted')
        THEN RAISE EXCEPTION 'storage object is deleted or being deleted' USING ERRCODE='40001'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_replayed_deleted_output BEFORE INSERT ON job_outputs FOR EACH ROW EXECUTE FUNCTION reject_replayed_deleted_output()`);
    try { await assert.doesNotReject(upsertJobOutputs([output])); }
    finally { await pg.pool.query('DROP TRIGGER reject_replayed_deleted_output ON job_outputs'); }
  });

  await t.test('a callback waiting behind deletion rechecks the committed tombstone', async () => {
    const output = makeOutput('concurrent-deletion', 'video');
    await seed([output]);
    const deletion = await pg.pool.connect();
    try {
      await deletion.query('BEGIN');
      await deletion.query("UPDATE job_outputs SET status='deleted' WHERE id=$1", [output.id]);
      const replay = upsertJobOutputs([output]);
      await new Promise(resolve => setTimeout(resolve, 30));
      await deletion.query('COMMIT');
      await assert.doesNotReject(replay);
      assert.equal((await pg.pool.query('SELECT status FROM job_outputs WHERE id=$1', [output.id])).rows[0].status, 'deleted');
    } finally { await deletion.query('ROLLBACK'); deletion.release(); }
  });

  await t.test('mixed-kind callbacks use the same output lock order as purge', async () => {
    const video = makeOutput('ordered-deletion', 'video'), audio = makeOutput('ordered-deletion', 'audio');
    await seed([video, audio]);
    const deletion = await pg.pool.connect();
    try {
      await deletion.query('BEGIN');
      await deletion.query('SELECT id FROM job_outputs WHERE id=$1 FOR UPDATE', [audio.id]);
      const replay = upsertJobOutputs([video, audio]).then(() => null, error => error as Error);
      await new Promise(resolve => setTimeout(resolve, 30));
      await deletion.query('SELECT id FROM job_outputs WHERE id=$1 FOR UPDATE', [video.id]);
      await deletion.query("UPDATE job_outputs SET status='deleted' WHERE job_id=$1", [video.jobId]);
      await deletion.query('COMMIT');
      assert.equal(await replay, null, 'a provider callback must not deadlock against ordered purge locks');
      assert.deepEqual((await pg.pool.query('SELECT status FROM job_outputs WHERE job_id=$1', [video.jobId])).rows.map(row => row.status), ['deleted', 'deleted']);
    } finally { await deletion.query('ROLLBACK'); deletion.release(); }
  });

  await t.test('required MCP promotion acknowledges a deleted legacy replay', async () => {
    const output = makeOutput('deleted-mcp', 'video');
    await seed([output]); await erase(output.id);
    await pg.pool.query("INSERT INTO mcp_generation_quotes VALUES('40000000-0000-4000-8000-000000000001','replay-owner',$1,'accepted')", [output.jobId]);
    await assert.doesNotReject(upsertLegacyJobOutputs({ job_id: output.jobId, user_id: output.userId, video_url: output.url, status: 'completed' }, {
      requireMcpPromotion: true,
      // A remote promotion failure must be irrelevant to an identity the user already deleted.
      promoteMcpOutputsFn: async outputs => ({ promoted: 0, failed: outputs.length, skipped: 0 }),
    }));
    assert.equal((await pg.pool.query('SELECT status FROM job_outputs WHERE id=$1', [output.id])).rows[0].status, 'deleted');
  });

  await t.test('the web overlay removes deleted image projections while preserving an independent identical-URL sibling', async () => {
    const removed = makeOutput('mixed-images', 'image'), survivor = { ...makeOutput('mixed-images', 'image', 1), url: removed.url };
    await seed([removed, survivor]); await erase(removed.id);
    const map = await listJobOutputsByJobIds([removed.jobId], { ensureSchema: false });
    const payload = applyOutputsToJobPayload({ jobId: removed.jobId, status: 'completed', finalPriceCents: 123,
      thumbUrl: removed.thumbUrl, previewFrame: removed.thumbUrl, heroRenderId: removed.id,
      renderIds: [removed.url, survivor.url], renderThumbUrls: [removed.thumbUrl!, survivor.thumbUrl!],
      imageRenders: [{ url: removed.url, sourceOutputId: removed.id }, { url: survivor.url, sourceOutputId: survivor.id }],
    }, map.get(removed.jobId));
    assert.equal(map.get(removed.jobId)?.find(output => output.id === removed.id)?.status, 'deleted', 'the read overlay needs the tombstone rather than an absent projection');
    assert.deepEqual(payload.renderIds, [survivor.url]);
    assert.deepEqual(payload.imageRenders?.map(image => image.sourceOutputId), [survivor.id]);
    assert.equal(payload.thumbUrl, survivor.thumbUrl);
    assert.equal(payload.previewFrame, survivor.thumbUrl);
    assert.equal(payload.heroRenderId, survivor.id);
    assert.equal(payload.status, 'completed'); assert.equal(payload.finalPriceCents, 123);
  });

  await t.test('all-deleted output overlays clear playback and retain the historical receipt', async () => {
    const video = makeOutput('empty-projection', 'video'), audio = makeOutput('empty-projection', 'audio'), image = makeOutput('empty-projection', 'image');
    await seed([video, audio, image]); for (const output of [video, audio, image]) await erase(output.id);
    const outputs = (await listJobOutputsByJobIds([video.jobId], { ensureSchema: false })).get(video.jobId);
    const payload = applyOutputsToJobPayload({ jobId: video.jobId, status: 'completed', finalPriceCents: 123,
      videoUrl: video.url, previewVideoUrl: video.previewUrl, playbackVideoUrl: video.url, audioUrl: audio.url,
      thumbUrl: image.thumbUrl, previewFrame: image.thumbUrl, heroRenderId: image.id,
      renderIds: [image.url], renderThumbUrls: [image.thumbUrl!], imageRenders: [{ url: image.url, sourceOutputId: image.id }],
    }, outputs);
    assert.equal(payload.videoUrl, null); assert.equal(payload.previewVideoUrl, null); assert.equal(payload.playbackVideoUrl, null);
    assert.equal(payload.audioUrl, null); assert.equal(payload.thumbUrl, null); assert.equal(payload.previewFrame, null); assert.equal(payload.heroRenderId, null);
    assert.deepEqual(payload.renderIds, []); assert.deepEqual(payload.renderThumbUrls, []); assert.deepEqual(payload.imageRenders, []);
    assert.equal(payload.status, 'completed'); assert.equal(payload.finalPriceCents, 123);
    const historical = { jobId: 'no-projection', videoUrl: video.url };
    assert.equal(applyOutputsToJobPayload(historical, undefined), historical, 'missing historical projections preserve their original fallback');
  });
});
