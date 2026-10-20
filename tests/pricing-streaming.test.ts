import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';

const requireFrontend = createRequire(resolve('frontend/package.json'));
const pricing = './frontend/app/(localized)/[locale]/(marketing)/pricing';

async function bundle() {
  const directory = await mkdtemp(join(tmpdir(), 'pricing-streaming-'));
  const output = join(directory, 'owners.cjs');
  const mocks: Record<string, string> = {
    probe: `
      export let calls=0, result;
      let done, fail;
      let gate, unavailable;
      export function reset(missing=false){unavailable=missing;calls=0;result=undefined;gate=new Promise((resolve,reject)=>{done=resolve;fail=reject;});}
      export function release(){done();}
      export function reject(error){fail(error);}
      export function record(){calls++;}
      export async function quote(input){await gate;if(unavailable)return {status:'unavailable'};return {status:'exact',amountCents:input.mode==='t2i'?321:654,currency:'USD',revision:'current',scenarioLabel:'Controlled current scenario'};}
      export function save(data){result=data;return data;}
    `,
    '@/lib/i18n/server': `import en from ${JSON.stringify(resolve('frontend/messages/en.json'))};import fr from ${JSON.stringify(resolve('frontend/messages/fr.json'))};import es from ${JSON.stringify(resolve('frontend/messages/es.json'))};export async function resolveDictionary({locale}){return {dictionary:{en,fr,es}[locale]};}`,
    'next-intl/server': `export async function getTranslations(){return key=>key;}`,
    '@/server/pricing/quote-public-model-scenario': `export const createScopedPublicModelQuoter=()=>{throw new Error('Use controlled quote I/O');};`,
    '@/server/pricing/quote-public': `export const computeCurrentAudioSnapshot=()=>{throw new Error('Use controlled audio I/O');};`,
    '@/lib/billing-products': `export const computeBillingProductSnapshot=()=>{throw new Error('Use controlled tool I/O');};`,
    hub: `import {buildCurrentPricingHubData as actual} from ${JSON.stringify(resolve(`${pricing}/_lib/currentPricingHubData.ts`))};import {quote,record,save} from 'probe';export function buildCurrentPricingHubData(locale){record();return actual(locale,quote,{audio:async()=>({totalCents:432,currency:'USD'}),product:async()=>({totalCents:543,currency:'USD'})}).then(save);}`,
  };
  await build({
    stdin: { contents: `export {default as PricingPage} from '${pricing}/page';export {PricingQuickStart} from '${pricing}/_components/PricingQuickStart';export {PricingVideoMatrixSection} from '${pricing}/_components/PricingVideoMatrixSection';export {PricingPopularChecksSection} from '${pricing}/_components/PricingPopularChecksSection';export {PricingOtherSurfacesSection} from '${pricing}/_components/PricingOtherSurfacesSection';export {I18nProvider} from './frontend/lib/i18n/I18nProvider';export * from 'probe';`, resolveDir: process.cwd() },
    outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json', jsx: 'automatic',
    plugins: [{ name: 'held-current-prices', setup(builder) {
      builder.onResolve({ filter: /\.css$/ }, args => ({ path: args.path, namespace: 'empty' }));
      builder.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: '', loader: 'js' }));
      builder.onResolve({ filter: /.*/ }, args => {
        if (args.path.startsWith(resolve('frontend/messages') + '/')) return { path: args.path, external: true };
        if (args.path in mocks) return { path: args.path, namespace: 'controlled' };
        if (args.path === './_lib/currentPricingHubData') return { path: 'hub', namespace: 'controlled' };
        if (!args.path.startsWith('.') && !args.path.startsWith('/') && !args.path.startsWith('@/') && !args.path.startsWith('node:')) return { path: requireFrontend.resolve(args.path), external: true };
      });
      builder.onLoad({ filter: /.*/, namespace: 'controlled' }, args => ({ loader: 'js', resolveDir: process.cwd(), contents: mocks[args.path] }));
    } }],
  });
  return { directory, output };
}

