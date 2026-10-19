import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { build } from 'esbuild';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test('saved audio listing projects measured exact-owner source durations in one read-only page batch', { timeout: 90_000 }, async t => {
  const database = await startDisposablePostgres('audio-library-duration');
  t.after(database.cleanup);
  await database.pool.query(`
    CREATE TABLE app_jobs (job_id text PRIMARY KEY, user_id text, prompt text, status text,
      hidden boolean DEFAULT false, audio_url text, settings_snapshot jsonb);
    CREATE TABLE job_outputs (id text PRIMARY KEY, job_id text, user_id text, kind text,
      url text, storage_url text, thumb_url text, preview_url text, mime_type text, width integer,
      height integer, duration_sec double precision, status text, metadata jsonb, created_at timestamptz DEFAULT '2026-10-19T00:00:00Z');
    CREATE TABLE media_assets (id text PRIMARY KEY, public_id text, user_id text, kind text, url text,
      thumb_url text, preview_url text, mime_type text, width integer, height integer, size_bytes bigint,
      source text, source_job_id text, source_output_id text, status text, metadata jsonb,
      created_at timestamptz DEFAULT '2026-10-19T00:00:00Z', deleted_at timestamptz);
    CREATE TABLE user_assets (asset_id text PRIMARY KEY, user_id text, url text, mime_type text,
      width integer, height integer, size_bytes bigint, source text, metadata jsonb, created_at timestamptz DEFAULT '2026-10-19T00:00:00Z');
  `);
  const source = (id: string) => `https://fixture.example/${id}.wav`;
  const add = async (id: string, options: { owner?: string; jobOwner?: string; origin?: string; outputOwner?: string;
    outputSource?: string; outputId?: string; outputFacts?: unknown; snapshot?: unknown; hidden?: boolean;
    status?: string; outputStatus?: string; storedDuration?: number; legacy?: boolean; output?: boolean } = {}) => {
    await database.pool.query(`INSERT INTO app_jobs VALUES ($1,$2,'voice',$3,$4,$5,$6)`,
      [id, options.jobOwner ?? 'a', options.status ?? 'completed', options.hidden ?? false, source(id), options.snapshot ?? {}]);
    if (options.output !== false) await database.pool.query(`INSERT INTO job_outputs
      (id,job_id,user_id,kind,url,duration_sec,status,metadata) VALUES ($1,$2,$3,'audio',$4,5,$5,$6)`,
      [`${id}:audio:0`, id, options.outputOwner ?? 'a', options.outputSource ?? source(id), options.outputStatus ?? 'ready', options.outputFacts ?? { mediaFacts: { source: 'probe', durationSec: 4.75 } }]);
    const metadata = { originUrl: options.origin ?? source(id), jobId: id, custom: { preserve: true },
      ...(options.storedDuration ? { durationSec: options.storedDuration } : {}) };
    if (options.legacy) await database.pool.query(`INSERT INTO user_assets (asset_id,user_id,url,mime_type,size_bytes,source,metadata)
      VALUES ($1,$2,$3,'audio/wav',1000,'generated',$4)`, [id, options.owner ?? 'a', source(`${id}-copy`), metadata]);
    else await database.pool.query(`INSERT INTO media_assets
      (id,user_id,kind,url,mime_type,size_bytes,source,source_job_id,source_output_id,status,metadata)
      VALUES ($1,$2,'audio',$3,'audio/wav',1000,'saved_job_output',$1,$4,'ready',$5)`,
      [id, options.owner ?? 'a', source(`${id}-copy`), options.outputId ?? null, metadata]);
  };
  await add('measured-output');
  await add('snapshot-only', { output: false, snapshot: { measuredDurationSec: 7.125 } });
  await add('snapshot-facts', { outputFacts: {}, snapshot: { mediaFacts: { source: 'probe', durationSec: 8.5 } } });
  await add('legacy', { legacy: true, outputFacts: { measuredDurationSec: 6.125 } });
  await add('valid-stored', { storedDuration: 3.25 });
  await add('wrong-owner', { jobOwner: 'b', outputOwner: 'b' });
  await add('wrong-output-owner', { outputOwner: 'b' });
  await add('wrong-url', { origin: source('unrelated') });
  await add('wrong-output-url', { outputSource: source('unrelated') });
  await add('wrong-output-id', { outputId: 'different-output', snapshot: { measuredDurationSec: 7 } });
  await add('hidden', { hidden: true });
  await add('failed', { status: 'failed' });
  await add('deleted-output', { outputStatus: 'deleted' });
  await add('requested-only', { outputFacts: { mediaFacts: { source: 'requested', durationSec: 5 } }, snapshot: { durationSec: 5 } });
  await add('invalid-measurement', { outputFacts: { measuredDurationSec: '7', mediaFacts: { source: 'probe', durationSec: -1 } }, snapshot: { measuredDurationSec: 0 } });
  await add('foreign-asset', { owner: 'b', jobOwner: 'b', outputOwner: 'b' });
  await add('identity-import');
  const identityImportId = `url:a:audio:${source('identity-import')}`;
  await database.pool.query(`UPDATE media_assets SET id = $1, source = 'import' WHERE id = 'identity-import'`, [identityImportId]);
  const before = (await database.pool.query('SELECT id, url, metadata FROM media_assets ORDER BY id')).rows;

  const statements: string[] = [];
  const fixture = { query: async (sql: string, values: unknown[]) => {
    assert.match(sql.trimStart(), /^(?:\/\*.*?\*\/\s*)?(?:SELECT|WITH)\b/s, 'listing must stay read-only');
    statements.push(sql); return (await database.pool.query(sql, values)).rows;
  } };
  const frontend = resolve('frontend');
  const compiled = await build({ absWorkingDir: frontend, entryPoints: ['server/media-library/asset-listing.ts'],
    tsconfig: resolve('frontend/tsconfig.json'), bundle: true, write: false, platform: 'node', format: 'cjs',
    plugins: [{ name: 'disposable-audio-library', setup(builder) {
      builder.onResolve({ filter: /^@\/lib\/(db|schema)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'js', contents: args.path.endsWith('/db')
        ? 'export const query=(...args)=>fixture.query(...args);'
        : 'export const ensureAssetSchema=async()=>{throw Error("read-time DDL")};export const ensureMediaLibrarySchema=ensureAssetSchema;' }));
    } }],
  });
  const module = { exports: {} as any };
  runInNewContext(compiled.outputFiles[0].text, { module, exports: module.exports, fixture, Buffer, URL, console, process: { env: {} },
    require: createRequire(resolve('frontend/package.json')) });
  const { listLibraryAssetPage, findLibraryAssetByOrigin } = module.exports;
  const page = await listLibraryAssetPage({ userId: 'a', kind: 'audio', limit: 100 }, { ensureSchema: false });
  const byId = new Map<string, any>(page.items.map((asset: any) => [asset.id, asset]));
  assert.equal(byId.get('measured-output')?.durationSec, 4.75, 'ready output measured facts must restore missing library duration');
  assert.equal(byId.get('snapshot-only')?.durationSec, 7.125, 'legacy completion snapshot works even without a job_outputs row');
  assert.equal(byId.get('snapshot-facts')?.durationSec, 8.5);
  assert.equal(byId.get('legacy')?.durationSec, 6.125);
  assert.equal(byId.get('valid-stored')?.durationSec, 3.25, 'existing valid duration is preserved');
  assert.equal(byId.get(identityImportId)?.durationSec, 4.75, 'job-linked imports use canonical saved-output projection');
  for (const id of ['wrong-owner', 'wrong-output-owner', 'wrong-url', 'wrong-output-url', 'wrong-output-id', 'hidden', 'failed', 'deleted-output', 'requested-only', 'invalid-measurement']) {
    assert.equal(byId.get(id)?.durationSec, null, id);
  }
  assert.equal(byId.has('foreign-asset'), false);
  assert.equal(statements.length, 2, 'the complete selected page uses one listing and one enrichment query');
  assert.equal(byId.get('measured-output').url, source('measured-output-copy'));
  assert.deepEqual(JSON.parse(JSON.stringify(byId.get('measured-output').metadata)), before.find(row => row.id === 'measured-output')?.metadata);
  assert.deepEqual((await database.pool.query('SELECT id, url, metadata FROM media_assets ORDER BY id')).rows, before);

  const exact = await findLibraryAssetByOrigin({ userId: 'a', kind: 'audio', originUrl: source('snapshot-only') }, { ensureSchema: false });
  assert.equal(exact?.durationSec, 7.125, 'exact-origin readers use the same projection');
  statements.length = 0;
  const identityImport = await findLibraryAssetByOrigin({ userId: 'a', kind: 'audio', source: 'generated', originUrl: source('identity-import') }, { ensureSchema: false });
  assert.equal(identityImport?.durationSec, 4.75, 'identity shortcut must project measured duration for job-linked imports');
  assert.equal(identityImport?.source, 'saved_job_output');
  assert.equal(statements.length, 2, 'identity match needs only one exact lookup and one bounded enrichment');
  const foreign = await findLibraryAssetByOrigin({ userId: 'b', kind: 'audio', originUrl: source('snapshot-only') }, { ensureSchema: false });
  assert.equal(foreign, null);

  statements.length = 0;
  const first = await listLibraryAssetPage({ userId: 'a', kind: 'audio', limit: 2 }, { ensureSchema: false });
  assert.equal(first.items.length, 2); assert.equal(first.hasMore, true);
  assert.ok(first.nextCursor);
  const second = await listLibraryAssetPage({ userId: 'a', kind: 'audio', limit: 2, cursor: first.nextCursor }, { ensureSchema: false });
  assert.ok(second.items.every((asset: any) => !first.items.some((prior: any) => prior.id === asset.id)));
});
