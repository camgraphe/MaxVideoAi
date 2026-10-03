import assert from 'node:assert/strict';
import test from 'node:test';
import { getDb } from '../frontend/src/lib/db';
import { getSeoVideoById, listExampleFamilyPage, listExamplesPage } from '../frontend/server/videos';
import { missingDisposablePostgresCommand, startDisposablePostgres } from './helpers/disposable-postgres';

test('public hub excludes archived identities before SQL limit while historical family and watch readers stay intact', { timeout: 30_000 }, async t => {
  const missing = missingDisposablePostgresCommand();
  if (missing) return t.skip(`${missing} unavailable`);
  const pg = await startDisposablePostgres('sora-discovery');
  const previous = process.env.DATABASE_URL;
  const playlist = process.env.EXAMPLES_PLAYLIST_SLUG;
  process.env.DATABASE_URL = pg.databaseUrl;
  process.env.EXAMPLES_PLAYLIST_SLUG = 'discovery-fixture';
  t.after(async () => {
    await getDb().end();
    if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous;
    if (playlist === undefined) delete process.env.EXAMPLES_PLAYLIST_SLUG; else process.env.EXAMPLES_PLAYLIST_SLUG = playlist;
    await pg.cleanup();
  });
  await pg.pool.query(`
    CREATE TABLE playlists (id text PRIMARY KEY, slug text, is_public boolean);
    CREATE TABLE playlist_items (playlist_id text, video_id text, order_index integer);
    CREATE TABLE app_jobs (
      job_id text PRIMARY KEY, user_id text, engine_id text, engine_label text, duration_sec integer,
      prompt text DEFAULT 'Example', thumb_url text DEFAULT 'https://media.maxvideoai.com/test.webp',
      video_url text DEFAULT 'https://media.maxvideoai.com/test.mp4', aspect_ratio text DEFAULT '16:9',
      has_audio boolean, can_upscale boolean, created_at timestamptz DEFAULT now(), visibility text DEFAULT 'public',
      indexable boolean DEFAULT true, featured boolean, featured_order integer,
      final_price_cents integer, currency text, pricing_snapshot jsonb, settings_snapshot jsonb
    );
    CREATE TABLE job_outputs (job_id text, kind text, thumb_url text, url text, storage_url text, status text, position integer, width integer, height integer, created_at timestamptz);
    INSERT INTO playlists VALUES ('hub', 'discovery-fixture', true), ('archive', 'family-sora', true);
  `);
  const identities = ['sora-2', 'openai-sora-2-pro', 'fal-ai/sora-2/text-to-video', 'seedance-2-5', 'minimax-h3', 'wan-3'];
  for (const [index, id] of identities.entries()) {
    await pg.pool.query('INSERT INTO app_jobs(job_id, engine_id, engine_label, duration_sec) VALUES ($1,$1,$1,5)', [id]);
    await pg.pool.query('INSERT INTO playlist_items VALUES ($1,$2,$3)', ['hub', id, 100 - index]);
    if (index < 3) await pg.pool.query('INSERT INTO playlist_items VALUES ($1,$2,$3)', ['archive', id, 100 - index]);
  }
  const before = (await pg.pool.query('SELECT to_jsonb(j) AS row FROM app_jobs j ORDER BY job_id')).rows;
  const first = await listExamplesPage({ sort: 'playlist', limit: 2 });
  assert.deepEqual(first.items.map(item => item.engineId), ['seedance-2-5', 'minimax-h3']);
  assert.deepEqual((await listExamplesPage({ sort: 'playlist', limit: 2, offset: 2 })).items.map(item => item.engineId), ['wan-3']);
  const historical = await listExampleFamilyPage('sora', { sort: 'playlist', limit: 10 });
  assert.equal(historical.items.length, 3);
  assert.equal((await getSeoVideoById('sora-2'))?.engineId, 'sora-2');
  assert.deepEqual((await pg.pool.query('SELECT to_jsonb(j) AS row FROM app_jobs j ORDER BY job_id')).rows, before);
});
