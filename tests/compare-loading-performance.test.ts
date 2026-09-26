import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';

test('comparison starts independent benchmark, prices, files and galleries before waiting', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'compare-loading-'));
  try {
    const output = join(directory, 'route.cjs');
    await build({
      stdin: { contents: `export {loadComparePageData} from './frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-route-data'; export * from 'probe';`, resolveDir: process.cwd() },
      outfile: output, bundle: true, platform: 'node', format: 'cjs', tsconfig: 'frontend/tsconfig.json',
      define: { 'process.env.NODE_ENV': '"test"' },
      plugins: [{ name: 'read-boundaries', setup(builder) {
        builder.onResolve({ filter: /^(probe|@\/server\/benchmark-lab-metrics|\.\/compare-page-helpers|\.\/compare-page-config|\.\/compare-gallery-loader)$/ }, args => ({ path: args.path, namespace: 'controlled' }));
        builder.onLoad({ filter: /.*/, namespace: 'controlled' }, args => ({ loader: 'js', contents: args.path === 'probe' ? `
          export const calls=[];
          let releaseGate; const gate=new Promise(resolve=>releaseGate=resolve);
          export const release=()=>releaseGate();
          export async function read(name,result){calls.push(name);await gate;return result;}
        ` : args.path === '@/server/benchmark-lab-metrics' ? `
          import {read} from 'probe'; export const fetchPublicBenchmarkLatency=()=>read('benchmark',{rows:[]});
        ` : args.path === './compare-page-config' ? `export const PRICING_ENGINES=new Map();`
        : args.path === './compare-gallery-loader' ? `import {read} from 'probe';export const loadCompareGallery=(entry,prelaunch)=>prelaunch?Promise.resolve([]):read(entry.modelSlug+'-gallery',[entry.modelSlug]);`
        : `
          import {read} from 'probe';
          export const loadEngineScores=()=>read('scores',new Map());
          export const loadEngineKeySpecs=()=>read('key-specs',new Map());
          export const resolvePricingDisplay=(entry)=>read(entry.modelSlug+'-pricing',{headline:entry.modelSlug});
          export const buildSpecValues=()=>({});export const computeOverall=()=>null;
          export const isPrelaunchAvailability=entry=>entry.availability==='waitlist';
        ` }));
      } }],
    });
    const { loadComparePageData, calls, release } = createRequire(import.meta.url)(output);
    const input = { activeLocale: 'en', left: { modelSlug: 'left', engineId: 'left' }, right: { modelSlug: 'right', engineId: 'right' } };
    const pending = loadComparePageData(input);
    // Every boundary is held open: start order is tested without wall-clock thresholds.
    await new Promise(resolve => setImmediate(resolve));
    const started = [...calls].sort();
    release();
    const result = await pending;
    assert.deepEqual(started, ['benchmark', 'key-specs', 'left-gallery', 'left-pricing', 'right-gallery', 'right-pricing', 'scores']);
    assert.deepEqual(result.leftGallery, ['left']);
    assert.deepEqual(result.rightGallery, ['right']);
    assert.deepEqual(result.routeData.leftPricingDisplay, { headline: 'left' });
    assert.equal(result.routeData.left, input.left);
    calls.length = 0;
    const prelaunch = await loadComparePageData({ ...input, left: { ...input.left, availability: 'waitlist' } });
    assert.deepEqual(prelaunch.leftGallery, []);
    assert.ok(!calls.includes('left-gallery'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
