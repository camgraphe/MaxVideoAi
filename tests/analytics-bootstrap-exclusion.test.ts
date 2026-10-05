import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const frontendRequire = createRequire(resolve('frontend/package.json'));

test('fresh consented marketing loaders suppress a stored admin before GA init or GTM insertion and restore after eligible resolution', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'analytics-bootstrap-'));
  const output = join(directory, 'bootstrap.cjs');
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://maxvideoai.com/integrations/claude', runScripts: 'dangerously' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  let root: ReturnType<typeof createRoot> | undefined;
  const idleCallbacks = new Map<number, IdleRequestCallback>();
  const timers = new Map<number, () => void>();
  let nextIdle = 1;
  let nextTimer = 1;
  try {
    await build({
      stdin: { contents: "export {default as Bootstrap} from './frontend/components/analytics/ConsentModeBootstrap'; export {GtmLazyLoader as GTM} from './frontend/components/analytics/GtmLazyLoader'; export {resolveBrowserCommercialAnalyticsAuthContext as resolveRole} from './frontend/lib/analytics/commercial-client';", resolveDir: process.cwd() },
      outfile: output, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', packages: 'external', tsconfig: 'frontend/tsconfig.json',
      define: { 'process.env.NEXT_PUBLIC_GA_ID': '"G-BOOTSTRAP-LOCAL"', 'process.env.NEXT_PUBLIC_GTM_ID': '"GTM-BOOTSTRAP-LOCAL"', 'process.env.NEXT_PUBLIC_DISABLE_GA': '"0"', 'process.env.NEXT_PUBLIC_DISABLE_GTM': '"0"', 'process.env.NODE_ENV': '"development"' },
      plugins: [{ name: 'resolved-runtime-boundaries', setup(builder) {
        builder.onResolve({ filter: /.*/ }, args => {
          if (args.path === 'next/navigation') return { path: args.path, namespace: 'route' };
          if (args.path === 'react' || args.path.startsWith('react/')) return { path: require.resolve(args.path), external: true };
          if (!args.path.startsWith('.') && !args.path.startsWith('/') && !args.path.startsWith('@/')) return { path: frontendRequire.resolve(args.path), external: true };
        });
        builder.onLoad({ filter: /.*/, namespace: 'route' }, () => ({ contents: 'export const usePathname=()=>window.location.pathname;', loader: 'js' }));
      } }],
    });
    for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, self: dom.window, React, IS_REACT_ACT_ENVIRONMENT: true })) {
      saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, { configurable: true, value });
    }
    saved.set('fetch', Object.getOwnPropertyDescriptor(globalThis, 'fetch'));
    dom.window.localStorage.setItem('mv-consent-analytics', 'granted');
    dom.window.sessionStorage.setItem('mvai.analytics-excluded-admin.v1', '1');
    Object.defineProperty(dom.window, 'requestIdleCallback', { configurable: true, value: (callback: IdleRequestCallback) => { const id = nextIdle++; idleCallbacks.set(id, callback); return id; } });
    Object.defineProperty(dom.window, 'cancelIdleCallback', { configurable: true, value: (id: number) => idleCallbacks.delete(id) });
    Object.defineProperty(dom.window, 'setTimeout', { configurable: true, value: (callback: () => void) => { const id = nextTimer++; timers.set(id, callback); return id; } });
    Object.defineProperty(dom.window, 'clearTimeout', { configurable: true, value: (id: number) => timers.delete(id) });
    const { Bootstrap, GTM, resolveRole } = require(output);
    root = createRoot(document.getElementById('root')!);
    await act(async () => root!.render(React.createElement(React.Fragment, null, React.createElement(Bootstrap), React.createElement(GTM, { delayMs: 0 }))));
    await act(async () => { dom.window.dispatchEvent(new dom.window.Event('load')); for (const callback of idleCallbacks.values()) callback({ didTimeout: false, timeRemaining: () => 50 }); idleCallbacks.clear(); for (const callback of timers.values()) callback(); timers.clear(); });
    assert.equal(document.querySelector('script[src*="googletagmanager.com/gtm.js"]'), null, 'the root container cannot bypass known account exclusion');
    assert.equal(document.querySelector('script#ga-init'), null, 'known excluded document never initializes GA');
    assert.equal(document.querySelector('script[src*="googletagmanager.com/gtag/js"]'), null);
    assert.equal((dom.window as unknown as Record<string, unknown>)['ga-disable-G-BOOTSTRAP-LOCAL'], true);
    assert.equal(dom.window.dataLayer, undefined, 'no inline GA commands have executed');
    let release!: (response: Response) => void;
    globalThis.fetch = async () => new Promise((done) => { release = done; });
    const ordinaryRole = resolveRole('ordinary-account', 'local-fixture', {});
    await Promise.resolve();
    assert.equal(document.querySelector('script#ga-init'), null, 'pending role read cannot restore a stored exclusion');
    const disableAtInit: unknown[] = [];
    const appendChild = document.body.appendChild.bind(document.body);
    document.body.appendChild = ((node: Node) => {
      if (node instanceof dom.window.HTMLScriptElement && node.id === 'ga-init') disableAtInit.push((dom.window as unknown as Record<string, unknown>)['ga-disable-G-BOOTSTRAP-LOCAL']);
      return appendChild(node);
    }) as typeof document.body.appendChild;
    await act(async () => { release(new Response(JSON.stringify({ ok: false, commercialAnalyticsEligible: true }))); await ordinaryRole; });
    assert.ok(document.querySelector('script#ga-init'));
    assert.deepEqual(disableAtInit, [false], 'eligible restoration clears disable before actual Next script initialization');
    await act(async () => { dom.window.dispatchEvent(new dom.window.Event('load')); for (const callback of idleCallbacks.values()) callback({ didTimeout: false, timeRemaining: () => 50 }); idleCallbacks.clear(); for (const callback of timers.values()) callback(); timers.clear(); });
    assert.ok(document.querySelector('script[src*="googletagmanager.com/gtag/js?id=G-BOOTSTRAP-LOCAL"]'));
    assert.ok(document.querySelector('script[src*="googletagmanager.com/gtm.js?id=GTM-BOOTSTRAP-LOCAL"]'));
    assert.equal(dom.window.sessionStorage.getItem('mvai.analytics-excluded-admin.v1'), null);
  } finally {
    if (root) await act(async () => root!.unmount());
    dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
    await rm(directory, { recursive: true, force: true });
  }
});
