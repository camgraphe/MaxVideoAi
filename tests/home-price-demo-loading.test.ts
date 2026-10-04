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

test('homepage pricing keeps its placeholder until the deferred real composer is ready', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'home-price-demo-loading-'));
  const require = createRequire(import.meta.url);
  const frontendRequire = createRequire(resolve('frontend/package.json'));
  const output = join(directory, 'demo.cjs');
  // App Router's real dynamic component runs with only the deferred chunk delivery
  // controlled. The pricing demo, canonical fixture and loaded Composer are real.
  const boundaries: Record<string, string> = {
    'next/dynamic': `import dynamic from 'next/dist/shared/lib/app-dynamic.js';export default function delayedDynamic(loader,options){return dynamic(()=>globalThis.__homePriceChunkReady.then(loader),options)}`,
    '@/i18n/navigation': `import React from 'react';export const Link=React.forwardRef(function Link({href,prefetch,children,...props},ref){return React.createElement('a',{...props,ref,href:typeof href==='string'?href:href.pathname},children)});`,
    'next/image': `import React from 'react';export default function Image({priority,fill,unoptimized,...props}){return React.createElement('img',props)}`,
  };
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/', pretendToBeVisual: true });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  let root: ReturnType<typeof createRoot> | undefined;
  let enter: IntersectionObserverCallback | undefined;
  let resolveChunk!: () => void;
  const chunkReady = new Promise<void>(resolve => { resolveChunk = resolve; });
  try {
    await build({
      stdin: { contents: `export {HomePriceDemo} from './frontend/components/marketing/home/HomePriceDemo.client';export {buildHomePriceDemo} from './frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-price-demo-data';`, resolveDir: process.cwd() },
      outfile: output, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic',
      tsconfig: 'frontend/tsconfig.json', packages: 'external',
      plugins: [{ name: 'browser-and-chunk-boundaries', setup(builder) {
        builder.onResolve({ filter: /.*/ }, args => {
          if (args.path in boundaries) return { path: args.path, namespace: 'boundary' };
          if (args.path === 'react' || args.path.startsWith('react/')) return { path: require.resolve(args.path), external: true };
          if (!args.path.startsWith('.') && !args.path.startsWith('/') && !args.path.startsWith('@/')) return { path: frontendRequire.resolve(args.path), external: true };
        });
        builder.onLoad({ filter: /.*/, namespace: 'boundary' }, args => ({ contents: boundaries[args.path], loader: 'js' }));
      } }],
    });
    const { HomePriceDemo, buildHomePriceDemo } = require(output);
    const models = buildHomePriceDemo('en');
    assert.ok(models.length, 'the published homepage must have its canonical pricing demo');
    Object.defineProperty(dom.window, 'matchMedia', {
      value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
    });
    const globals = {
      window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
      HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
      requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
      cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
      matchMedia: dom.window.matchMedia.bind(dom.window),
      IntersectionObserver: class {
        constructor(callback: IntersectionObserverCallback) { enter = callback; }
        observe() {}
        disconnect() {}
      },
      IS_REACT_ACT_ENVIRONMENT: true,
      __homePriceChunkReady: chunkReady,
    };
    for (const [key, value] of Object.entries(globals)) {
      saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    }
    root = createRoot(dom.window.document.getElementById('root')!);
    await act(async () => root!.render(React.createElement(HomePriceDemo, { locale: 'en', models })));
    const placeholder = () => dom.window.document.querySelector('.price-app-placeholder');
    assert.ok(placeholder(), 'before entering view the deferred composer needs its reserved surface');
    assert.ok(enter);
    await act(async () => enter!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    assert.ok(placeholder(), 'entering view must not remove the reserved surface while its chunk is pending');
    assert.equal(dom.window.document.querySelector('.price-app-surface'), null);
    await act(async () => { resolveChunk(); });
    assert.equal(placeholder(), null);
    assert.ok(dom.window.document.querySelector('.price-app-surface textarea'), 'the original full composer must replace the loading surface');
    const surface = dom.window.document.querySelector('.price-app-surface')!;
    assert.equal(surface.getAttribute('inert'), '', 'the guided demo controls must remain inert in the rendered DOM');
    assert.equal(surface.getAttribute('aria-hidden'), 'true');
    assert.equal(dom.window.document.querySelectorAll('.price-app-annotation').length, 1);
  } finally {
    if (root) await act(async () => { resolveChunk(); root!.unmount(); });
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    await rm(directory, { recursive: true, force: true });
  }
});
