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
const content = JSON.parse(readFileSync('frontend/messages/en.json', 'utf8')).home.redesign;
const isConfig = (text: string) => text.includes('SELECT p.is_public,c.mode');
const isCandidates = (text: string) => text.includes('SELECT job_id,engine_id,engine_label,prompt');
type Statement = { text: string; params: unknown[] };

test('homepage curation reads share only the invocation and preserve PostgreSQL outputs', { timeout: 60_000 }, async (t) => {
  const missing = missingDisposablePostgresCommand();
  if (missing) return t.skip(`${missing} is unavailable`);
  const postgres = await startDisposablePostgres('home-examples');
  const folder = mkdtempSync(join(tmpdir(), 'home-examples-bundle-'));
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
      SELECT engine,engine,'https://media.maxvideoai.com/fixture/'||engine||'.webp','https://media.maxvideoai.com/fixture/'||engine||'.mp4','2026-09-21'
      FROM unnest(ARRAY['seedance-2-0','veo-3-1','happy-horse-1-1','ltx-2-3-fast','wan-2-6','ltx-2-5-pro']) engine;
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
    stdin: { contents: `export {loadHomepageExamples} from './frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/examples';
      export * from './frontend/server/videos';export * from './frontend/server/videos-playlists';
      export {getDb,statements,setBeforeQuery} from '@/lib/db';`, resolveDir: process.cwd() },
    define: { 'import.meta.url': JSON.stringify(pathToFileURL(resolve('frontend/server/video-keyframes.ts')).href) },
    outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json',
    plugins: [{ name: 'count-real-postgres-reads', setup(builder) {
      builder.onResolve({ filter: /^@\/lib\/db$/ }, () => ({ path: 'db', namespace: 'fixture' }));
      builder.onLoad({ filter: /^db$/, namespace: 'fixture' }, () => ({ contents: `
        export * from ${JSON.stringify(dbPath)};
        import {query as realQuery} from ${JSON.stringify(dbPath)};
        export const statements=[]; let beforeQuery;
        export function setBeforeQuery(hook){beforeQuery=hook;}
        export async function query(text,params=[]){statements.push({text,params});await beforeQuery?.(text,params);return realQuery(text,params);}
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
  const reader = requireFrontend(output);
  closeDb = () => reader.getDb().end();
  const statements: Statement[] = reader.statements;
  const evidence: Record<string, unknown> = {};
  const load = () => reader.loadHomepageExamples('en', content, { acceptedAssets: [] });
  // Independent readers retain the pre-scope behavior as a same-fixture output control.
  const loadWithoutScope = () => reader.loadHomepageExamples('en', content, {
    acceptedAssets: [],
    listExamples: (sort: string, limit: number) => reader.listExamples(sort, limit),
    listExampleFamilyPage: (family: string, options: unknown) => reader.listExampleFamilyPage(family, options),
    listPlaylistVideos: (slug: string, limit: number) => reader.listPlaylistVideos(slug, limit),
  });
  const configs = () => statements.filter(({ text }) => isConfig(text));
  const managed = async (mode: 'hybrid' | 'manual' = 'hybrid') => {
    await postgres.pool.query(`INSERT INTO playlist_curations(playlist_id,mode,ordered_ids,excluded_ids)
      SELECT id,$1,'{}','{}' FROM playlists ON CONFLICT(playlist_id) DO UPDATE SET mode=EXCLUDED.mode,ordered_ids='{}',excluded_ids='{}'`, [mode]);
  };
  const checkScenario = async (name: string) => {
    statements.length = 0;
    const expectedCards = await loadWithoutScope();
    const independentTotal = statements.length;
    statements.length = 0;
    const cards = await load();
    const perSlug: Record<string, number> = {};
    for (const statement of configs()) perSlug[String(statement.params[0])] = (perSlug[String(statement.params[0])] ?? 0) + 1;
    evidence[name] = { independentTotal, total: statements.length, configs: configs().length, candidates: statements.filter(({ text }) => isCandidates(text)).length, perSlug, cards };
    if (process.env.EXAMPLES_READ_EVIDENCE) writeFileSync(process.env.EXAMPLES_READ_EVIDENCE, JSON.stringify(evidence, null, 2));
    t.diagnostic(`${name}: ${statements.length} SQL; ${configs().length} config; ${statements.filter(({ text }) => isCandidates(text)).length} candidate; cards=${cards.map((c: { id: string }) => c.id).join(',')}`);
    assert.deepEqual(cards, expectedCards, 'all selected card fields equal independent reads');
    if (name !== 'errors') assert.ok(Object.values(perSlug).every(count => count === 1), `each slug resolves once per homepage invocation: ${JSON.stringify(perSlug)}`);
    assert.equal(cards.length, 6);
    assert.ok(statements.every(({ text }) => /^\s*SELECT\b/i.test(text)), 'application reads execute SELECT only');
    const kling = cards.find((card: { id: string }) => card.id === 'fallback-kling');
    if (name === 'legacy' || name === 'public') {
      assert.equal(kling.imageSrc, `https://media.maxvideoai.com/fixture/kling-${name === 'legacy' ? 114 : 130}.webp`);
      assert.equal(kling.duration, '5s');
      const scope = reader.createCurationReadScope();
      for (const sort of ['playlist', 'date-desc', 'date-asc']) {
        assert.deepEqual(await reader.listExamples(sort, 120, scope), await reader.listExamples(sort, 120));
        assert.deepEqual(await reader.listExampleFamilyPage('kling', { sort, limit: 24, offset: 4 }, scope),
          await reader.listExampleFamilyPage('kling', { sort, limit: 24, offset: 4 }));
      }
      for (const engineAliases of [undefined, [], ['KLING-3-PRO']]) {
        const options = { slug: 'examples', engineAliases, limit: 24 };
        assert.deepEqual(await reader.listPlaylistVideosWithOptions(options, scope), await reader.listPlaylistVideosWithOptions(options));
      }
    } else {
      assert.equal(kling.imageSrc, '/hero/kling-3-4k-hero.jpg');
    }
    return cards;
  };
  await t.test('legacy null resolutions are reused without changing membership reads', () => checkScenario('legacy'));
  await managed();
  await t.test('public managed curation shares selection and leaves final hydration independent', () => checkScenario('public'));
  await managed('manual');
  await t.test('explicitly empty destinations do not inherit legacy items', () => checkScenario('empty'));
  await managed();
  await postgres.pool.query('UPDATE playlists SET is_public=false');
  await t.test('private managed destinations remain empty', () => checkScenario('private'));
  await postgres.pool.query('UPDATE playlists SET is_public=true');
  await postgres.pool.query('ALTER TABLE app_jobs RENAME TO unavailable_app_jobs');
  await t.test('database errors preserve homepage fallback cards', () => checkScenario('errors'));
  await postgres.pool.query('ALTER TABLE unavailable_app_jobs RENAME TO app_jobs');

  await t.test('one in-flight resolution per slug, independent slugs, and rejected promises retry', async () => {
    assert.equal(typeof reader.createCurationReadScope, 'function');
    const scope = reader.createCurationReadScope();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let entered!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    reader.setBeforeQuery(async (text: string, params: unknown[]) => {
      if (isConfig(text) && params[0] === 'examples') { entered(); await gate; }
    });
    statements.length = 0;
    const first = scope.resolve('examples');
    const second = scope.resolve('examples');
    try {
      await started;
      assert.ok((await scope.resolve('family-kling')).length > 0, 'other slugs proceed while hub is blocked');
      assert.equal(configs().filter(({ params }) => params[0] === 'examples').length, 1);
    } finally { release(); reader.setBeforeQuery(undefined); }
    assert.deepEqual(await first, await second);

    const retryScope = reader.createCurationReadScope();
    await postgres.pool.query('ALTER TABLE app_jobs RENAME TO unavailable_app_jobs');
    try { await assert.rejects(retryScope.resolve('examples'), (error: { code?: string }) => error.code === '42P01'); }
    finally { await postgres.pool.query('ALTER TABLE unavailable_app_jobs RENAME TO app_jobs'); }
    assert.ok((await retryScope.resolve('examples')).length > 0, 'rejected resolution is evicted rather than cached as null or empty');
  });

  await t.test('aliases, limits, sorting and public eligibility stay local to each consumer', async () => {
    const scope = reader.createCurationReadScope();
    const ids = (videos: Array<{ id: string }>) => videos.map(video => video.id);
    const unlimited = await reader.listCuratedGalleryVideos('examples', { engineAliases: ['KLING-3-PRO'] }, scope);
    assert.deepEqual(unlimited, await reader.listCuratedGalleryVideos('examples', { engineAliases: ['KLING-3-PRO'] }));
    assert.equal(unlimited.length, 130);
    assert.deepEqual(ids(unlimited).slice(0, 2), ['kling-130', 'kling-129']);
    assert.deepEqual(await reader.listCuratedGalleryVideos('examples', { engineAliases: [] }, scope), []);
    assert.equal((await reader.listCuratedGalleryVideos('examples', { engineAliases: null }, scope)).length, 136);
    assert.equal((await reader.listCuratedGalleryVideos('examples', {}, scope)).length, 136);
    const limited = await reader.listCuratedGalleryVideos('examples', { engineAliases: ['kling-3-pro'], limit: 24 }, scope);
    assert.deepEqual(ids(limited), ids(unlimited).slice(0, 24));
    await postgres.pool.query(`UPDATE playlist_curations SET mode='hybrid',ordered_ids=ARRAY['kling-1'],excluded_ids=ARRAY['kling-2'] WHERE playlist_id=(SELECT id FROM playlists WHERE slug='examples')`);
    const changedScope = reader.createCurationReadScope();
    const ordered = await reader.listExamples('playlist', 120, changedScope);
    const latest = await reader.listExamples('date-desc', 120, changedScope);
    assert.equal(ordered[0].id, 'kling-1');
    assert.ok(!ids(ordered).includes('kling-2'));
    assert.ok(!ids(latest).includes('kling-1'), 'managed global date sort precedes the 120-item limit');
    assert.deepEqual(await reader.listExamples('playlist', 120, changedScope), ordered, 'a different sort does not mutate the shared resolution');
    await managed();
  });

  await t.test('fresh hydration observes playlist revocation and media removal within one scope', async () => {
    const scope = reader.createCurationReadScope();
    assert.ok((await reader.listCuratedGalleryVideos('examples', {}, scope)).length > 0);
    await postgres.pool.query(`UPDATE playlists SET is_public=false WHERE slug='examples'`);
    assert.deepEqual(await reader.listCuratedGalleryVideos('examples', {}, scope), [], 'fresh playlist public predicate applies even with a resolved curation');
    await postgres.pool.query(`UPDATE playlists SET is_public=true WHERE slug='examples'`);
    await postgres.pool.query(`UPDATE app_jobs SET visibility='private' WHERE job_id='kling-130'`);
    await postgres.pool.query(`UPDATE app_jobs SET indexable=false WHERE job_id='kling-129'`);
    await postgres.pool.query(`INSERT INTO job_outputs(job_id,kind,status,url) VALUES ('kling-128','video','deleted','https://media.maxvideoai.com/fixture/kling-128.mp4')`);
    const fresh = await reader.listCuratedGalleryVideos('examples', { engineAliases: ['kling-3-pro'] }, scope);
    assert.equal(fresh.length, 127);
    assert.ok(fresh.every((video: { id: string }) => !['kling-130', 'kling-129', 'kling-128'].includes(video.id)));
    await postgres.pool.query(`UPDATE app_jobs SET visibility='public',indexable=true WHERE job_id IN ('kling-130','kling-129')`);
    await postgres.pool.query(`DELETE FROM job_outputs WHERE job_id='kling-128'`);
  });

  await t.test('missing curation schema remains legacy null and legacy reads recheck public status', async () => {
    const scope = reader.createCurationReadScope();
    await postgres.pool.query('ALTER TABLE playlist_curations RENAME TO unavailable_playlist_curations');
    try {
      assert.equal(await reader.listCuratedGalleryVideos('examples', {}, scope), null);
      assert.ok((await reader.listPlaylistVideos('examples', 24, scope)).length > 0);
      await postgres.pool.query(`UPDATE playlists SET is_public=false WHERE slug='examples'`);
      assert.deepEqual(await reader.listPlaylistVideos('examples', 24, scope), []);
      assert.equal((await postgres.pool.query("SELECT to_regclass('public.playlist_curations') AS name")).rows[0].name, null);
    } finally {
      await postgres.pool.query('ALTER TABLE unavailable_playlist_curations RENAME TO playlist_curations');
      await postgres.pool.query(`UPDATE playlists SET is_public=true WHERE slug='examples'`);
    }
  });

  await t.test('new homepage invocations immediately reread changed curation and public state', async () => {
    const before = await load();
    await postgres.pool.query(`UPDATE playlist_curations SET mode='manual',ordered_ids=ARRAY['kling-1'],excluded_ids='{}' WHERE playlist_id IN (SELECT id FROM playlists WHERE slug IN ('examples','family-kling'))`);
    const changed = await load();
    assert.notDeepEqual(changed, before);
    assert.match(changed.find((card: { id: string }) => card.id === 'fallback-kling').imageSrc, /kling-1\.webp$/);
    await postgres.pool.query(`UPDATE playlists SET is_public=false WHERE slug IN ('examples','family-kling')`);
    const revoked = await load();
    assert.ok(!revoked.find((card: { id: string }) => card.id === 'fallback-kling').imageSrc.includes('/fixture/'));
  });
});
