import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { setImmediate as nextTurn } from 'node:timers/promises';
import test from 'node:test';
import { build } from 'esbuild';

type QuoteContext = { engines: unknown[]; quote: () => Promise<{ totalCents: number; currency: string }> };
type Fixture = {
  loadPage: () => Promise<unknown>;
  loadQuotes: () => Promise<QuoteContext>;
  renderable: boolean;
  redirect: string | null;
  events: string[];
};
type Outcome = { kind: 'returned'; value: any } | { kind: 'threw'; error: unknown };

function deferred<T>() {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>(resolve => { resolvePromise = resolve; });
  return { promise, resolve: resolvePromise };
}

async function loadRealRoute() {
  // Compile the actual route in memory. Only its readers, navigation sentinels and
  // JSX boundaries are replaced; no browser, file artifact or database is needed.
  const fixture = 'globalThis.__videoPageQuoteRouteFixture';
  const mocks: Record<string, string> = {
    react: 'export const cache = fn => fn;',
    'react/jsx-runtime': 'export const jsx = (type, props) => ({type, props}); export const jsxs = jsx;',
    'next/navigation': 'export function notFound(){throw Error("NOT_FOUND")} export function permanentRedirect(path){throw Error("REDIRECT:"+path)}',
    '@/server/video-seo': `export async function getVideoWatchPageDataById(){const f=${fixture};f.events.push('watch');return f.loadPage();}`,
    '@/server/example-watch-detail-loader': `export async function prepareExampleWatchDetailContext(){const f=${fixture};f.events.push('quotes');return f.loadQuotes();}`,
    '@/lib/video-seo-canonical': `export const buildExpectedVideoCanonicalUrl=()=>"https://example.test/video/job";export const getVideoCanonicalRedirectPath=()=>${fixture}.redirect;`,
    './_components/VideoUnavailableState': 'export const VideoUnavailableState="unavailable";',
    './_components/VideoWatchContent': 'export const VideoWatchContent="watch-content";',
    './_lib/video-watch-page-utils': `export const FALLBACK_THUMB="";export const TITLE_SUFFIX="";export const buildMetaTitle=x=>x;export const isRenderable=()=>${fixture}.renderable;export const parseAspectRatio=()=>null;export const toAbsoluteUrl=x=>x;`,
  };
  const output = await build({
    entryPoints: ['frontend/app/(public-watch)/video/[id]/page.tsx'],
    bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
    jsx: 'automatic', tsconfig: 'frontend/tsconfig.json',
    plugins: [{ name: 'controlled-watch-route-readers', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => Object.hasOwn(mocks, args.path)
        ? { path: args.path, namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'js' }));
    } }],
  });
  const module = { exports: {} as { default: (props: { params: Promise<{ id: string }> }) => Promise<unknown> } };
  new Function('module', 'exports', 'require', output.outputFiles[0].text)(
    module, module.exports, createRequire(resolve('frontend/package.json')),
  );
  return module.exports.default;
}

test('watch route guards do not depend on speculative quote preparation', async t => {
  const route = await loadRealRoute();
  const globals = globalThis as typeof globalThis & { __videoPageQuoteRouteFixture?: Fixture };
  t.after(() => { delete globals.__videoPageQuoteRouteFixture; });
  const page = { video: { id: 'job' }, signals: { parentPath: '/examples', canonicalSlug: 'approved-slug' }, isEligible: true };
  const context: QuoteContext = { engines: [], quote: async () => ({ totalCents: 401, currency: 'USD' }) };
  function start(fixture: Fixture) {
    globals.__videoPageQuoteRouteFixture = fixture;
    let outcome: Outcome | undefined;
    // Observe both outcomes immediately, including deliberate navigation throws.
    const completion = route({ params: Promise.resolve({ id: 'job' }) }).then(
      value => { outcome = { kind: 'returned', value }; },
      error => { outcome = { kind: 'threw', error }; },
    );
    return { completion, outcome: () => outcome };
  }

  for (const priceState of ['rejected', 'pending'] as const) {
    for (const scenario of ['missing', 'private', 'canonical redirect', 'unavailable'] as const) {
      await t.test(`${scenario} ignores ${priceState} quote context`, async () => {
        const pending = deferred<QuoteContext>();
        const fixture: Fixture = {
          // Private videos are excluded by the unchanged public watch-data owner.
          loadPage: async () => scenario === 'missing' || scenario === 'private' ? null : page,
          loadQuotes: priceState === 'pending' ? () => pending.promise : async () => { throw Error('Quote catalog unavailable'); },
          renderable: scenario !== 'unavailable',
          redirect: scenario === 'canonical redirect' ? '/video/approved-slug' : null,
          events: [],
        };
        const request = start(fixture);
        await nextTurn();
        const outcome = request.outcome();
        assert.ok(outcome, 'the watch-data guard must finish while quote preparation is still pending');
        assert.equal(fixture.events.filter(event => event === 'watch').length, 1);
        assert.equal(fixture.events.filter(event => event === 'quotes').length, 1);
        if (scenario === 'unavailable') {
          assert.equal(outcome.kind, 'returned');
          if (outcome.kind === 'returned') assert.deepEqual(outcome.value, { type: 'unavailable', props: { backHref: '/examples' } });
        } else {
          assert.equal(outcome.kind, 'threw');
          if (outcome.kind === 'threw') assert.equal((outcome.error as Error).message,
            scenario === 'canonical redirect' ? 'REDIRECT:/video/approved-slug' : 'NOT_FOUND');
        }
        await request.completion;
      });
    }
  }

  await t.test('a valid render waits for both reads and receives its exact quote context', async () => {
    const watch = deferred<typeof page>();
    const quotes = deferred<QuoteContext>();
    const fixture: Fixture = { loadPage: () => watch.promise, loadQuotes: () => quotes.promise, renderable: true, redirect: null, events: [] };
    const request = start(fixture);
    await nextTurn();
    assert.deepEqual([...fixture.events].sort(), ['quotes', 'watch'], 'both reads start before either is released');
    assert.equal(request.outcome(), undefined);
    watch.resolve(page);
    await nextTurn();
    assert.equal(request.outcome(), undefined, 'valid content still requires its configured quote context');
    quotes.resolve(context);
    await request.completion;
    const outcome = request.outcome();
    assert.equal(outcome?.kind, 'returned');
    if (outcome?.kind === 'returned') {
      assert.equal(outcome.value.type, 'watch-content');
      assert.equal(outcome.value.props.page, page);
      assert.equal(outcome.value.props.quoteContext, context);
    }
  });

  await t.test('a rejected quote is handled immediately but still rejects a valid render', async () => {
    const watch = deferred<typeof page>();
    const failure = Error('Quote catalog unavailable');
    const fixture: Fixture = {
      loadPage: () => watch.promise, loadQuotes: async () => { throw failure; },
      renderable: true, redirect: null, events: [],
    };
    const request = start(fixture);
    await nextTurn();
    assert.equal(request.outcome(), undefined, 'quote failure must not run ahead of the watch-data guards');
    watch.resolve(page);
    await request.completion;
    const outcome = request.outcome();
    assert.equal(outcome?.kind, 'threw');
    if (outcome?.kind === 'threw') assert.equal(outcome.error, failure);
  });
});
