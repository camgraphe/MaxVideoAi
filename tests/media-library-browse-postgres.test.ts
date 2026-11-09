import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { startDisposablePostgres } from './helpers/disposable-postgres';
test('common browse filters owned identities before limit and retains totals, versions and sort ties', { timeout: 120000 }, async (t) => {
    assert.ok(existsSync('frontend/server/media-library/browse.ts'), 'common browse owner must exist');
    const pg = await startDisposablePostgres('library-browse');
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = pg.databaseUrl;
    const db = await import('../frontend/src/lib/db');
    t.after(async () => { await db.getDb().end(); process.env.DATABASE_URL = previous; await pg.cleanup(); });
    const schema = await import('../frontend/src/lib/schema');
    await schema.ensureAssetSchema();
    await schema.ensureMediaLibrarySchema();
    await schema.ensureMediaLibraryOrganizationSchema();
    await pg.pool.query(`CREATE TABLE app_jobs(job_id text PRIMARY KEY,user_id text,hidden boolean DEFAULT false,prompt text,surface text,settings_snapshot jsonb,duration_sec integer,aspect_ratio text,created_at timestamptz DEFAULT now());
    INSERT INTO app_jobs(job_id,user_id,prompt,surface,settings_snapshot) VALUES('job','alice','job needle','image','{}'),('api','alice','api','image','{"origin":"mcp"}');
    INSERT INTO job_outputs(id,job_id,user_id,kind,url,position,created_at) VALUES
    ('out1','job','alice','image','https://test/shared',0,'2026-01-01'),('out2','job','alice','image','https://test/shared',1,'2026-01-01');
    INSERT INTO media_assets(id,public_id,user_id,kind,url,source,source_job_id,source_output_id,metadata,created_at) VALUES
    ('saved','ma_saved','alice','image','https://test/copy','saved_job_output','job','out1','{"originUrl":"https://test/shared","label":"Alpha"}','2026-01-01'),
    ('video','ma_video','alice','video','https://test/v','upload',null,null,'{"label":"Beta"}','2026-01-03'),
    ('audio','ma_audio','alice','audio','https://test/a','upload',null,null,'{"label":"Beta","durationSec":10}','2026-01-02'),
    ('foreign','ma_foreign','bob','image','https://test/f','upload',null,null,'{}','2026-01-04');
    INSERT INTO user_assets(asset_id,user_id,url,mime_type,source,metadata,created_at) VALUES
    ('legacy','alice','https://test/shared','image/png','generated','{"jobId":"job","sourceOutputId":"out1","originalName":"literal 100%_match"}','2025-12-31'),
    ('standalone','alice','https://test/l','image/png','upload','{"label":"Gamma"}','2026-01-01');`);
    const { browseLibrary } = await import('../frontend/server/media-library/browse');
    const { mutateLibraryOrganization } = await import('../frontend/server/media-library/organization');
    const { resolveLibraryOrganizationReferences } = await import('../frontend/server/media-library/organization-resolver');
    const scope = { view: 'all', kind: 'all', sort: 'recent' } as const;
    const page = await browseLibrary({ userId: 'alice', scope, limit: 2 });
    assert.equal(page.totalCount, 5);
    assert.deepEqual(page.assets.map(x => x.kind), ['video', 'audio']);
    assert.equal(page.hasMore, true);
    const next = await browseLibrary({ userId: 'alice', scope, limit: 2, cursor: page.nextCursor });
    const end = await browseLibrary({ userId: 'alice', scope, limit: 2, cursor: next.nextCursor });
    const all = [...page.assets, ...next.assets, ...end.assets];
    assert.equal(new Set(all.map(x => x.organization.key)).size, 5);
    assert.equal(all.filter(x => x.sourceOutputId === 'out1').length, 1);
    for (const asset of all) {
        const [resolved] = await resolveLibraryOrganizationReferences('alice', [asset.libraryRef]);
        assert.equal(asset.organization.key, resolved.key);
    }
    const found = await browseLibrary({ userId: 'alice', scope: { ...scope, q: '100%_match' }, limit: 1 });
    assert.equal(found.totalCount, 1);
    assert.equal(found.assets[0].id, 'saved');
    assert.equal((await browseLibrary({ userId: 'alice', scope: { ...scope, view: 'review' } })).totalCount, 2);
    assert.equal((await browseLibrary({ userId: 'alice', scope: { ...scope, view: 'saved' } })).totalCount, 4);
    assert.equal((await browseLibrary({ userId: 'alice', scope: { ...scope, source: 'upload' }, limit: 1 })).totalCount, 3);
    for (const sort of ['recent', 'oldest', 'name'] as const) {
        const keys: string[] = [];
        let cursor: string | null = null;
        do {
            const p = await browseLibrary({ userId: 'alice', scope: { ...scope, sort }, limit: 1, cursor });
            keys.push(...p.assets.map(x => x.organization.key));
            cursor = p.nextCursor;
        } while (cursor);
        assert.equal(keys.length, 5);
        assert.equal(new Set(keys).size, 5);
    }
    await assert.rejects(browseLibrary({ userId: 'alice', scope: { ...scope, kind: 'image' }, cursor: page.nextCursor }), /INVALID_CURSOR/);
    await assert.rejects(browseLibrary({ userId: 'alice', scope: { ...scope, collectionId: 'missing' } }), /COLLECTION_NOT_FOUND/);
    for (const bad of [{ kind: ['image'] }, { favorite: 'false' }, { trash: [] }, { jobId: '' }, { source: 'made-up' }, { sort: {} }, { q: 2 }])
        await assert.rejects(browseLibrary({ userId: 'alice', scope: { ...scope, ...bad } as never }), /INVALID/);
    const saved = all.find(x => x.id === 'saved')!;
    await mutateLibraryOrganization({ userId: 'alice', operation: 'favorite', references: [saved.libraryRef] });
    assert.equal((await browseLibrary({ userId: 'alice', scope: { ...scope, favorite: true } })).totalCount, 1);
    await mutateLibraryOrganization({ userId: 'alice', operation: 'trash', references: [saved.libraryRef] });
    assert.equal((await browseLibrary({ userId: 'alice', scope })).totalCount, 4);
    assert.equal((await browseLibrary({ userId: 'alice', scope: { ...scope, trash: true } })).totalCount, 1);
    const { listLibraryAssetPage, findLibraryAssetByOrigin } = await import('../frontend/server/media-library/asset-listing');
    const { listRecentOutputPage } = await import('../frontend/server/media-library/job-outputs');
    assert.equal((await findLibraryAssetByOrigin({ userId: 'alice', kind: 'image', originUrl: 'https://test/shared' }, { ensureSchema: false })), null);
    assert.equal((await listLibraryAssetPage({ userId: 'alice', includeOutputs: true, limit: 100 }, { ensureSchema: false })).items.some(x => x.id === 'saved' || x.id === 'legacy'), false);
    assert.deepEqual((await listRecentOutputPage({ userId: 'alice' }, { ensureSchema: false })).items.map(x => x.id), ['out2']);
    await mutateLibraryOrganization({ userId: 'alice', operation: 'restore', references: [saved.libraryRef] });
    await pg.pool.query(`UPDATE job_outputs SET url='https://test/replaced' WHERE id='out1'`);
    const versions = await browseLibrary({ userId: 'alice', scope });
    assert.equal(versions.totalCount, 6);
    assert.equal(new Set(versions.assets.filter(x => x.sourceOutputId === 'out1').map(x => x.organization.key)).size, 2);
    const ro = new URL(pg.databaseUrl);
    ro.searchParams.set('options', '-c default_transaction_read_only=on');
    process.env.DATABASE_URL = ro.toString();
    assert.equal((await browseLibrary({ userId: 'alice', scope })).totalCount, 6);
    process.env.DATABASE_URL = pg.databaseUrl;
    await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,source,metadata,created_at)
    SELECT 'micro-'||i,'ma_micro_'||i,'micro','image','https://test/micro/'||i,'upload','{"label":"Same"}','2026-01-01T00:00:00Z'::timestamptz+i*interval '1 microsecond' FROM generate_series(1,125)i;`);
    assert.equal((await browseLibrary({ userId: 'micro', scope })).assets.length, 30);
    assert.equal((await browseLibrary({ userId: 'micro', scope, limit: 500 })).assets.length, 100);
    for (const sort of ['recent', 'oldest', 'name'] as const) {
        const ids: string[] = [];
        let cursor: string | null = null;
        do {
            const page = await browseLibrary({ userId: 'micro', scope: { ...scope, sort }, limit: 30, cursor });
            assert.equal(page.totalCount, 125);
            ids.push(...page.assets.map(x => x.id));
            cursor = page.nextCursor;
        } while (cursor);
        assert.equal(new Set(ids).size, 125);
        assert.equal(ids.length, 125);
        assert.equal(ids[0], sort === 'recent' ? 'micro-125' : 'micro-1');
    }
    const first = await browseLibrary({ userId: 'micro', scope, limit: 1 });
    const cursorData = JSON.parse(Buffer.from(first.nextCursor!, 'base64url').toString());
    cursorData.time = '1900-01-01T00:00:00Z';
    const beyond = await browseLibrary({ userId: 'micro', scope, cursor: Buffer.from(JSON.stringify(cursorData)).toString('base64url') });
    assert.equal(beyond.totalCount, 125);
    assert.deepEqual(beyond.assets, []);
    assert.equal(beyond.nextCursor, null);
    await pg.pool.query(`INSERT INTO user_assets(asset_id,user_id,url,mime_type,source,metadata) VALUES
      ('no-mime-image','old','https://test/old.png',NULL,'upload','{}'),
      ('no-mime-video','old','https://test/old.mp4',NULL,'upload','{}'),
      ('no-mime-audio','old','https://test/old.flac',NULL,'upload','{}')`);
    const inferred = await browseLibrary({ userId: 'old', scope });
    assert.equal(inferred.totalCount, 3);
    assert.deepEqual(new Set(inferred.assets.map(x => x.kind)), new Set(['image', 'video', 'audio']));
    for (const row of inferred.assets)
        assert.equal((await resolveLibraryOrganizationReferences('old', [row.libraryRef]))[0].key, row.organization.key);
    await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,source,metadata) VALUES
      ('name-alpha','ma_name_a','names','image','https://test/n1','upload','{"fileName":"Alpha","originalName":"Zulu"}'),
      ('name-beta','ma_name_b','names','image','https://test/n2','upload','{"label":"Beta"}'),
      ('name-zed','ma_name_z','names','image','https://test/n3','upload','{"label":"  Zed  "}')`);
    assert.deepEqual((await browseLibrary({ userId: 'names', scope: { ...scope, sort: 'name' } })).assets.map(x => x.name), ['Alpha', 'Beta', 'Zed']);
});
