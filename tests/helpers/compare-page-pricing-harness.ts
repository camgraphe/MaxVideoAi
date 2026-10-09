import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import type { buildCompareRouteData } from '../../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-route-data';
import type { computeCurrentPublicSnapshot, createScopedCurrentPublicSnapshot } from '../../frontend/server/pricing/quote-public';
import type { PRICING_ENGINES } from '../../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-config';

type Harness = {
  buildCompareRouteData: typeof buildCompareRouteData;
  scopes: ReturnType<typeof createScopedCurrentPublicSnapshot>[];
  pricingEngines: typeof PRICING_ENGINES;
  setSnapshotReader(reader: typeof computeCurrentPublicSnapshot): void;
  setSnapshotFactory(factory: typeof createScopedCurrentPublicSnapshot): void;
};

/** Executes the real comparison route, scenario selection and localized pricing.
 * Only unrelated benchmark/spec I/O and pricing references are controlled. The
 * injected pricing functions execute the real canonical/store owners outside the
 * bundle, preserving their application pool and real PostgreSQL query results. */
export async function makeComparePagePricingHarness() {
  const routeDirectory = resolve('frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib');
  const directory = await mkdtemp(join(tmpdir(), 'compare-page-pricing-'));
  const fixture = `
    let snapshot, factory;
    export const scopes=[];
    export const setSnapshotReader=reader=>{snapshot=reader};
    export const setSnapshotFactory=value=>{factory=value};
    export const computeCurrentPublicSnapshot=context=>snapshot(context);
    export function createScopedCurrentPublicSnapshot(){const scope=factory();scopes.push(scope);return scope;}
    export const fetchPublicBenchmarkLatency=async()=>({rows:[]});
    export const loadEngineScores=async()=>new Map();
    export const loadEngineKeySpecs=async()=>new Map();
    export const loadCompareGallery=async()=>[];
  `;
  try {
    await build({
      stdin: { contents: `export {buildCompareRouteData} from ${JSON.stringify(join(routeDirectory, 'compare-page-route-data.ts'))};
        export {PRICING_ENGINES as pricingEngines} from ${JSON.stringify(join(routeDirectory, 'compare-page-config.ts'))};
        export * from 'comparison-fixture';`, resolveDir: process.cwd() },
      outfile: join(directory, 'route.cjs'), bundle: true, platform: 'node', format: 'cjs',
      tsconfig: 'frontend/tsconfig.json',
      define: { 'process.env.NODE_ENV': '"test"' },
      plugins: [{ name: 'comparison-pricing-io', setup(builder) {
        builder.onResolve({ filter: /^(comparison-fixture|@\/server\/benchmark-lab-metrics|@\/server\/pricing\/quote-public|\.\/compare-gallery-loader)$/ },
          () => ({ path: 'fixture', namespace: 'controlled' }));
        builder.onResolve({ filter: /^\.\/compare-page-helpers$/ },
          () => ({ path: 'helpers', namespace: 'controlled' }));
        builder.onLoad({ filter: /.*/, namespace: 'controlled' }, args => ({ loader: 'js',
          resolveDir: routeDirectory,
          contents: args.path === 'fixture' ? fixture : `
            export {resolvePricingDisplay,isPrelaunchAvailability} from './compare-page-pricing';
            export {buildSpecValues} from './compare-page-spec-values';
            export {computeOverall} from './compare-page-score-utils';
            export {loadEngineScores,loadEngineKeySpecs} from 'comparison-fixture';`,
        }));
      } }],
    });
    return { harness: createRequire(import.meta.url)(join(directory, 'route.cjs')) as Harness,
      dispose: () => rm(directory, { recursive: true, force: true }) };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
