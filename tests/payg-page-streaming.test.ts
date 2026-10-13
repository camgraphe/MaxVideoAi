import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const requireFrontend = createRequire(resolve('frontend/package.json'));
const route = resolve('frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator');
const tick = () => new Promise<void>(done => setImmediate(done));

// Keep the actual route, video quote queue, pure projections and sections. Only
// canonical price I/O and the public showcase read are held at their boundaries.
async function bundle() {
  const directory = await mkdtemp(join(tmpdir(), 'payg-streaming-'));
  const output = join(directory, 'route.cjs');
  const mocks: Record<string, string> = {
    probe: `
      export const calls=[], reads=[];
      export const failure=new Error('controlled current quote failure');
      export const videos=[{id:'selected-public-video',engineId:'kling-3-pro',engineLabel:'Kling 3 Pro',durationLabel:'8s',title:'Public selected video',useCase:'Public example',videoUrl:'/test.mp4',thumbUrl:'/test.webp',href:'/video/selected-public-video'}];
      let state, releasePrices, releaseShowcase, prices, showcase;
      export function configure(value={}) {state=value;calls.length=0;reads.length=0;prices=new Promise(done=>releasePrices=done);showcase=new Promise(done=>releaseShowcase=done);}
      export function release(name) {(name==='prices'?releasePrices:releaseShowcase)();}
      export async function quote(input) {calls.push(input);await prices;if(state.failure)throw failure;return state.unavailable?{status:'unavailable'}:{status:'exact',amountCents:1937,currency:'USD',revision:'current-test',scenarioLabel:'Current exact scenario'};}
      export async function loadShowcase(input) {reads.push(input);await showcase;if(state.showcaseFailure)throw failure;return state.empty?[]:videos;}
    `,
    '@/server/pricing/quote-public-model-scenario': `import {quote} from 'probe';export const createScopedPublicModelQuoter=()=>quote;`,
    showcase: `export {loadShowcase as loadPayAsYouGoVideoShowcase} from 'probe';`,
  };
  try {
    await build({
      stdin: { contents: `export {default as Page} from ${JSON.stringify(join(route, 'page.tsx'))};export {PayAsYouGoPageView} from ${JSON.stringify(join(route, '_components/PayAsYouGoPageView.tsx'))};export {buildPayAsYouGoPageData} from ${JSON.stringify(join(route, '_lib/payg-page-data.ts'))};export {getPayAsYouGoContent} from ${JSON.stringify(join(route, '_content/index.ts'))};export {buildCurrentVideoPricingData} from './frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/currentPricingHubData';export {I18nProvider} from './frontend/lib/i18n/I18nProvider';export * from 'probe';`, resolveDir: process.cwd() },
      outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json', jsx: 'automatic',
      plugins: [{ name: 'payg-controlled-io', setup(builder) {
        builder.onResolve({ filter: /.*/ }, args => {
          if (args.path in mocks) return { path: args.path, namespace: 'controlled' };
          if (/payg-video-showcase$/.test(args.path)) return { path: 'showcase', namespace: 'controlled' };
          if (args.path.startsWith('@/messages/')) return { path: resolve('frontend', args.path.slice(2)), external: true };
          if (!args.path.startsWith('.') && !args.path.startsWith('/') && !args.path.startsWith('@/') && !args.path.startsWith('node:')) return { path: requireFrontend.resolve(args.path), external: true };
        });
        builder.onLoad({ filter: /.*/, namespace: 'controlled' }, args => ({ contents: mocks[args.path], loader: 'js', resolveDir: process.cwd() }));
      } }],
    });
    return { directory, output };
  } catch (error) { await rm(directory, { recursive: true, force: true }); throw error; }
}

function projection(document: Document) {
  return [...document.querySelectorAll('header, section')].map(section => ({
    tag: section.tagName, id: section.id, className: section.className,
    text: section.textContent,
    links: [...section.querySelectorAll('a')].map(link => [link.getAttribute('href'), link.textContent]),
    images: [...section.querySelectorAll('img')].map(img => [img.getAttribute('src'), img.getAttribute('sizes'), img.getAttribute('loading')]),
  }));
}

