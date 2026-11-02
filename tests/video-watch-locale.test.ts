import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
import { NextRequest } from 'next/server';
import { createCoreLocaleResponse } from '../frontend/lib/middleware/routing-locale';
import type { ExampleWatchDetail } from '../frontend/lib/example-watch-detail';
import type { WatchPageData } from '../frontend/app/(public-watch)/video/[id]/_lib/video-watch-page-utils';

const detail: ExampleWatchDetail = {
  id: 'locale-example', title: 'Original example title', prompt: 'Original English prompt, kept verbatim.',
  videoUrl: 'https://media.maxvideoai.com/example.mp4', posterUrl: null, engineLabel: 'MiniMax Hailuo 02',
  watchHref: '/video/locale-example', modelHref: '/models/minimax-hailuo-02-text', recreateHref: '/app?from=locale-example',
  aspectRatio: '16:9', durationSec: 6, hasAudio: false, historicalCost: null, scenario: null, quotes: [], references: [],
  context: { intro: 'Original editorial description.', visualContext: null, negativePrompt: 'No text.', createdAt: '',
    details: [], controls: [], highlights: [], notes: [], engineDescription: '', engineBadges: [], keyframes: null,
    compareLinks: [{ href: '/ai-video-engines/minimax-hailuo-02-vs-veo-3-1', label: 'MiniMax vs Veo', reason: '' }] },
};
const page = {
  video: { id: detail.id, videoUrl: detail.videoUrl, thumbUrl: null, createdAt: '2026-11-01T00:00:00Z', durationSec: 6 },
  isEligible: true, entry: null,
  signals: { canonicalUrl: 'https://maxvideoai.com/video/locale-example', title: detail.title,
    videoObjectName: detail.title, metaDescription: detail.context.intro, durationSec: 6,
    parentPath: '/examples/hailuo', modelPath: detail.modelHref,
    breadcrumbs: [{ label: 'Home', href: '/' }, { label: 'Examples', href: '/examples' },
      { label: 'Hailuo', href: '/examples/hailuo' }, { label: detail.title }] },
  related: [{ id: 'related', href: '/video/related', title: 'Original related title', subtitle: 'Original related description', thumbUrl: null, engineLabel: 'MiniMax' }],
} as unknown as WatchPageData;

type RequestFixture = { cookies: Record<string, string>; detail: ExampleWatchDetail | null };
const requests = new AsyncLocalStorage<RequestFixture>();
const globals = globalThis as typeof globalThis & { __watchLocaleRequests?: typeof requests };

async function loadWatch() {
  // Only the request adapter and external quote/catalogue reads are controlled.
  // The watch composition, reader, continuation actions, paths and SEO are real.
  const mocks: Record<string, string> = {
    'next/headers': 'export async function cookies(){return {get(name){const value=globalThis.__watchLocaleRequests.getStore().cookies[name];return value===undefined?undefined:{value};}};}',
    '@/server/example-watch-detail-loader': 'export async function buildExampleWatchDetail(){await Promise.resolve();return globalThis.__watchLocaleRequests.getStore().detail;}',
    '@/server/video-seo': 'export async function getVideoWatchRelatedPages(page){return page.related;}',
  };
  const output = await build({
    entryPoints: ['frontend/app/(public-watch)/video/[id]/_components/VideoWatchContent.tsx'],
    bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic', tsconfig: 'frontend/tsconfig.json',
    plugins: [{ name: 'request-and-data-boundaries', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => Object.hasOwn(mocks, args.path) ? { path: args.path, namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'js' }));
    } }],
  });
  const module = { exports: {} as { VideoWatchContent: (props: { page: WatchPageData; deferRelated?: boolean }) => Promise<React.ReactElement> } };
  new Function('module', 'exports', 'require', output.outputFiles[0].text)(module, module.exports, createRequire(resolve('frontend/package.json')));
  return module.exports.VideoWatchContent;
}

