import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';
test('organization preserves owned source versions and commits truthful bounded operations', { timeout: 120000 }, async (t) => {
    const pg = await startDisposablePostgres('library-organization');
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = pg.databaseUrl;
    const db = await import('../frontend/src/lib/db');
    t.after(async () => {
        await db.getDb().end();
        if (previous === undefined)
            delete process.env.DATABASE_URL;
        else
            process.env.DATABASE_URL = previous;
        await pg.cleanup();
    });
    const schema = await import('../frontend/src/lib/schema');
    await schema.ensureMediaLibrarySchema();
    await schema.ensureAssetSchema();
    await pg.pool.query('CREATE TABLE app_jobs(job_id text PRIMARY KEY,user_id text,hidden boolean DEFAULT false)');
    assert.ok(existsSync('frontend/server/media-library/organization.ts'), 'server-owned organization mutations must exist');
    const { mutateLibraryOrganization: mutate } = await import('../frontend/server/media-library/organization');
    const { resolveLibraryOrganizationReferences: resolve } = await import('../frontend/server/media-library/organization-resolver');
    const collections = await import('../frontend/server/media-library/collections');
    const { ensureMediaLibraryOrganizationSchema } = await import('../frontend/src/lib/schema/media-library-organization-schema');
    await ensureMediaLibraryOrganizationSchema();
    await pg.pool.query('CREATE SCHEMA migration_only');
    const parityClient = await pg.pool.connect();
    try {
        await parityClient.query('SET search_path TO migration_only');
        await parityClient.query(readFileSync('neon/migrations/97_media_library_organization.sql', 'utf8'));
    }
    finally {
        await parityClient.query('SET search_path TO public');
        parityClient.release();
    }
    const columns = async (schemaName: string) => (await pg.pool.query("SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema=$1 AND table_name LIKE 'library_%' ORDER BY table_name,ordinal_position", [schemaName])).rows;
    assert.deepEqual(await columns('public'), await columns('migration_only'));
    await pg.pool.query('SET search_path TO public');
    // Migration replay over bootstrap exercises the same physical tables and constraints.
    await pg.pool.query(readFileSync('neon/migrations/97_media_library_organization.sql', 'utf8'));
    await pg.pool.query(`INSERT INTO app_jobs VALUES ('job','alice',false),('foreign','bob',false);
    INSERT INTO job_outputs(id,job_id,user_id,kind,url,position) VALUES
    ('out-a','job','alice','image','https://original.test/shared.png',0),
    ('out-b','job','alice','image','https://original.test/shared.png',1),
    ('out-foreign','foreign','bob','image','https://original.test/foreign.png',0);
    INSERT INTO media_assets(id,public_id,user_id,kind,url,source,source_job_id,source_output_id,metadata) VALUES
    ('saved','ma_11111111111111111111111111111111','alice','image','https://durable.test/copy.png','saved_job_output','job','out-a','{"originUrl":"https://original.test/shared.png"}'),
    ('foreign-asset','ma_22222222222222222222222222222222','bob','image','https://durable.test/foreign.png','upload',null,null,'{}');
    INSERT INTO user_assets(asset_id,user_id,url,mime_type,source,metadata) VALUES
    ('saved','alice','https://durable.test/copy.png','image/png','generated','{"originUrl":"https://original.test/shared.png","jobId":"job","sourceOutputId":"out-a"}'),
    ('legacy-only','alice','https://durable.test/legacy.png','image/png','upload','{}')`);
    const asset = { type: 'asset', assetId: 'ma_11111111111111111111111111111111', kind: 'image' } as const;
    const output = { type: 'job-output', jobId: 'job', outputId: 'out-a', kind: 'image' } as const;
    const legacy = { type: 'legacy', assetId: 'saved', kind: 'image' } as const;
    const foreign = { type: 'asset', assetId: 'ma_22222222222222222222222222222222', kind: 'image' } as const;
    const run = (operation: any, references: any[], collectionId?: string) => mutate({ userId: 'alice', operation, references, collectionId });
    await t.test('same-content background projection stays in Trash; explicit import/Save restores without losing favorites', async () => {
        const { ensureReusableAsset } = await import('../frontend/server/media-library/assets');
        const { restoreForegroundLibraryAsset } = await import('../frontend/server/media-library/foreground-visibility');
        const original = await ensureReusableAsset({ userId: 'alice', kind: 'image', url: 'https://durable.test/reimport.png', source: 'upload' });
        const ref = { type: 'asset', assetId: original.publicId!, kind: 'image' } as const;
        await run('favorite', [ref]); await run('trash', [ref]);
        const duplicate = await ensureReusableAsset({ userId: 'alice', kind: 'image', url: original.url, source: 'upload' });
        assert.equal(duplicate.publicId, original.publicId);
        assert.ok((await resolve('alice', [ref]))[0].state?.trashedAt);
        await restoreForegroundLibraryAsset('alice', duplicate);
        assert.equal((await resolve('alice', [ref]))[0].state?.trashedAt, null);
        assert.equal((await resolve('alice', [ref]))[0].state?.favorite, true);
        await assert.rejects(restoreForegroundLibraryAsset('bob', duplicate), /SAVED_ASSET_RESTORE_FAILED/);
    });
    await t.test('exact output display survives verified byte-copy promotion and cannot leak from another sibling', async () => {
        const { ensureReusableAsset } = await import('../frontend/server/media-library/assets');
        const { serializeLibraryAsset } = await import('../frontend/server/media-library/asset-response');
        const sourceUrl='https://original.test/display-source.png', previewUrl='https://original.test/display.webp';
        const facts={version:1,profile:'image-display-v1',sourceUrl,sourceSha256:'a'.repeat(64),url:previewUrl,mimeType:'image/webp',width:1920,height:960,sizeBytes:4000};
        await pg.pool.query(`INSERT INTO job_outputs(id,job_id,user_id,kind,url,preview_url,metadata,position) VALUES('display-output','job','alice','image',$1,$2,$3::jsonb,3)`,[sourceUrl,previewUrl,JSON.stringify({imageDisplay:facts})]);
        const asset=await ensureReusableAsset({userId:'alice',kind:'image',url:sourceUrl,source:'saved_job_output',sourceJobId:'job',sourceOutputId:'display-output',previewUrl:'https://forged.test/display.webp'}, {copyRemoteMediaFn:async()=>({url:'https://durable.test/display-copy.png',thumbUrl:null,mimeType:'image/png',width:4000,height:2000,sizeBytes:90000,sourceSha256:facts.sourceSha256})});
        assert.equal(asset.previewUrl,previewUrl);
        assert.deepEqual(serializeLibraryAsset(asset).imageDisplay,{...facts,sourceUrl:asset.url});
        await assert.rejects(ensureReusableAsset({userId:'alice',kind:'image',url:'https://original.test/unrelated.png',source:'generated',sourceJobId:'job',sourceOutputId:'display-output',previewUrl,metadata:{imageDisplay:facts}}), /IMAGE_OUTPUT_SOURCE_MISMATCH/);
    });
    await t.test('owned canonical, legacy and exact output share state; same-URL outputs remain distinct', async () => {
        const result = await run('favorite', [asset, legacy, output, foreign]);
        assert.equal(result.succeededCount, 3);
        assert.equal(result.failedCount, 1);
        assert.equal(result.affectedCount, 1);
        assert.equal(new Set(result.results.slice(0, 3).map(r => r.key)).size, 1);
        const rows = await resolve('alice', [output, { ...output, outputId: 'out-b' }]);
        assert.notEqual(rows[0].key, rows[1].key);
        assert.equal(rows[0].state?.favorite, true);
        assert.equal(rows[1].state?.favorite, false);
        const readOnlyUrl = new URL(pg.databaseUrl);
        readOnlyUrl.searchParams.set('options', '-c default_transaction_read_only=on');
        process.env.DATABASE_URL = readOnlyUrl.toString();
        try {
            assert.equal((await resolve('alice', [asset]))[0].state?.favorite, true);
        }
        finally {
            process.env.DATABASE_URL = pg.databaseUrl;
        }
    });
    await t.test('collections validate names, isolate owners, paginate, and delete only membership', async () => {
        for (const name of ['', '  ', 'x'.repeat(121)])
            await assert.rejects(collections.createLibraryCollection({ userId: 'alice', name }), /INVALID_COLLECTION_NAME/);
        const collection = await collections.createLibraryCollection({ userId: 'alice', name: '  Photos  ' });
        assert.equal(collection.name, 'Photos');
        await assert.rejects(collections.renameLibraryCollection({ userId: 'bob', collectionId: collection.id, name: 'Stolen' }), /COLLECTION_NOT_FOUND/);
        await run('add-to-collection', [asset], collection.id);
        assert.equal((await run('add-to-collection', [asset, asset], collection.id)).succeededCount, 2);
        const before = await resolve('alice', [asset]);
        assert.deepEqual(before[0].state?.collectionIds, [collection.id]);
        const list = await collections.listLibraryCollections({ userId: 'alice', limit: 1 });
        assert.equal(list.items.length, 1);
        assert.equal((await collections.listLibraryCollections({ userId: 'bob' })).items.length, 0);
        await collections.deleteLibraryCollection({ userId: 'alice', collectionId: collection.id });
        const after = await resolve('alice', [asset]);
        assert.deepEqual(after[0].state?.collectionIds, []);
        assert.equal(after[0].state?.favorite, true);
        await assert.rejects(run('add-to-collection', [asset], collection.id), /COLLECTION_NOT_FOUND/);
        const extra = [];
        for (const name of ['Page A', 'Page B', 'Page C', '😀'.repeat(120)])
            extra.push(await collections.createLibraryCollection({ userId: 'alice', name }));
        const ids = [];
        let cursor: string | null = null;
        do {
            const page = await collections.listLibraryCollections({ userId: 'alice', limit: 2, cursor });
            ids.push(...page.items.map(row => row.id));
            cursor = page.nextCursor;
        } while (cursor);
        assert.deepEqual(ids, [...extra.map(row => row.id)].sort());
        await assert.rejects(collections.listLibraryCollections({ userId: 'alice', limit: 101 }), /INVALID_LIMIT/);
        for (const row of extra)
            await collections.deleteLibraryCollection({ userId: 'alice', collectionId: row.id });
    });
    await t.test('Trash and restore retain originals, first timestamp, key, favorite and memberships', async () => {
        const collection = await collections.createLibraryCollection({ userId: 'alice', name: 'Keep' });
        await run('add-to-collection', [asset], collection.id);
        const sources = await pg.pool.query('SELECT row_to_json(t) AS row FROM job_outputs t UNION ALL SELECT row_to_json(t) FROM app_jobs t UNION ALL SELECT row_to_json(t) FROM media_assets t UNION ALL SELECT row_to_json(t) FROM user_assets t');
        const trashed = await run('trash', [asset]);
        const again = await run('trash', [output]);
        assert.equal(again.results[0].state?.trashedAt, trashed.results[0].state?.trashedAt);
        const restored = await run('restore', [legacy]);
        assert.equal(restored.results[0].key, trashed.results[0].key);
        assert.equal(restored.results[0].state?.trashedAt, null);
        assert.equal(restored.results[0].state?.favorite, true);
        assert.deepEqual(restored.results[0].state?.collectionIds, [collection.id]);
        assert.deepEqual((await pg.pool.query('SELECT row_to_json(t) AS row FROM job_outputs t UNION ALL SELECT row_to_json(t) FROM app_jobs t UNION ALL SELECT row_to_json(t) FROM media_assets t UNION ALL SELECT row_to_json(t) FROM user_assets t')).rows, sources.rows);
        await run('remove-from-collection', [asset], collection.id);
        await run('remove-from-collection', [asset], collection.id);
        await run('unfavorite', [asset]);
        await run('unfavorite', [asset]);
        assert.equal((await resolve('alice', [asset]))[0].state?.favorite, false);
    });
    await t.test('500 raw references accepted, 501 duplicates rejected before writes', async () => {
        assert.equal((await run('favorite', Array(500).fill(asset))).succeededCount, 500);
        await assert.rejects(run('unfavorite', Array(501).fill(asset)), /REFERENCE_LIMIT/);
        assert.equal((await resolve('alice', [asset]))[0].state?.favorite, true);
        await assert.rejects(run('erase', [asset]), /INVALID_OPERATION/);
    });
    await t.test('an output replacement cannot inherit old state; saved old originals remain available', async () => {
        const old = (await resolve('alice', [output]))[0];
        await pg.pool.query("UPDATE job_outputs SET url='https://original.test/replacement.png' WHERE id='out-a'");
        const rejected = await run('trash', [{ ...output, sourceRevision: old.sourceRevision }]);
        assert.equal(rejected.failedCount, 1);
        const current = (await resolve('alice', [output]))[0];
        assert.notEqual(current.key, old.key);
        assert.equal(current.state?.favorite, false);
        const saved = (await resolve('alice', [asset]))[0];
        assert.equal(saved.key, old.key);
        assert.equal(saved.state?.favorite, true);
        await pg.pool.query("UPDATE media_assets SET deleted_at=now(),status='deleted' WHERE id='saved'");
        const restore = await run('restore', [asset]);
        assert.equal(restore.failedCount, 1);
        assert.equal((await pg.pool.query("SELECT status FROM media_assets WHERE id='saved'")).rows[0].status, 'deleted');
    });
    await t.test('unexpected SQL failure rolls back all valid writes and reports no success', async () => {
        const refs = [{ type: 'legacy', assetId: 'legacy-only', kind: 'image' }, { ...output, outputId: 'out-b' }];
        await pg.pool.query(`CREATE FUNCTION reject_organization_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure'; END $$;
      CREATE TRIGGER reject_organization_write BEFORE INSERT OR UPDATE ON library_organization FOR EACH ROW EXECUTE FUNCTION reject_organization_write()`);
        const before = (await pg.pool.query('SELECT * FROM library_organization ORDER BY key')).rows;
        const result = await run('trash', refs);
        assert.equal(result.succeededCount, 0);
        assert.equal(result.failedCount, 2);
        assert.deepEqual((await pg.pool.query('SELECT * FROM library_organization ORDER BY key')).rows, before);
        await pg.pool.query('DROP TRIGGER reject_organization_write ON library_organization');
    });
    await t.test('save promotion attaches a materialized legacy key before its last legacy anchor disappears', async () => {
        const ref = { type: 'legacy', assetId: 'legacy-only', kind: 'image' } as const;
        const old = (await run('favorite', [ref])).results[0];
        const { ensureReusableAsset } = await import('../frontend/server/media-library/assets');
        const promoted = await ensureReusableAsset({ userId: 'alice', kind: 'image', url: 'https://durable.test/legacy.png', source: 'upload' });
        await pg.pool.query("DELETE FROM user_assets WHERE user_id='alice' AND asset_id='legacy-only'");
        const current = (await resolve('alice', [{ type: 'asset', assetId: promoted.publicId!, kind: 'image' }]))[0];
        assert.equal(current.key, old.key);
        assert.equal(current.state?.favorite, true);
    });
    await t.test('failed promotion rolls its canonical insert back with its alias registration', async () => {
        await pg.pool.query("INSERT INTO user_assets(asset_id,user_id,url,mime_type) VALUES('rollback-legacy','alice','https://durable.test/rollback.png','image/png')");
        const before = await run('favorite', [{ type: 'legacy', assetId: 'rollback-legacy', kind: 'image' }]);
        await pg.pool.query(`CREATE TRIGGER reject_promotion_alias BEFORE INSERT ON library_organization_aliases FOR EACH ROW EXECUTE FUNCTION reject_organization_write()`);
        const { ensureReusableAsset } = await import('../frontend/server/media-library/assets');
        try {
            await assert.rejects(ensureReusableAsset({ userId: 'alice', kind: 'image', url: 'https://durable.test/rollback.png', source: 'upload' }), /fixture failure/);
        }
        finally {
            await pg.pool.query('DROP TRIGGER reject_promotion_alias ON library_organization_aliases');
        }
        assert.equal((await pg.pool.query("SELECT count(*) FROM media_assets WHERE user_id='alice' AND url='https://durable.test/rollback.png'")).rows[0].count, '0');
        assert.equal((await resolve('alice', [{ type: 'legacy', assetId: 'rollback-legacy', kind: 'image' }]))[0].key, before.results[0].key);
    });
    await t.test('ambiguous legacy provenance and conflicting persisted aliases fail without unioning state', async () => {
        await pg.pool.query(`INSERT INTO user_assets(asset_id,user_id,url,mime_type,metadata) VALUES('ambiguous','alice','https://original.test/shared.png','image/png','{"jobId":"job"}')`);
        // Restore equal original for two exact output IDs; the job-only alias cannot select one.
        await pg.pool.query("UPDATE job_outputs SET url='https://original.test/shared.png' WHERE id='out-a'");
        const ambiguous = await run('favorite', [{ type: 'legacy', assetId: 'ambiguous', kind: 'image' }]);
        assert.equal(ambiguous.succeededCount, 1);
        assert.notEqual(ambiguous.results[0].key, (await resolve('alice', [output]))[0].key);
        await pg.pool.query("DELETE FROM user_assets WHERE asset_id='ambiguous'");
        await pg.pool.query(`INSERT INTO user_assets(asset_id,user_id,url,mime_type) VALUES
      ('split-one','alice','https://original.test/split.png','image/png'),('split-two','alice','https://original.test/split.png','image/png')`);
        const first = await run('favorite', [{ type: 'legacy', assetId: 'split-one', kind: 'image' }]);
        const second = await run('trash', [{ type: 'legacy', assetId: 'split-two', kind: 'image' }]);
        assert.notEqual(first.results[0].key, second.results[0].key);
        await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,source) VALUES('unifier','ma_33333333333333333333333333333333','alice','image','https://original.test/split.png','upload')`);
        const conflict = await run('restore', [{ type: 'asset', assetId: 'ma_33333333333333333333333333333333', kind: 'image' }]);
        assert.equal(conflict.failedCount, 1);
        assert.equal(conflict.results[0].error, 'ORGANIZATION_IDENTITY_CONFLICT');
        assert.equal((await pg.pool.query('SELECT trashed_at IS NOT NULL AS trashed FROM library_organization WHERE user_id=$1 AND key=$2', ['alice', second.results[0].key])).rows[0].trashed, true);
    });
    await t.test('500 distinct owned sources commit; hidden, wrong-kind, missing and URL-only references do not', async () => {
        await pg.pool.query("INSERT INTO app_jobs VALUES('bulk-job','alice',false)");
        await pg.pool.query(`INSERT INTO job_outputs(id,job_id,user_id,kind,url,position)
          SELECT 'bulk-output-'||n,'bulk-job','alice','image','https://original.test/bulk-'||n||'.png',n FROM generate_series(1,500) n`);
        await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,source,source_job_id,source_output_id,metadata)
          SELECT 'bulk-'||n,'ma_'||lpad(n::text,32,'0'),'alice','image','https://example.test/bulk-'||n||'.png','saved_job_output','bulk-job','bulk-output-'||n,
          jsonb_build_object('originUrl','https://original.test/bulk-'||n||'.png') FROM generate_series(1,500) n`);
        await pg.pool.query(`INSERT INTO user_assets(asset_id,user_id,url,mime_type,metadata)
          SELECT id,user_id,url,'image/png',metadata||jsonb_build_object('jobId',source_job_id,'sourceOutputId',source_output_id) FROM media_assets WHERE source_job_id='bulk-job'`);
        const refs = Array.from({ length: 500 }, (_, i) => ({ type: 'asset', assetId: 'ma_' + String(i + 1).padStart(32, '0'), kind: 'image' }));
        let statements = 0, sourceReads = 0;
        const wrapped = new Set<any>();
        const observe = (client: any) => {
            if (wrapped.has(client))
                return;
            wrapped.add(client);
            const original = client.query.bind(client);
            client.query = (...args: any[]) => { statements++; if (typeof args[0] === 'string' && /^\s*(SELECT|WITH)/.test(args[0]) && /FROM (media_assets|user_assets|job_outputs|app_jobs)/.test(args[0]))
                sourceReads++; return original(...args); };
        };
        const pool = db.getDb();
        pool.on('acquire', observe);
        const start = performance.now();
        let result;
        try {
            result = await run('favorite', refs);
        }
        finally {
            pool.removeListener('acquire', observe);
        }
        t.diagnostic(JSON.stringify({ case: '500 distinct with canonical/legacy/output mirrors', sourceReads, statements, elapsedMs: Math.round(performance.now() - start) }));
        assert.equal(result.succeededCount, 500);
        assert.equal(result.affectedCount, 500);
        assert.ok(statements <= 64, `500 references must use bounded set queries, got ${statements} SQL statements`);
        await pg.pool.query("UPDATE app_jobs SET hidden=true WHERE job_id='job'");
        const denied = await run('trash', [output, { ...asset, kind: 'audio' }, { type: 'legacy', assetId: 'absent', kind: 'image' }, { url: 'https://example.test/bulk-1.png', kind: 'image' }]);
        assert.equal(denied.failedCount, 4);
        assert.equal(denied.succeededCount, 0);
        await pg.pool.query("UPDATE app_jobs SET hidden=false WHERE job_id='job'");
    });
    await t.test('unrelated outputs sharing an original do not turn an exact output reference into ambiguity', async () => {
        await pg.pool.query("INSERT INTO app_jobs VALUES('crowd-job','alice',false)");
        await pg.pool.query(`INSERT INTO job_outputs(id,job_id,user_id,kind,url,position)
          SELECT 'crowd-'||n,'crowd-job','alice','image','https://original.test/crowded.png',n FROM generate_series(1,1001) n`);
        await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,source,source_job_id,source_output_id,metadata)
          SELECT 'crowd-asset-'||n,'ma_'||repeat('c',16)||lpad(n::text,16,'0'),'alice','image','https://durable.test/crowd-'||n||'.png',
          'saved_job_output','crowd-job','crowd-'||n,'{"originUrl":"https://original.test/crowded.png"}'::jsonb FROM generate_series(1,1001) n`);
        await pg.pool.query(`INSERT INTO user_assets(asset_id,user_id,url,mime_type,metadata)
          SELECT id,user_id,url,'image/png',metadata||jsonb_build_object('jobId',source_job_id,'sourceOutputId',source_output_id) FROM media_assets WHERE source_job_id='crowd-job'`);
        const exact = { type: 'job-output', jobId: 'crowd-job', outputId: 'crowd-1', kind: 'image' } as const;
        const result = await run('favorite', [exact, { type: 'asset', assetId: 'ma_' + 'c'.repeat(16) + '0000000000000001', kind: 'image' }, { type: 'legacy', assetId: 'crowd-asset-1', kind: 'image' }]);
        assert.equal(result.succeededCount, 3);
        assert.equal(result.affectedCount, 1);
        const other = (await resolve('alice', [{ ...exact, outputId: 'crowd-2' }]))[0];
        assert.notEqual(result.results[0].key, other.key);
        assert.equal(other.state?.favorite, false);
        await pg.pool.query("INSERT INTO job_outputs(id,job_id,user_id,kind,url,position) VALUES('crowd-1002','crowd-job','alice','image','https://original.test/crowded.png',1002)");
        const { ensureReusableAsset } = await import('../frontend/server/media-library/assets');
        const saved = await ensureReusableAsset({ userId: 'alice', kind: 'image', url: 'https://original.test/crowded.png', source: 'saved_job_output', sourceJobId: 'crowd-job', sourceOutputId: 'crowd-1002' }, { copyRemoteMediaFn: async () => ({ url: 'https://durable.test/crowd-new.png', mimeType: 'image/png', thumbUrl: null, width: null, height: null, sizeBytes: 24 }) });
        assert.ok(saved.publicId);
    });
    await t.test('MCP retained bytes and cleanup holds survive Trash; old DELETE and unavailable fences prevent restore', async () => {
        for (const name of ['32_mcp_reference_uploads.sql', '34_mcp_reference_upload_media_kind.sql', '35_mcp_reference_upload_hardening.sql', '36_mcp_reference_upload_replay_safety.sql', '37_mcp_reference_upload_recovery_state.sql', '43_mcp_reference_asset_deletion.sql', '44_mcp_reference_staging_storage_namespace.sql']) {
            await pg.pool.query(readFileSync('neon/migrations/' + name, 'utf8'));
        }
        const sessions = await import('../frontend/src/server/agent-api/reference-upload-sessions');
        const attempts = await import('../frontend/src/server/agent-api/reference-upload-attempts');
        const { randomUUID } = await import('node:crypto');
        const session = await sessions.createUploadSession({ userId: 'alice', oauthClientId: 'fixture', mediaKind: 'image' });
        const claimed = await db.withDbTransaction(executor => sessions.claimUploadSessionForUpload({ token: session.token, userId: 'alice' }, { executor, randomUUID }));
        const uploadId = randomUUID();
        const digest = 'a'.repeat(64);
        const attempt = await db.withDbTransaction(executor => attempts.createReferenceUploadAttempt({ session: claimed, uploadId, storageKey: 'mcp-reference-staging/' + 'b'.repeat(32) + '/' + uploadId, fileName: 'reference.png', declaredMime: 'image/png', declaredSize: 4, fileSha256: digest, chunkBytes: 4, totalParts: 1, mediaKind: 'image' }, { executor }));
        const key = 'user-assets/by-content/' + 'c'.repeat(32) + '/' + digest + '.png';
        const publicId = 'ma_' + 'e'.repeat(32);
        await db.withDbTransaction(async (executor) => {
            await attempts.registerReferenceUploadCleanupObject({ attempt, objectKey: key, objectRole: 'final', safeToDelete: false }, { executor, now: new Date() });
            await attempts.retainReferenceUploadCleanupObject({ attempt, objectKey: key }, { executor, now: new Date() });
        });
        const leaseId = randomUUID();
        const leased = await db.withDbTransaction(executor => attempts.acquireReferenceUploadCompletionLease({ attempt }, { executor, leaseId, now: new Date() }));
        const staged = await db.withDbTransaction(executor => attempts.stageReferenceUploadAttempt({ attempt: leased, leaseId, version: leased.version, contentSha256: digest, assetId: publicId }, { executor, updatedAt: new Date() }));
        await db.withDbTransaction(executor => attempts.completeReferenceUploadAttempt({ attempt: staged, leaseId, version: staged.version }, { executor, completedAt: new Date() }));
        await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,source) VALUES('fenced',$1,'alice','image',$2,'image/png','upload')`, [publicId, 'https://media.maxvideoai.com/' + key]);
        const ref = { type: 'asset', assetId: publicId, kind: 'image' };
        const ledger = (await pg.pool.query('SELECT * FROM mcp_reference_upload_cleanup_objects')).rows;
        const fences = (await pg.pool.query('SELECT * FROM mcp_reference_upload_object_fences')).rows;
        assert.equal((await run('trash', [ref])).succeededCount, 1);
        assert.equal((await run('restore', [ref])).succeededCount, 1);
        assert.deepEqual((await pg.pool.query('SELECT * FROM mcp_reference_upload_cleanup_objects')).rows, ledger);
        assert.deepEqual((await pg.pool.query('SELECT * FROM mcp_reference_upload_object_fences')).rows, fences);
        await run('trash', [ref]);
        const { resolveStudioMedia } = await import('../frontend/src/server/studio/media-resolver');
        assert.equal((await resolveStudioMedia('alice', ref, async (sql, values) => (await pg.pool.query(sql, values)).rows)).url, 'https://media.maxvideoai.com/' + key);
        await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,source) VALUES('quarantined',$1,'alice','image',$2,'image/png','upload');`, ['ma_' + 'f'.repeat(32), 'https://unrecognized.test/' + key]);
        await pg.pool.query("INSERT INTO app_jobs VALUES('fenced-job','alice',false)");
        await pg.pool.query("INSERT INTO job_outputs(id,job_id,user_id,kind,url) VALUES('fenced-output','fenced-job','alice','image',$1)", ['https://media.maxvideoai.com/' + key]);
        await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,source,source_job_id,source_output_id,metadata)
      VALUES('copied-fenced','ma_dddddddddddddddddddddddddddddddd','alice','image','https://durable.test/fence-copy.png','saved_job_output','fenced-job','fenced-output',jsonb_build_object('originUrl',$1::text));`, ['https://media.maxvideoai.com/' + key]);
        await pg.pool.query("UPDATE mcp_reference_upload_object_fences SET state='deleted',updated_at=clock_timestamp() WHERE object_key=$1", [key]);
        assert.equal((await run('restore', [ref])).results[0].error, 'SOURCE_UNAVAILABLE');
        assert.equal((await run('restore', [{ type: 'asset', assetId: 'ma_' + 'f'.repeat(32), kind: 'image' }])).results[0].error, 'SOURCE_UNAVAILABLE', 'unknown authorities cannot bypass an existing storage fence');
        assert.equal((await run('restore', [{ type: 'asset', assetId: 'ma_dddddddddddddddddddddddddddddddd', kind: 'image' }])).succeededCount, 1, 'a separately saved durable original remains usable when the old output storage is unavailable');
        await pg.pool.query("UPDATE mcp_reference_upload_object_fences SET state='referenced',updated_at=clock_timestamp() WHERE object_key=$1", [key]);
        const { deleteLibraryAsset } = await import('../frontend/server/media-library/asset-deletion');
        assert.equal(await deleteLibraryAsset({ userId: 'alice', assetId: 'fenced' }), 'deleted');
        assert.equal((await run('restore', [ref])).failedCount, 1);
        assert.equal((await pg.pool.query('SELECT state FROM mcp_reference_upload_cleanup_objects WHERE object_key=$1', [key])).rows[0].state, 'released');
    });
    await t.test('restore waits for old DELETE and cannot resurrect the committed deleted source', async () => {
        const { deleteLibraryAsset } = await import('../frontend/server/media-library/asset-deletion');
        const ref = { type: 'asset', assetId: 'ma_00000000000000000000000000000001', kind: 'image' };
        await run('trash', [ref]);
        let unlock!: () => void;
        const gate = new Promise<void>(resolve => { unlock = resolve; });
        let deleted!: () => void;
        const reached = new Promise<void>(resolve => { deleted = resolve; });
        const deletion = deleteLibraryAsset({ userId: 'alice', assetId: 'bulk-1' }, { ensureSchema: async () => { }, withTransaction: callback => db.withDbTransaction(async (executor) => { const result = await callback(executor); deleted(); await gate; return result; }) });
        await reached;
        const restoration = run('restore', [ref]);
        try {
            let waiting = false;
            for (let i = 0; i < 80 && !waiting; i++) {
                waiting = (await pg.pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%FROM media_assets%'")).rows[0].n > 0;
                if (!waiting)
                    await new Promise(resolve => setTimeout(resolve, 10));
            }
            assert.equal(waiting, true, 'restore must hold/wait on the canonical source row lock');
        }
        finally {
            unlock();
        }
        assert.equal(await deletion, 'deleted');
        assert.equal((await restoration).failedCount, 1);
        assert.equal((await pg.pool.query("SELECT status FROM media_assets WHERE id='bulk-1'")).rows[0].status, 'deleted');
    });
    await t.test('a legacy restore waits on canonical-first DELETE without reverse-order deadlock', async () => {
        const { deleteLibraryAsset } = await import('../frontend/server/media-library/asset-deletion');
        const legacyRef = { type: 'legacy', assetId: 'bulk-2', kind: 'image' };
        await run('trash', [legacyRef]);
        let unlock!: () => void;
        const gate = new Promise<void>(resolve => { unlock = resolve; });
        let locked!: () => void;
        const held = new Promise<void>(resolve => { locked = resolve; });
        const deletion = deleteLibraryAsset({ userId: 'alice', assetId: 'bulk-2' }, { ensureSchema: async () => { }, withTransaction: callback => db.withDbTransaction(async (executor) => {
                await executor.query("SET LOCAL lock_timeout='2s'");
                await executor.query("SELECT id FROM media_assets WHERE id='bulk-2' AND user_id='alice' FOR UPDATE");
                locked();
                await gate;
                return callback(executor);
            }) });
        await held;
        const restoration = run('restore', [legacyRef]);
        try {
            let waiting = false;
            for (let i = 0; i < 80 && !waiting; i++) {
                waiting = (await pg.pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%media_assets%'")).rows[0].n > 0;
                if (!waiting)
                    await new Promise(resolve => setTimeout(resolve, 10));
            }
            assert.equal(waiting, true);
        }
        finally {
            unlock();
        }
        assert.equal(await deletion, 'deleted');
        assert.equal((await restoration).failedCount, 1);
    });
    await t.test('a concurrent replacement fails the old output revision after waiting for its source lock', async () => {
        const reference = { type: 'job-output', jobId: 'crowd-job', outputId: 'crowd-2', kind: 'image' } as const;
        const old = (await resolve('alice', [reference]))[0];
        const client = await pg.pool.connect();
        await client.query('BEGIN');
        await client.query("UPDATE job_outputs SET url='https://original.test/concurrent-new.png' WHERE id='crowd-2'");
        const action = run('trash', [{ ...reference, sourceRevision: old.sourceRevision }]);
        try {
            let waiting = false;
            for (let i = 0; i < 80 && !waiting; i++) {
                waiting = (await pg.pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%job_outputs%'")).rows[0].n > 0;
                if (!waiting)
                    await new Promise(resolve => setTimeout(resolve, 10));
            }
            assert.equal(waiting, true);
        }
        finally {
            await client.query('COMMIT');
            client.release();
        }
        const result = await action;
        assert.equal(result.failedCount, 1);
        assert.equal(result.results[0].error, 'SOURCE_VERSION_CHANGED');
        const current = (await resolve('alice', [reference]))[0];
        assert.notEqual(current.key, old.key);
        assert.equal(current.state?.trashedAt, null);
    });
    await t.test('removing an output row leaves its tombstone but cannot authorize Restore through the old output ref', async () => {
        const reference={type:'job-output',jobId:'crowd-job',outputId:'crowd-3',kind:'image'} as const;
        const trashed=await run('trash',[reference]);
        await pg.pool.query("DELETE FROM job_outputs WHERE id='crowd-3'");
        const unavailable=await run('restore',[reference]);assert.equal(unavailable.failedCount,1);
        const persisted=(await pg.pool.query('SELECT trashed_at FROM library_organization WHERE user_id=$1 AND key=$2',['alice',trashed.results[0].key])).rows[0];
        assert.ok(persisted.trashed_at);
        const saved={type:'asset',assetId:'ma_'+ 'c'.repeat(16)+'0000000000000003',kind:'image'};
        const available=await run('restore',[saved]);assert.equal(available.succeededCount,1);assert.equal(available.results[0].key,trashed.results[0].key);
    });

    await t.test('mixed-kind provenance keeps identity stable alone, in batches and after successful writes', async () => {
        await pg.pool.query("INSERT INTO app_jobs VALUES('mixed-kind-job','alice',false)");
        await pg.pool.query(`INSERT INTO job_outputs(id,job_id,user_id,kind,url) VALUES('mixed-video','mixed-kind-job','alice','video','https://original.test/mixed.mp4')`);
        await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,source,source_job_id,source_output_id,metadata)
          VALUES('mixed-image','ma_55555555555555555555555555555555','alice','image','https://original.test/mixed.mp4','image/png','saved_job_output','mixed-kind-job','mixed-video','{"originUrl":"https://original.test/mixed.mp4"}')`);
        await pg.pool.query(`INSERT INTO user_assets(asset_id,user_id,url,mime_type,metadata)
          VALUES('mixed-image','alice','https://original.test/mixed.mp4','image/png','{"jobId":"mixed-kind-job","sourceOutputId":"mixed-video","originUrl":"https://original.test/mixed.mp4"}')`);
        const image={type:'asset',assetId:'ma_55555555555555555555555555555555',kind:'image'} as const;
        const video={type:'job-output',jobId:'mixed-kind-job',outputId:'mixed-video',kind:'video'} as const;
        const imageAlone=(await resolve('alice',[image]))[0];const videoAlone=(await resolve('alice',[video]))[0];
        const mixed=await resolve('alice',[image,video]);
        assert.equal(mixed[0].key,imageAlone.key);assert.equal(mixed[1].key,videoAlone.key);assert.notEqual(mixed[0].key,mixed[1].key);
        for(const item of mixed)assert.ok(item.identity!.sources.every(source=>source.kind===item.reference.kind));
        const favorite=await run('favorite',[image,video]);assert.equal(favorite.succeededCount,2);assert.equal(favorite.affectedCount,2);
        const later=await resolve('alice',[image,video]);
        assert.deepEqual(favorite.results.map(row=>row.key),later.map(row=>row.key));
        assert.deepEqual(later.map(row=>row.key),[imageAlone.key,videoAlone.key]);
        await run('unfavorite',[image]);await run('trash',[video]);
        const independent=await resolve('alice',[image,video]);
        assert.equal(independent[0].state?.favorite,false);assert.equal(independent[0].state?.trashedAt,null);
        assert.equal(independent[1].state?.favorite,true);assert.ok(independent[1].state?.trashedAt);
    });
    await t.test('conflicting new alias assignments fail before any materialization insert', async () => {
        const {materializeOrganizationIdentities}=await import('../frontend/server/media-library/organization-identity');
        const identity=(await resolve('alice',[{type:'asset',assetId:'ma_'+ 'c'.repeat(16)+'0000000000000004',kind:'image'}]))[0].identity!;
        const first={...identity,key:'lo_fixture_collision_first'};
        const second={...identity,key:'lo_fixture_collision_second'};
        await db.withDbTransaction(async executor=>{
            await assert.rejects(materializeOrganizationIdentities('alice',[first,second],executor),/ORGANIZATION_IDENTITY_CONFLICT/);
            const rows=await executor.query<{count:string}>("SELECT count(*)::text AS count FROM library_organization WHERE user_id='alice' AND key=ANY($1::text[])",[[first.key,second.key]]);
            assert.equal(rows[0].count,'0','even a caller catching the conflict must observe no inserted organizations');
            const aliases=await executor.query<{count:string}>("SELECT count(*)::text AS count FROM library_organization_aliases WHERE user_id='alice' AND organization_key=ANY($1::text[])",[[first.key,second.key]]);
            assert.equal(aliases[0].count,'0');
        });
    });
    await t.test('exact differently named legacy proof survives 1001 earlier similarity candidates', async () => {
        await pg.pool.query(`INSERT INTO user_assets(asset_id,user_id,url,mime_type,metadata)
          VALUES('zzz-exact','alice','https://original.test/late-proof.png','image/png','{"jobId":"later-job","sourceOutputId":"later-output"}')`);
        const legacy={type:'legacy',assetId:'zzz-exact',kind:'image'} as const;
        const original=await run('favorite',[legacy]);assert.equal(original.succeededCount,1);const oldKey=original.results[0].key;
        await pg.pool.query("INSERT INTO app_jobs VALUES('later-job','alice',false)");
        await pg.pool.query(`INSERT INTO job_outputs(id,job_id,user_id,kind,url) VALUES('later-output','later-job','alice','image','https://original.test/late-proof.png')`);
        await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,source,source_job_id,source_output_id,metadata)
          VALUES('later-canonical','ma_66666666666666666666666666666666','alice','image','https://durable.test/late-proof.png','saved_job_output','later-job','later-output','{"originUrl":"https://original.test/late-proof.png"}')`);
        await pg.pool.query(`INSERT INTO user_assets(asset_id,user_id,url,mime_type,metadata)
          SELECT 'aaa-similarity-'||lpad(n::text,4,'0'),'alice','https://original.test/late-proof.png','image/png','{}'::jsonb FROM generate_series(1,1001)n`);
        const asset={type:'asset',assetId:'ma_66666666666666666666666666666666',kind:'image'} as const;
        const output={type:'job-output',jobId:'later-job',outputId:'later-output',kind:'image'} as const;
        for(const reference of [asset,output,legacy]){
            const alone=(await resolve('alice',[reference]))[0];assert.equal(alone.key,oldKey);assert.equal(alone.state?.favorite,true);
        }
        const action=await run('trash',[asset,output,legacy]);assert.equal(action.succeededCount,3);assert.equal(action.affectedCount,1);
        assert.ok(action.results.every(row=>row.key===oldKey&&row.state?.favorite));
        const later=await resolve('alice',[asset,output,legacy]);assert.ok(later.every(row=>row.key===oldKey&&row.state?.trashedAt));
    });

    await t.test('materialized URL-only legacy proof survives the similarity bound', async () => {
        await pg.pool.query("INSERT INTO user_assets(asset_id,user_id,url,mime_type,metadata) VALUES('zzz-materialized','alice','https://original.test/materialized-proof.png','image/png','{}')");
        const legacy={type:'legacy',assetId:'zzz-materialized',kind:'image'} as const;
        const old=(await run('favorite',[legacy])).results[0];
        await pg.pool.query(`INSERT INTO user_assets(asset_id,user_id,url,mime_type,metadata)
          SELECT 'aaa-materialized-'||n,'alice','https://original.test/materialized-proof.png','image/png','{}'::jsonb FROM generate_series(1,1001)n`);
        await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,source) VALUES('materialized-canonical','ma_77777777777777777777777777777777','alice','image','https://original.test/materialized-proof.png','upload')`);
        const asset={type:'asset',assetId:'ma_77777777777777777777777777777777',kind:'image'} as const;
        const resolved=(await resolve('alice',[asset]))[0];assert.equal(resolved.key,old.key);assert.equal(resolved.state?.favorite,true);
    });
    await t.test('an over-bound proven identity group fails explicitly while unrelated references commit', async () => {
        await pg.pool.query(`INSERT INTO user_assets(asset_id,user_id,url,mime_type,metadata)
          VALUES('zzz-proof-overflow','alice','https://original.test/proof-overflow.png','image/png','{"jobId":"proof-overflow-job","sourceOutputId":"proof-overflow-output"}')`);
        const legacy={type:'legacy',assetId:'zzz-proof-overflow',kind:'image'} as const;
        const old=(await run('favorite',[legacy])).results[0];
        await pg.pool.query(`INSERT INTO user_assets(asset_id,user_id,url,mime_type,metadata)
          SELECT 'aaa-proof-overflow-'||n,'alice','https://original.test/proof-overflow.png','image/png','{"jobId":"proof-overflow-job","sourceOutputId":"proof-overflow-output"}'::jsonb FROM generate_series(1,1000)n`);
        await pg.pool.query("INSERT INTO app_jobs VALUES('proof-overflow-job','alice',false)");
        await pg.pool.query(`INSERT INTO job_outputs(id,job_id,user_id,kind,url) VALUES('proof-overflow-output','proof-overflow-job','alice','image','https://original.test/proof-overflow.png')`);
        await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,source,source_job_id,source_output_id,metadata)
          VALUES('proof-overflow-canonical','ma_88888888888888888888888888888888','alice','image','https://durable.test/proof-overflow.png','saved_job_output','proof-overflow-job','proof-overflow-output','{"originUrl":"https://original.test/proof-overflow.png"}')`);
        const asset={type:'asset',assetId:'ma_88888888888888888888888888888888',kind:'image'} as const;
        const output={type:'job-output',jobId:'proof-overflow-job',outputId:'proof-overflow-output',kind:'image'} as const;
        const unrelated={type:'asset',assetId:'ma_'+ 'c'.repeat(16)+'0000000000000005',kind:'image'};
        const result=await run('trash',[asset,unrelated]);assert.equal(result.succeededCount,1);assert.equal(result.failedCount,1);
        assert.equal(result.results[0].error,'IDENTITY_PROOF_LIMIT');assert.equal(result.results[0].key,undefined);assert.equal(result.results[0].state,undefined);
        const persisted=(await pg.pool.query('SELECT favorite,trashed_at FROM library_organization WHERE user_id=$1 AND key=$2',['alice',old.key])).rows[0];
        assert.deepEqual(persisted,{favorite:true,trashed_at:null});
        assert.equal((await pg.pool.query(`SELECT count(*) FROM library_organization_aliases WHERE user_id='alice' AND
          (reference->>'assetId'='ma_88888888888888888888888888888888' OR reference->>'outputId'='proof-overflow-output' OR reference->>'assetId' LIKE 'aaa-proof-overflow-%')`)).rows[0].count,'0');
        const unresolved=await resolve('alice',[asset,legacy,output]);
        assert.ok(unresolved.every(row=>row.error==='IDENTITY_PROOF_LIMIT'&&row.key===undefined&&row.state===undefined));
        await pg.pool.query("DELETE FROM user_assets WHERE asset_id='aaa-proof-overflow-1000'");
        const atLimit=(await resolve('alice',[asset]))[0];assert.equal(atLimit.key,old.key);assert.equal(atLimit.state?.favorite,true);
    });

});
