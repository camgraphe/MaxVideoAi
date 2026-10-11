import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';

type RuntimeProps = {
  children?: unknown; locale?: string; dictionary?: Record<string, unknown>; fallback?: Record<string, unknown>;
  fontClass?: string; json?: Record<string, unknown>;
};
type Element = { type: string | ((props: RuntimeProps) => unknown); props: RuntimeProps };
type RecordedFont = { src: string; directory: string; variable: string; display: string; weight: string; preload: boolean };
type Fixture = { cookies: Record<string, string>; messages: Record<string, Record<string, unknown>>; reads: string[]; fonts: RecordedFont[] };
const globals = globalThis as typeof globalThis & { __watchRuntimeFixture?: Fixture };

async function loadLayout(entry: string) {
  const fixture = 'globalThis.__watchRuntimeFixture';
  // Request adapters and client serialization leaves are the only doubles. The
  // dictionary resolver, namespace picker, schemas and layout composition are real.
  const mocks: Record<string, string> = {
    'react/jsx-runtime': 'export const Fragment="fragment";export const jsx=(type,props)=>({type,props});export const jsxs=jsx;',
    'next/headers': `export async function cookies(){return {get(name){const value=${fixture}.cookies[name];return value===undefined?undefined:{value};}};}`,
    'next-intl/server': `export async function getMessages({locale}){${fixture}.reads.push(locale);return ${fixture}.messages[locale];}export async function getLocale(){throw Error('Cookie runtime must select its own locale');}`,
    '@vercel/analytics/react': 'export const Analytics="VercelAnalytics";',
  };
  for (const [path, name] of [
    ['components/AppExperienceRoot', 'AppExperienceRoot'],
    ['components/analytics/AnalyticsScripts', 'AnalyticsScripts'],
    ['components/analytics/GA4EventBridge', 'GA4EventBridge'],
    ['components/analytics/GA4RouteTracker', 'GA4RouteTracker'],
    ['components/legal/CookieBanner', 'CookieBanner'],
    ['components/SeoJsonLd', 'JsonLd'],
    ['components/auth/SessionWatchdog', 'SessionWatchdog'],
    ['components/swr/SWRFocusResync', 'SWRFocusResync'],
    ['components/swr/SWRProvider', 'SWRProvider'],
    ['lib/i18n/I18nProvider', 'I18nProvider'],
    ['components/i18n/LocaleSync', 'LocaleSync'],
  ]) mocks[`@/${path}`] = `export const ${name}=${JSON.stringify(name)};export default ${name};`;
  mocks['@/components/analytics/ConsentModeBootstrap'] = 'export default "ConsentModeBootstrap";';
  const output = await build({
    entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
    jsx: 'automatic', tsconfig: 'frontend/tsconfig.json',
    define: { 'process.env.NODE_ENV': '"production"', 'process.env.VERCEL_ENV': '"production"' },
    plugins: [{ name: 'watch-request-client-boundaries', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => {
        if (Object.hasOwn(mocks, args.path)) return { path: args.path, namespace: 'fixture' };
        if (args.path.endsWith('.css')) return { path: args.path, namespace: 'style' };
        if (args.path === 'next/font/local') return { path: args.path, namespace: 'font', pluginData: dirname(args.importer) };
      });
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'js' }));
      builder.onLoad({ filter: /.*/, namespace: 'style' }, () => ({ contents: '', loader: 'js' }));
      builder.onLoad({ filter: /.*/, namespace: 'font' }, args => ({
        contents: `export default options=>{${fixture}.fonts.push({...options,directory:${JSON.stringify(args.pluginData)}});return {variable:"fixture-font"};};`, loader: 'js',
      }));
    } }],
  });
  const compiledModule = { exports: {} as {
    default: (props: { children: unknown }) => unknown;
    metadata: { title: { template: string } }; viewport: Record<string, unknown>;
  } };
  new Function('module', 'exports', 'require', output.outputFiles[0].text)(compiledModule, compiledModule.exports, createRequire(resolve('frontend/package.json')));
  return compiledModule.exports;
}

async function expand(node: unknown): Promise<Element[]> {
  if (!node) return [];
  if (Array.isArray(node)) return (await Promise.all(node.map(expand))).flat();
  if (typeof node !== 'object' || !('type' in node)) return [];
  const element = node as Element;
  if (typeof element.type === 'function') return expand(await element.type(element.props));
  return [element, ...await expand(element.props?.children)];
}