test('direct watch renders active-cookie UI and action links before hydration without changing original content or canonical schemas', async t => {
  globals.__watchLocaleRequests = requests;
  t.after(() => { delete globals.__watchLocaleRequests; });
  const Watch = await loadWatch();
  let schemas: unknown;
  for (const [cookies, locale, modelHref, examplesHref, homeHref, modelLabel, homeLabel] of [
    [{}, 'en', '/models/minimax-hailuo-02-text', '/examples', '/', 'Explore the model', 'Home'],
    [{ mvid_locale: 'fr', NEXT_LOCALE: 'es' }, 'fr', '/fr/modeles/minimax-hailuo-02-text', '/fr/galerie', '/fr', 'Découvrir le modèle', 'Accueil'],
    [{ mvid_locale: 'es', NEXT_LOCALE: 'fr' }, 'es', '/es/modelos/minimax-hailuo-02-text', '/es/galeria', '/es', 'Descubrir el modelo', 'Inicio'],
    [{ mvid_locale: 'en', NEXT_LOCALE: 'fr' }, 'en', '/models/minimax-hailuo-02-text', '/examples', '/', 'Explore the model', 'Home'],
    [{ mvid_locale: 'invalid', NEXT_LOCALE: 'invalid' }, 'en', '/models/minimax-hailuo-02-text', '/examples', '/', 'Explore the model', 'Home'],
    [{ mvid_locale: 'invalid', NEXT_LOCALE: 'es' }, 'es', '/es/modelos/minimax-hailuo-02-text', '/es/galeria', '/es', 'Descubrir el modelo', 'Inicio'],
    [{ NEXT_LOCALE: 'fr' }, 'fr', '/fr/modeles/minimax-hailuo-02-text', '/fr/galerie', '/fr', 'Découvrir le modèle', 'Accueil'],
  ] as const) {
    await t.test(JSON.stringify(cookies), async () => requests.run({ cookies, detail }, async () => {
      const dom = new JSDOM(renderToStaticMarkup(await Watch({ page })));
      t.after(() => dom.window.close());
      const doc = dom.window.document;
      assert.equal(doc.querySelector('.video-reader-modelLink')?.textContent, modelLabel);
      assert.equal(doc.querySelector('.video-reader-modelLink')?.getAttribute('href'), modelHref);
      assert.equal(doc.querySelector('h1')?.textContent, detail.title);
      assert.equal(doc.querySelector('#example-reader-prompt')?.textContent, detail.prompt);
      assert.ok(doc.body.textContent?.includes(detail.context.intro));
      assert.ok(doc.body.textContent?.includes(detail.context.negativePrompt!));
      const breadcrumbs = [...doc.querySelectorAll('nav a')];
      assert.deepEqual(breadcrumbs.map(a => a.getAttribute('href')), [homeHref, examplesHref, `${examplesHref}/hailuo`]);
      assert.equal(breadcrumbs[0].textContent, homeLabel);
      assert.equal(doc.querySelector('.video-reader-primary')?.getAttribute('href'), '/app?from=locale-example');
      const studio = doc.querySelector('a[href^="/app/studio?"]');
      assert.equal(studio?.getAttribute('href'), `/app/studio?example=locale-example&lang=${locale}`);
      const compare = [...doc.querySelectorAll('a')].find(a => a.textContent === 'MiniMax vs Veo');
      assert.equal(compare?.getAttribute('href'), locale === 'fr' ? '/fr/comparatif/minimax-hailuo-02-vs-veo-3-1' : locale === 'es' ? '/es/comparativa/minimax-hailuo-02-vs-veo-3-1' : '/ai-video-engines/minimax-hailuo-02-vs-veo-3-1');
      assert.ok(doc.querySelector(`a[href="${examplesHref}"]:not(nav a)`), 'the related-gallery action uses the same locale');
      assert.equal(doc.querySelector('a[href="/video/related"]')?.getAttribute('href'), '/video/related');
      const currentSchemas = [...doc.querySelectorAll('script[type="application/ld+json"]')].map(script => JSON.parse(script.textContent!));
      if (schemas) assert.deepEqual(currentSchemas, schemas, 'one canonical watch and shared editorial SEO across visitor languages');
      schemas = currentSchemas;
      assert.equal(currentSchemas[0].url, 'https://maxvideoai.com/video/locale-example');
      const request = new NextRequest('https://maxvideoai.com/app?engine=minimax-hailuo-02-text', {
        headers: { referer: `https://maxvideoai.com${modelHref}`, cookie: 'mvid_locale=invalid', 'sec-fetch-dest': 'document' },
      });
      const response = createCoreLocaleResponse(request, '/app');
      assert.equal(response?.cookies.get('mvid_locale')?.value, locale, 'localized model -> composer uses the existing handoff contract');
      assert.equal(request.nextUrl.searchParams.get('engine'), 'minimax-hailuo-02-text');
    }));
  }
  const html = await Promise.all(['es', 'fr', 'en', 'fr'].map(locale => requests.run({ cookies: { mvid_locale: locale }, detail }, async () => renderToStaticMarkup(await Watch({ page })))));
  assert.deepEqual(html.map(value => { const dom = new JSDOM(value); try { return dom.window.document.querySelector('a[href^="/app/studio?"]')?.getAttribute('href'); } finally { dom.window.close(); } }),
    ['/app/studio?example=locale-example&lang=es', '/app/studio?example=locale-example&lang=fr', '/app/studio?example=locale-example&lang=en', '/app/studio?example=locale-example&lang=fr'], 'concurrent requests and returning to the same URL read their own preference');
  const deferred = await requests.run({ cookies: { mvid_locale: 'fr' }, detail }, () => Watch({ page, deferRelated: true }));
  assert.ok(React.Children.toArray(deferred.props.children).some(node => React.isValidElement(node) && node.type === React.Suspense), 'optional related reads remain behind Suspense');
});
