import assert from 'node:assert/strict';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { parseModerationSurface } from '../frontend/lib/admin/moderation-filters';
import { buildModerationSurfaceFilterClause } from '../frontend/server/admin-moderation-filters';

test('moderation tool filters retrieve their actual job shapes without mixing finishing tools into Video', async () => {
  const db = await startDisposablePostgres('moderation-tools');
  try {
    await db.pool.query(`CREATE TABLE app_jobs (
      job_id text PRIMARY KEY, surface text, settings_snapshot jsonb DEFAULT '{}',
      engine_id text DEFAULT '', video_url text, render_ids jsonb
    )`);
    const fixtures = [
      ['normal-video', 'video', {}, 'wan-video', 'https://example.test/video.mp4'],
      ['normal-image', 'image', {}, 'nano-banana-2', null],
      ['upscale-image', 'upscale', { mediaType: 'image' }, 'seedvr-image', null],
      ['tool_upscale_legacy', null, { mediaType: 'video' }, 'seedvr-video', 'https://example.test/upscale.mp4'],
      ['background', 'background-removal', {}, 'bria-video-background-removal-v3', 'https://example.test/bg.webm'],
      ['character', 'character', {}, 'nano-banana-2', null],
      ['angle', 'angle', {}, 'qwen-multiple-angles', null],
      ['storyboard', 'storyboard', {}, 'storyboarder', null],
      ['restore', 'tool', { surface: 'tool', toolId: 'restore-video' }, 'toolbox-finishing', 'https://example.test/restore.mp4'],
      ['denoise', 'tool', { surface: 'tool', toolId: 'denoise' }, 'toolbox-finishing', 'https://example.test/denoise.mp4'],
      ['blur', 'tool', { surface: 'tool', toolId: 'fix-blur' }, 'toolbox-finishing', 'https://example.test/blur.mp4'],
      ['motion', 'tool', { surface: 'tool', toolId: 'smooth-motion' }, 'toolbox-finishing', 'https://example.test/motion.mp4'],
    ] as const;
    for (const [id, surface, settings, engine, url] of fixtures) {
      await db.pool.query('INSERT INTO app_jobs (job_id,surface,settings_snapshot,engine_id,video_url) VALUES ($1,$2,$3,$4,$5)',
        [id, surface, JSON.stringify(settings), engine, url]);
    }
    await db.pool.query(`UPDATE app_jobs SET render_ids = '["storyboard-frame-1"]' WHERE job_id = 'storyboard'`);
    for (const [filter, expected] of [
      ['upscale', ['tool_upscale_legacy', 'upscale-image']],
      ['background-removal', ['background']], ['character', ['character']], ['angle', ['angle']], ['storyboard', ['storyboard']],
      ['restore-video', ['restore']], ['denoise', ['denoise']], ['fix-blur', ['blur']], ['smooth-motion', ['motion']],
      ['tool', ['blur', 'denoise', 'motion', 'restore']], ['video', ['normal-video']],
      ['image', ['normal-image']],
    ] as const) {
      const params: Array<string | string[]> = [];
      const clause = buildModerationSurfaceFilterClause(parseModerationSurface(filter), params);
      const result = await db.pool.query(`SELECT job_id FROM app_jobs WHERE ${clause} ORDER BY job_id`, params);
      assert.deepEqual(result.rows.map(row => row.job_id), expected, filter);
    }
    assert.equal(parseModerationSurface(' Restore-Video '), 'restore-video');
    assert.equal(parseModerationSurface("upscale' OR TRUE --"), 'video');
    assert.equal(parseModerationSurface(null), 'video');
  } finally {
    await db.cleanup();
  }
});