test('Core keeps full messages while direct watch serializes only navigation and English fallback', async t => {
  const messages = Object.fromEntries(['en', 'fr', 'es'].map(locale => [locale,
    JSON.parse(readFileSync(`frontend/messages/${locale}.json`, 'utf8')) as Record<string, unknown>,
  ]));
  const watchEntry = 'frontend/app/(public-watch)/layout.tsx';
  t.after(() => { delete globals.__watchRuntimeFixture; });
  for (const [cookies, locale] of [
    [{}, 'en'], [{ mvid_locale: 'en', NEXT_LOCALE: 'fr' }, 'en'],
    [{ mvid_locale: 'fr', NEXT_LOCALE: 'es' }, 'fr'], [{ mvid_locale: 'es', NEXT_LOCALE: 'en' }, 'es'],
    [{ NEXT_LOCALE: 'fr' }, 'fr'], [{ mvid_locale: 'invalid', NEXT_LOCALE: 'es' }, 'es'],
    [{ mvid_locale: 'FR', NEXT_LOCALE: 'en' }, 'en'], [{ mvid_locale: 'invalid', NEXT_LOCALE: 'invalid' }, 'en'],
  ] as const) {
    for (const [group, entry] of [['core', 'frontend/app/(core)/layout.tsx'], ['watch', watchEntry]]) {
      await t.test(`${group} ${JSON.stringify(cookies)} resolves ${locale}`, async () => {
        const fixture: Fixture = { cookies, messages, reads: [], fonts: [] };
        globals.__watchRuntimeFixture = fixture;
        const layout = await loadLayout(entry);
        const nodes = await expand(await layout.default({ children: { type: 'reader', props: {} } }));
        const providers = nodes.filter(node => node.type === 'I18nProvider');
        assert.equal(providers.length, 1, 'exactly one client dictionary serialization boundary');
        const props = providers[0].props;
        assert.ok(props.dictionary && props.fallback);
        assert.equal(props.locale, locale);
        assert.deepEqual(Object.keys(props.dictionary).sort(), group === 'watch' ? ['footer', 'nav'] : Object.keys(messages[locale]).sort());
        assert.deepEqual(Object.keys(props.fallback).sort(), group === 'watch' ? ['footer', 'nav'] : Object.keys(messages.en).sort());
        assert.deepEqual(props.dictionary.nav, messages[locale].nav);
        assert.deepEqual(props.dictionary.footer, messages[locale].footer);
        assert.deepEqual(props.fallback.nav, messages.en.nav);
        assert.deepEqual(props.fallback.footer, messages.en.footer);
        assert.equal(props.dictionary === props.fallback, locale === 'en', 'EN must reuse the same serialized object');
        assert.deepEqual(fixture.reads, locale === 'en' ? ['en'] : [locale, 'en']);
        assert.deepEqual(nodes.map(node => node.type), [
          'fragment', 'ConsentModeBootstrap', 'GA4RouteTracker', 'GA4EventBridge', 'I18nProvider',
          'SWRProvider', 'LocaleSync', 'SessionWatchdog', 'SWRFocusResync', 'AppExperienceRoot', 'reader',
          'VercelAnalytics', 'AnalyticsScripts', 'CookieBanner', 'JsonLd', 'JsonLd',
        ], 'one runtime retains provider/effect order and all analytics/consent leaves');
        assert.equal(nodes.find(node => node.type === 'AppExperienceRoot')?.props.fontClass, 'fixture-font');
        assert.equal(fixture.fonts.length, 1);
        const { src, directory, ...fontOptions } = fixture.fonts[0];
        assert.equal(resolve(directory, src), resolve('frontend/app/(core)/_fonts/GeistLatin.woff2'));
        assert.deepEqual(fontOptions, { variable: '--font-app', display: 'swap', weight: '100 900', preload: false });
        const schemas = nodes.filter(node => node.type === 'JsonLd').map(node => node.props.json!);
        assert.equal(schemas[0]['@id'], 'https://maxvideoai.com/#organization');
        assert.deepEqual(schemas[1], { '@context': 'https://schema.org', '@type': 'WebSite', url: 'https://maxvideoai.com/', name: 'MaxVideoAI' });
        assert.equal(layout.metadata.title.template, '%s — MaxVideoAI');
        assert.deepEqual(layout.viewport, { themeColor: '#4F5D75' });
      });
    }
  }
});
