import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

test('public ID reader preserves empty, duplicate, error, build and local-snapshot behavior', async t => {
  const root = process.cwd();
  const directory = await mkdtemp(join(tmpdir(), 'public-video-presence-'));
  const requireFrontend = createRequire(resolve('frontend/package.json'));
  const dbPath = resolve('frontend/src/lib/db.ts');
  const output = join(directory, 'reader.cjs');
  const envKeys = ['NODE_ENV', 'DATABASE_URL', 'VERCEL', 'NEXT_PHASE', 'MAXVIDEOAI_PUBLIC_EXAMPLES_SNAPSHOT'];
  const previous = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  try {
    await build({
      stdin: { contents: `export {getPublicVideoIds,getPublicVideosByIds} from './frontend/server/videos';
        export {statements,configure} from '@/lib/db';`, resolveDir: root },
      outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external',
      tsconfig: 'frontend/tsconfig.json',
      define: { 'import.meta.url': JSON.stringify(pathToFileURL(resolve('frontend/server/video-keyframes.ts')).href) },
      plugins: [{ name: 'controlled-public-presence-query', setup(builder) {
        builder.onResolve({ filter: /^@\/lib\/db$/ }, () => ({ path: 'db', namespace: 'fixture' }));
        builder.onLoad({ filter: /^db$/, namespace: 'fixture' }, () => ({ contents: `
          export * from ${JSON.stringify(dbPath)};
          export const statements=[]; let rows=[],failure;
          export function configure(value=[],error){rows=value;failure=error;statements.length=0;}
          export async function query(text,params=[]){statements.push({text,params});if(failure)throw failure;return rows;}
        `, loader: 'js', resolveDir: root }));
        builder.onResolve({ filter: /^pg$/ }, args => ({ path: requireFrontend.resolve(args.path), external: true }));
      } }],
    });
    const reader = requireFrontend(output);
    process.env.NODE_ENV = 'test';
    delete process.env.NEXT_PHASE;
    delete process.env.MAXVIDEOAI_PUBLIC_EXAMPLES_SNAPSHOT;
    await t.test('empty IDs never execute SQL', async () => {
      reader.configure();
      assert.deepEqual(await reader.getPublicVideoIds([]), new Set());
      assert.deepEqual(await reader.getPublicVideosByIds([]), new Map());
      assert.deepEqual(reader.statements, []);
    });
    await t.test('query projects only job_id and deduplicates parameters without rewriting IDs', async () => {
      const ids = ['a', "quote' OR TRUE --", 'a', 'absent', ''];
      reader.configure([{job_id:'a'},{job_id:'a'}]);
      assert.deepEqual(await reader.getPublicVideoIds(ids), new Set(['a']));
      assert.equal(reader.statements.length, 1);
      assert.deepEqual(reader.statements[0].params, [['a', "quote' OR TRUE --", 'absent', '']]);
      assert.match(reader.statements[0].text, /^SELECT job_id FROM app_jobs WHERE job_id = ANY\(\$1::text\[\]\)/);
      assert.match(reader.statements[0].text, /visibility = 'public'\s+AND COALESCE\(indexable, TRUE\)/);
      assert.doesNotMatch(reader.statements[0].text, /quote'|status|surface|job_outputs|media_assets|prompt|pricing_snapshot/);
    });
    await t.test('both readers reject the original database error', async () => {
      const original = new Error('controlled original DB failure');
      reader.configure([], original);
      for (const read of [reader.getPublicVideoIds, reader.getPublicVideosByIds]) {
        await assert.rejects(read(['a']), (error: unknown) => error === original);
      }
      assert.equal(reader.statements.length, 2);
    });
    await t.test('production build skips SQL before touching data', async () => {
      process.env.NEXT_PHASE = 'phase-production-build';
      reader.configure([], new Error('must not query'));
      assert.deepEqual(await reader.getPublicVideoIds(['a']), new Set());
      assert.deepEqual(await reader.getPublicVideosByIds(['a']), new Map());
      assert.deepEqual(reader.statements, []);
    });
    await t.test('actual local snapshot lookup precedes build skip and retains requested keys', async () => {
      process.env.NODE_ENV = 'development';
      process.env.MAXVIDEOAI_PUBLIC_EXAMPLES_SNAPSHOT = '1';
      delete process.env.DATABASE_URL;
      delete process.env.VERCEL;
      await mkdir(join(directory, '.local-review'));
      process.chdir(directory);
      reader.configure([], new Error('local snapshots must not query'));
      // Empty lookups do not read a snapshot, matching the existing full reader.
      assert.deepEqual(await reader.getPublicVideoIds([]), new Set());
      assert.deepEqual(await reader.getPublicVideosByIds([]), new Map());
      await writeFile(join(directory, '.local-review/public-examples.json'), JSON.stringify({
        version: 1, source: 'https://maxvideoai.com/api/examples', capturedAt: '2026-10-09',
        cards: {lookup:{id:'display-id',engineIconId:'wan-3',engineLabel:'Wan',prompt:'Original prompt',durationSec:5,hasAudio:false}}, feeds:{},
      }));
      const ids = ['lookup', 'absent', 'lookup'];
      const full = await reader.getPublicVideosByIds(ids);
      assert.deepEqual(await reader.getPublicVideoIds(ids), new Set(full.keys()));
      assert.deepEqual([...full.keys()], ['lookup']);
      assert.equal(full.get('lookup').id, 'display-id');
      assert.deepEqual(reader.statements, []);
    });
  } finally {
    process.chdir(root);
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await rm(directory, { recursive: true, force: true });
  }
});
