import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test('curation is opt-in, eligible, stable, local and protected against stale saves', async () => {
  const db = await startDisposablePostgres('curation');
  process.env.DATABASE_URL = db.databaseUrl;
  const { getDb } = await import('../frontend/src/lib/db');
  try {
    await db.pool
      .query(`CREATE TABLE playlists(id uuid PRIMARY KEY, slug text, is_public boolean, updated_at timestamptz DEFAULT now());
      CREATE TABLE playlist_items(playlist_id uuid,video_id text,order_index int,pinned boolean DEFAULT false,created_at timestamptz DEFAULT now(),PRIMARY KEY(playlist_id,video_id));
      CREATE TABLE app_jobs(job_id text PRIMARY KEY,engine_id text,engine_label text,prompt text,thumb_url text,video_url text,status text,surface text,visibility text,indexable boolean,created_at timestamptz);
      INSERT INTO playlists(id,slug,is_public) VALUES ('11111111-1111-4111-8111-111111111111','examples-wan-3',true),('22222222-2222-4222-8222-222222222222','starter',true);
      INSERT INTO playlist_items(playlist_id,video_id,order_index) VALUES ('11111111-1111-4111-8111-111111111111','a',1);`);
    await db.pool.query(`ALTER TABLE app_jobs ADD COLUMN user_id uuid, ADD COLUMN duration_sec int DEFAULT 5,
      ADD COLUMN aspect_ratio text, ADD COLUMN has_audio boolean, ADD COLUMN can_upscale boolean,
      ADD COLUMN featured boolean, ADD COLUMN featured_order int, ADD COLUMN final_price_cents int,
      ADD COLUMN currency text, ADD COLUMN pricing_snapshot jsonb;
      CREATE TABLE media_assets(user_id uuid,url text,status text,deleted_at timestamptz);
      CREATE TABLE job_outputs(job_id text,kind text,status text,width int,height int,position int,created_at timestamptz,thumb_url text,url text,storage_url text);`);
    const { listPlaylistVideos, listExampleFamilyPage } = await import('../frontend/server/videos');
    const { appendPlaylistItem, reorderPlaylistItems, removePlaylistItem } = await import(
      '../frontend/server/playlists/mutations'
    );
    const { getCurationSnapshot, previewCuration, saveCuration, resolveCuratedPlaylist } = await import(
      '../frontend/server/playlists/curation-service'
    );
    const id = '11111111-1111-4111-8111-111111111111';
    assert.equal(await resolveCuratedPlaylist('examples-wan-3'), null);
    assert.equal((await getCurationSnapshot(id)).available, false);
    await db.pool.query(readFileSync('neon/migrations/52_playlist_curations.sql', 'utf8'));
    const add = async (job: string, values: Record<string, unknown> = {}) => {
      const row = {
        engine_id: 'wan-3',
        engine_label: 'Wan 3',
        prompt: 'Fixture',
        thumb_url: '/thumb.png',
        video_url: '/video.mp4',
        status: 'completed',
        surface: 'video',
        visibility: 'public',
        indexable: true,
        created_at: '2026-09-20T12:00:00Z',
        ...values,
      };
      await db.pool.query(
        `INSERT INTO app_jobs(job_id,${Object.keys(row).join(',')}) VALUES (${[job, ...Object.values(row)].map((_, i) => '$' + (i + 1)).join(',')})`,
        [job, ...Object.values(row)],
      );
    };
    for (const job of ['a', 'b', 'c']) await add(job);
    await add('private', { visibility: 'private' });
    await add('hidden', { indexable: false });
    await add('running', { status: 'running' });
    await add('image', { surface: 'image' });
    await add('missing', { video_url: null });
    await add('other-model', { engine_id: 'kling-3-pro' });
    assert.deepEqual(
      (await listPlaylistVideos('examples-wan-3', 10)).map((v) => v.id),
      ['a'],
    );
    await add('deleted-output');
    await db.pool.query(
      "INSERT INTO job_outputs(job_id,kind,status,url) VALUES ('deleted-output','video','deleted','/video.mp4')",
    );
    const initial = await getCurationSnapshot(id);
    assert.equal(initial.config, null);
    assert.equal(initial.openingAvailable, false);
    assert.equal(await resolveCuratedPlaylist('examples-wan-3'), null);
    const draft = { mode: 'hybrid' as const, orderedIds: ['a'], excludedIds: ['b'] };
    const preview = await previewCuration(id, draft, initial.revision);
    assert.deepEqual(
      preview.items.map((v) => v.id),
      ['a', 'c'],
    );
    await assert.rejects(previewCuration(id, { ...draft, orderedIds: ['private'] }, initial.revision), /eligible/);
    await assert.rejects(previewCuration(id, { ...draft, orderedIds: ['a', 'a'] }, initial.revision), /duplicate/i);
    await assert.rejects(previewCuration('22222222-2222-4222-8222-222222222222', draft, ''), /supported/i);
    await appendPlaylistItem(id, 'c');
    await assert.rejects(saveCuration(id, draft, initial.revision, preview.token, null), /changed/i);
    await removePlaylistItem(id, 'c');
    await saveCuration(id, draft, initial.revision, preview.token, null);
    await assert.rejects(appendPlaylistItem(id, 'b'), /Site placements/);
    await assert.rejects(reorderPlaylistItems(id, [{ videoId: 'b' }]), /Site placements/);
    await assert.rejects(removePlaylistItem(id, 'a'), /Site placements/);
    assert.deepEqual(
      (await listPlaylistVideos('examples-wan-3', 1)).map((v) => v.id),
      ['a'],
    );
    const familyId = '33333333-3333-4333-8333-333333333333';
    await db.pool.query("INSERT INTO playlists(id,slug,is_public) VALUES ($1,'family-wan',true)", [familyId]);
    const staleFamily = await getCurationSnapshot(familyId);
    const oldFamilyDraft = { mode: 'manual' as const, orderedIds: ['a'], excludedIds: [] };
    await assert.rejects(previewCuration(familyId, oldFamilyDraft, staleFamily.revision), /four-video opening/);
    // A previously saved family remains editable on the older optional schema.
    await db.pool.query("INSERT INTO playlist_curations(playlist_id,mode,ordered_ids,excluded_ids) VALUES ($1,'manual',ARRAY['a'],'{}')", [familyId]);
    const legacyFamily = await getCurationSnapshot(familyId);
    const oldFamilyPreview = await previewCuration(familyId, oldFamilyDraft, legacyFamily.revision);
    await db.pool.query(
      "INSERT INTO playlists(id,slug,is_public) VALUES ('44444444-4444-4444-8444-444444444444','examples-wan-2-6',true)",
    );
    await appendPlaylistItem('44444444-4444-4444-8444-444444444444', 'b');
    await assert.rejects(
      saveCuration(familyId, oldFamilyDraft, legacyFamily.revision, oldFamilyPreview.token, null),
      /changed/i,
      'source changes must invalidate a family preview',
    );
    await db.pool.query('DELETE FROM playlist_curations WHERE playlist_id=$1', [familyId]);
    const { loadPlaylistDestinations } = await import('../frontend/server/playlists/destinations');
    const { mapCreatedPlaylistRow } = await import('../frontend/server/playlists/mappers');
    const inventory = await loadPlaylistDestinations([mapCreatedPlaylistRow({ id: familyId, slug: 'family-wan', name: 'Wan', description: null, is_public: true, created_at: '2026-09-28', updated_at: '2026-09-28' })]);
    assert.equal(inventory.find(row => row.id === 'family:wan')!.publicCount, 3);
    assert.equal(inventory.find(row => row.id === 'model:wan-3')!.publicCount, 2);
    assert.equal(inventory.find(row => row.id === 'examples')!.publicCount, 3);
    process.env.EXAMPLES_PLAYLIST_SLUG = 'marketing-examples';
    await db.pool.query("INSERT INTO playlists(id,slug,is_public) VALUES ('55555555-5555-4555-8555-555555555555',' examples ',true)");
    const historicalId = '55555555-5555-4555-8555-555555555555';
    await assert.rejects(previewCuration(historicalId, oldFamilyDraft, ''), /historical|configuration/i);
    await assert.rejects(saveCuration(historicalId, oldFamilyDraft, '', '', null), /historical|configuration/i);
    await db.pool.query("INSERT INTO playlist_curations(playlist_id,mode,ordered_ids,excluded_ids) VALUES ($1,'manual',ARRAY['a'],'{}')", [familyId]);
    const family = await getCurationSnapshot(familyId);
    const familyDraft = { mode: 'hybrid' as const, orderedIds: ['a'], excludedIds: ['b', 'c'] };
    const familyPreview = await previewCuration(familyId, familyDraft, family.revision);
    await saveCuration(familyId, familyDraft, family.revision, familyPreview.token, null);
    assert.deepEqual(
      (await listExampleFamilyPage('wan', { sort: 'playlist', limit: 1, offset: 0 })).items.map((v) => v.id),
      ['a'],
    );
    assert.equal(
      (await listExampleFamilyPage('wan', { sort: 'playlist', limit: 1, offset: 1 })).items.length,
      0,
      'excluded model clips cannot reappear via inheritance',
    );

    assert.deepEqual(
      (await resolveCuratedPlaylist('examples-wan-3'))!.map((v) => v.id),
      ['a', 'c'],
    );
    await assert.rejects(saveCuration(id, draft, initial.revision, preview.token, null), /changed/i);
    await add('new', { created_at: '2026-09-22T12:00:00Z' });
    assert.deepEqual(
      (await resolveCuratedPlaylist('examples-wan-3'))!.map((v) => v.id),
      ['a', 'new', 'c'],
    );
    await db.pool.query("UPDATE app_jobs SET visibility='private' WHERE job_id='a'");
    assert.deepEqual(
      (await resolveCuratedPlaylist('examples-wan-3'))!.map((v) => v.id),
      ['new', 'c'],
    );
    const saved = await getCurationSnapshot(id);
    const manual = { mode: 'manual' as const, orderedIds: ['c', 'new'], excludedIds: ['b'] };
    const manualPreview = await previewCuration(id, manual, saved.revision);
    await db.pool.query("UPDATE app_jobs SET indexable=false WHERE job_id='new'");
    await assert.rejects(saveCuration(id, manual, saved.revision, manualPreview.token, null), /eligible|preview/i);
    assert.equal((await getCurationSnapshot(id)).revision, saved.revision);
    const empty = { mode: 'manual' as const, orderedIds: [], excludedIds: ['b'] };
    const emptyPreview = await previewCuration(id, empty, saved.revision);
    await saveCuration(id, empty, saved.revision, emptyPreview.token, null);
    assert.deepEqual(
      await resolveCuratedPlaylist('examples-wan-3'),
      [],
      'explicitly empty never becomes legacy fallback',
    );
    assert.deepEqual(await listPlaylistVideos('examples-wan-3', 10), []);
    await db.pool.query('UPDATE playlists SET is_public=false WHERE id=$1', [id]);
    assert.deepEqual(await resolveCuratedPlaylist('examples-wan-3'), []);
    await db.pool.query(readFileSync('neon/migrations/53_playlist_opening.sql', 'utf8'));
    await db.pool.query(readFileSync('neon/migrations/53_playlist_opening.sql', 'utf8')); // migration runner replays files
    await db.pool.query('UPDATE playlists SET is_public=true WHERE id=$1', [id]);
    for (const name of ['open-a','open-b','open-c','open-d']) {
      await add(name,{aspect_ratio:'16:9'});
      await db.pool.query("INSERT INTO job_outputs(job_id,kind,status,width,height,position,created_at) VALUES ($1,'video','completed',$2,$3,0,now())",[name,name==='open-b'?480:1280,name==='open-b'?854:720]);
    }
    const openingSnapshot = await getCurationSnapshot(id);
    assert.equal(openingSnapshot.openingAvailable,true);
    const openingDraft = {mode:'manual' as const, orderedIds:['c','open-a'], excludedIds:[], openingIds:['open-a','open-b','open-c','open-d']};
    const openingPreview = await previewCuration(id,openingDraft,openingSnapshot.revision);
    assert.deepEqual(openingPreview.items.map(item=>item.id),['open-a','open-b','open-c','open-d','c']);
    await db.pool.query("UPDATE job_outputs SET width=1280,height=720 WHERE job_id='open-b'");
    await assert.rejects(saveCuration(id,openingDraft,openingSnapshot.revision,openingPreview.token,null),/9:16/);
    await db.pool.query("UPDATE job_outputs SET width=480,height=854 WHERE job_id='open-b'");
    await saveCuration(id,openingDraft,openingSnapshot.revision,openingPreview.token,null);
    assert.deepEqual((await getCurationSnapshot(id)).config?.openingIds,openingDraft.openingIds);
    assert.deepEqual((await resolveCuratedPlaylist('examples-wan-3'))?.map(item=>item.id),['open-a','open-b','open-c','open-d','c']);
    const {listCatalogPage} = await import('../frontend/server/videos-catalog-page');
    // Remove family override so its inherited model source owns this assertion.
    await db.pool.query('DELETE FROM playlist_curations WHERE playlist_id=$1',[familyId]);
    const page = await listCatalogPage({familyId:'wan',sort:'playlist',limit:4,offset:0});
    assert.deepEqual(page.items.map(item=>item.id),openingDraft.openingIds);
    assert.equal(new Set(page.items.map(item=>item.id)).size,4);
    const dated = await listCatalogPage({familyId:'wan',sort:'date-asc',limit:30,offset:0});
    assert.notDeepEqual(dated.items.slice(0,4).map(item=>item.id),openingDraft.openingIds);
    await db.pool.query("UPDATE app_jobs SET visibility='private' WHERE job_id='open-c'");
    assert.ok(!(await listCatalogPage({familyId:'wan',sort:'playlist',limit:30,offset:0})).items.some(item=>item.id==='open-c'));
  } finally {
    await getDb().end();
    await db.cleanup();
  }
});
