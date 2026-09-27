import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { missingDisposablePostgresCommand, startDisposablePostgres } from './helpers/disposable-postgres';

const requireFrontend = createRequire(resolve('frontend/package.json'));

test('homepage reads initialized sections and public videos with read-only PostgreSQL', { timeout: 60_000 }, async (t) => {
  const missing = missingDisposablePostgresCommand();
  if (missing) return t.skip(`${missing} is unavailable`);
  const postgres = await startDisposablePostgres('homepage-read');
  const folder = mkdtempSync(join(tmpdir(), 'homepage-read-bundle-'));
  const previousUrl = process.env.DATABASE_URL;
  const previousPhase = process.env.NEXT_PHASE;
  let closeDb: (() => Promise<void>) | undefined;
  t.after(async () => {
    await closeDb?.();
    for (const [key, value] of Object.entries({ DATABASE_URL: previousUrl, NEXT_PHASE: previousPhase })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    rmSync(folder, { recursive: true, force: true });
    await postgres.cleanup();
  });
  const bootstrap = spawnSync('frontend/node_modules/.bin/tsx', [
    '--tsconfig', 'frontend/tsconfig.json', 'scripts/bootstrap-application-schema.ts', '--allow-local-postgres-test',
  ], { env: { PATH: process.env.PATH, NODE_ENV: 'test', APPLICATION_DATABASE_URL: postgres.databaseUrl }, encoding: 'utf8' });
  assert.equal(bootstrap.status, 0, bootstrap.stderr);
  await postgres.pool.query(`INSERT INTO app_jobs (job_id,user_id,engine_id,engine_label,duration_sec,prompt,thumb_url,video_url,visibility,indexable,status) VALUES
    ('public-home','owner','kling-3-pro','Kling 3 Pro',12,'fixture','https://example.com/poster.webp','https://example.com/video.mp4','public',true,'completed'),
    ('private-home','owner','kling-3-pro','Kling 3 Pro',12,'private','https://example.com/private.webp','https://example.com/private.mp4','private',true,'completed'),
    ('unindexed-home','owner','kling-3-pro','Kling 3 Pro',12,'unindexed','https://example.com/unindexed.webp','https://example.com/unindexed.mp4','public',false,'completed')`);
  await postgres.pool.query(`INSERT INTO homepage_sections (key,type,title,video_id,order_index) VALUES
    ('hero-1','hero','Public slot','public-home',1),('hero-2','hero','Private slot','private-home',0),
    ('hero-3','hero','Unindexed slot','unindexed-home',2),('gallery-1','gallery','Missing slot','missing-home',0)`);
  const output = join(folder, 'reader.cjs');
  await build({
    stdin: { contents: `export {getHomepageSlots,listHomepageSections} from './frontend/server/homepage';export {loadProgrammedHomepageHeroSlots} from './frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/hero';export {getDb} from '@/lib/db';`, resolveDir: process.cwd() },
    define: { 'import.meta.url': JSON.stringify(pathToFileURL(resolve('frontend/server/video-keyframes.ts')).href) },
    outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json',
    plugins: [{ name: 'next-cache-in-local-postgres', setup(builder) {
      builder.onResolve({ filter: /^next\/cache$/ }, () => ({ path: 'cache', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const unstable_cache=operation=>operation;', loader: 'js' }));
      builder.onResolve({ filter: /^pg$/ }, args => ({ path: requireFrontend.resolve(args.path), external: true }));
    } }],
  });
  delete process.env.NEXT_PHASE;
  const readonlyUrl = new URL(postgres.databaseUrl);
  readonlyUrl.searchParams.set('options', '-c default_transaction_read_only=on');
  process.env.DATABASE_URL = readonlyUrl.toString();
  const reader = requireFrontend(output);
  closeDb = () => reader.getDb().end();
  assert.equal((await reader.getDb().query('SHOW default_transaction_read_only')).rows[0].default_transaction_read_only, 'on');
  const slots = await reader.getHomepageSlots();
  assert.deepEqual(slots.hero.map(({ key }: { key: string }) => key), ['hero-2', 'hero-1', 'hero-3', 'hero-4', 'hero-5']);
  assert.equal(slots.hero[0].video, null);
  assert.equal(slots.hero[1].video.id, 'public-home');
  assert.equal(slots.hero[2].video, null);
  assert.equal(slots.gallery[0].video, null);
  assert.deepEqual(await reader.loadProgrammedHomepageHeroSlots(), slots.hero);
  await postgres.pool.query('DELETE FROM homepage_sections');
  const empty = await reader.getHomepageSlots();
  assert.equal(empty.hero.length, 5);
  assert.equal(empty.gallery.length, 3);
  assert.ok([...empty.hero, ...empty.gallery].every(slot => slot.video === null && slot.sectionId === null));
  await postgres.pool.query('ALTER TABLE homepage_sections RENAME TO homepage_sections_unavailable');
  await assert.rejects(reader.listHomepageSections(), (error: { code?: string }) => error.code === '42P01');
  const warn = console.warn;
  console.warn = () => undefined;
  try { assert.deepEqual(await reader.loadProgrammedHomepageHeroSlots(), []); }
  finally { console.warn = warn; }
  assert.equal((await postgres.pool.query("SELECT to_regclass('public.homepage_sections') AS name")).rows[0].name, null);
});
