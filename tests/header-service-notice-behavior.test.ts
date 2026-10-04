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

test('header service notices reflect confirmed state when the status request fails', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'header-service-notice-'));
  const require = createRequire(import.meta.url);
  const frontendRequire = createRequire(resolve('frontend/package.json'));
  const output = join(directory, 'header.cjs');
  // Only Next's browser-router/image boundaries are replaced. The actual header,
  // notice request lifecycle, account hook and translation provider are exercised.
  const link = `import React from 'react';const Link=React.forwardRef(function Link({href,prefetch,children,...props},ref){return React.createElement('a',{...props,ref,href:typeof href==='string'?href:href.pathname},children)});`;
  const boundaries: Record<string, string> = {
    'next/link': `${link} export default Link;`,
    'next/image': `import React from 'react';export default function Image({priority,fill,unoptimized,...props}){return React.createElement('img',props)}`,
    'next/navigation': `export const usePathname=()=>window.location.pathname;export const useSearchParams=()=>new URLSearchParams();export const useRouter=()=>({push(){},refresh(){},prefetch(){}});`,
    '@/i18n/navigation': `${link} export {Link};export const usePathname=()=>window.location.pathname;export const getPathname=({href})=>typeof href==='string'?href:href.pathname;`,
  };
  try {
    await build({
      stdin: { contents: `export {HeaderBar} from './frontend/components/HeaderBar';export {I18nProvider} from './frontend/lib/i18n/I18nProvider';`, resolveDir: process.cwd() },
      outfile: output, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic',
      tsconfig: 'frontend/tsconfig.json', packages: 'external',
      plugins: [{ name: 'next-browser-boundaries', setup(builder) {
        builder.onResolve({ filter: /.*/ }, args => {
          if (args.path in boundaries) return { path: args.path, namespace: 'boundary' };
          if (args.path === 'react' || args.path.startsWith('react/')) return { path: require.resolve(args.path), external: true };
          if (!args.path.startsWith('.') && !args.path.startsWith('/') && !args.path.startsWith('@/')) return { path: frontendRequire.resolve(args.path), external: true };
        });
        builder.onLoad({ filter: /.*/, namespace: 'boundary' }, args => ({ contents: boundaries[args.path], loader: 'js' }));
      } }],
    });
    const { HeaderBar, I18nProvider } = require(output);
    const dictionary = { workspace: { header: { serviceNotice: 'Unconfirmed provider outage fallback.' } } };

    async function withHeader(envNotice: string | undefined, check: (fixture: {
      notice: () => string | null;
      respond: (response: Response | Error) => Promise<void>;
      refresh: () => Promise<void>;
    }) => Promise<void>) {
      const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app', pretendToBeVisual: true });
      const saved = new Map<string, PropertyDescriptor | undefined>();
      const savedEnv = process.env.NEXT_PUBLIC_SERVICE_NOTICE;
      const requests: Array<{ resolve: (response: Response) => void; reject: (reason: Error) => void }> = [];
      let refresh: (() => void) | undefined;
      let root: ReturnType<typeof createRoot> | undefined;
      if (envNotice === undefined) delete process.env.NEXT_PUBLIC_SERVICE_NOTICE;
      else process.env.NEXT_PUBLIC_SERVICE_NOTICE = envNotice;
      dom.window.setInterval = ((callback: () => void) => { refresh = callback; return 1; }) as typeof dom.window.setInterval;
      dom.window.clearInterval = () => { refresh = undefined; };
      const globals = {
        window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
        HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
        requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
        cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
        IS_REACT_ACT_ENVIRONMENT: true,
        fetch: (url: string) => {
          assert.equal(url, '/api/service-notice', 'an anonymous header should only request its public notice');
          return new Promise<Response>((resolve, reject) => requests.push({ resolve, reject }));
        },
      };
      for (const [key, value] of Object.entries(globals)) {
        saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
        Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
      }
      try {
        root = createRoot(dom.window.document.getElementById('root')!);
        await act(async () => root!.render(React.createElement(I18nProvider, { locale: 'en', dictionary, fallback: dictionary }, React.createElement(HeaderBar))));
        await check({
          notice: () => dom.window.document.querySelector('[role="status"][aria-live="polite"]')?.textContent ?? null,
          respond: async (response) => {
            const request = requests.shift();
            assert.ok(request, 'a service notice request must be pending');
            await act(async () => { if (response instanceof Error) request.reject(response); else request.resolve(response); });
          },
          refresh: async () => {
            assert.ok(refresh, 'the mounted header must keep its normal polling lifecycle');
            await act(async () => { refresh!(); });
          },
        });
      } finally {
        if (root) await act(async () => root!.unmount());
        dom.window.close();
        for (const [key, descriptor] of saved) {
          if (descriptor) Object.defineProperty(globalThis, key, descriptor);
          else Reflect.deleteProperty(globalThis, key);
        }
        if (savedEnv === undefined) delete process.env.NEXT_PUBLIC_SERVICE_NOTICE;
        else process.env.NEXT_PUBLIC_SERVICE_NOTICE = savedEnv;
      }
    }

    for (const envNotice of [undefined, 'off']) {
      await t.test(`initial network failure does not invent an outage when notice is ${envNotice ?? 'unset'}`, async () => {
        await withHeader(envNotice, async ({ notice, respond }) => {
          assert.equal(notice(), null);
          await respond(new Error('Network unavailable'));
          assert.equal(notice(), null, 'a failed status request is not evidence of a provider outage');
        });
      });
    }
    await t.test('a failed refresh retains the last confirmed enabled message instead of the environment fallback', async () => {
      await withHeader('Environment maintenance notice.', async ({ notice, respond, refresh }) => {
        assert.equal(notice(), 'Environment maintenance notice.');
        await respond(Response.json({ enabled: true, message: 'Confirmed provider maintenance.' }));
        assert.equal(notice(), 'Confirmed provider maintenance.');
        await refresh();
        await respond(new Response('Unavailable', { status: 503 }));
        assert.equal(notice(), 'Confirmed provider maintenance.');
      });
    });
    await t.test('a failed refresh retains a confirmed disabled state', async () => {
      await withHeader('Environment maintenance notice.', async ({ notice, respond, refresh }) => {
        await respond(Response.json({ enabled: false, message: '' }));
        assert.equal(notice(), null);
        await refresh();
        await respond(new Error('Network unavailable'));
        assert.equal(notice(), null, 'an obsolete environment notice must not reappear after the server cleared it');
      });
    });
    await t.test('valid enabled and disabled responses still update an initially off header', async () => {
      await withHeader('off', async ({ notice, respond, refresh }) => {
        assert.equal(notice(), null);
        await respond(Response.json({ enabled: true, message: 'Confirmed provider maintenance.' }));
        assert.equal(notice(), 'Confirmed provider maintenance.');
        await refresh();
        await respond(Response.json({ enabled: false, message: '' }));
        assert.equal(notice(), null);
      });
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
