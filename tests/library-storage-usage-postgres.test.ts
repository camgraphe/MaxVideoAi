import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test('storage GET counts recorded originals once per owner, preserves unknowns and reads without DDL', { timeout: 60000 }, async t => {
  const pg = await startDisposablePostgres('library-storage');
  const folder = mkdtempSync(join(tmpdir(), 'library-storage-route-'));
  const fixture = { userId: 'alice' as string | null, statements: [] as string[], query: async (sql: string, args: unknown[]) => { fixture.statements.push(sql); return (await pg.pool.query(sql, args)).rows; } };
  (globalThis as any).__storageFixture = fixture;
  t.after(async () => { delete (globalThis as any).__storageFixture; rmSync(folder, { recursive: true, force: true }); await pg.cleanup(); });
  await pg.pool.query(`CREATE TABLE media_assets(user_id text,url text,size_bytes bigint,status text DEFAULT 'ready',deleted_at timestamptz,
      id text,public_id text,kind text DEFAULT 'image',source_output_id text,metadata jsonb);
    CREATE TABLE user_assets(user_id text,url text,size_bytes bigint,asset_id text,mime_type text,metadata jsonb);
    CREATE TABLE app_jobs(job_id text,user_id text,hidden boolean);
    CREATE TABLE job_outputs(user_id text,job_id text,url text,storage_url text,status text DEFAULT 'ready',id text,kind text DEFAULT 'image');
    CREATE TABLE library_organization(user_id text,trashed_at timestamptz,key text,purge_requested_at timestamptz);
    CREATE TABLE library_organization_aliases(user_id text,alias_type text,alias_id text,source_revision text,organization_key text);
    CREATE TABLE library_purge_requests(user_id text,organization_key text,state text,sources jsonb,last_error text);
    CREATE TABLE library_purge_objects(user_id text,organization_key text,object_key text,url text,size_bytes bigint,size_conflict boolean DEFAULT false,role text,state text,reason text);
    CREATE TABLE library_storage_object_fences(object_key text,state text);
    CREATE TABLE mcp_reference_upload_object_fences(object_key text,state text);
    INSERT INTO media_assets(user_id,url,size_bytes) VALUES ('alice','https://media/a',100),('alice','https://media/a',100),('bob','https://media/b',9999),('alice','https://media/conflict',20);
    INSERT INTO media_assets(user_id,url,size_bytes,status,deleted_at) VALUES ('alice','https://media/deleted',800,'deleted',now());
    INSERT INTO user_assets(user_id,url,size_bytes) VALUES ('alice','https://media/a',100),('alice','https://media/b',200),('alice','https://media/unknown',NULL),('alice','https://media/conflict',30),('alice','https://media/negative',-1);
    INSERT INTO app_jobs VALUES ('job','alice',true),('foreign','bob',false);
    INSERT INTO job_outputs(user_id,job_id,url) VALUES ('alice','job','https://media/output'),('alice','foreign','https://media/foreign');
    INSERT INTO library_organization(user_id,trashed_at) VALUES('alice',now());`);
  await pg.pool.query(readFileSync('neon/migrations/43_mcp_reference_asset_deletion.sql', 'utf8').match(/CREATE OR REPLACE FUNCTION reference_storage_authority_is_recognized[\s\S]*?\n\$\$;/)![0]);
  await pg.pool.query(readFileSync('neon/migrations/98_media_library_purge.sql', 'utf8').match(/CREATE OR REPLACE FUNCTION library_possible_storage_key[\s\S]*?\n\$\$;/)![0]);
  await build({ entryPoints: ['frontend/app/api/media-library/storage/route.ts'], outfile: join(folder, 'route.cjs'), bundle: true, platform: 'node', format: 'cjs', tsconfig: 'frontend/tsconfig.json', external: ['next/server'], plugins: [{ name: 'route-adapters', setup(b) {
    b.onResolve({ filter: /^@\/lib\/(?:db|supabase-ssr)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path.endsWith('/db') ? 'export const query=(...args)=>globalThis.__storageFixture.query(...args);' : 'export const getRouteAuthContext=async()=>({userId:globalThis.__storageFixture.userId});' }));
    b.onResolve({ filter: /^next\/server$/ }, () => ({ path: createRequire(resolve('frontend/package.json')).resolve('next/server'), external: true }));
  } }] });
  const route = createRequire(import.meta.url)(join(folder, 'route.cjs'));
  const { NextRequest } = createRequire(resolve('frontend/package.json'))('next/server');
  const request = () => new NextRequest('https://example.invalid/api/media-library/storage');
  // Actual reads execute against PostgreSQL's read-only mode.
  await pg.pool.query('SET default_transaction_read_only=on');
  const response = await route.GET(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual((await response.json()).usage, { recordedBytes: 300, measuredFiles: 2, totalFiles: 6,
    pendingDeletionFiles: 0, pendingDeletionBytes: 0, failedDeletionFiles: 0, trashedFiles: 0, trashedBytes: 0,
    sharedDeletionFiles: 0, sharedDeletionBytes: 0, limitBytes: null, enforcement: false });
  assert.equal(fixture.statements.length, 1);
  fixture.userId = 'bob';
  assert.equal((await (await route.GET(request())).json()).usage.recordedBytes, 9999);
  fixture.userId = 'empty';
  assert.equal((await (await route.GET(request())).json()).usage.totalFiles, 0);
  fixture.userId = null; fixture.statements.length = 0;
  assert.equal((await route.GET(request())).status, 401);
  assert.equal(fixture.statements.length, 0);
  fixture.userId = 'alice';
  await pg.pool.query('SET default_transaction_read_only=off');
  await pg.pool.query('DROP TABLE job_outputs');
  assert.equal((await route.GET(request())).status, 500);
});
