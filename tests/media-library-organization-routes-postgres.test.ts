import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import { startDisposablePostgres } from './helpers/disposable-postgres';
const requireFrontend = createRequire(resolve('frontend/package.json'));
test('real collection and organization routes authenticate, validate and serialize committed PG state', { timeout: 60000 }, async (t) => {
    const pg = await startDisposablePostgres('library-org-routes');
    const folder = mkdtempSync(join(tmpdir(), 'library-org-routes-'));
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = pg.databaseUrl;
    const fixture = { userId: 'alice' as string | null };
    const globals = globalThis as typeof globalThis & {
        __organizationRoutes?: typeof fixture;
    };
    globals.__organizationRoutes = fixture;
    let close: (() => Promise<void>) | undefined;
    t.after(async () => {
        await close?.();
        if (previous === undefined)
            delete process.env.DATABASE_URL;
        else
            process.env.DATABASE_URL = previous;
        delete globals.__organizationRoutes;
        rmSync(folder, { recursive: true, force: true });
        await pg.cleanup();
    });
    assert.ok(existsSync('frontend/app/api/media-library/organization/route.ts'), 'organization POST must exist');
    const outfile = join(folder, 'routes.cjs');
    await build({ stdin: { loader: 'ts', resolveDir: process.cwd(), contents: `export * as collections from './frontend/app/api/media-library/collections/route';export * as collection from './frontend/app/api/media-library/collections/[collectionId]/route';export * as organization from './frontend/app/api/media-library/organization/route';export{getDb}from'@/lib/db';export{ensureAssetSchema,ensureMediaLibrarySchema,ensureMediaLibraryOrganizationSchema}from'@/lib/schema';` }, outfile, bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json', plugins: [{ name: 'auth-boundary', setup(b) {
                    b.onResolve({ filter: /^@\/lib\/supabase-ssr$/ }, () => ({ path: 'auth', namespace: 'fixture' }));
                    b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const createSupabaseServerClient=()=>{throw new Error("unexpected auth access")};export const getRouteAuthContext=async()=>({userId:globalThis.__organizationRoutes.userId});', loader: 'ts' }));
                    b.onResolve({ filter: /^(next\/server|pg)$/ }, a => ({ path: requireFrontend.resolve(a.path), external: true }));
                } }] });
    const routes = requireFrontend(outfile);
    close = () => routes.getDb().end();
    const { NextRequest } = requireFrontend('next/server');
    const req = (path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') => new NextRequest('http://localhost/api/media-library/' + path, { method, ...(body !== undefined ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}) });
    // No database configured: any unauthenticated SQL is an immediate failure, not a spy assertion.
    fixture.userId = null;
    delete process.env.DATABASE_URL;
    assert.equal((await routes.collections.GET(req('collections'))).status, 401);
    assert.equal((await routes.collections.POST(req('collections', { name: 'No' }))).status, 401);
    assert.equal((await routes.organization.POST(req('organization', {}))).status, 401);
    assert.equal((await routes.collection.PATCH(req('collections/foreign', { name: 'No' }, 'PATCH'), { params: Promise.resolve({ collectionId: 'foreign' }) })).status, 401);
    assert.equal((await routes.collection.DELETE(req('collections/foreign', undefined, 'DELETE'), { params: Promise.resolve({ collectionId: 'foreign' }) })).status, 401);
    fixture.userId = 'alice';
    process.env.DATABASE_URL = pg.databaseUrl;
    await routes.ensureAssetSchema();
    await routes.ensureMediaLibrarySchema();
    await routes.ensureMediaLibraryOrganizationSchema();
    await pg.pool.query(`CREATE TABLE app_jobs(job_id text PRIMARY KEY,user_id text,hidden boolean DEFAULT false);
    INSERT INTO media_assets(id,public_id,user_id,kind,url,source) VALUES('a','ma_a','alice','image','https://example.test/a.png','upload')`);
    const created = await routes.collections.POST(req('collections', { name: '  Album  ' }));
    assert.equal(created.status, 201);
    const collection = (await created.json()).collection;
    assert.equal(collection.name, 'Album');
    const invalid = await routes.collections.POST(req('collections', { name: ' ' }));
    assert.equal(invalid.status, 400);
    assert.equal((await routes.organization.POST(req('organization', { operation: 'trash', references: [], snapshotId: 'future' }))).status, 400);
    const ref = { type: 'asset', assetId: 'ma_a', kind: 'image' };
    for (const operation of [['favorite'], { toString: 'favorite' }]) {
        assert.equal((await routes.organization.POST(req('organization', { operation, references: [ref] }))).status, 400);
        assert.equal((await pg.pool.query('SELECT count(*) FROM library_organization')).rows[0].count, '0');
    }
    for (const kind of [['image'], {}]) {
        const invalid = await routes.organization.POST(req('organization', { operation: 'favorite', references: [{ ...ref, kind }] }));
        assert.equal((await invalid.json()).failedCount, 1);
        assert.equal((await pg.pool.query('SELECT count(*) FROM library_organization')).rows[0].count, '0');
    }
    const result = await routes.organization.POST(req('organization', { operation: 'add-to-collection', references: [ref, { ...ref, assetId: 'foreign' }], collectionId: collection.id }));
    assert.equal(result.status, 200);
    const data = await result.json();
    assert.equal(data.succeededCount, 1);
    assert.equal(data.failedCount, 1);
    assert.deepEqual(data.results[0].state.collectionIds, [collection.id]);
    assert.equal((await routes.organization.POST(req('organization', { operation: 'favorite', references: Array(501).fill(ref) }))).status, 400);
    assert.equal((await routes.organization.POST(req('organization', { operation: 'add-to-collection', references: [ref], collectionId: 'missing' }))).status, 404);
    const context = { params: Promise.resolve({ collectionId: collection.id }) };
    assert.equal((await routes.collection.PATCH(req('collections/' + collection.id, { name: 'Renamed' }, 'PATCH'), context)).status, 200);
    const malformed = await routes.organization.POST(new NextRequest('http://localhost/api/media-library/organization', { method: 'POST', body: '{' }));
    assert.equal(malformed.status, 400);
    await pg.pool.query(`CREATE FUNCTION fixture_org_rollback() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'rollback'; END $$;
      CREATE TRIGGER fixture_org_rollback BEFORE UPDATE ON library_organization FOR EACH ROW EXECUTE FUNCTION fixture_org_rollback()`);
    try {
        const rollback = await routes.organization.POST(req('organization', { operation: 'favorite', references: [ref] }));
        assert.equal(rollback.status, 500);
        const failed = await rollback.json();
        assert.equal(failed.ok, false);
        assert.equal(failed.succeededCount, 0);
        assert.equal(failed.failedCount, 1);
        assert.equal((await pg.pool.query('SELECT favorite FROM library_organization')).rows[0].favorite, false);
    }
    finally {
        await pg.pool.query('DROP TRIGGER fixture_org_rollback ON library_organization');
    }
    const readonly = new URL(pg.databaseUrl);
    readonly.searchParams.set('options', '-c default_transaction_read_only=on');
    process.env.DATABASE_URL = readonly.toString();
    const listed = await routes.collections.GET(req('collections?limit=1'));
    assert.equal(listed.status, 200);
    assert.equal((await listed.json()).items[0].name, 'Renamed');
    await pg.pool.query('ALTER TABLE library_collections RENAME TO fixture_missing_collections');
    assert.equal((await routes.collections.GET(req('collections'))).status, 500);
    await pg.pool.query('ALTER TABLE fixture_missing_collections RENAME TO library_collections');
    process.env.DATABASE_URL = pg.databaseUrl;
    assert.equal((await routes.collection.DELETE(req('collections/' + collection.id, undefined, 'DELETE'), context)).status, 200);
    assert.equal((await pg.pool.query('SELECT count(*) FROM library_collection_members')).rows[0].count, '0');
});