// Catch a route-level await reappearing, a second pricing read, stale pending amounts,
// or a reveal that replaces static hero/SEO instead of only the current-price slots.
test('Pricing streams its static hero before current prices, then reveals one exact localized hub', async (t) => {
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
    const en = JSON.parse(await readFile('frontend/messages/en.json', 'utf8'));
    const tick = () => new Promise<void>(done => setImmediate(done));
    const clean = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '');
    for (const [locale, unavailable] of [['en', false], ['fr', false], ['es', false], ['en', true]] as const) await t.test(`${locale}${unavailable ? ' unavailable' : ''}`, async () => {
      fixture.reset(unavailable);
      const dictionary = JSON.parse(await readFile(`frontend/messages/${locale}.json`, 'utf8'));
      const wrap = (child: unknown) => React.createElement(fixture.I18nProvider, { locale, dictionary, fallback: en }, child);
      let pageReady = false;
      const pagePromise = fixture.PricingPage({ params: Promise.resolve({ locale }) }).then((page: unknown) => { pageReady = true; return page; });
      await tick();
      assert.equal(pageReady, true, 'Static Pricing must not wait for held canonical model quotes');
      const stream = await renderToReadableStream(wrap(await pagePromise));
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let shell = '';
      while (!shell.includes('"@type":"FAQPage"')) {
        const next = await reader.read();
        assert.equal(next.done, false, 'SEO and static hero must arrive while prices remain held');
        shell += decoder.decode(next.value, { stream: true });
      }
      assert.match(shell, /<h1[^>]*>/);
      assert.ok(shell.includes(dictionary.pricing.hero.title));
      assert.match(shell, /href="#video-pricing"/);
      assert.match(shell, /id="video-pricing"/);
      assert.match(shell, /pricing-breadcrumb-jsonld/);
      assert.match(shell, /pricing-service-jsonld/);
      assert.doesNotMatch(shell, /data-pricing-(?:content|quick-start)-ready/);
      assert.doesNotMatch(shell, /[$€]\d+[.,]\d|\d+[.,]\d+\s*(?:[$€]|USD)/, 'Pending content must not display current or historical numeric estimates');
      assert.doesNotMatch(shell, /data-analytics-cta-name="pricing_scenario"/, 'Pending cards cannot guess a winning row destination');
      assert.equal(fixture.calls, 1);
      fixture.release();
      let tail = '';
      for (;;) { const next = await reader.read(); if (next.done) break; tail += decoder.decode(next.value, { stream: true }); }
      assert.equal(fixture.calls, 1, 'Quick start and all matrices must share one complete current hub');
      assert.match(tail, /data-pricing-content-ready/);
      assert.match(tail, /data-pricing-quick-start-ready/);
      if (unavailable) {
        assert.equal(fixture.result.video.highlights.filter((highlight: { featured?: unknown }) => highlight.featured).length, 0);
        assert.doesNotMatch(tail, /\$6[.,]54|6[.,]54\s*\$|data-analytics-cta-name="pricing_scenario"/);
      } else {
        assert.equal(fixture.result.video.rows.find((row: { id: string }) => row.id === 'kling-3-pro').quotes['10s-1080p'].amountCents, 654);
      }
      for (const [Component, props] of [
        [fixture.PricingQuickStart, { highlights: fixture.result.video.highlights, title: dictionary.pricing.hero.quickStartTitle, note: dictionary.pricing.hero.quickStartNote }],
        [fixture.PricingVideoMatrixSection, { video: fixture.result.video, locale }],
        [fixture.PricingPopularChecksSection, { checks: fixture.result.popularChecks, locale }],
        [fixture.PricingOtherSurfacesSection, { data: fixture.result.otherSurfaces, locale }],
      ]) {
        const expected = renderToStaticMarkup(wrap(React.createElement(Component, props)));
        assert.ok(clean(tail).includes(clean(expected)), 'Streamed output must equal the complete existing current-price renderer');
      }
      assert.doesNotMatch(tail, /<h1|pricing-opening-grid|pricing-breadcrumb-jsonld|pricing-service-jsonld/);
    });
    await t.test('a rejected quote remains an error in both boundaries', async () => {
      fixture.reset();
      const errors: unknown[] = [];
      const page = await fixture.PricingPage({ params: Promise.resolve({ locale: 'en' }) });
      const wrapped = React.createElement(fixture.I18nProvider, { locale: 'en', dictionary: en, fallback: en }, page);
      const stream = await renderToReadableStream(wrapped, { onError: (error: unknown) => { errors.push(error); return 'held-pricing-failure'; } });
      const reader = stream.getReader();
      const first = await reader.read();
      assert.equal(first.done, false);
      const failure = new Error('Canonical pricing unavailable');
      fixture.reject(failure);
      let tail = '';
      const decoder = new TextDecoder();
      for (;;) { const next = await reader.read(); if (next.done) break; tail += decoder.decode(next.value, { stream: true }); }
      assert.equal(errors.length, 2);
      assert.ok(errors.every(error => error === failure));
      assert.equal(fixture.calls, 1);
      assert.equal(fixture.result, undefined, 'A failed hub must not become successful fallback prices');
      assert.doesNotMatch(tail, /data-analytics-cta-name="pricing_scenario"/);
    });
  } finally {
    Module._resolveFilename = priorResolve;
    previousReact ? Object.defineProperty(globalThis, 'React', previousReact) : Reflect.deleteProperty(globalThis, 'React');
    if (directory) await rm(directory, { recursive: true, force: true });
  }
});
