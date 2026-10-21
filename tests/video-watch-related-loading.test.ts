import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';

// A late catalogue rejection must not replace an already streamed watch reader
// with the route error page. Only the external data boundary is controlled.
test('deferred watch recommendations fail softly after a pending catalogue read', async t => {
  let reject!: (error: Error) => void;
  const pending = new Promise<never>((_, fail) => { reject = fail; });
  const globals = globalThis as typeof globalThis & { __watchRelatedRead?: () => Promise<unknown[]> };
  globals.__watchRelatedRead = () => pending;
  t.after(() => { delete globals.__watchRelatedRead; });
  const bundle = await build({
    entryPoints: ['frontend/app/(public-watch)/video/[id]/_components/VideoWatchRelatedExamples.tsx'],
    bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
    jsx: 'automatic', tsconfig: 'frontend/tsconfig.json',
    plugins: [{ name: 'related-read', setup(builder) {
      builder.onResolve({ filter: /^@\/server\/video-seo$/ }, () => ({ path: 'read', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'js',
        contents: 'export const getVideoWatchRelatedPages=()=>globalThis.__watchRelatedRead();' }));
    } }],
  });
  const module = { exports: {} as { DeferredVideoWatchRelatedExamples: (props: { page: unknown }) => Promise<unknown> } };
  new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, createRequire(resolve('frontend/package.json')));
  const warnings: unknown[][] = [];
  t.mock.method(console, 'warn', (...values: unknown[]) => { warnings.push(values); });
  const result = module.exports.DeferredVideoWatchRelatedExamples({ page: {} });
  reject(new Error('private database details'));
  assert.equal(await result, null);
  assert.equal(warnings.length, 1);
  assert.ok(!JSON.stringify(warnings).includes('private database details'));
  globals.__watchRelatedRead = async () => [];
  assert.equal(await module.exports.DeferredVideoWatchRelatedExamples({ page: {} }), null);
  assert.equal(warnings.length, 1, 'an empty catalogue is not a read failure');
});
