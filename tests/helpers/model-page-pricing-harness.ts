import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';

const routePath = resolve('frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx');
const layoutPath = resolve('frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/MarketingModelPageLayout.tsx');
const marketingPricingPath = resolve('frontend/src/lib/pricing-marketing.ts');

/** Real route, layout, pricing loops, specs, metadata and schemas; controlled I/O only. */
export async function makeModelPagePricingHarness({ legacyLabels = false } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'model-page-pricing-'));
  let source = await readFile(routePath, 'utf8');
  if (legacyLabels) {
    source = source.replace(/const pricePerSecondLabel = [\s\S]*?const keySpecValues =/,
      `const pricePerSecondLabel = await buildPricePerSecondLabel(pricingEngine, locale);
       const pricePerImageLabel = await buildPricePerImageLabel(pricingEngine, locale);
       const keySpecValues =`);
  }
  const fixture = `
    export const calls = [];
    export const readers = [];
    let state;
    let quote;
    let publicQuote;
    export function configure(value) { state = value; calls.length = 0; readers.length = 0; }
    export function setQuote(value) { quote = value; }
    export function setPublicQuote(value) { publicQuote = value; }
    async function snapshot(context) {
      calls.push(context);
      if (quote) return quote(context);
      if (state.reject?.(context, calls.length)) throw new Error('current quote unavailable');
      const rate = state.rates?.[context.resolution] ?? 10;
      const quality = {low:1,medium:2,high:3}[context.quality] ?? 1;
      const audio = context.addons?.audio_off ? 0.5 : 1;
      return { totalCents: rate * quality * audio * context.durationSec, currency: 'USD',
        base: {seconds:context.durationSec} };
    }
    export function computeCurrentPublicSnapshot(context) { readers.push('current'); return snapshot(context); }
    export function computeCanonicalPublicSnapshot(context) { readers.push('canonical'); return snapshot(context); }
    export async function quotePublicModelScenario(input) {
      if (publicQuote) return publicQuote(input);
      return state.unavailableOffer ? {status:'unavailable'}
        : {status:'exact',amountCents:123,currency:'USD'};
    }
    export async function loadModelPageInputs() {
      return { benchmarkScoreSlugs:new Set(),
        enginePricingOverrides:state.override ? {[state.engine.engine.id]:state.override} : {},
        keySpecsMap:new Map([[state.engine.modelSlug,{keySpecs:state.specs}]]),
        gallery:{galleryVideos:[],preferredIds:{hero:null,demo:null},managed:false} };
    }
    export const getEngineLocalized = async () => state.localizedContent;
    export const resolveDictionary = async () => ({dictionary:{models:{detail:{}}}});
    export const getFalEngineBySlug = () => state.engine;
    export const listFalEngines = () => [];
    export const resolveRuntimePublicSlug = () => ({slug:state.engine.modelSlug,
      lifecycle:state.archive?'deep_legacy':'active'});
    export const isRuntimeModelPagePublished = () => true;
    export const isRuntimePresentationOnlyModel = () => Boolean(state.prelaunch);
    export const listPublishedRuntimeModels = () => [];
    export const isPublishedModelPage = () => true;
    export const isPrelaunchModelPageTemplateSlug = () => false;
    export const renderMarketingModelPrelaunchPage = async () => ({prelaunch:true});
    export const buildModelPrelaunchMetadata = () => ({});
    export const ModelArchivePage = () => null;
    export const buildModelArchiveMetadata = () => ({});
    export const modelExamplePlaylistKeys = () => [];
    export const projectModelPageGallery = () => undefined;
    export const hasPlaylistCuration = () => false;
    export const listPlaylistVideos = () => [];
    export const getPublicVideosByIds = () => new Map();
    export const quoteCurrentExamplePrices = () => new Map();
  `;
  const controlledRouteImports = new Set([
    '@/server/model-gallery-projection', '@/server/playlists/curation-service', '@/server/videos',
    '@/server/current-example-price', '@/lib/i18n/server', '@/lib/models/i18n', '@/config/falEngines',
    '@/config/model-runtime', './_lib/model-page-inputs', './_lib/model-page-publication',
    './_lib/model-page-template-registry', './_lib/model-page-prelaunch-route',
    './_components/ModelArchivePage', './_lib/model-page-archive-metadata',
  ]);
  try {
    await build({
      stdin: { contents: `export {default as page,generateMetadata,renderMarketingModelPage as render} from ${JSON.stringify(routePath)};
        export {MarketingModelPageLayout as layout} from ${JSON.stringify(layoutPath)};
        export {computeMarketingPricePoints as points,computeMarketingPriceRange as range} from ${JSON.stringify(marketingPricingPath)};
        export * from 'pricing-fixture';`, resolveDir: process.cwd() },
      outfile: join(directory, 'route.cjs'), bundle: true, platform: 'node', format: 'cjs',
      tsconfig: 'frontend/tsconfig.json', jsx: 'automatic',
      define: { 'process.env.NODE_ENV': '"test"' },
      plugins: [{ name: 'model-pricing-io', setup(builder) {
        builder.onResolve({ filter: /.*/ }, args => {
          if (args.path === 'server-only' || args.path.endsWith('.css')) return {path:'empty',namespace:'controlled'};
          if (args.path === 'pricing-fixture' ||
            (args.importer === routePath && controlledRouteImports.has(args.path)) ||
            args.path === '@/server/pricing/quote-public' || args.path === '@/server/pricing/quote-public-model-scenario') {
            return {path:'fixture',namespace:'controlled'};
          }
          // Section rendering is outside this pricing test. Capture the props assembled
          // by the real layout, including its hero and shared visible/schema offer.
          if (args.importer === layoutPath && args.path.startsWith('./')) {
            return {path:args.path,namespace:'sections'};
          }
        });
        builder.onLoad({ filter: /.*/, namespace: 'controlled' }, args => ({ contents: args.path === 'empty' ? '' : fixture, loader: 'js' }));
        builder.onLoad({ filter: /.*/, namespace: 'sections' }, args => {
          const name = args.path.slice(2);
          return {contents:`export function ${name}() {return null;}`,loader:'js'};
        });
        builder.onLoad({ filter: /models\/\[slug\]\/page\.tsx$/ }, () => ({
          contents: source+'\nexport {renderMarketingModelPage};', loader:'tsx',
          resolveDir:routePath.slice(0,routePath.lastIndexOf('/')),
        }));
      } }],
    });
    return { harness: createRequire(import.meta.url)(join(directory, 'route.cjs')),
      dispose: () => rm(directory, {recursive:true,force:true}) };
  } catch (error) {
    await rm(directory, {recursive:true,force:true});
    throw error;
  }
}

export function findModelLayoutElements(tree: any): { name: string; props: any }[] {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(findModelLayoutElements);
  return [{name:typeof tree.type === 'function' ? tree.type.name : tree.type,props:tree.props},
    ...findModelLayoutElements(tree.props?.children)];
}
