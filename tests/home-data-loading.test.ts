import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
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
      stdin: { contents: `export {default as HomePage} from './frontend/app/(localized)/[locale]/(marketing)/(home)/page'; export * from 'probe';`, resolveDir: process.cwd() },
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
            let gates, failure, failingPhase;
            export function reset(error,phase='scores'){calls.length=0;records.length=0;failure=error;failingPhase=phase;gates=new Map();}
            export function release(){for(const done of gates.values())done();}
            export async function read(name,value){calls.push(name);await new Promise(done=>gates.set(name,done));if(name===failingPhase&&failure)throw failure;return value;}
          `,
          '@/lib/i18n/server': `import en from ${JSON.stringify(resolve('frontend/messages/en.json'))};import fr from ${JSON.stringify(resolve('frontend/messages/fr.json'))};import es from ${JSON.stringify(resolve('frontend/messages/es.json'))};export async function resolveDictionary({locale}){return {dictionary:{en,fr,es}[locale]};}`,
          'next-intl/server': `export async function getTranslations(){return key=>key;}`,
          '@/server/homepage': `import {read,slots} from 'probe';export const getHomepageSlotsCached=()=>read('hero-slots',{hero:slots,gallery:[]});export const getSuccessfulGenerationCountCached=()=>read('count',20000);`,
          '@/server/public-page-timing': `import {withPublicPageTiming as actual} from ${JSON.stringify(timingPath)};import {records} from 'probe';export * from ${JSON.stringify(timingPath)};export const withPublicPageTiming=(context,load)=>actual(context,load,{enabled:true,now:()=>0,deployment:'test',emit:record=>records.push(record)});`,
        };
        builder.onResolve({ filter: /.*/ }, args => {
          if (args.path.startsWith('@/messages/')) return { path: resolve('frontend', args.path.slice(2)), external: true };
          if (args.path.startsWith(resolve('frontend/messages') + '/')) return { path: args.path, external: true };
          if (args.path in mocks) return { path: args.path, namespace: 'controlled' };
          if (/home-route-data\/examples$/.test(args.path)) return { path: 'examples', namespace: 'controlled' };
          if (/compare-page-data-loaders$/.test(args.path)) return { path: 'scores', namespace: 'controlled' };
          if (/^@\/components\/marketing\/(?:home\/)?[A-Z]/.test(args.path)) return { path: args.path, namespace: 'components' };
          if (!args.path.startsWith('.') && !args.path.startsWith('/') && !args.path.startsWith('@/') && !args.path.startsWith('node:')) return { path: requireFrontend.resolve(args.path), external: true };
        });
        builder.onLoad({ filter: /.*/, namespace: 'components' }, () => ({ loader: 'js', contents: `export const HomeHero=()=>null,HomeFaq=()=>null,WorkflowSeoSummary=()=>null,DeferredMarketingContent=()=>null,HomeCreativeWorlds=()=>null,HomeCreationSection=()=>null,HomeModelChoice=()=>null,HomeToolsGallery=()=>null,HomePricingSection=()=>null;` }));
        builder.onLoad({ filter: /.*/, namespace: 'controlled' }, args => ({ loader: 'js', resolveDir: process.cwd(), contents: mocks[args.path] ?? (args.path === 'examples'
          ? `import {read,examples} from 'probe';export const loadHomepageExamples=()=>read('examples',examples);export const selectHomepageHeroPreviews=cards=>cards.slice(0,5);export const buildHomepageP0PromotionTargets=()=>[];`
          : `import {read,scores} from 'probe';export const loadEngineScores=()=>read('scores',scores);`) }));
      } }],
    });
    const fixture = requireFrontend(output);
    const tick = () => new Promise<void>(done => setImmediate(done));
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
        assert.deepEqual(started.sort(), ['examples', 'hero-slots', 'scores']);
        const children = page.props.children;
        const hero = children[0];
        assert.equal('proofStats' in hero.props, false);
        assert.deepEqual(hero.props.previews, fixture.examples);
        assert.deepEqual(hero.props.programmedHeroItems, []);
        assert.equal(children[2].props.children.props.examples, fixture.examples);
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
  } finally { await rm(directory, { recursive: true, force: true }); }
});
