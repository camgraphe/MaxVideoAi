import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const requireFrontend = createRequire(resolve('frontend/package.json'));
const home = './frontend/app/(localized)/[locale]/(marketing)/(home)';

// Next 15 uses its bundled React 19 renderer for App Router, while standalone tests use React 18.
// Alias those external runtime imports together so the real async Server Component can stream.
async function bundle() {
  const directory = await mkdtemp(join(tmpdir(), 'home-streaming-'));
  const output = join(directory, 'owners.cjs');
  const mocks: Record<string, string> = {
    probe: `
      export const calls=[], records=[];
      let released, gates;
      export function reset(){calls.length=0;records.length=0;released=new Set();gates=new Map();}
      export function release(name){released.add(name);gates.get(name)?.();}
      export async function read(name,value){calls.push(name);if(!released.has(name))await new Promise(done=>gates.set(name,done));return value;}
      export const videos=[{id:'selected-real-kling',engineId:'kling-3-pro',engineLabel:'Kling 3 Pro',thumbUrl:'https://media.maxvideoai.com/fixture/selected-real-kling.webp',videoUrl:'https://media.maxvideoai.com/fixture/selected-real-kling.mp4',durationSec:12,aspectRatio:'16:9',visibility:'public',indexable:true,prompt:'Public fixture'}];
    `,
    '@/lib/i18n/server': `import en from ${JSON.stringify(resolve('frontend/messages/en.json'))};import fr from ${JSON.stringify(resolve('frontend/messages/fr.json'))};import es from ${JSON.stringify(resolve('frontend/messages/es.json'))};export async function resolveDictionary({locale}){return {dictionary:{en,fr,es}[locale]};}`,
    'next-intl/server': `export async function getTranslations(){return key=>key;}`,
    '@/server/homepage': `import {read} from 'probe';export const getHomepageSlotsCached=()=>read('hero-slots',{hero:[],gallery:[]});export const getSuccessfulGenerationCountCached=async()=>20000;`,
    '@/server/videos': `import {read,videos} from 'probe';export const listExamples=async(sort)=>read(sort==='playlist'?'example-playlist':'example-latest',videos);export const listExampleFamilyPage=async()=>({items:[],total:0,limit:24,offset:0,hasMore:false});export const listPlaylistVideos=async()=>[];`,
    '@/server/model-launch-assets': `export const ACCEPTED_DURABLE_MODEL_ASSETS=[];`,
    '@/server/current-example-price': `import {read} from 'probe';export const quoteCurrentExamplePrices=()=>read('hero-pricing',new Map([['minimax-h3-max',{kind:'reference',modelId:'minimax-h3-max',amountCents:141,currency:'USD',scenarioLabel:'Text to video · 5s · 1080p'}]]));`,
    '@/server/public-page-timing': `import {withPublicPageTiming as actual} from ${JSON.stringify(resolve('frontend/server/public-page-timing.ts'))};import {records} from 'probe';export * from ${JSON.stringify(resolve('frontend/server/public-page-timing.ts'))};export const withPublicPageTiming=(context,load)=>actual(context,load,{enabled:true,deployment:'test',emit:record=>records.push(record)});`,
  };
  await build({
    stdin: { contents: `export {default as HomePage} from '${home}/page';export {HomeModelDiscovery} from './frontend/components/marketing/home/HomeModelDiscovery';export {I18nProvider} from './frontend/lib/i18n/I18nProvider';export {assembleHomepageExampleCards} from '${home}/_lib/home-route-data/examples';export * from 'probe';`, resolveDir: process.cwd() },
    define: { 'import.meta.url': JSON.stringify(pathToFileURL(resolve('frontend/server/video-keyframes.ts')).href) },
    outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json', jsx: 'automatic',
    plugins: [{ name: 'controlled-home-io', setup(builder) {
      builder.onResolve({ filter: /\.css$/ }, args => ({ path: args.path, namespace: 'empty' }));
      builder.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: '', loader: 'js' }));
      builder.onResolve({ filter: /.*/ }, args => {
        if (args.path.startsWith(resolve('frontend/messages') + '/')) return { path: args.path, external: true };
        if (args.path.startsWith('@/messages/')) return { path: resolve('frontend', args.path.slice(2)), external: true };
        if (args.path in mocks) return { path: args.path, namespace: 'controlled' };
        if (/compare-page-data-loaders$/.test(args.path)) return { path: 'scores', namespace: 'controlled' };
        if (/current-home-price-demo-data$/.test(args.path)) return { path: 'demo-pricing', namespace: 'controlled' };
        if (!args.path.startsWith('.') && !args.path.startsWith('/') && !args.path.startsWith('@/') && !args.path.startsWith('node:')) return { path: requireFrontend.resolve(args.path), external: true };
      });
      builder.onLoad({ filter: /.*/, namespace: 'controlled' }, args => ({ loader: 'js', resolveDir: process.cwd(), contents: mocks[args.path] ?? (args.path === 'scores'
        ? `import {read} from 'probe';export const loadEngineScores=()=>read('scores',new Map());`
        : `import {read} from 'probe';export const buildCurrentHomePriceDemo=()=>read('demo-pricing',[]);`) }));
    } }],
  });
  return { directory, output, controlledBoundaries: [...Object.keys(mocks), 'compare-page-data-loaders', 'current-home-price-demo-data'] };
}

