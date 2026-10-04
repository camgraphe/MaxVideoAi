import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { missingDisposablePostgresCommand, startDisposablePostgres } from './helpers/disposable-postgres';

const requireFrontend = createRequire(resolve('frontend/package.json'));
type Statement = { text: string; params: unknown[]; rows?: number; bytes?: number };
const isConfig = (text: string) => /SELECT p\.(?:slug,p\.)?is_public,c\.mode/.test(text);
const isCandidates = (text: string) => text.includes('SELECT job_id,engine_id,engine_label,prompt');
const configSlugs = ({params}: Statement): string[] => Array.isArray(params[0]) ? params[0] as string[] : [String(params[0])];

test('scoped gallery readers resolve each requested curation once per invocation with unchanged PostgreSQL results', { timeout: 60_000 }, async t => {
  const missing = missingDisposablePostgresCommand();
  if (missing) return t.skip(`${missing} is unavailable`);
  const postgres = await startDisposablePostgres('gallery-read');
  const folder = mkdtempSync(join(tmpdir(), 'gallery-read-bundle-'));
  const previous = Object.fromEntries(['DATABASE_URL', 'NEXT_PHASE', 'EXAMPLES_PLAYLIST_SLUG', 'MAXVIDEOAI_PUBLIC_EXAMPLES_SNAPSHOT'].map(key => [key, process.env[key]]));
  let closeDb: (() => Promise<void>) | undefined;
  t.after(async () => {
    await closeDb?.();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    rmSync(folder, { recursive: true, force: true });
    await postgres.cleanup();
  });
  await postgres.pool.query(`
    CREATE TABLE playlists(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text UNIQUE, is_public boolean, updated_at timestamptz DEFAULT now());
    CREATE TABLE playlist_items(playlist_id uuid,video_id text,order_index int,pinned boolean DEFAULT false,created_at timestamptz DEFAULT now(),PRIMARY KEY(playlist_id,video_id));
    CREATE TABLE app_jobs(job_id text PRIMARY KEY,user_id text DEFAULT 'fixture-owner',engine_id text,engine_label text DEFAULT 'Fixture',prompt text DEFAULT 'Fixture',
      thumb_url text,video_url text,status text DEFAULT 'completed',surface text DEFAULT 'video',visibility text DEFAULT 'public',indexable boolean DEFAULT true,
      created_at timestamptz,duration_sec int DEFAULT 5,aspect_ratio text DEFAULT '16:9',has_audio boolean,can_upscale boolean,
      featured boolean,featured_order int,final_price_cents int DEFAULT 25,currency text DEFAULT 'USD',pricing_snapshot jsonb);
    CREATE TABLE media_assets(user_id text,url text,status text,deleted_at timestamptz);
    CREATE TABLE job_outputs(job_id text,kind text,status text,width int,height int,position int,created_at timestamptz,thumb_url text,url text,storage_url text);
    INSERT INTO playlists(slug,is_public) VALUES ('examples',true),('family-kling',true),('examples-kling-3-pro',true),('examples-ltx-2-5-pro',true);
    INSERT INTO app_jobs(job_id,engine_id,thumb_url,video_url,created_at)
      SELECT 'kling-'||n,'kling-3-pro','https://media.maxvideoai.com/fixture/kling-'||n||'.webp','https://media.maxvideoai.com/fixture/kling-'||n||'.mp4',
        '2026-09-20'::timestamptz + n * interval '1 minute' FROM generate_series(1,130) n;
    INSERT INTO app_jobs(job_id,engine_id,thumb_url,video_url,created_at)
      SELECT engine,engine,'https://media.maxvideoai.com/fixture/'||engine||'.webp','https://media.maxvideoai.com/fixture/'||engine||'.mp4','2026-09-21'::timestamptz + n * interval '1 hour'
      FROM unnest(ARRAY['seedance-2-0','veo-3-1','happy-horse-1-1','ltx-2-3-fast','wan-2-6','ltx-2-5-pro']) WITH ORDINALITY engine(engine,n);
    INSERT INTO app_jobs(job_id,engine_id,thumb_url,video_url,created_at,visibility,indexable,status,surface)
      SELECT id,'kling-3-pro','https://media.maxvideoai.com/fixture/'||id||'.webp','https://media.maxvideoai.com/fixture/'||id||'.mp4','2026-09-22',visibility,indexable,status,surface
      FROM (VALUES ('private','private',true,'completed','video'),('hidden','public',false,'completed','video'),
        ('running','public',true,'running','video'),('image','public',true,'completed','image'),
        ('deleted-output','public',true,'completed','video'),('deleted-asset','public',true,'completed','video')) v(id,visibility,indexable,status,surface);
    INSERT INTO job_outputs(job_id,kind,status,url) VALUES ('deleted-output','video','deleted','https://media.maxvideoai.com/fixture/deleted-output.mp4');
    INSERT INTO media_assets(user_id,url,status) VALUES ('fixture-owner','https://media.maxvideoai.com/fixture/deleted-asset.mp4','deleted');
    INSERT INTO playlist_items(playlist_id,video_id,order_index)
      SELECT p.id,j.job_id,CASE WHEN j.job_id LIKE 'kling-%' THEN 1000-substring(j.job_id from 7)::int ELSE 2000 END
      FROM playlists p CROSS JOIN app_jobs j WHERE (p.slug='examples' OR p.slug='examples-kling-3-pro' AND j.engine_id='kling-3-pro'
        OR p.slug='examples-ltx-2-5-pro' AND j.engine_id='ltx-2-5-pro') AND j.job_id NOT IN ('private','hidden','running','image','deleted-output','deleted-asset');
  `);
  await postgres.pool.query(readFileSync('neon/migrations/52_playlist_curations.sql', 'utf8'));
  const dbPath = resolve('frontend/src/lib/db.ts');
  const output = join(folder, 'reader.cjs');
  await build({
    stdin: { contents: `export * from './frontend/server/videos';
      export {resolveCuratedPlaylist} from './frontend/server/playlists/curation-service';
      export {createCurationReadScope} from './frontend/server/videos-playlists';
      export {getDb,statements,setBeforeQuery} from '@/lib/db';`, resolveDir: process.cwd() },
    define: { 'import.meta.url': JSON.stringify(pathToFileURL(resolve('frontend/server/video-keyframes.ts')).href) },
    outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json',
    plugins: [{ name: 'count-real-gallery-reads', setup(builder) {
      builder.onResolve({ filter: /^@\/lib\/db$/ }, () => ({ path: 'db', namespace: 'fixture' }));
      builder.onLoad({ filter: /^db$/, namespace: 'fixture' }, () => ({ contents: `
        export * from ${JSON.stringify(dbPath)};
        import {query as realQuery} from ${JSON.stringify(dbPath)};
        export const statements=[]; let beforeQuery;
        export function setBeforeQuery(hook){beforeQuery=hook;}
        export async function query(text,params=[]){
          const statement={text,params}; statements.push(statement); await beforeQuery?.(text,params);
          const rows=await realQuery(text,params); statement.rows=rows.length;
          statement.bytes=Buffer.byteLength(JSON.stringify(rows)); return rows;
        }
      `, loader: 'js', resolveDir: process.cwd() }));
      builder.onResolve({ filter: /^pg$/ }, args => ({ path: requireFrontend.resolve(args.path), external: true }));
    } }],
  });
  const readonlyUrl = new URL(postgres.databaseUrl);
  readonlyUrl.searchParams.set('options', '-c default_transaction_read_only=on');
  process.env.DATABASE_URL = readonlyUrl.toString();
  process.env.EXAMPLES_PLAYLIST_SLUG = 'examples';
  delete process.env.NEXT_PHASE;
  delete process.env.MAXVIDEOAI_PUBLIC_EXAMPLES_SNAPSHOT;
  const unscopedReader = requireFrontend(output);
  // This suite owns request-scope batching. Full public SQL pagination has its own catalog suite.
  const reader = {
    ...unscopedReader,
    listExamplesPage: (options: unknown, scope = unscopedReader.createCurationReadScope()) => unscopedReader.listExamplesPage(options, scope),
    listExampleFamilyPage: (family: string, options: unknown, scope = unscopedReader.createCurationReadScope()) => unscopedReader.listExampleFamilyPage(family, options, scope),
  };
  closeDb = () => reader.getDb().end();
  const statements: Statement[] = reader.statements;
  const evidence: Record<string, unknown> = {};
  const independentScope = { resolve: reader.resolveCuratedPlaylist };
  const count = () => ({
    total: statements.length,
    configurations: statements.filter(s => isConfig(s.text)).length,
    candidates: statements.filter(s => isCandidates(s.text)).length,
    hydration: statements.filter(s => !isConfig(s.text) && !isCandidates(s.text)).length,
    rows: statements.reduce((sum, s) => sum + (s.rows ?? 0), 0),
    bytes: statements.reduce((sum, s) => sum + (s.bytes ?? 0), 0),
    configSlugs: statements.filter(s => isConfig(s.text)).flatMap(configSlugs),
    trace: statements.map(s => ({
      category: isConfig(s.text) ? 'configuration' : isCandidates(s.text) ? 'candidates' : 'hydration',
      ...(isConfig(s.text) ? {slugs: configSlugs(s)} : {}),
      rows: s.rows,
      bytes: s.bytes,
    })),
  });
  const check = async (name: string, family = '', sort = 'playlist', limit = 24, offset = 0, engineGroup?: string) => {
    const options = {sort, limit, offset, engineGroup};
    const load = (scope?: unknown) => family ? reader.listExampleFamilyPage(family, options, scope) : reader.listExamplesPage(options, scope);
    statements.length = 0;
    const expected = await load(independentScope);
    const independent = count();
    statements.length = 0;
    const result = await load();
    const actual = count();
    evidence[name] = {independent, actual, result};
    if (process.env.GALLERY_READ_EVIDENCE) writeFileSync(process.env.GALLERY_READ_EVIDENCE, JSON.stringify(evidence, null, 2));
    t.diagnostic(`${name}: independent=${independent.total}, actual=${actual.total}, configuration=${actual.configurations}, candidate=${actual.candidates}, hydration=${actual.hydration}`);
    assert.deepEqual(result, expected, 'complete public media data and pagination match independent reads');
    assert.ok(statements.every(({text}) => /^\s*SELECT\b/i.test(text)), 'the real application connection performs SELECTs only');
    assert.equal(new Set(actual.configSlugs).size, actual.configSlugs.length, 'each requested slug resolves only once');
    assert.ok(statements.filter(s => isConfig(s.text)).every(s => configSlugs(s).length <= 4), 'each configuration batch remains bounded');
    return result;
  };
  await t.test('legacy hub avoids its repeated configuration SELECT', async () => {
    const result = await check('legacy-hub');
    assert.deepEqual(result.items.slice(0, 3).map((item: {id: string}) => item.id), ['ltx-2-5-pro', 'wan-2-6', 'ltx-2-3-fast']);
    assert.equal(result.total, 24);
  });
  await t.test('legacy family merges inherited sources in existing order', async () => {
    const result = await check('legacy-family', 'kling');
    assert.deepEqual(result.items.slice(0, 3).map((item: {id: string}) => item.id), ['kling-1', 'kling-2', 'kling-3']);
    assert.equal(result.total, 130);
  });
  for (const sort of ['playlist', 'date-desc', 'date-asc', 'duration-desc', 'duration-asc', 'engine-asc']) {
    await t.test(`legacy sort ${sort} preserves pagination and aliases`, async () => {
      await check(`legacy-hub-${sort}`, '', sort, 11, 5, 'kling');
      await check(`legacy-family-${sort}`, 'kling', sort, 11, 5);
    });
  }
  await postgres.pool.query(`INSERT INTO playlist_curations(playlist_id,mode,ordered_ids,excluded_ids)
    SELECT id,'hybrid',ARRAY['kling-3','kling-1'],ARRAY['kling-2'] FROM playlists`);
  await t.test('managed hub preserves selection, excludes ineligible media, and retains pagination', async () => {
    const result = await check('managed-hub');
    assert.deepEqual(result.items.slice(0, 2).map((item: {id: string}) => item.id), ['kling-3', 'kling-1']);
    assert.equal(result.total, 135);
    assert.ok(!result.items.some((item: {id: string}) => ['private','hidden','running','image','deleted-output','deleted-asset','kling-2'].includes(item.id)));
  });
  await t.test('managed family prunes all inherited source reads', async () => {
    await check('managed-family', 'kling');
    assert.deepEqual(count().configSlugs, ['family-kling']);
    assert.equal(count().total, 3);
  });
  for (const sort of ['playlist', 'date-desc', 'date-asc', 'duration-desc', 'duration-asc', 'engine-asc']) {
    await t.test(`managed sort ${sort} preserves pagination and aliases`, async () => {
      await check(`managed-hub-${sort}`, '', sort, 11, 5, 'kling');
      await check(`managed-family-${sort}`, 'kling', sort, 11, 5);
    });
  }
  await postgres.pool.query("DELETE FROM playlist_curations WHERE playlist_id=(SELECT id FROM playlists WHERE slug='family-kling')");
  await t.test('legacy family reuses config while independent managed children keep their selection', () => check('mixed-family', 'kling'));
  await postgres.pool.query(`INSERT INTO playlist_curations(playlist_id,mode,ordered_ids,excluded_ids)
    SELECT id,'manual','{}','{}' FROM playlists ON CONFLICT(playlist_id) DO UPDATE SET mode='manual',ordered_ids='{}',excluded_ids='{}'`);
  await t.test('managed empty destinations never fall back to legacy memberships', async () => {
    assert.equal((await check('empty-hub')).total, 0);
    assert.equal((await check('empty-family', 'kling')).total, 0);
  });
  await postgres.pool.query("UPDATE playlist_curations SET mode='hybrid'");
  await postgres.pool.query('UPDATE playlists SET is_public=false');
  await t.test('private destinations remain empty', async () => {
    assert.equal((await check('private-hub')).total, 0);
    assert.equal((await check('private-family', 'kling')).total, 0);
  });
  await postgres.pool.query('UPDATE playlists SET is_public=true');
  await t.test('later reader invocations see changed curation rather than retaining prior promises', async () => {
    assert.ok((await check('fresh-hub')).total > 0);
    await postgres.pool.query("UPDATE playlist_curations SET mode='manual',ordered_ids=ARRAY['kling-4']");
    const changed = await check('changed-hub');
    assert.deepEqual(changed.items.map((item: {id: string}) => item.id), ['kling-4']);
  });
  await t.test('public playlist revocation before final hydration prevents disclosure', async () => {
    let changed = false;
    reader.setBeforeQuery(async (text: string) => {
      if (!changed && !isConfig(text) && !isCandidates(text)) {
        changed = true;
        await postgres.pool.query("UPDATE playlists SET is_public=false WHERE slug='examples'");
      }
    });
    try { assert.equal((await reader.listExamplesPage({sort: 'playlist', limit: 24})).total, 0); }
    finally {reader.setBeforeQuery(undefined); await postgres.pool.query("UPDATE playlists SET is_public=true WHERE slug='examples'");}
  });
  await t.test('public media eligibility is rechecked after curation resolves', async () => {
    let changed = false;
    reader.setBeforeQuery(async (text: string) => {
      if (!changed && !isConfig(text) && !isCandidates(text)) {
        changed = true;
        await postgres.pool.query("UPDATE app_jobs SET indexable=false WHERE job_id='kling-4'");
      }
    });
    try { assert.equal((await reader.listExampleFamilyPage('kling', {sort: 'playlist', limit: 24})).total, 0); }
    finally {reader.setBeforeQuery(undefined); await postgres.pool.query("UPDATE app_jobs SET indexable=true WHERE job_id='kling-4'");}
  });
  await t.test('failed configuration reads propagate and later invocations retry', async () => {
    let failed = false;
    reader.setBeforeQuery((text: string) => {
      if (isConfig(text) && !failed) {failed = true; throw new Error('controlled configuration failure');}
    });
    try { await assert.rejects(reader.listExamplesPage({sort: 'playlist', limit: 24}), /controlled configuration failure/); }
    finally {reader.setBeforeQuery(undefined);}
    assert.equal((await reader.listExamplesPage({sort: 'playlist', limit: 24})).items[0].id, 'kling-4');
  });
  await t.test('failed candidate reads propagate instead of becoming empty success', async () => {
    reader.setBeforeQuery((text: string) => {
      if (isCandidates(text)) throw new Error('controlled candidate failure');
    });
    try { await assert.rejects(reader.listExampleFamilyPage('kling', {sort: 'playlist', limit: 24}), /controlled candidate failure/); }
    finally {reader.setBeforeQuery(undefined);}
    assert.equal((await reader.listExampleFamilyPage('kling', {sort: 'playlist', limit: 24})).items[0].id, 'kling-4');
  });
  await postgres.pool.query('ALTER TABLE playlist_curations RENAME TO absent_playlist_curations');
  await t.test('missing curation schema preserves legacy reads without initialization', async () => {
    await check('missing-schema-hub');
    await check('missing-schema-family', 'kling');
  });
});