test('PAYG emits its hero before held current prices, then preserves the settled localized page', async t => {
  // Next App Router uses this bundled React 19 renderer; package tests use React 18.
  const Module = requireFrontend('node:module'), priorResolve = Module._resolveFilename;
  const aliases = Object.fromEntries(['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/server', 'react-dom/client'].map(name => [name, requireFrontend.resolve(`next/dist/compiled/${name}`)]));
  Module._resolveFilename = function(request: string, ...args: unknown[]) { return priorResolve.call(this, aliases[request] ?? request, ...args); };
  let directory: string | undefined;
  const previousReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
  try {
    const bundled = await bundle(); directory = bundled.directory;
    const h = requireFrontend(bundled.output);
    const React = requireFrontend('next/dist/compiled/react');
    Object.defineProperty(globalThis, 'React', { configurable: true, value: React });
    const { renderToReadableStream, renderToStaticMarkup } = requireFrontend('next/dist/compiled/react-dom/server');
    const { ImageConfigContext } = requireFrontend('next/dist/shared/lib/image-config-context.shared-runtime');
    const { imageConfigDefault } = requireFrontend('next/dist/shared/lib/image-config');
    const config = { ...imageConfigDefault, ...requireFrontend('./next.config.js').images };
    for (const locale of ['en', 'fr', 'es']) for (const unavailable of [false, true]) await t.test(`${locale}/${unavailable ? 'unavailable' : 'exact'}`, async () => {
      h.configure({ unavailable, empty: unavailable });
      const content = h.getPayAsYouGoContent(locale);
      const dictionary = JSON.parse(await readFile(`frontend/messages/${locale}.json`, 'utf8'));
      const wrap = (page: unknown) => React.createElement('html', null, React.createElement('body', null,
        React.createElement(ImageConfigContext.Provider, { value: config },
          React.createElement(h.I18nProvider, { locale, dictionary, fallback: dictionary }, page,
            React.createElement('span', { 'data-shell-complete': true })))));
      let pageReady = false;
      const pending = h.Page({ params: Promise.resolve({ locale }) }).then((page: unknown) => { pageReady = true; return page; });
      try {
        await tick(); await tick();
        assert.equal(pageReady, true, 'The actual PAYG route must return its hero while canonical quotes and showcase are held');
        assert.equal(h.calls.length, 8, 'The existing video queue starts only its eight workers');
        assert.equal(h.reads.length, 1);
        const errors: unknown[] = [];
        const stream = await renderToReadableStream(wrap(await pending), { onError: (error: unknown) => errors.push(error) });
        const reader = stream.getReader(), decoder = new TextDecoder();
        let shell = '';
        while (!shell.includes('data-shell-complete')) {
          const next = await reader.read(); assert.equal(next.done, false);
          shell += decoder.decode(next.value, { stream: true });
        }
        const opening = new JSDOM(shell);
        assert.equal(opening.window.document.querySelector('h1')?.textContent, content.hero.title);
        assert.equal(opening.window.document.querySelectorAll('h1').length, 1);
        assert.equal(opening.window.document.querySelectorAll('script[type="application/ld+json"]').length, 3);
        assert.equal(opening.window.document.querySelector('#compare-price-per-model'), null);
        assert.equal(opening.window.document.querySelectorAll('header [data-payg-price-pending]').length, 1);
        assert.doesNotMatch(opening.window.document.querySelector('header [data-payg-price-pending]')?.textContent ?? '', /\d+[.,]\d{2}/, 'No speculative amount belongs in the pending card');
        opening.window.close();
        h.release('prices');
        let tail = '';
        // Quotes resolve independently of showcase; they must not replace the title.
        const card = await reader.read(); assert.equal(card.done, false);
        tail += decoder.decode(card.value, { stream: true });
        assert.doesNotMatch(tail, /<h1\b/);
        h.release('showcase');
        for (;;) { const next = await reader.read(); if (next.done) break; tail += decoder.decode(next.value, { stream: true }); }
        assert.deepEqual(errors, []);
        assert.equal(h.calls.length, 114, 'Hero and details consume one current video projection');
        assert.ok(h.calls.every((input: { mode: string }) => input.mode !== 't2i'));
        const final = new JSDOM(shell + tail, { runScripts: 'dangerously', pretendToBeVisual: true });
        await new Promise(done => setTimeout(done, 60));
        const expectedData = h.buildPayAsYouGoPageData({ locale, content, pricingHub: await h.buildCurrentVideoPricingData(locale) });
        const expected = new JSDOM(renderToStaticMarkup(wrap(React.createElement(h.PayAsYouGoPageView, {
          data: expectedData, showcaseCopy: content.showcase.section, showcaseVideos: unavailable ? [] : h.videos,
        }))));
        assert.deepEqual(projection(final.window.document), projection(expected.window.document));
        assert.equal(final.window.document.querySelectorAll('h1').length, 1);
        assert.equal(final.window.document.querySelectorAll('[data-payg-price-pending]').length, 0);
        const cardText = final.window.document.querySelector('header')?.textContent ?? '';
        assert.ok(unavailable ? cardText.includes(content.common.liveQuote) : /19[.,]37/.test(cardText));
        assert.equal(final.window.document.querySelector('section')?.querySelector('video'), null, 'The showcase retains poster-only server output');
        final.window.close(); expected.window.close();
      } finally { h.release('prices'); h.release('showcase'); await pending.catch(() => undefined); }
    });
    for (const beforeRender of [false, true]) for (const showcaseFailure of [false, true]) await t.test(`rejection/${beforeRender ? 'before' : 'during'}-render/${showcaseFailure ? 'showcase' : 'pricing'}`, async () => {
      h.configure({ failure: !showcaseFailure, showcaseFailure });
      const locale = 'fr', content = h.getPayAsYouGoContent(locale);
      const errors: unknown[] = [];
      const page = await h.Page({ params: Promise.resolve({ locale }) });
      if (beforeRender) {
        // A request can reject before React consumes either async section. It is
        // already observed, and must never become a provisional base-price page.
        h.release('prices'); h.release('showcase'); await tick(); await tick();
      }
      const stream = await renderToReadableStream(React.createElement(ImageConfigContext.Provider, { value: config },
        React.createElement(h.I18nProvider, { locale, dictionary: {}, fallback: {} }, page)),
      { onError: (error: unknown) => errors.push(error) });
      const reader = stream.getReader(), decoder = new TextDecoder();
      const first = await reader.read();
      let html = decoder.decode(first.value, { stream: true });
      h.release('prices'); h.release('showcase');
      for (;;) { const next = await reader.read(); if (next.done) break; html += decoder.decode(next.value, { stream: true }); }
      assert.ok(errors.length >= 1);
      assert.ok(errors.every(error => error === h.failure), 'Keep the original failed-read error for the server boundary');
      assert.equal(h.reads.length, 1);
      assert.equal(h.calls.length, showcaseFailure ? 114 : 8);
      const doc = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
      await new Promise(done => setTimeout(done, 60));
      assert.equal(doc.window.document.querySelector('h1')?.textContent, content.hero.title);
      assert.equal(doc.window.document.querySelector('#compare-price-per-model'), null);
      assert.equal(doc.window.document.querySelectorAll('script[type="application/ld+json"]').length, 3);
      const pendingCard = doc.window.document.querySelector('[data-payg-price-pending]');
      if (!showcaseFailure) {
        assert.ok(pendingCard, 'A rejected canonical read cannot display a base-price quote card');
        assert.doesNotMatch(pendingCard.textContent ?? '', /\d+[.,]\d{2}/);
      }
      doc.window.close();
      h.configure(); h.release('prices'); h.release('showcase');
      const recovered = await h.buildCurrentVideoPricingData('fr');
      assert.equal(h.calls.length, 114, 'A later request owns fresh current quotes after failure');
      assert.ok(recovered.video.rows.some((row: { quotes: Record<string, { amountCents?: number }> }) =>
        Object.values(row.quotes).some(quote => quote.amountCents === 1937)));
    });
  } finally {
    Module._resolveFilename = priorResolve;
    if (previousReact) Object.defineProperty(globalThis, 'React', previousReact); else delete (globalThis as { React?: unknown }).React;
    if (directory) await rm(directory, { recursive: true, force: true });
  }
});
