import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test('opening migration and empty collection reconciliation preserve existing public selections', async () => {
  const db = await startDisposablePostgres('gallery-release');
  process.env.DATABASE_URL = db.databaseUrl;
  process.env.EXAMPLES_PLAYLIST_SLUG = 'examples';
  process.env.STARTER_PLAYLIST_SLUG = 'welcome';
  const { getDb } = await import('../frontend/src/lib/db');
  try {
    await db.pool.query(`
      CREATE TABLE playlists(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),slug text UNIQUE,
        name text,description text,is_public boolean DEFAULT true,created_by uuid,updated_by uuid,
        created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
      CREATE TABLE playlist_items(playlist_id uuid,video_id text,order_index int,pinned boolean DEFAULT false,
        created_at timestamptz DEFAULT now(),PRIMARY KEY(playlist_id,video_id));
      CREATE TABLE app_jobs(job_id text PRIMARY KEY,user_id text,engine_id text,engine_label text,
        prompt text DEFAULT 'Public fixture',thumb_url text DEFAULT '/poster.webp',video_url text DEFAULT '/video.mp4',
        audio_url text,render_ids jsonb,
        status text DEFAULT 'completed',surface text DEFAULT 'video',visibility text DEFAULT 'public',
        indexable boolean DEFAULT true,created_at timestamptz DEFAULT now(),duration_sec int DEFAULT 10,
        aspect_ratio text DEFAULT '16:9',has_audio boolean,can_upscale boolean,featured boolean,
        featured_order int,final_price_cents int,currency text,pricing_snapshot jsonb);
      CREATE TABLE media_assets(user_id text,url text,status text,deleted_at timestamptz);
      CREATE TABLE job_outputs(job_id text,kind text,status text,width int,height int,position int,
        created_at timestamptz,thumb_url text,url text,storage_url text);
      CREATE TABLE video_seo_pages(video_id text PRIMARY KEY,slug text,seo_title text);
      INSERT INTO playlists(slug,name,description) VALUES
        ('examples','Existing examples','Do not overwrite'),('welcome','Starter video','Do not overwrite'),
        ('family-seedance','Seedance','Do not overwrite'),('family-happy-horse','Happy Horse','Do not overwrite');
    `);
    await db.pool.query(readFileSync('neon/migrations/52_playlist_curations.sql', 'utf8'));
    const { createMissingModelPlaylists, getPublishedExampleModelPlaylistSlugs } = await import('../frontend/server/example-family-playlists');
    const { readEffectiveModelPageGallery } = await import('../frontend/server/playlists/curation-model-preview');
    const { listCatalogMembershipIds } = await import('../frontend/server/videos-catalog-page');
    const { PREFERRED_MEDIA, FEATURED_EXAMPLE_MEDIA } = await import('../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-static-media');
    const missing = ['dreamina-seedance-2-0-mini', 'happy-horse-1-1'];
    const models = getPublishedExampleModelPlaylistSlugs();
    for (const model of missing) assert.ok(models.includes(model), `${model} remains a published destination`);
    for (const model of models.filter(model => !missing.includes(model))) {
      await db.pool.query('INSERT INTO playlists(slug,name,description) VALUES ($1,$2,$3)',
        [`examples-${model}`, `Existing ${model}`, 'Preserve authoring']);
    }
    await db.pool.query("UPDATE playlists SET is_public=false WHERE slug='examples-wan-3'");
    const allIds: string[] = [];
    for (const model of missing) {
      const ids = [...new Set([
        ...Object.values(PREFERRED_MEDIA[model]).filter((id): id is string => Boolean(id)),
        ...(FEATURED_EXAMPLE_MEDIA[model] ?? []),
      ])];
      allIds.push(...ids);
      for (const [index, id] of ids.entries()) {
        await db.pool.query('INSERT INTO app_jobs(job_id,engine_id,engine_label,aspect_ratio) VALUES ($1,$2,$2,$3)',
          [id, model, index === 1 ? '9:16' : '16:9']);
        await db.pool.query("INSERT INTO playlist_items SELECT id,$1,$2,false FROM playlists WHERE slug IN ('examples','welcome',$3)",
          [id, index, model === missing[0] ? 'family-seedance' : 'family-happy-horse']);
        await db.pool.query('INSERT INTO video_seo_pages VALUES ($1,$2,$3)', [id, `unchanged-${allIds.indexOf(id)}`, 'Preserve SEO']);
      }
    }
    assert.equal(allIds.length, 7, 'the two missing destinations retain five and two editorial examples');
    await db.pool.query("INSERT INTO playlist_curations(playlist_id,mode,ordered_ids,excluded_ids) SELECT id,'manual',$1,'{}' FROM playlists WHERE slug='examples'", [allIds]);
    const reader = {query: async <T>(sql: string, params?: readonly unknown[]) => (await db.pool.query(sql, params as unknown[])).rows as T[]};
    const snapshots = async () => ({
      playlists: (await db.pool.query('SELECT * FROM playlists WHERE NOT slug=ANY($1) ORDER BY slug', [missing.map(model => `examples-${model}`)])).rows,
      memberships: (await db.pool.query('SELECT * FROM playlist_items ORDER BY playlist_id,video_id')).rows,
      curations: (await db.pool.query("SELECT to_jsonb(c)-'opening_ids' AS config FROM playlist_curations c ORDER BY playlist_id")).rows,
      jobs: (await db.pool.query('SELECT * FROM app_jobs ORDER BY job_id')).rows,
      seo: (await db.pool.query('SELECT * FROM video_seo_pages ORDER BY video_id')).rows,
    });
    const publicOrder = async () => ({
      models: await Promise.all(missing.map(async model => (await readEffectiveModelPageGallery({slug: `examples-${model}`}, reader)).map(card => card.id))),
      hub: await listCatalogMembershipIds({offset: 0, limit: 500}, reader),
      seedance: await listCatalogMembershipIds({familyId: 'seedance', offset: 0, limit: 500}, reader),
      happyHorse: await listCatalogMembershipIds({familyId: 'happy-horse', offset: 0, limit: 500}, reader),
    });
    const before = await snapshots();
    const beforePublic = await publicOrder();
    assert.deepEqual(beforePublic.models.map(ids => ids.length), [5, 2]);
    assert.equal(beforePublic.hub.total, 7);
    for (let replay = 0; replay < 2; replay++) {
      await db.pool.query(readFileSync('neon/migrations/53_playlist_opening.sql', 'utf8'));
      assert.deepEqual(await snapshots(), before, 'migration is additive and replay does not rewrite authoring, media or SEO');
      assert.deepEqual(await publicOrder(), beforePublic, 'old NULL openings preserve public order');
    }
    const originalIds = new Set((await db.pool.query('SELECT id FROM playlists')).rows.map(row => row.id));
    const first = await createMissingModelPlaylists(null);
    const created = first.filter(playlist => !originalIds.has(playlist.id));
    assert.deepEqual(created.map(playlist => playlist.slug).sort(), missing.map(model => `examples-${model}`).sort());
    assert.ok(created.every(playlist => playlist.itemCount === 0 && playlist.isPublic));
    assert.equal((await db.pool.query('SELECT count(*)::int AS count FROM playlist_curations WHERE playlist_id=ANY($1::uuid[])', [created.map(playlist => playlist.id)])).rows[0].count, 0,
      'creating an empty collection must not opt into authoritative empty curation');
    assert.deepEqual(await snapshots(), before);
    assert.deepEqual(await publicOrder(), beforePublic, 'model fallbacks, family and hub retain their visible cards and order');
    const afterFirst = (await db.pool.query('SELECT * FROM playlists ORDER BY slug')).rows;
    await createMissingModelPlaylists(null);
    assert.deepEqual((await db.pool.query('SELECT * FROM playlists ORDER BY slug')).rows, afterFirst, 'repeating the action creates no duplicate and changes no existing row');
    assert.deepEqual(await snapshots(), before);
    assert.deepEqual(await publicOrder(), beforePublic);
  } finally {
    await getDb().end().catch(() => undefined);
    await db.cleanup();
  }
});
