import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';

test('mobile actions skip unchanged desktop menus while desktop state and locale still update', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'marketing-navigation-rendering-'));
  const require = createRequire(import.meta.url);
  const frontendRequire = createRequire(resolve('frontend/package.json'));
  const output = join(directory, 'navigation.cjs');
  // Next's routing/image boundaries need a browser router; the application components,
  // navigation configuration, translation provider and state transitions remain real.
  const boundaries: Record<string, string> = {
    '@/i18n/navigation': `import React from 'react'; export const usePathname=()=>window.location.pathname;
      export const Link=React.forwardRef(function Link({href,prefetch,children,...props},ref){return React.createElement('a',{...props,ref,href:typeof href==='string'?href:href.pathname},children)});`,
    'next/image': `import React from 'react';export default function Image({priority,fill,unoptimized,...props}){return React.createElement('img',props)}`,
  };
  let dom: JSDOM | undefined;
  let root: ReturnType<typeof createRoot> | undefined;
  const saved = new Map<string, PropertyDescriptor | undefined>();
  try {
    await build({
      stdin: { contents: `export {MarketingNav} from './frontend/components/marketing/MarketingNav'; export {I18nProvider} from './frontend/lib/i18n/I18nProvider';`, resolveDir: process.cwd() },
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
    const { MarketingNav, I18nProvider } = require(output);
    dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/', pretendToBeVisual: true });
    const globals = {
      window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
      HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
      requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
      cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
      IS_REACT_ACT_ENVIRONMENT: true,
    };
    for (const [key, value] of Object.entries(globals)) {
      saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    }
    const dictionary = JSON.parse(await readFile('frontend/messages/en.json', 'utf8'));
    const modelLabels = dictionary.nav.dropdown.models.items;
    let modelLabelReads = 0;
    Object.defineProperty(dictionary.nav.dropdown.models, 'items', {
      enumerable: true, get() { modelLabelReads += 1; return modelLabels; },
    });
    root = createRoot(document.getElementById('root')!);
    const render = (locale: string, messages: unknown) => act(async () => root!.render(
      React.createElement(I18nProvider, { locale, dictionary: messages, fallback: messages }, React.createElement(MarketingNav))
    ));
    await render('en', dictionary);
    const before = modelLabelReads;
    assert.ok(before > 0, 'desktop model links must be rendered initially, even when their panel is closed');
    const click = async (selector: string) => {
      const button = document.querySelector<HTMLButtonElement>(selector);
      assert.ok(button, selector);
      await act(async () => button.click());
    };
    await click('button[aria-label="Open menu"]');
    assert.ok(document.querySelector('[role="dialog"]'));
    assert.equal(modelLabelReads, before, 'opening mobile navigation must not rebuild the hidden desktop model links');
    await click('button[aria-controls="mobile-examples-panel"]');
    assert.ok(document.querySelector('#mobile-examples-panel a[href="/examples"]'));
    assert.match(document.querySelector('#mobile-examples-panel')!.textContent!, /Veo/);
    assert.equal(modelLabelReads, before, 'expanding another mobile section must leave desktop model links untouched');
    await click('button[aria-label="Close menu"]');
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.equal(modelLabelReads, before);

    await click('button[aria-controls="marketing-models-dropdown"]');
    assert.equal(document.querySelector('#marketing-models-dropdown')?.hasAttribute('hidden'), false);
    assert.ok(modelLabelReads > before, 'desktop state still invalidates its own menu');
    const allModels = document.querySelector<HTMLAnchorElement>('#marketing-models-dropdown a')!;
    allModels.addEventListener('click', event => event.preventDefault(), { once: true });
    await act(async () => { allModels.click(); });
    assert.equal(document.querySelector('#marketing-models-dropdown')?.hasAttribute('hidden'), true);

    const frenchDictionary = JSON.parse(await readFile('frontend/messages/fr.json', 'utf8'));
    await render('fr', frenchDictionary);
    assert.match(document.querySelector('button[aria-controls="marketing-models-dropdown"]')!.textContent!, /Modèles/);
    dom.window.history.replaceState(null, '', '/models');
    await render('fr', frenchDictionary);
    assert.ok(document.querySelector('button[aria-controls="marketing-models-dropdown"]')?.classList.contains('is-active'));
  } finally {
    if (root) await act(async () => root!.unmount());
    dom?.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    await rm(directory, { recursive: true, force: true });
  }
});
