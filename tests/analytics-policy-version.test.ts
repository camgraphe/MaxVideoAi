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

test('GA and GTM wait for the policy even with a persisted granted flag, then reject an expired choice', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'analytics-policy-'));
  const frontendRequire = createRequire(resolve('frontend/package.json'));
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://maxvideoai.com/pricing', runScripts: 'dangerously' });
  let release!: (response: Response) => void;
  const policy = new Promise<Response>(resolve => { release = resolve; });
  const idle: Array<() => void> = [];
  Object.defineProperty(dom.window, 'requestIdleCallback', { value: (callback: () => void) => { idle.push(callback); return idle.length; } });
  Object.defineProperty(dom.window, 'cancelIdleCallback', { value: () => {} });
  const globals = { window: dom.window, document: dom.window.document, CustomEvent: dom.window.CustomEvent, React, IS_REACT_ACT_ENVIRONMENT: true, fetch: () => policy };
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let root: ReturnType<typeof createRoot> | undefined;
  try {
    const output = join(directory, 'loaders.cjs');
    await build({
      stdin: { contents: "export {default as GA} from './frontend/components/analytics/ConsentModeBootstrap';export {GtmLazyLoader as GTM} from './frontend/components/analytics/GtmLazyLoader';export {applyStoredConsentEffects} from './frontend/components/legal/cookie-banner-client';", resolveDir: process.cwd() },
      outfile: output, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', packages: 'external', tsconfig: 'frontend/tsconfig.json',
      define: { 'process.env.NEXT_PUBLIC_GA_ID': '"G-POLICY-FIXTURE"', 'process.env.NEXT_PUBLIC_GTM_ID': '"GTM-POLICY-FIXTURE"', 'process.env.NEXT_PUBLIC_DISABLE_GA': '"0"', 'process.env.NEXT_PUBLIC_DISABLE_GTM': '"0"', 'process.env.NODE_ENV': '"development"' },
      plugins: [{ name: 'route-boundary', setup(builder) {
        builder.onResolve({ filter: /.*/ }, args => {
          if (args.path === 'next/navigation') return { path: args.path, namespace: 'route' };
          if (!args.path.startsWith('.') && !args.path.startsWith('/') && !args.path.startsWith('@/')) return { path: frontendRequire.resolve(args.path), external: true };
        });
        builder.onLoad({ filter: /.*/, namespace: 'route' }, () => ({ contents: 'export const usePathname=()=>window.location.pathname;', loader: 'js' }));
      } }],
    });
    for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    dom.window.document.cookie = `mv-consent=${encodeURIComponent(JSON.stringify({ version: 'expired', timestamp: 1, categories: { analytics: true, ads: true }, source: 'banner' }))}; Path=/`;
    dom.window.localStorage.setItem('mv-consent-analytics', 'granted');
    const { GA, GTM, applyStoredConsentEffects } = frontendRequire(output);
    root = createRoot(dom.window.document.getElementById('root')!);
    await act(async () => root!.render(React.createElement(React.Fragment, null, React.createElement(GA), React.createElement(GTM, { delayMs: 0 }))));
    const drain = async () => { await act(async () => { dom.window.dispatchEvent(new dom.window.Event('load')); idle.splice(0).forEach(callback => callback()); await new Promise(resolve => setTimeout(resolve, 20)); }); };
    await drain();
    assert.equal(dom.window.document.querySelectorAll('script[src*="googletagmanager.com"]').length, 0, 'pending validation cannot be bypassed by load, idle or the GTM timer');
    await act(async () => { release(new Response(JSON.stringify({ ok: true, version: 'current' }))); await policy; });
    await drain();
    assert.equal(dom.window.document.querySelectorAll('script[src*="googletagmanager.com"]').length, 0, 'expired consent remains inactive even if the stored flag is granted');
    const current = { version: 'current', timestamp: 2, categories: { analytics: true, ads: false }, source: 'preferences' };
    await act(async () => {
      dom.window.document.cookie = `mv-consent=${encodeURIComponent(JSON.stringify(current))}; Path=/`;
      applyStoredConsentEffects(current);
    });
    await drain();
    assert.equal(dom.window.document.querySelectorAll('script[src*="googletagmanager.com"]').length, 2, 'an explicit current choice still enables GA and GTM');
    const commands = (dom.window as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer;
    const update = commands.filter(command => command[0] === 'consent' && command[1] === 'update').at(-1);
    assert.deepEqual(JSON.parse(JSON.stringify(update?.[2])), { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' }, 'GA initialization must replay the current choice after its command queue is created');
  } finally {
    release(new Response(JSON.stringify({ ok: true, version: 'current' })));
    if (root) await act(async () => root!.unmount());
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    await rm(directory, { recursive: true, force: true });
  }
});