test('real homepage streams critical poster and stable films before held discovery in EN/FR/ES', async (t) => {
  const Module = requireFrontend('node:module');
  const priorResolve = Module._resolveFilename;
  const aliases = Object.fromEntries(['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/server', 'react-dom/client'].map(name => [name, requireFrontend.resolve(`next/dist/compiled/${name}`)]));
  Module._resolveFilename = function(request: string, ...args: unknown[]) { return priorResolve.call(this, aliases[request] ?? request, ...args); };
  let directory: string | undefined;
  const previousReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
  try {
    const bundled = await bundle(); directory = bundled.directory;
    const fixture = requireFrontend(bundled.output);
    const React = requireFrontend('next/dist/compiled/react');
    Object.defineProperty(globalThis, 'React', { configurable: true, value: React });
    const { renderToReadableStream, renderToStaticMarkup } = requireFrontend('next/dist/compiled/react-dom/server');
    const { ImageConfigContext } = requireFrontend('next/dist/shared/lib/image-config-context.shared-runtime');
    const { imageConfigDefault } = requireFrontend('next/dist/shared/lib/image-config');
    const imageConfig = { ...imageConfigDefault, ...requireFrontend('./next.config.js').images };
    const en = JSON.parse(await readFile('frontend/messages/en.json', 'utf8'));
    const tick = () => new Promise<void>(done => setImmediate(done));
    for (const locale of ['en', 'fr', 'es']) await t.test(locale, async () => {
      fixture.reset();
      const dictionary = JSON.parse(await readFile(`frontend/messages/${locale}.json`, 'utf8'));
      const wrap = (child: unknown) => React.createElement(ImageConfigContext.Provider, { value: imageConfig },
        React.createElement(fixture.I18nProvider, { locale, dictionary, fallback: en }, child));
      let pageReady = false;
      const pagePromise = fixture.HomePage({ params: Promise.resolve({ locale }) }).then((page: unknown) => { pageReady = true; return page; });
      await tick();
      for (const phase of ['hero-slots', 'scores', 'hero-pricing', 'demo-pricing']) fixture.release(phase);
      await tick();
      assert.equal(pageReady, true, 'The real route cannot wait for held gallery reads');
      const page = await pagePromise;
      const stream = await renderToReadableStream(wrap(page));
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      const first = await reader.read();
      let shell = decoder.decode(first.value, { stream: true });
      assert.equal(first.done, false);
      while (!/home-provider-itemlist-jsonld[\s\S]*?<\/script>/.test(shell)) {
        const next = await reader.read();
        assert.equal(next.done, false, 'The full shell must render while discovery is held');
        shell += decoder.decode(next.value, { stream: true });
      }
      assert.match(shell, /fetchPriority="high"|fetchpriority="high"/);
      assert.match(shell, /hero\/prepared\/[a-f0-9]{64}\.webp/);
      assert.match(shell, /home-hero-section cinema-opening/);
      assert.equal((shell.match(/class="creative-film"/g) ?? []).length, 4, 'All four authored films stay in the initial shell');
      assert.match(shell, /home-webapp-jsonld/);
      assert.match(shell, /home-faq-jsonld/);
      assert.match(shell, /home-provider-itemlist-jsonld/);
      assert.match(shell, /id="explore-models"/);
      assert.doesNotMatch(shell, /selected-real-kling\.webp/);
      assert.equal(fixture.records.length, 0, 'Server diagnostics must wait for the eventual gallery duration');
      fixture.release('example-latest'); fixture.release('example-playlist');
      let tail = '';
      for (;;) { const next = await reader.read(); if (next.done) break; tail += decoder.decode(next.value, { stream: true }); }
      assert.match(tail, /selected-real-kling\.webp/);
      assert.doesNotMatch(tail, /home-hero-section|creative-film/, 'The later reveal must replace discovery alone');
      const finalCards = fixture.assembleHomepageExampleCards({ locale, content: dictionary.home.redesign, globalCandidates: fixture.videos, familyVideos: new Map(), acceptedAssets: [] });
      const providers = page.props.children[2].props.children.props.modelDiscovery.props.children.props.providers;
      const expectedDiscovery = renderToStaticMarkup(wrap(React.createElement(fixture.HomeModelDiscovery, { locale, examples: finalCards, providers, copy: dictionary.home.redesign.examples })));
      assert.ok(tail.replace(/<!--[\s\S]*?-->/g, '').includes(expectedDiscovery), 'Final localized discovery markup must preserve the existing curation output');
      await tick();
      assert.equal(fixture.records.length, 1);
      assert.equal(fixture.records[0].status, 'ok');
      assert.ok(fixture.records[0].phases.every((phase: { status: string; durationMs: unknown }) => phase.status === 'ok' && typeof phase.durationMs === 'number'));
      assert.equal(fixture.calls.filter((phase: string) => phase === 'hero-slots').length, 1);
      assert.equal(fixture.calls.filter((phase: string) => phase === 'hero-pricing').length, 1);
      assert.equal(fixture.calls.filter((phase: string) => phase === 'example-latest').length, 1);
      assert.equal(fixture.calls.filter((phase: string) => phase === 'example-playlist').length, 1);
      const reportDirectory = process.env.CWV_HOME_STREAM_REPORT_DIR;
      if (reportDirectory) {
        await mkdir(reportDirectory, { recursive: true });
        await Promise.all([
          writeFile(join(reportDirectory, `shell-${locale}.html`), shell),
          writeFile(join(reportDirectory, `reveal-${locale}.html`), tail),
          writeFile(join(reportDirectory, `proof-${locale}.json`), JSON.stringify({
            locale, renderer: React.version, sourceOwners: 'real HomePage/HomeHero/HomeCreativeWorlds/HomeDiscovery/HomeModelDiscovery',
            controlledBoundaries: bundled.controlledBoundaries, calls: fixture.calls, records: fixture.records,
            criticalShellBeforeGallery: true, stableCreativeFilms: 4, seoScriptsInShell: 3,
            heroReplacedInReveal: false, creativeFilmsReplacedInReveal: false, finalDiscoveryMarkupEqual: true,
            shellBytes: Buffer.byteLength(shell), revealBytes: Buffer.byteLength(tail),
            limitation: 'Controlled I/O and Next bundled React rendering; not HTTP cache, browser playback, CLS or LCP evidence.',
          }, null, 2)),
        ]);
      }
    });
  } finally {
    Module._resolveFilename = priorResolve;
    previousReact ? Object.defineProperty(globalThis, 'React', previousReact) : Reflect.deleteProperty(globalThis, 'React');
    if (directory) await rm(directory, { recursive: true, force: true });
  }
});
