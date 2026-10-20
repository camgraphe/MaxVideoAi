import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const requireFrontend = createRequire(resolve('frontend/package.json'));
const route = resolve('frontend/app/(localized)/[locale]/(marketing)/examples');

// Execute the route, canonical example scenario selection, gallery and card renderer.
// Only catalogue I/O, dictionary I/O and the canonical price provider are controlled.
async function bundle() {
  const directory = await mkdtemp(join(tmpdir(), 'examples-price-streaming-'));
  const output = join(directory, 'route.cjs');
  const mocks: Record<string, string> = {
    probe: `
      export const calls=[], reads=[];
      let state, resolvePrices, gate;
      export function configure(value={}) {state=value;calls.length=0;reads.length=0;gate=new Promise(done=>resolvePrices=done);}
      export function release() {resolvePrices();}
      export function quoteBatch(videos, actual) {
        return state.batchFailure ? gate.then(()=>{throw new Error('batch pricing failure');}) : actual(videos);
      }
      export function catalogue(kind, options) {
        reads.push({kind,...options});
        const items=state.empty?[]:Array.from({length:24},(_,index)=>{
          const aspectRatio=index%4===1?'9:16':'16:9';
          const id='stream-'+(options.offset+index);
          return {id,userId:null,engineId:'kling-3-pro',engineLabel:'Kling 3 Pro',
            durationSec:5,prompt:'Public test prompt '+id,promptExcerpt:'Public test prompt '+id,
            createdAt:'2026-10-01T12:00:00Z',visibility:'public',indexable:true,hasAudio:true,canUpscale:false,
            aspectRatio,finalPriceCents:99999,currency:'USD',
            videoUrl:'https://media.maxvideoai.com/test/'+id+'.mp4',thumbUrl:'https://media.maxvideoai.com/test/'+id+'.webp',
            settingsSnapshot:index===2?null:{inputMode:'t2v',core:{durationSec:5,resolution:'1080p',audio:true,aspectRatio},refs:{}}};
        });
        return {items,total:state.empty?0:48,limit:24,offset:options.offset,hasMore:options.offset===0};
      }
      export async function quote(context) {
        calls.push(context);await gate;
        if(state.unavailable)throw new Error('held canonical quote unavailable');
        const amount=context.aspectRatio==='9:16'?237:141;
        return {currency:'USD',totalCents:amount,subtotalBeforeDiscountCents:amount,
          base:{seconds:context.durationSec,rate:amount/100/context.durationSec,unit:'sec',amountCents:amount},
          addons:[],margin:{percent:0,flatCents:0,amountCents:0},meta:{customerTariffRevision:'fixture-current'}};
      }
    `,
    '@/lib/i18n/server': `import en from ${JSON.stringify(resolve('frontend/messages/en.json'))};import fr from ${JSON.stringify(resolve('frontend/messages/fr.json'))};import es from ${JSON.stringify(resolve('frontend/messages/es.json'))};export async function resolveDictionary({locale}){return {locale,dictionary:{en,fr,es}[locale]};}`,
    'next-intl/server': `export async function getTranslations(){return key=>key;}`,
    '@/server/videos': `import {catalogue} from 'probe';export const listExamplesPage=async options=>catalogue('hub',options);export const listExampleFamilyPage=async(family,options)=>catalogue(family,options);export const listExamples=async()=>[];`,
    '@/server/pricing/quote-public': `export {quote as computeCurrentPublicSnapshot} from 'probe';`,
    '@/server/current-example-price': `import {quoteCurrentExamplePrices as actual} from ${JSON.stringify(resolve('frontend/server/current-example-price.ts'))};import {quoteBatch} from 'probe';export const quoteCurrentExamplePrices=videos=>quoteBatch(videos,actual);`,
  };
  try {
    await build({
      stdin: { contents: `export {default as Page} from ${JSON.stringify(join(route, 'page.tsx'))};export * from 'probe';`, resolveDir: process.cwd() },
      outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json', jsx: 'automatic',
      plugins: [{ name: 'examples-controlled-io', setup(builder) {
        builder.onResolve({ filter: /\.css$/ }, args => ({ path: args.path, namespace: 'styles' }));
        builder.onLoad({ filter: /.*/, namespace: 'styles' }, () => ({ contents: 'export default new Proxy({}, {get:(_target,key)=>String(key)});', loader: 'js' }));
        builder.onResolve({ filter: /.*/ }, args => {
          if (args.path.startsWith(resolve('frontend/messages') + '/')) return { path: args.path, external: true };
          if (args.path.startsWith('@/messages/')) return { path: resolve('frontend', args.path.slice(2)), external: true };
          if (args.path in mocks) return { path: args.path, namespace: 'controlled' };
          if (!args.path.startsWith('.') && !args.path.startsWith('/') && !args.path.startsWith('@/') && !args.path.startsWith('node:')) return { path: requireFrontend.resolve(args.path), external: true };
        });
        builder.onLoad({ filter: /.*/, namespace: 'controlled' }, args => ({ contents: mocks[args.path], loader: 'js', resolveDir: process.cwd() }));
      } }],
    });
    return { directory, output };
  } catch (error) { await rm(directory, { recursive: true, force: true }); throw error; }
}

