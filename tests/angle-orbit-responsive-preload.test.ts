import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

test('Angle idle preparation warms the same responsive images displayed by its controls', async () => {
  const require = createRequire(import.meta.url);
  const previousCssLoader = require.extensions['.css'];
  require.extensions['.css'] = (module) => {
    module.exports = { orbitImage: 'orbitImage', orbitImageReduced: 'orbitImageReduced' };
  };
  let AngleOrbitStudio;
  try {
    ({ AngleOrbitStudio } = await import('../frontend/src/components/tools/angle/landing/AngleOrbitStudio.client'));
  } finally {
    if (previousCssLoader) require.extensions['.css'] = previousCssLoader;
    else delete require.extensions['.css'];
  }

  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', pretendToBeVisual: true });
  const preloaded: HTMLImageElement[] = [];
  let idleCallback: (() => void) | undefined;
  const cancelled: number[] = [];
  Object.defineProperty(dom.window, 'Image', {
    configurable: true,
    value: function () {
      const image = dom.window.document.createElement('img');
      preloaded.push(image);
      return image;
    },
  });
  Object.defineProperty(dom.window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  });
  Object.defineProperty(dom.window, 'requestIdleCallback', {
    configurable: true,
    value: (callback: () => void) => { idleCallback = callback; return 7; },
  });
  Object.defineProperty(dom.window, 'cancelIdleCallback', {
    configurable: true,
    value: (handle: number) => { cancelled.push(handle); },
  });
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const container = dom.window.document.querySelector<HTMLElement>('#root')!;
  const root = createRoot(container);
  const content = JSON.parse(readFileSync('frontend/messages/en.json', 'utf8')).toolMarketing.angle.hero.orbit;
  try {
    await act(async () => root.render(React.createElement(AngleOrbitStudio, { content })));
    const initial = container.querySelector('img')!.getAttribute('src');
    assert.equal(container.querySelector('img')!.className, 'orbitImageReduced', 'the first view must be visible without an entrance animation');
    assert.equal(container.querySelectorAll('img').length, 1);
    assert.equal(preloaded.length, 0, 'secondary views must wait for the existing idle boundary');
    assert.ok(idleCallback);
    await act(async () => idleCallback!());
    assert.equal(preloaded.length, 3, 'only the three other views are prepared');
    for (const image of preloaded) {
      assert.match(image.getAttribute('src')!, /^\/_next\/image\?/, 'prepare the display derivative instead of the source file');
      assert.ok(image.getAttribute('srcset'), 'preserve responsive selection for viewport and DPR');
      assert.ok(image.getAttribute('sizes'));
    }
    const next = container.querySelector<HTMLButtonElement>(`button[aria-label="${content.nextLabel}"]`)!;
    for (let index = 0; index < 3; index += 1) {
      await act(async () => next.click());
      const displayed = container.querySelector('img')!;
      assert.equal(displayed.className, 'orbitImage', 'user-requested view changes retain their transition');
      const prepared = preloaded.find((image) => image.src === displayed.src);
      assert.ok(prepared, 'each selected view must reuse an already prepared resource');
      assert.equal(prepared.getAttribute('srcset'), displayed.getAttribute('srcset'));
      assert.equal(prepared.getAttribute('sizes'), displayed.getAttribute('sizes'));
      assert.equal(container.querySelectorAll('img').length, 1);
    }
    await act(async () => next.click());
    assert.equal(container.querySelector('img')!.getAttribute('src'), initial, 'the fourth action returns to the initial view');
    assert.equal(container.querySelector('img')!.className, 'orbitImage', 'returning to the first view still counts as an interaction');
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
  assert.deepEqual(cancelled, [7], 'retain cancellation of scheduled work on unmount');
});
