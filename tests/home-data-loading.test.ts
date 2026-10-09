import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const requireFrontend = createRequire(resolve('frontend/package.json'));

test('homepage starts retained reads together, drops unused proof reads and records one bounded load', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'home-data-loading-'));
  try {
    const output = join(directory, 'page.cjs');
    const timingPath = resolve('frontend/server/public-page-timing.ts');
    await build({
      stdin: { contents: `export {default as HomePage} from './frontend/app/(localized)/[locale]/(marketing)/(home)/page'; export * from './frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-page-data'; export * from 'probe';`, resolveDir: process.cwd() },
      define: { 'import.meta.url': JSON.stringify(pathToFileURL(resolve('frontend/server/video-keyframes.ts')).href) },
      outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json', jsx: 'automatic',
      plugins: [{ name: 'controlled-home-reads', setup(builder) {
        builder.onResolve({ filter: /\.css$/ }, args => ({ path: args.path, namespace: 'empty' }));
        builder.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: '', loader: 'js' }));
        const mocks: Record<string, string> = {
          probe: `
            export const calls=[], records=[];
            export const example={id:'fixture-example',engineId:'kling-3-pro',engine:'Kling 3 Pro',title:'Example',mode:'Image to video',duration:'12s',price:'$2.63',useCase:'Cinematic',imageSrc:'/fixture.webp',videoSrc:null,imageAlt:'Fixture cover',href:'/examples/kling',ctaLabel:'Examples',cloneLabel:'Use prompt'};
            export const examples=[example]; export const slots=[]; export const scores=new Map();
            let gates, failure, failingPhase, released;
            export function reset(error,phase='scores'){calls.length=0;records.length=0;failure=error;failingPhase=phase;gates=new Map();released=new Set();}
            export function release(name){if(name){released.add(name);gates.get(name)?.();}else{for(const [key,done] of gates){released.add(key);done();}}}
            export async function read(name,value){calls.push(name);if(!released.has(name))await new Promise(done=>gates.set(name,done));if(name===failingPhase&&failure)throw failure;return value;}
          `,
          '@/lib/i18n/server': `import en from ${JSON.stringify(resolve('frontend/messages/en.json'))};import fr from ${JSON.stringify(resolve('frontend/messages/fr.json'))};import es from ${JSON.stringify(resolve('frontend/messages/es.json'))};export async function resolveDictionary({locale}){return {dictionary:{en,fr,es}[locale]};}`,
          'next-intl/server': `export async function getTranslations(){return key=>key;}`,
          '@/server/homepage': `import {read,slots} from 'probe';export const getHomepageSlotsCached=()=>read('hero-slots',{hero:slots,gallery:[]});export const getSuccessfulGenerationCountCached=()=>read('count',20000);`,
          '@/server/current-example-price': `import {read} from 'probe';export const quoteCurrentExamplePrices=()=>read('hero-pricing',new Map());`,
          '@/server/public-page-timing': `import {withPublicPageTiming as actual} from ${JSON.stringify(timingPath)};import {records} from 'probe';export * from ${JSON.stringify(timingPath)};export const withPublicPageTiming=(context,load)=>actual(context,load,{enabled:true,now:()=>0,deployment:'test',emit:record=>records.push(record)});`,
        };
        builder.onResolve({ filter: /.*/ }, args => {
          if (args.path.startsWith('@/messages/')) return { path: resolve('frontend', args.path.slice(2)), external: true };
          if (args.path.startsWith(resolve('frontend/messages') + '/')) return { path: args.path, external: true };
          if (args.path in mocks) return { path: args.path, namespace: 'controlled' };
          if (/home-route-data\/examples$/.test(args.path)) return { path: 'examples', namespace: 'controlled' };
          if (/compare-page-data-loaders$/.test(args.path)) return { path: 'scores', namespace: 'controlled' };
          if (/current-home-price-demo-data$/.test(args.path)) return { path: 'demo-pricing', namespace: 'controlled' };
          if (/^@\/components\/marketing\/(?:home\/)?[A-Z]/.test(args.path)) return { path: args.path, namespace: 'components' };
          if (!args.path.startsWith('.') && !args.path.startsWith('/') && !args.path.startsWith('@/') && !args.path.startsWith('node:')) return { path: requireFrontend.resolve(args.path), external: true };
        });
        builder.onLoad({ filter: /.*/, namespace: 'components' }, () => ({ loader: 'js', contents: `export const HomeHero=()=>null,HomeFaq=()=>null,WorkflowSeoSummary=()=>null,DeferredMarketingContent=()=>null,HomeCreativeWorlds=()=>null,HomeModelDiscovery=()=>null,HomeCreationSection=()=>null,HomeModelChoice=()=>null,HomeToolsGallery=()=>null,HomePricingSection=()=>null;` }));
        builder.onLoad({ filter: /.*/, namespace: 'controlled' }, args => ({ loader: 'js', resolveDir: process.cwd(), contents: mocks[args.path] ?? (args.path === 'examples'
          ? `import {read,examples} from 'probe';export const loadHomepageExamples=()=>read('examples',examples);export const assembleHomepageExampleCards=()=>examples;export const selectHomepageHeroPreviews=cards=>cards.slice(0,5);export const buildHomepageP0PromotionTargets=()=>[];`
          : args.path === 'demo-pricing' ? `import {read} from 'probe';export const buildCurrentHomePriceDemo=()=>read('demo-pricing',[]);`
          : `import {read,scores} from 'probe';export const loadEngineScores=()=>read('scores',scores);`) }));
      } }],
    });
    const fixture = requireFrontend(output);
    const tick = () => new Promise<void>(done => setImmediate(done));
    await t.test('critical data resolves while gallery and its full timing record remain pending', async () => {
      assert.equal(typeof fixture.prepareHomePageData, 'function', 'The route needs independently awaitable critical and discovery data');
      fixture.reset();
      const content = JSON.parse(await readFile('frontend/messages/en.json', 'utf8')).home.redesign;
      const prepared = fixture.prepareHomePageData('en', content);
      let criticalReady = false;
      const critical = prepared.critical.then((value: unknown) => { criticalReady = true; return value; });
      await tick();
      assert.deepEqual([...fixture.calls].sort(), ['demo-pricing', 'examples', 'hero-pricing', 'hero-slots', 'scores']);
      for (const phase of ['hero-slots', 'scores', 'hero-pricing', 'demo-pricing']) fixture.release(phase);
      await tick();
      assert.equal(criticalReady, true, 'An unrelated slow gallery cannot delay the critical hero');
      assert.equal(fixture.records.length, 0, 'A pending gallery timing must not be emitted as a complete load');
      fixture.release('examples');
      await prepared.completed;
      assert.equal((await critical).programmedHeroSlots.length, 0);
      assert.deepEqual(await prepared.examples, fixture.examples);
      assert.equal(fixture.records.length, 1);
      assert.ok(fixture.records[0].phases.every((phase: { status: string; durationMs: unknown }) => phase.status === 'ok' && typeof phase.durationMs === 'number'));
    });
    for (const locale of ['en', 'fr', 'es']) {
      await t.test(`retained reads overlap and content data is preserved for ${locale}`, async () => {
        fixture.reset();
        const pending = fixture.HomePage({ params: Promise.resolve({ locale }) });
        await tick();
        const started = [...fixture.calls];
        fixture.release();
        await tick();
        // Also release a sequential baseline score read so a failed assertion cannot hang.
        fixture.release();
        const page = await pending;
        assert.deepEqual(started.sort(), ['demo-pricing', 'examples', 'hero-pricing', 'hero-slots', 'scores'], 'current prices must start before unrelated gallery reads resolve');
        const children = page.props.children;
        const hero = children[0];
        assert.equal('proofStats' in hero.props, false);
        assert.equal('previews' in hero.props, false);
        assert.deepEqual(hero.props.programmedHeroItems, []);
        const discovery = children[2].props.children.props.modelDiscovery;
        assert.equal((await discovery.props.children.type(discovery.props.children.props)).props.examples, fixture.examples);
        assert.deepEqual(children[3].props.children.props.scores.opponents, []);
        const schemas = children.filter((child: { type: string }) => child.type === 'script');
        assert.deepEqual(schemas.map((child: { props: { id: string } }) => child.props.id), ['home-webapp-jsonld', 'home-faq-jsonld', 'home-provider-itemlist-jsonld']);
        const software = JSON.parse(schemas[0].props.dangerouslySetInnerHTML.__html);
        assert.equal(software.inLanguage, locale);
        assert.equal(software.url, `https://maxvideoai.com${locale === 'en' ? '' : `/${locale}`}`);
        assert.equal(fixture.records.length, 1);
        const record = fixture.records[0];
        assert.equal(record.route, 'home');
        assert.equal(record.locale, locale);
        assert.equal(record.status, 'ok');
        assert.deepEqual(record.phases.map(({ phase, status }: { phase: string; status: string }) => ({ phase, status })), [
          { phase: 'examples', status: 'ok' }, { phase: 'hero-slots', status: 'ok' }, { phase: 'scores', status: 'ok' },
          { phase: 'hero-pricing', status: 'ok' }, { phase: 'demo-pricing', status: 'ok' },
        ]);
        assert.deepEqual(Object.keys(record).sort(), ['schema', 'route', 'locale', 'deployment', 'status', 'dataDurationMs', 'phases'].sort());
      });
    }
    await t.test('the hero-slot fallback remains successful data rather than an instrumentation error', async () => {
      fixture.reset(new Error('unavailable fixture cache'), 'hero-slots');
      const warn = console.warn;
      console.warn = () => undefined;
      try {
        const pending = fixture.HomePage({ params: Promise.resolve({ locale: 'en' }) });
        await tick(); fixture.release();
        const page = await pending;
        await tick();
        assert.deepEqual(page.props.children[0].props.programmedHeroItems, []);
        assert.equal(fixture.records.length, 1);
        assert.equal(fixture.records[0].status, 'ok');
        assert.equal(fixture.records[0].phases.find(({ phase }: { phase: string }) => phase === 'hero-slots').status, 'ok');
      } finally { console.warn = warn; }
    });
    await t.test('unexpected loader errors preserve identity without logging their content', async () => {
      const failure = new Error('private fixture details must never be recorded');
      fixture.reset(failure);
      const pending = fixture.HomePage({ params: Promise.resolve({ locale: 'en' }) });
      const rejected = assert.rejects(pending, error => error === failure);
      await tick(); fixture.release(); await tick(); fixture.release();
      await rejected;
      assert.equal(fixture.records.length, 1);
      assert.equal(fixture.records[0].status, 'error');
      assert.equal(fixture.records[0].phases.find(({ phase }: { phase: string }) => phase === 'scores').status, 'error');
      assert.ok(!JSON.stringify(fixture.records).includes(failure.message));
    });
    await t.test('discovery failure after critical data stays observable and finishes one error record', async () => {
      const failure = new Error('private gallery details');
      const content = JSON.parse(await readFile('frontend/messages/en.json', 'utf8')).home.redesign;
      fixture.reset(failure, 'examples');
      const prepared = fixture.prepareHomePageData('en', content);
      await tick();
      for (const phase of ['hero-slots', 'scores', 'hero-pricing', 'demo-pricing']) fixture.release(phase);
      await prepared.critical;
      assert.equal(fixture.records.length, 0);
      const examplesRejected = assert.rejects(prepared.examples, error => error === failure);
      const completionRejected = assert.rejects(prepared.completed, error => error === failure);
      fixture.release('examples');
      await Promise.all([examplesRejected, completionRejected]);
      assert.equal(fixture.records.length, 1);
      assert.equal(fixture.records[0].status, 'error');
      assert.ok(fixture.records[0].phases.every((phase: { status: string; durationMs: unknown }) => phase.status !== 'pending' && typeof phase.durationMs === 'number'));
      assert.ok(!JSON.stringify(fixture.records).includes(failure.message));
    });
    await t.test('abandoned preparation observes each rejection immediately', async () => {
      const content = JSON.parse(await readFile('frontend/messages/en.json', 'utf8')).home.redesign;
      for (const phase of ['examples', 'scores']) {
        fixture.reset(new Error('abandoned request'), phase);
        fixture.prepareHomePageData('en', content);
        await tick(); fixture.release(); await tick(); await tick();
        assert.equal(fixture.records.length, 1);
        assert.equal(fixture.records[0].status, 'error');
      }
      // node:test also fails this test if any abandoned task emits unhandledRejection.
    });
    await t.test('early critical errors retain their identity while timings wait for slower reads', async () => {
      const content = JSON.parse(await readFile('frontend/messages/en.json', 'utf8')).home.redesign;
      const failure = new Error('original score failure');
      fixture.reset(failure, 'scores');
      const prepared = fixture.prepareHomePageData('en', content);
      const criticalRejected = assert.rejects(prepared.critical, error => error === failure);
      const completionRejected = assert.rejects(prepared.completed, error => error === failure);
      await tick(); fixture.release('scores');
      await criticalRejected;
      assert.equal(fixture.records.length, 0, 'Failed requests also need eventual durations for every started phase');
      fixture.release();
      await completionRejected;
      assert.equal(fixture.records.length, 1);
      assert.equal(fixture.records[0].status, 'error');
      assert.ok(fixture.records[0].phases.every((phase: { status: string; durationMs: unknown }) => phase.status !== 'pending' && typeof phase.durationMs === 'number'));
    });
  } finally { await rm(directory, { recursive: true, force: true }); }
});