test('examples posters and SEO stream before held canonical prices without replacing the gallery', async (t) => {
  // The App Router uses Next's compiled React renderer, not the standalone React 18 renderer.
  const Module = requireFrontend('node:module');
  const priorResolve = Module._resolveFilename;
  const aliases = Object.fromEntries(['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/server', 'react-dom/client'].map(name => [name, requireFrontend.resolve(`next/dist/compiled/${name}`)]));
  Module._resolveFilename = function(request: string, ...args: unknown[]) { return priorResolve.call(this, aliases[request] ?? request, ...args); };
  let directory: string | undefined;
  const previousReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
  try {
    const bundled = await bundle(); directory = bundled.directory;
    const fixture = requireFrontend(bundled.output);
    for (const [locale, base] of [['en', '/examples'], ['fr', '/fr/galerie'], ['es', '/es/galeria']]) {
      for (const [searchParams, target] of [
        [{ engine: 'ltx', page: '1' }, `${base}/ltx`],
        [{ engine: 'ltx', sort: 'invalid', page: '2' }, `${base}/ltx?page=2`],
        [{ engine: 'ltx', page: '2junk', utm_source: 'audit' }, `${base}/ltx?utm_source=audit`],
        [{ page: ['2', '3'] }, base],
      ] as const) {
        await assert.rejects(() => fixture.Page({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(searchParams) }),
          (error: any) => Boolean(error.digest?.includes(`;${target};`)), `Normalize without losing the requested family: ${JSON.stringify(searchParams)}`);
      }
    }
    const React = requireFrontend('next/dist/compiled/react');
    Object.defineProperty(globalThis, 'React', { configurable: true, value: React });
    const { renderToReadableStream } = requireFrontend('next/dist/compiled/react-dom/server');
    const { ImageConfigContext } = requireFrontend('next/dist/shared/lib/image-config-context.shared-runtime');
    const { imageConfigDefault } = requireFrontend('next/dist/shared/lib/image-config');
    const imageConfig = { ...imageConfigDefault, ...requireFrontend('./next.config.js').images };
    const tick = () => new Promise<void>(done => setImmediate(done));
    const cases = [
      { locale: 'en', expected: 'Current price $1.41', portrait: 'Current price $2.37', reference: 'From $1.41 · Text to video · 5s · 1080p' },
      { locale: 'fr', expected: 'Prix actuel 1,41 $US', portrait: 'Prix actuel 2,37 $US', reference: 'Dès 1,41 $US · Texte vers vidéo · 5 s · 1080p' },
      { locale: 'es', expected: 'Precio actual USD 1.41', portrait: 'Precio actual USD 2.37', reference: 'Desde USD 1.41 · Texto a vídeo · 5 s · 1080p' },
      { locale: 'en', family: 'kling', page: 2, expected: 'Current price $1.41', portrait: 'Current price $2.37', reference: 'From $1.41 · Text to video · 5s · 1080p' },
      { locale: 'fr', unavailable: true },
      { locale: 'en', batchFailure: true },
      { locale: 'es', empty: true },
    ];
    for (const state of cases) await t.test(JSON.stringify(state), async () => {
      fixture.configure(state);
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      let pageReady = false;
      const searchParams = { ...(state.family ? { engine: state.family, __engineFromPath: state.family } : {}), ...(state.page ? { page: String(state.page) } : {}) };
      const pagePromise = fixture.Page({ params: Promise.resolve({ locale: state.locale }), searchParams: Promise.resolve(searchParams) })
        .then((page: unknown) => { pageReady = true; return page; });
      try {
        await tick();
        assert.equal(pageReady, true, 'The real examples route must return its gallery while canonical prices are held');
        const page = await pagePromise;
        if (state.batchFailure) {
          // Settle before React consumes any price slot: the data owner must already observe rejection.
          fixture.release(); await tick();
        }
        const stream = await renderToReadableStream(React.createElement(ImageConfigContext.Provider, { value: imageConfig },
          React.createElement(React.Fragment, null, page, React.createElement('div', { 'data-shell-end': true }))));
        reader = stream.getReader();
        const decoder = new TextDecoder();
        let shell = '';
        while (!shell.includes('data-shell-end')) {
          const next = await reader.read();
          assert.equal(next.done, false, 'The shell must finish before the quote provider is released');
          shell += decoder.decode(next.value, { stream: true });
        }
        const dom = new JSDOM(shell);
        try {
          const doc = dom.window.document;
          const cards = [...doc.querySelectorAll('a[data-analytics-cta-name="view_example_details"]')];
          assert.equal(cards.length, state.empty ? 0 : 24);
          assert.ok(cards.every(card => card.querySelector('.priceSlot')), 'Each pending or unavailable card retains its reserved price row');
          assert.equal(doc.querySelectorAll('#gallery img').length, state.empty ? 0 : 24);
          assert.equal(doc.querySelectorAll('img[fetchpriority="high"]').length, state.empty ? 0 : 1);
          assert.equal(doc.querySelector('video'), null);
          assert.equal(doc.querySelectorAll('[data-gallery-opening] [data-frame]').length, state.empty || state.page ? 0 : 4);
          assert.equal(new Set(cards.map(card => card.getAttribute('href'))).size, cards.length);
          assert.ok(cards.every(card => !/[0-9][.,][0-9]{2}/.test(card.textContent ?? '')), 'No pending or historical numeric price may appear');
          assert.ok(doc.querySelector('script[type="application/ld+json"]'), 'Native route schemas remain in the shell');
          if (state.page) {
            assert.equal(cards[0].getAttribute('href'), '/video/stream-24');
            assert.match(doc.querySelector('a[rel="prev"]')?.getAttribute('href') ?? '', /examples\/kling/);
          }
          if (state.empty) assert.match(doc.body.textContent ?? '', /No hay vídeos disponibles/);
        } finally { dom.window.close(); }
        fixture.release();
        let tail = '';
        for (;;) { const next = await reader.read(); if (next.done) break; tail += decoder.decode(next.value, { stream: true }); }
        const revealed = new JSDOM(tail);
        try {
          const text = revealed.window.document.body.textContent ?? '';
          if (state.expected) {
            assert.ok(text.includes(state.expected), `The final exact label must be ${state.expected}`);
            assert.ok(text.includes(state.reference!), `The reference scenario must stay qualified and localized: ${state.reference}`);
          } else assert.doesNotMatch(text, /[0-9][.,][0-9]{2}/, 'Unavailable and empty galleries cannot expose a numeric price');
          assert.equal(revealed.window.document.querySelectorAll('img,video,a[data-analytics-cta-name="view_example_details"]').length, 0, 'Only price labels may stream; never another gallery payload');
        } finally { revealed.window.close(); }
        const completed = new JSDOM(shell + tail, { runScripts: 'dangerously', pretendToBeVisual: true });
        try {
          await new Promise<void>(done => completed.window.requestAnimationFrame(() => completed.window.requestAnimationFrame(() => done())));
          const cards = [...completed.window.document.querySelectorAll('a[data-analytics-cta-name="view_example_details"]')];
          assert.equal(cards.length, state.empty ? 0 : 24, 'Applying the streamed reveal keeps exactly one gallery');
          assert.ok(cards.every(card => card.querySelector('.priceSlot')), 'Resolved prices keep the same row and responsive reserve');
          for (let index = 0; index < cards.length; index += 1) {
            const text = cards[index].textContent ?? '';
            if (state.expected) {
              const expected = index === 2 ? state.reference! : index % 4 === 1 ? state.portrait! : state.expected;
              assert.ok(text.includes(expected), `Price must stay associated with ${cards[index].getAttribute('href')}: ${expected}`);
            } else assert.doesNotMatch(text, /[0-9][.,][0-9]{2}/);
          }
        } finally { completed.window.close(); }
        assert.equal(fixture.reads.length, 1);
        assert.equal(fixture.reads[0].kind, state.family ?? 'hub');
        assert.equal(fixture.reads[0].offset, state.page ? 24 : 0);
        assert.equal(fixture.calls.length, state.empty || state.batchFailure ? 0 : 2, 'Identical settings still share their canonical quote');
        assert.ok(fixture.calls.every((context: { engine: { id: string }; mode: string; resolution: string; durationSec: number }) => context.engine.id === 'kling-3-pro' && context.mode === 't2v' && context.resolution === '1080p' && context.durationSec === 5));
      } finally { fixture.release(); await pagePromise; if (reader) await reader.cancel(); }
    });
  } finally {
    Module._resolveFilename = priorResolve;
    previousReact ? Object.defineProperty(globalThis, 'React', previousReact) : Reflect.deleteProperty(globalThis, 'React');
    if (directory) await rm(directory, { recursive: true, force: true });
  }
});
