import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';

test('analytics-only consent does not configure Ads; granting advertising enables the real tag once', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'analytics-consent-'));
  const requireFrontend = createRequire(resolve('frontend/package.json'));
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://maxvideoai.com/models/seedance-2-5' });
  const configured: unknown[][] = [];
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, React, IS_REACT_ACT_ENVIRONMENT: true, fetch: async () => new Response(JSON.stringify({ ok: true, version: 'fixture' })) };
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let root: ReturnType<typeof createRoot> | undefined;
  try {
    const output = join(directory, 'analytics.cjs');
    await build({
      stdin: { contents: "export {AnalyticsScripts} from './frontend/components/analytics/AnalyticsScripts';", resolveDir: process.cwd() },
      outfile: output, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', packages: 'external', tsconfig: 'frontend/tsconfig.json',
      define: { 'process.env.NEXT_PUBLIC_GOOGLE_ADS_ID': '"AW-CONSENT-FIXTURE"' },
      plugins: [{ name: 'framework-and-non-ads-boundaries', setup(builder) {
        const boundaries: Record<string, string> = {
          'next/navigation': "export const usePathname=()=>'/models/seedance-2-5';",
          'next/dynamic': "import React from 'react';export default function dynamic(load){const Lazy=React.lazy(()=>Promise.resolve(load()).then(component=>({default:component.default??component})));return function Deferred(props){return React.createElement(React.Suspense,{fallback:null},React.createElement(Lazy,props));};}",
          '@/components/analytics/Clarity': 'export const Clarity=()=>null;',
          '@vercel/speed-insights/next': 'export const SpeedInsights=()=>null;',
        };
        builder.onResolve({ filter: /.*/ }, args => {
          if (args.path in boundaries) return { path: args.path, namespace: 'boundary' };
          if (!args.path.startsWith('.') && !args.path.startsWith('/') && !args.path.startsWith('@/')) return { path: requireFrontend.resolve(args.path), external: true };
        });
        builder.onLoad({ filter: /.*/, namespace: 'boundary' }, args => ({ contents: boundaries[args.path], loader: 'js' }));
      } }],
    });
    for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    (dom.window as unknown as { gtag: (...args: unknown[]) => void }).gtag = (...args) => configured.push(args);
    const consent = (analytics: boolean, ads: boolean) => {
      const record = { version: 'fixture', timestamp: 1, categories: { analytics, ads }, source: 'preferences' };
      dom.window.document.cookie = `mv-consent=${encodeURIComponent(JSON.stringify(record))}; Path=/`;
      dom.window.dispatchEvent(new dom.window.CustomEvent('consent:updated', { detail: record }));
    };
    consent(true, false);
    const { AnalyticsScripts } = requireFrontend(output);
    root = createRoot(dom.window.document.getElementById('root')!);
    await act(async () => root!.render(React.createElement(AnalyticsScripts)));
    assert.deepEqual(configured, [], 'an analytics choice must not configure the advertising destination');
    await act(async () => consent(true, true));
    assert.deepEqual(configured, [['config', 'AW-CONSENT-FIXTURE', { allow_enhanced_conversions: false }]]);
    await act(async () => consent(true, false));
    await act(async () => consent(true, true));
    assert.equal(configured.length, 1, 'reopening the gate must preserve destination deduplication');
  } finally {
    if (root) await act(async () => root!.unmount());
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    await rm(directory, { recursive: true, force: true });
  }
});
