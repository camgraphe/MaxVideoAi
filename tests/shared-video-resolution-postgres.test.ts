import assert from 'node:assert/strict';
import test from 'node:test';
import { BASE_SELECT } from '../frontend/server/videos-query';
import { mapGalleryVideoRow, type VideoRow } from '../frontend/server/videos-normalization';
import { buildVideoSettingsSnapshotFromSharedVideo } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-shared-video-snapshot';
import type { SharedVideoPreview } from '../frontend/lib/video-preview-group';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test('public reuse preserves recorded resolution without exposing the private snapshot', async (t) => {
  const database = await startDisposablePostgres('shared-resolution');
  t.after(() => database.cleanup());
  await database.pool.query(`
    CREATE TABLE app_jobs (
      job_id text PRIMARY KEY, user_id text, engine_id text, engine_label text,
      duration_sec integer, prompt text, thumb_url text, video_url text,
      aspect_ratio text, has_audio boolean, can_upscale boolean, created_at timestamptz,
      visibility text, indexable boolean, featured boolean, featured_order integer,
      final_price_cents integer, currency text, pricing_snapshot jsonb, settings_snapshot jsonb
    );
    CREATE TABLE job_outputs (
      job_id text, kind text, status text, width integer, height integer,
      position integer, created_at timestamptz, thumb_url text, url text, storage_url text
    );
  `);
  const snapshot = { core: { resolution: '720P' }, refs: { imageUrl: 'https://private.test/input' }, negativePrompt: 'Private value' };
  await database.pool.query(`INSERT INTO app_jobs
    (job_id, engine_id, engine_label, duration_sec, prompt, aspect_ratio, has_audio,
     created_at, visibility, indexable, final_price_cents, currency, settings_snapshot)
    VALUES ('example', 'seedance-2-5', 'Seedance 2.5', 24, 'Example prompt', '16:9', true,
      NOW(), 'public', true, 123, 'USD', $1::jsonb)`, [JSON.stringify(snapshot)]);
  const read = async () => {
    const { rows } = await database.pool.query<VideoRow>(`${BASE_SELECT} WHERE job_id = $1`, ['example']);
    assert.equal('settings_snapshot' in rows[0], false);
    const video = mapGalleryVideoRow(rows[0]);
    assert.equal('settingsSnapshot' in JSON.parse(JSON.stringify(video)), false);
    assert.ok(!JSON.stringify(video).includes('private.test'));
    return {
      video,
      snapshot: buildVideoSettingsSnapshotFromSharedVideo(video as SharedVideoPreview) as { core: { resolution: string | null } },
    };
  };
  assert.equal((await read()).snapshot.core.resolution, '720p', 'recorded settings survive absent output dimensions');
  await database.pool.query(`INSERT INTO job_outputs (job_id, kind, status, width, height, position, created_at)
    VALUES ('example', 'video', 'completed', 1920, 1080, 0, NOW())`);
  assert.equal((await read()).snapshot.core.resolution, '1080p', 'measured output takes precedence');
  await database.pool.query(`UPDATE job_outputs SET width = 1000, height = 1000`);
  assert.equal((await read()).snapshot.core.resolution, null, 'unknown measured output cannot claim the requested size');
  await database.pool.query(`DELETE FROM job_outputs`);
  for (const resolution of ['unknown', '', null, { private: 'value' }]) {
    await database.pool.query(`UPDATE app_jobs SET settings_snapshot = $1::jsonb`, [JSON.stringify({ ...snapshot, core: { resolution } })]);
    const result = await read();
    assert.equal(result.video.requestedResolution, undefined);
    assert.equal(result.snapshot.core.resolution, null, 'invalid or absent settings are not invented');
  }
  await database.pool.query('ALTER TABLE app_jobs DROP COLUMN settings_snapshot');
  assert.equal((await read()).snapshot.core.resolution, null, 'older read schemas remain usable without bootstrap writes');
});
