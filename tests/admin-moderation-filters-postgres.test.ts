import assert from 'node:assert/strict';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { parseModerationSurface, TOOL_MODERATION_FILTERS } from '../frontend/lib/admin/moderation-filters';
import { TOOLBOX, CREATOR_TOOLBOX } from '../frontend/src/lib/toolbox/catalogue';
import { buildModerationSurfaceFilterClause } from '../frontend/server/admin-moderation-filters';

test('moderation tool filters retrieve their actual job shapes without mixing finishing tools into Video', async () => {
  const db = await startDisposablePostgres('moderation-tools');
  try {
    await db.pool.query(`CREATE TABLE app_jobs (
      job_id text PRIMARY KEY, user_id text DEFAULT 'owner', surface text, settings_snapshot jsonb DEFAULT '{}',
      engine_id text DEFAULT '', video_url text, render_ids jsonb, pricing_snapshot jsonb DEFAULT '{}'
    ); CREATE TABLE creator_operations(id text,user_id text,tool_id text,status text); CREATE TABLE mcp_generation_quotes(quote_id text,job_id text,user_id text)`);
    const fixtures = [
      ['normal-video', 'video', {}, 'wan-video', 'https://example.test/video.mp4'],
      ['creator-failed', 'video', {}, 'wan-3', 'https://example.test/raw-failed.mp4', {meta:{surface:'tool',toolId:'product-video-editor'}}],
      ['creator-photo', 'image', {}, 'nano-banana-2', null, {meta:{surface:'tool',toolId:'product-photo-editor'}}],
      ['creator-video', 'video', {}, 'wan-3', 'https://example.test/raw.mp4', {meta:{surface:'tool',toolId:'product-video-editor'}}],
      ['lip', 'video', {toolId:'lip-sync'}, 'wan-3', 'https://example.test/lip.mp4'],
      ['transfer', 'video', {}, 'wan-3', 'https://example.test/transfer.mp4', {meta:{surface:'tool',toolId:'motion-transfer'}}],
      ['subtitles', 'tool', {toolId:'subtitles',operation:'render'}, 'toolbox-subtitles', 'https://example.test/subtitles.mp4'],
      ['transcript', 'tool', {toolId:'subtitles',operation:'transcribe'}, 'toolbox-subtitles', null],
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
    for (const [id, surface, settings, engine, url, pricing] of fixtures) {
      await db.pool.query('INSERT INTO app_jobs (job_id,surface,settings_snapshot,engine_id,video_url,pricing_snapshot) VALUES ($1,$2,$3,$4,$5,$6)',
        [id, surface, JSON.stringify(settings), engine, url, JSON.stringify(pricing ?? {})]);
    }
    for (const [id,tool,status] of [['creator-photo','product-photo-editor','completed'],['creator-video','product-video-editor','completed'],['lip','lip-sync','completed'],['transfer','motion-transfer','completed'],['creator-failed','product-video-editor','failed']]) {
      await db.pool.query("INSERT INTO creator_operations VALUES ($1,'owner',$2,$3)",[id,tool,status]);
      await db.pool.query("INSERT INTO mcp_generation_quotes VALUES ($1,$1,'owner')",[id]);
    }
    await db.pool.query(`UPDATE app_jobs SET render_ids = '["storyboard-frame-1"]' WHERE job_id = 'storyboard'`);
    for (const [filter, expected] of [
      ['upscale', ['tool_upscale_legacy', 'upscale-image']],
      ['background-removal', ['background']], ['character', ['character']], ['angle', ['angle']], ['storyboard', ['storyboard']],
      ['restore-video', ['restore']], ['denoise', ['denoise']], ['fix-blur', ['blur']], ['smooth-motion', ['motion']],
      ['subtitles', ['subtitles']], ['lip-sync', ['lip']], ['product-photo-editor', ['creator-photo']], ['product-video-editor', ['creator-video']], ['motion-transfer', ['transfer']],
      ['tool', ['blur', 'denoise', 'motion', 'restore', 'subtitles', 'transcript']], ['video', ['normal-video']],
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

 test('every current tool has a reachable moderation filter', () => {
  for (const { id } of [...TOOLBOX, ...CREATOR_TOOLBOX]) {
    const filterId = id === 'character-builder' ? 'character' : id;
    assert.ok(TOOL_MODERATION_FILTERS.some(filter => filter.id === filterId), id);
    assert.equal(parseModerationSurface(filterId), filterId);
  }
});
