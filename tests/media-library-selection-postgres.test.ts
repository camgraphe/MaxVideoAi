import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { startDisposablePostgres } from './helpers/disposable-postgres';
test('frozen selection accepts 10000 distinct sources, rejects overflow atomically and returns compact complete failures', { timeout: 240000 }, async (t) => {
    assert.ok(existsSync('frontend/server/media-library/selection.ts'), 'snapshot owner must exist');
    const pg = await startDisposablePostgres('library-selection');
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = pg.databaseUrl;
    const db = await import('../frontend/src/lib/db');
    t.after(async () => { await db.getDb().end(); process.env.DATABASE_URL = previous; await pg.cleanup(); });
    const schema = await import('../frontend/src/lib/schema');
    await schema.ensureAssetSchema();
    await schema.ensureMediaLibrarySchema();
    await schema.ensureMediaLibraryOrganizationSchema();
    const mirrored = process.env.LIBRARY_SELECTION_FIXTURE !== 'canonical';
    await pg.pool.query(`CREATE TABLE app_jobs(job_id text PRIMARY KEY,user_id text,hidden boolean DEFAULT false,prompt text,surface text,settings_snapshot jsonb,duration_sec integer,aspect_ratio text,created_at timestamptz DEFAULT now());
    ${mirrored ? `INSERT INTO app_jobs(job_id,user_id) SELECT 'job-'||i,'alice' FROM generate_series(1,10000)i;
    INSERT INTO job_outputs(id,job_id,user_id,kind,url,created_at) SELECT 'out-'||i,'job-'||i,'alice','image','https://test/'||i,'2026-01-01'::timestamptz FROM generate_series(1,10000)i;` : ''}
    INSERT INTO media_assets(id,public_id,user_id,kind,url,source,source_job_id,source_output_id,metadata,created_at)
      SELECT 'source-'||i,'ma_'||i,'alice','image','https://test/'||i,${mirrored ? "'saved_job_output','job-'||i,'out-'||i" : "'upload',NULL,NULL"},'{}','2026-01-01'::timestamptz FROM generate_series(1,10000) i;
    ${mirrored ? `INSERT INTO user_assets(asset_id,user_id,url,mime_type,source,metadata,created_at)
      SELECT 'source-'||i,'alice','https://test/'||i,'image/png','generated',jsonb_build_object('jobId','job-'||i,'sourceOutputId','out-'||i),'2026-01-01'::timestamptz FROM generate_series(1,10000)i;` : ''}`);
    const { createLibrarySelectionSnapshot, mutateLibrarySelectionSnapshot } = await import('../frontend/server/media-library/selection');
    const scope = { view: 'all', kind: 'all', sort: 'recent' } as const;
    const timings: {
        sql: string;
        ms: number;
    }[] = [];
    let explained = false;
    const measuredPool = db.getDb(), connect = measuredPool.connect.bind(measuredPool);
    measuredPool.connect = (async () => {
        const client = await connect(), original = client.query.bind(client), release = client.release.bind(client);
        client.query = (async (...args: unknown[]) => {
            const start = Date.now();
            try {
                if (process.env.LIBRARY_BROWSE_EXPLAIN === '1' && !explained && String(args[0]).startsWith('WITH li_raw')) {
                    explained = true;
                    const plan = await original('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ' + String(args[0]), args[1] as any);
                    const { writeFileSync } = await import('node:fs');
                    writeFileSync('.superpowers/sdd/2026-11-09-media-library-integration/task-3-evidence/browse-explain.json', JSON.stringify(plan.rows, null, 2));
                }
                return await original(...args as Parameters<typeof original>);
            }
            finally {
                timings.push({ sql: String(args[0]).slice(0, 140), ms: Date.now() - start });
            }
        }) as typeof client.query;
        client.release = (...args) => { client.query = original; release(...args); };
        return client;
    }) as typeof measuredPool.connect;
    const createStart = Date.now();
    const snapshot = await createLibrarySelectionSnapshot({ userId: 'alice', scope });
    console.log(JSON.stringify({ fixture: mirrored ? 'mirrored' : 'canonical', phase: 'create', ms: Date.now() - createStart, slow: timings.filter(x => x.ms > 100) }));
    timings.length = 0;
    const { browseLibrary } = await import('../frontend/server/media-library/browse');
    const browseStart = Date.now();
    await browseLibrary({ userId: 'alice', scope });
    console.log(JSON.stringify({ phase: 'browse', ms: Date.now() - browseStart, slow: timings.filter(x => x.ms > 100) }));
    timings.length = 0;
    assert.equal(snapshot.totalCount, 10000);
    assert.equal(snapshot.keys.length, 10000);
    assert.equal(new Set(snapshot.keys).size, 10000);
    assert.equal((await pg.pool.query('SELECT expires_at-created_at AS ttl FROM library_selection_snapshots')).rows[0].ttl.minutes, 10);
    assert.ok(Buffer.byteLength(JSON.stringify(snapshot)) < 750000);
    await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,source) VALUES('later','ma_later','alice','image','https://test/later','upload')`);
    await assert.rejects(createLibrarySelectionSnapshot({ userId: 'alice', scope }), /SELECTION_LIMIT/);
    assert.equal((await pg.pool.query('SELECT count(*) FROM library_selection_snapshots')).rows[0].count, '1');
    assert.equal((await pg.pool.query('SELECT count(*) FROM library_selection_snapshot_items')).rows[0].count, '10000');
    await assert.rejects(mutateLibrarySelectionSnapshot({ userId: 'bob', snapshotId: snapshot.id, operation: 'trash' }), /SNAPSHOT_NOT_FOUND/);
    await assert.rejects(mutateLibrarySelectionSnapshot({ userId: 'alice', snapshotId: snapshot.id, operation: 'trash', excludedKeys: ['lo_missing'] }), /INVALID_EXCLUSIONS/);
    const excluded = snapshot.keys[0];
    const selected = (await pg.pool.query('SELECT organization_key,reference FROM library_selection_snapshot_items WHERE user_id=$1 AND snapshot_id=$2 AND organization_key<>$3 ORDER BY ordinal LIMIT 2', ['alice', snapshot.id, excluded])).rows;
    await pg.pool.query('DELETE FROM media_assets WHERE public_id=$1', [selected[0].reference.assetId]);
    await pg.pool.query("UPDATE media_assets SET url='https://test/replaced' WHERE public_id=$1", [selected[1].reference.assetId]);
    const pool = db.getDb();
    const originalConnect = pool.connect.bind(pool);
    let count = 0;
    pool.connect = (async () => { const client = await originalConnect(); const original = client.query.bind(client); client.query = ((...args: unknown[]) => { count++; return original(...args as Parameters<typeof original>); }) as typeof client.query; const release = client.release.bind(client); client.release = (...args) => { client.query = original; release(...args); }; return client; }) as typeof pool.connect;
    let result: Awaited<ReturnType<typeof mutateLibrarySelectionSnapshot>>;
    timings.length = 0;
    const start = Date.now();
    try {
        result = await mutateLibrarySelectionSnapshot({ userId: 'alice', snapshotId: snapshot.id, operation: 'favorite', excludedKeys: [excluded] });
    }
    finally {
        pool.connect = originalConnect;
    }
    assert.equal(result.succeededCount, 9997);
    assert.equal(result.failedCount, 2);
    assert.equal(result.affectedCount, 9997);
    assert.deepEqual(new Set(result.failed.map(x => x.errorCode)), new Set(['SOURCE_UNAVAILABLE', 'SOURCE_VERSION_CHANGED']));
    assert.equal(result.succeededKeys.includes(excluded), false);
    assert.equal(result.succeededKeys.length + result.failed.length, 9999);
    assert.ok(count <= 64, `grouped snapshot mutation must not waterfall: ${count} queries`);
    const bytes = Buffer.byteLength(JSON.stringify(result));
    assert.ok(bytes < 800000, `compact mutation wire=${bytes}`);
    console.log(JSON.stringify({ phase: 'action', slow: timings.filter(x => x.ms > 100) }));
    console.log(JSON.stringify({ distinctSources: 10000, queries: count, wireBytes: bytes, elapsedMs: Date.now() - start }));
    assert.equal((await pg.pool.query('SELECT count(*) FROM library_organization WHERE favorite')).rows[0].count, '9997');
    const retry = await mutateLibrarySelectionSnapshot({ userId: 'alice', snapshotId: snapshot.id, operation: 'favorite', excludedKeys: snapshot.keys.filter(k => !result.failed.some(f => f.key === k)) });
    assert.equal(retry.failedCount, 2);
    assert.equal(retry.succeededCount, 0);
    await pg.pool.query("UPDATE library_selection_snapshots SET expires_at=now()-interval '1 second'");
    await assert.rejects(mutateLibrarySelectionSnapshot({ userId: 'alice', snapshotId: snapshot.id, operation: 'restore' }), /SNAPSHOT_EXPIRED/);
    await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,source) VALUES('newer-1','ma_newer_1','alice','image','https://test/newer1','upload'),('newer-2','ma_newer_2','alice','image','https://test/newer2','upload')`);
    await pg.pool.query("UPDATE library_selection_snapshots SET expires_at=now()-interval '2 days' WHERE user_id='alice'");
    await pg.pool.query(`INSERT INTO library_selection_snapshots(user_id,id,scope,total_count,expires_at) VALUES
      ('alice','active-control','{}',0,now()+interval '10 minutes'),
      ('alice','extra-expired','{}',0,now()-interval '1 day'),
      ('bob','foreign-expired','{}',0,now()-interval '3 days')`);
    await assert.rejects(createLibrarySelectionSnapshot({ userId: 'alice', scope }), /SELECTION_LIMIT/);
    assert.equal((await pg.pool.query('SELECT count(*) FROM library_selection_snapshot_items')).rows[0].count, '10000');
    const refreshed = await createLibrarySelectionSnapshot({ userId: 'alice', scope: { ...scope, q: 'later' } });
    assert.equal(refreshed.totalCount, 1);
    assert.equal((await pg.pool.query('SELECT count(*) FROM library_selection_snapshot_items WHERE snapshot_id=$1', [snapshot.id])).rows[0].count, '0');
    assert.equal((await pg.pool.query('SELECT count(*) FROM library_selection_snapshots WHERE id=$1', [snapshot.id])).rows[0].count, '0');
    assert.deepEqual((await pg.pool.query("SELECT id FROM library_selection_snapshots WHERE id IN('active-control','extra-expired','foreign-expired') ORDER BY id")).rows.map(x => x.id), ['active-control', 'extra-expired', 'foreign-expired']);
});
