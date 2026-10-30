import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { marketingVideoReader } from '../frontend/server/marketing-media/public-read';
import { readLegacyPlaylistVideos } from '../frontend/server/playlists/legacy-video-reader';
import {
  BASE_SELECT,
  BASE_SELECT_FOR_REUSE,
  BASE_SELECT_WITH_SETTINGS,
  PUBLIC_VIDEO_SOURCE_ELIGIBILITY,
} from '../frontend/server/videos-query';
import { mapGalleryVideoRow, type VideoRow } from '../frontend/server/videos-normalization';
import { buildVideoSettingsSnapshotFromSharedVideo } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-shared-video-snapshot';
import { buildExampleRecreationHref } from '../frontend/lib/example-recreation';
import type { QueryExecutor } from '../frontend/src/lib/db';
import type { SharedVideoPreview } from '../frontend/lib/video-preview-group';

test('public read overlay preserves page IDs, eligibility, settings and dimensions after deleting the personal source', async () => {
  const db = await startDisposablePostgres('marketing-public');
  const executor: QueryExecutor = { query: async (sql, params) => (await db.pool.query(sql, params as any[])).rows };
  try {
    await db.pool
      .query(`CREATE TABLE app_jobs(job_id text PRIMARY KEY,user_id text,engine_id text,engine_label text,duration_sec int,prompt text,thumb_url text,video_url text,preview_video_url text,keyframe_urls jsonb,
   aspect_ratio text,has_audio boolean,can_upscale boolean,created_at timestamptz,visibility text,indexable boolean,featured boolean,featured_order int,final_price_cents int,currency text,pricing_snapshot jsonb,settings_snapshot jsonb,status text,surface text);
   CREATE TABLE job_outputs(job_id text,kind text,status text,width int,height int,position int,created_at timestamptz,thumb_url text,url text,storage_url text);
   CREATE TABLE media_assets(user_id text,url text,status text,deleted_at timestamptz);
   CREATE TABLE playlists(id text PRIMARY KEY,slug text,is_public boolean);
   CREATE TABLE playlist_items(video_id text,order_index int,playlist_id text DEFAULT 'playlist');
   INSERT INTO playlists VALUES('playlist','marketing-fixture',true);
   INSERT INTO app_jobs(job_id,user_id,engine_id,engine_label,prompt,video_url,thumb_url,status,surface,visibility,indexable,duration_sec,created_at)
    VALUES('stable-page','owner','luma-ray-3-2','Luma','Exact prompt','https://media.example/personal.mp4','https://media.example/personal.jpg','completed','video','public',true,5,'2026-10-22');
   INSERT INTO playlist_items(video_id,order_index) VALUES('stable-page',7);`);
    const legacy = marketingVideoReader(executor, false);
    assert.equal(
      (await legacy.query<VideoRow>(BASE_SELECT))[0].job_id,
      'stable-page',
      'disabled operation needs no marketing migration',
    );
    await executor.query(readFileSync('neon/migrations/78_marketing_media.sql', 'utf8'));
    const [original] = await executor.query<any>('SELECT to_jsonb(app_jobs) AS job FROM app_jobs');
    const snapshot = {
      schemaVersion: 1,
      surface: 'video',
      engineId: 'luma-ray-3-2',
      engineLabel: 'Luma',
      inputMode: 'v2v',
      prompt: 'Exact prompt',
      negativePrompt: 'no blur',
      core: { durationSec: 5, resolution: '1080p', fps: 24, aspectRatio: '9:16' },
      advanced: { seed: 42, extraInputValues: { strength: 0.7 } },
      refs: { videoUrls: ['https://media.example/marketing-media/reference.mp4'] },
    };
    const publication = {
      ...original.job,
      user_id: null,
      video_url: 'https://media.example/marketing-media/original.mp4',
      thumb_url: 'https://media.example/marketing-media/poster.jpg',
      settings_snapshot: snapshot,
      marketing_output_width: 1080,
      marketing_output_height: 1920,
    };
    await executor.query(
      `INSERT INTO marketing_media(video_id,copy_id,state,source_user_id,source_fingerprint,source_snapshot,source_record,publication,recreation_snapshot,attempt_id,copied_by)
   VALUES('stable-page',gen_random_uuid(),'ready','owner','fingerprint',$1,'{}',$2,$1,gen_random_uuid(),'admin')`,
      [JSON.stringify(snapshot), JSON.stringify(publication)],
    );
    const reader = marketingVideoReader(executor, true);
    const rows = await reader.query<VideoRow>(`${BASE_SELECT} WHERE ${PUBLIC_VIDEO_SOURCE_ELIGIBILITY}`);
    assert.equal(rows.length, 1, 'one publication, no duplicate in a gallery');
    assert.equal(rows[0].video_url, 'https://media.example/marketing-media/original.mp4');
    assert.equal(rows[0].generation_mode, 'v2v', 'public copies retain their recorded mode without the full recipe');
    assert.equal(rows[0].recreation_snapshot, undefined, 'gallery reads must not transport the complete reuse recipe');
    const previousFlag = process.env.MARKETING_MEDIA_ENABLED;
    process.env.MARKETING_MEDIA_ENABLED = '1';
    try {
      const playlist = await readLegacyPlaylistVideos({ slug: 'marketing-fixture' }, executor);
      assert.equal(playlist[0].id, 'stable-page');
      assert.equal(playlist[0].recreationSnapshot, undefined, 'direct playlist cards also omit the full recipe');
    } finally {
      if (previousFlag === undefined) delete process.env.MARKETING_MEDIA_ENABLED;
      else process.env.MARKETING_MEDIA_ENABLED = previousFlag;
    }
    await executor.query(
      `INSERT INTO media_assets VALUES('owner','https://media.example/personal.mp4','deleted',now());DELETE FROM job_outputs;DELETE FROM app_jobs`,
    );
    const [row] = await reader.query<VideoRow>(
      `${BASE_SELECT_WITH_SETTINGS} WHERE job_id=$1 AND visibility='public' AND indexable IS TRUE AND ${PUBLIC_VIDEO_SOURCE_ELIGIBILITY}`,
      ['stable-page'],
    );
    const video = mapGalleryVideoRow(row);
    assert.equal(video.generationMode, 'v2v');
    assert.equal(video.id, 'stable-page');
    assert.equal(video.indexable, true);
    assert.equal(video.visibility, 'public');
    assert.deepEqual([video.outputWidth, video.outputHeight], [1080, 1920]);
    const hydrated = buildVideoSettingsSnapshotFromSharedVideo(video as SharedVideoPreview);
    assert.deepEqual(hydrated, snapshot, 'the original generation settings replace the old derived t2v fallback');
    const [reuseRow] = await reader.query<VideoRow>(`${BASE_SELECT_FOR_REUSE} WHERE job_id=$1`, ['stable-page']);
    assert.deepEqual(
      buildVideoSettingsSnapshotFromSharedVideo(mapGalleryVideoRow(reuseRow) as SharedVideoPreview),
      snapshot,
      'the single-video app handoff retains the full recipe independently of the slim gallery projection',
    );
    const [membership] = await reader.query<any>(
      `WITH selected AS (SELECT video_id FROM playlist_items) SELECT job_id FROM app_jobs JOIN selected ON selected.video_id=app_jobs.job_id`,
    );
    assert.equal(membership.job_id, 'stable-page', 'existing playlist membership still resolves without rewriting IDs');
    const comparison = buildExampleRecreationHref('stable-page', 'luma-ray-3-2', {
      mode: 't2v',
      durationSec: 5,
      aspectRatio: '9:16',
      resolution: '1080p',
      audio: false,
    });
    assert.match(comparison, /from=stable-page/);
    assert.match(comparison, /remix=1/);
    assert.match(comparison, /mode=t2v/);
    const legacyRecipe = { ...snapshot, inputMode: 'extend' };
    const provenance = {
      ...legacyRecipe, operation: 'luma-extend', sourceJobId: 'private-source-job',
      refs: { videoUrls: ['https://private.example/source.mp4'], assetId: 'private-asset' },
    };
    await executor.query(`UPDATE marketing_media SET source_snapshot=$1,recreation_snapshot=$2,
      publication=jsonb_set(publication,'{settings_snapshot}',$2::jsonb) WHERE video_id='stable-page'`,
      [JSON.stringify(provenance), JSON.stringify(legacyRecipe)]);
    for (const sql of [BASE_SELECT, BASE_SELECT_FOR_REUSE, BASE_SELECT_WITH_SETTINGS]) {
      const [recoveredRow] = await reader.query<VideoRow>(sql);
      const recovered = mapGalleryVideoRow(recoveredRow);
      assert.equal(recovered.generationMode, 'extend');
      assert.equal(recovered.operation, 'luma-extend', 'existing copies recover their operation without a database repair');
      assert.doesNotMatch(JSON.stringify(recovered), /private-source-job|private\.example|private-asset/);
      if (sql === BASE_SELECT) assert.equal(recovered.recreationSnapshot, undefined, 'the feed stays slim');
      else assert.deepEqual(recovered.recreationSnapshot, { ...legacyRecipe, operation: 'luma-extend' });
    }
    const [stored] = await executor.query<{ recreation_snapshot: unknown; source_snapshot: unknown }>(
      'SELECT recreation_snapshot,source_snapshot FROM marketing_media WHERE video_id=$1', ['stable-page']);
    assert.deepEqual(stored.recreation_snapshot, legacyRecipe, 'read recovery does not rewrite stored publications');
    assert.deepEqual(stored.source_snapshot, provenance, 'private provenance remains unchanged');
    for (const invalid of [
      { engineId: 'kling-o3-pro' }, { inputMode: 'v2v' }, { operation: 'not-an-operation' },
      { operation: 'kling-edit' },
    ]) {
      await executor.query('UPDATE marketing_media SET source_snapshot=$1 WHERE video_id=$2',
        [JSON.stringify({ ...provenance, ...invalid }), 'stable-page']);
      const [invalidRow] = await reader.query<VideoRow>(BASE_SELECT_FOR_REUSE);
      assert.equal(mapGalleryVideoRow(invalidRow).operation, undefined);
      assert.deepEqual(mapGalleryVideoRow(invalidRow).recreationSnapshot, legacyRecipe);
    }
    const explicitRecipe = { ...legacyRecipe, engineId: 'kling-o3-pro', inputMode: 'v2v', operation: 'kling-edit' };
    await executor.query(`UPDATE marketing_media SET source_snapshot=$1,recreation_snapshot=$2,
      publication=jsonb_set(jsonb_set(publication,'{settings_snapshot}',$2::jsonb),'{engine_id}','"kling-o3-pro"')
      WHERE video_id='stable-page'`, [JSON.stringify({ ...explicitRecipe, operation: 'kling-reference' }), JSON.stringify(explicitRecipe)]);
    const [explicitRow] = await reader.query<VideoRow>(BASE_SELECT_FOR_REUSE);
    assert.equal(mapGalleryVideoRow(explicitRow).operation, 'kling-edit', 'published explicit operation wins over provenance');
    assert.deepEqual(mapGalleryVideoRow(explicitRow).recreationSnapshot, explicitRecipe);
    await executor.query(`UPDATE marketing_media SET state='failed' WHERE video_id='stable-page'`);
    assert.equal((await reader.query(BASE_SELECT)).length, 0, 'unfinished records never act as a public source');
  } finally {
    await db.cleanup();
  }
});
