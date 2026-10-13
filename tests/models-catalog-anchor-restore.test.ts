import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { ModelsCatalogAnchorRestore } from '../frontend/app/(localized)/[locale]/(marketing)/models/_components/ModelsCatalogAnchorRestore.client';

async function fixture(hash: string, options: { scrollY?: number; navigationType?: string } = {}) {
  const dom = new JSDOM('<main id="page"><div id="client"></div></main><aside id="external"></aside>', {
    url: `https://maxvideoai.com/models${hash}`, pretendToBeVisual: true,
  });
  const globals = { React, window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  Object.defineProperty(dom.window, 'scrollY', { configurable: true, writable: true, value: options.scrollY ?? 0 });
  Object.defineProperty(dom.window.performance, 'getEntriesByType', { value: () => [{ type: options.navigationType ?? 'navigate' }] });
  const scrolls: { id: string; options: unknown }[] = [];
  dom.window.HTMLElement.prototype.scrollIntoView = function (options) { scrolls.push({ id: this.id, options }); };
  const root = createRoot(dom.window.document.getElementById('client')!);
  const insert = (id: string, external = false) => {
    const section = dom.window.document.createElement('section');
    section.id = id;
    // The hidden client marker and delayed details are siblings in the real layout.
    dom.window.document.getElementById(external ? 'external' : 'client')!.append(section);
    return section;
  };
  await act(async () => root.render(React.createElement(ModelsCatalogAnchorRestore, {})));
  const flush = async () => { await act(async () => { await new Promise(done => dom.window.setTimeout(done, 40)); }); };
  return {
    dom, scrolls, insert, flush,
    click(href = '#recommended', options: { event?: MouseEventInit; target?: string; download?: string } = {}) {
      const link = dom.window.document.createElement('a');
      link.href = href;
      if (options.target) link.target = options.target;
      if (options.download !== undefined) link.download = options.download;
      const label = dom.window.document.createElement('span');
      label.textContent = 'Browse models'; link.append(label);
      dom.window.document.getElementById('client')!.append(link);
      label.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }));
      // Emulate native anchor navigation without asking jsdom to scroll.
      link.addEventListener('click', event => {
        assert.equal(event.defaultPrevented, false, 'the restorer cannot hijack Link navigation');
        event.preventDefault();
        const url = new URL(link.href);
        if (url.origin === dom.window.location.origin) dom.window.history.pushState({ next: true }, '', url);
        dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));
      });
      label.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, ...options.event }));
    },
    async dispose() {
      await act(async () => root.unmount());
      dom.window.close();
      for (const [key, descriptor] of previous) descriptor ? Object.defineProperty(globalThis, key, descriptor) : Reflect.deleteProperty(globalThis, key);
    },
  };
}

test('late catalogue sections restore the current owned anchor once without changing history', async t => {
  for (const hash of ['#models-grid', '#recommended', '#%6dodels-grid']) await t.test(hash, async () => {
    const f = await fixture(hash);
    try {
      const before = { href: f.dom.window.location.href, length: f.dom.window.history.length, state: f.dom.window.history.state };
      f.insert('unrelated'); await f.flush(); assert.deepEqual(f.scrolls, []);
      f.insert(hash === '#recommended' ? 'recommended' : 'models-grid'); await f.flush();
      assert.deepEqual(f.scrolls, [{ id: hash === '#recommended' ? 'recommended' : 'models-grid', options: { block: 'start', behavior: 'instant' } }]);
      f.insert('more-content'); await f.flush(); assert.equal(f.scrolls.length, 1);
      assert.deepEqual({ href: f.dom.window.location.href, length: f.dom.window.history.length, state: f.dom.window.history.state }, before);
    } finally { await f.dispose(); }
  });
});

test('late catalogue sections never override user interaction or history navigation', async t => {
  for (const event of ['scroll', 'wheel', 'touchstart', 'pointerdown', 'keydown', 'click', 'popstate', 'hashchange', 'pagehide']) await t.test(event, async () => {
    const f = await fixture('#models-grid');
    try {
      f.dom.window.dispatchEvent(new f.dom.window.Event(event));
      f.insert('models-grid'); await f.flush(); assert.deepEqual(f.scrolls, []);
    } finally { await f.dispose(); }
  });
  for (const options of [{ scrollY: 400 }, { navigationType: 'back_forward' }]) await t.test(JSON.stringify(options), async () => {
    const f = await fixture('#models-grid', options);
    try { f.insert('models-grid'); await f.flush(); assert.deepEqual(f.scrolls, []); }
    finally { await f.dispose(); }
  });
});

test('missing, malformed, changed and external anchors do not cause a catalogue scroll', async t => {
  for (const hash of ['', '#external', '#%ZZ']) await t.test(hash || 'no hash', async () => {
    const f = await fixture(hash);
    try { f.insert('models-grid'); f.insert('external'); await f.flush(); assert.deepEqual(f.scrolls, []); }
    finally { await f.dispose(); }
  });
  await t.test('an allowed id outside the current page', async () => {
    const f = await fixture('#models-grid');
    try { f.insert('models-grid', true); await f.flush(); assert.deepEqual(f.scrolls, []); }
    finally { await f.dispose(); }
  });
  await t.test('hash changed before reveal without an event', async () => {
    const f = await fixture('#models-grid');
    try {
      f.dom.window.history.replaceState(null, '', '#recommended');
      f.insert('models-grid'); await f.flush(); assert.deepEqual(f.scrolls, []);
    } finally { await f.dispose(); }
  });
  await t.test('interaction between insertion and animation frame', async () => {
    const f = await fixture('#models-grid');
    try {
      f.insert('models-grid'); await Promise.resolve();
      f.dom.window.dispatchEvent(new f.dom.window.Event('wheel'));
      await f.flush(); assert.deepEqual(f.scrolls, []);
    } finally { await f.dispose(); }
  });
});


test('a hero Link click creates a new late-anchor intent from its current scroll position', async t => {
  for (const hash of ['', '#models-grid']) await t.test(hash || 'arrival without hash', async () => {
    const f = await fixture(hash, { scrollY: 640 });
    try {
      f.click(); await f.flush();
      assert.equal(f.dom.window.location.hash, '#recommended');
      assert.deepEqual(f.scrolls, []);
      f.insert('models-grid'); await f.flush(); assert.deepEqual(f.scrolls, []);
      f.insert('recommended'); await f.flush();
      assert.deepEqual(f.scrolls, [{ id: 'recommended', options: { block: 'start', behavior: 'instant' } }]);
      assert.equal(f.dom.window.history.length, 2);
      assert.deepEqual(f.dom.window.history.state, { next: true });
    } finally { await f.dispose(); }
  });
});

test('new input or history navigation cancels a pending hero Link intent', async t => {
  for (const event of ['wheel', 'pointerdown', 'keydown', 'popstate', 'hashchange']) await t.test(event, async () => {
    const f = await fixture('', { scrollY: 640 });
    try {
      f.click();
      if (event === 'hashchange') f.dom.window.history.replaceState(null, '', '#other');
      f.dom.window.dispatchEvent(new f.dom.window.Event(event));
      f.insert('recommended'); await f.flush(); assert.deepEqual(f.scrolls, []);
    } finally { await f.dispose(); }
  });
});
