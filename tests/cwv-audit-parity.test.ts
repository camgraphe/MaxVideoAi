import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { isCrawlerUserAgent } from '../frontend/lib/crawler-user-agent';
import { NextRequest } from 'next/server';
import { middleware } from '../frontend/middleware';

const require = createRequire(import.meta.url);
const frontendRequire = createRequire(resolve('frontend/package.json'));
const chrome = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36';

test('public routing serves the same target to Chrome and Lighthouse across locale families', async () => {
  for (const path of ['/pricing', '/examples', '/docs/mcp', '/models/veo-3-1', '/fr/tarifs', '/es/modelos/veo-3-1']) {
    const outcomes = [];
    for (const suffix of ['', ' Chrome-Lighthouse', ' HeadlessChrome/153.0.0.0']) {
      const response = await middleware(new NextRequest('https://maxvideoai.com' + path, {
        headers: { host: 'maxvideoai.com', 'user-agent': chrome + suffix, 'accept-language': 'fr-FR,fr;q=0.9' },
      }));
      outcomes.push({ status: response.status, location: response.headers.get('location'), rewrite: response.headers.get('x-middleware-rewrite'), next: response.headers.get('x-middleware-next') });
    }
    assert.deepEqual(outcomes[1], outcomes[0], path);
    assert.deepEqual(outcomes[2], outcomes[0], path + ' headless browser');
  }
});

test('performance audits retain the same media eligibility as Chrome', () => {
  for (const ua of [chrome, chrome + ' Chrome-Lighthouse', chrome.replace('Chrome/', 'HeadlessChrome/')]) {
    assert.equal(isCrawlerUserAgent(ua), false, ua);
  }
  assert.equal(isCrawlerUserAgent('Googlebot/2.1 (+http://www.google.com/bot.html)'), true);
});

test('real GA and GTM loaders obey consent equally for Chrome and performance audits', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'cwv-consent-'));
  const output = join(directory, 'loaders.cjs');
  try {
    await build({
      stdin: { contents: "export {default as GA} from './frontend/components/analytics/ConsentModeBootstrap'; export {GtmLazyLoader as GTM} from './frontend/components/analytics/GtmLazyLoader';", resolveDir: process.cwd() },
      outfile: output, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic',
      tsconfig: 'frontend/tsconfig.json', packages: 'external',
      define: {
        'process.env.NEXT_PUBLIC_GA_ID': '"G-CWVTEST"',
        'process.env.NEXT_PUBLIC_GTM_ID': '"GTM-CWVTEST"',
        'process.env.NEXT_PUBLIC_DISABLE_GA': '"0"',
        'process.env.NEXT_PUBLIC_DISABLE_GTM': '"0"',
        // Preserve the development React renderer while exercising enabled production loaders.
        'process.env.NODE_ENV': '"development"',
      },
      plugins: [{ name: 'next-route-context', setup(builder) {
        builder.onResolve({ filter: /.*/ }, args => {
          if (args.path === 'next/navigation' || args.path === 'next/script') return { path: args.path, namespace: 'route' };
          if (args.path === 'react' || args.path.startsWith('react/')) return { path: require.resolve(args.path), external: true };
          if (!args.path.startsWith('.') && !args.path.startsWith('/') && !args.path.startsWith('@/')) return { path: frontendRequire.resolve(args.path), external: true };
        });
        builder.onLoad({ filter: /.*/, namespace: 'route' }, args => ({ contents: args.path === 'next/navigation'
          ? 'export const usePathname=()=>window.location.pathname;'
          : "import {createElement} from 'react'; export default function Script({src,id}){return createElement('script',{src,id});}", loader: 'js' }));
      } }],
    });
    for (const [label, ua, path] of [
      ['Chrome', chrome, '/pricing'],
      ['Lighthouse', chrome + ' Chrome-Lighthouse', '/pricing'],
      ['legacy query', chrome, '/pricing?lh-mode=1'],
      ['excluded admin', chrome + ' Chrome-Lighthouse', '/admin'],
    ]) {
      for (const granted of [false, true]) {
        await t.test(label + ' / consent ' + granted, async () => {
          // Next's delivery/cache is the boundary; both application consent loaders run unchanged.
          const { GA, GTM } = require(output);
          const dom = new JSDOM('<div id="root"></div>', { url: 'https://maxvideoai.com' + path });
          Object.defineProperty(dom.window.navigator, 'userAgent', { value: ua });
          if (granted) dom.window.localStorage.setItem('mv-consent-analytics', 'granted');
          const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, self: dom.window, React, IS_REACT_ACT_ENVIRONMENT: true };
          const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
          for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
          const root = createRoot(dom.window.document.getElementById('root')!);
          try {
            await act(async () => { root.render(React.createElement(React.Fragment, null, React.createElement(GA), React.createElement(GTM, { delayMs: 0 }))); });
            await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
            const shouldLoad = granted && path !== '/admin';
            assert.equal(Boolean(dom.window.document.querySelector('script[src*="/gtag/js?id=G-CWVTEST"]')), shouldLoad, 'GA network script follows consent');
            assert.equal(Boolean(dom.window.document.querySelector('script[src*="/gtm.js?id=GTM-CWVTEST"]')), shouldLoad, 'GTM network script follows consent');
          } finally {
            await act(async () => { root.unmount(); });
            dom.window.close();
            for (const [key, descriptor] of saved) {
              if (descriptor) Object.defineProperty(globalThis, key, descriptor);
              else Reflect.deleteProperty(globalThis, key);
            }
          }
        });
      }
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
