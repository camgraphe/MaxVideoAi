import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { ModelDetailsAnchorRestore } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDetailsAnchorRestore.client';

async function fixture(hash: string, options: { scrollY?: number; navigationType?: string } = {}) {
  const dom = new JSDOM('<main id="page"><div id="client"></div></main><aside id="external"></aside>', {
    url: `https://maxvideoai.com/models/veo-3-1${hash}`, pretendToBeVisual: true,
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
  await act(async () => root.render(React.createElement(ModelDetailsAnchorRestore, { anchorIds: ['specs', 'decision-pricing', 'prompting'] })));
  const flush = async () => { await act(async () => { await new Promise(done => dom.window.setTimeout(done, 40)); }); };
  return {
    dom, scrolls, insert, flush,
    click(href = '#prompting', options: { event?: MouseEventInit; target?: string; download?: string } = {}) {
      const link = dom.window.document.createElement('a');
      link.href = href;
      if (options.target) link.target = options.target;
      if (options.download !== undefined) link.download = options.download;
      const label = dom.window.document.createElement('span');
      label.textContent = 'Prompt examples'; link.append(label);
      dom.window.document.getElementById('client')!.append(link);
      label.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }));
      // Next handles local Link clicks with pushState; no hashchange is emitted.
      link.addEventListener('click', event => {
        assert.equal(event.defaultPrevented, false, 'the restorer cannot hijack Link navigation');
        event.preventDefault();
        const url = new URL(link.href);
        if (url.origin === dom.window.location.origin) dom.window.history.pushState({ next: true }, '', url);
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

test('late model details restore the current owned anchor once without changing history', async t => {
  for (const hash of ['#specs', '#decision-pricing', '#%73pecs']) await t.test(hash, async () => {
    const f = await fixture(hash);
    try {
      const before = { href: f.dom.window.location.href, length: f.dom.window.history.length, state: f.dom.window.history.state };
      f.insert('unrelated'); await f.flush(); assert.deepEqual(f.scrolls, []);
      f.insert(hash === '#decision-pricing' ? 'decision-pricing' : 'specs'); await f.flush();
      assert.deepEqual(f.scrolls, [{ id: hash === '#decision-pricing' ? 'decision-pricing' : 'specs', options: { block: 'start', behavior: 'instant' } }]);
      f.insert('more-content'); await f.flush(); assert.equal(f.scrolls.length, 1);
      assert.deepEqual({ href: f.dom.window.location.href, length: f.dom.window.history.length, state: f.dom.window.history.state }, before);
    } finally { await f.dispose(); }
  });
});

test('late model details never override user interaction or history navigation', async t => {
  for (const event of ['scroll', 'wheel', 'touchstart', 'pointerdown', 'keydown', 'click', 'popstate', 'hashchange', 'pagehide']) await t.test(event, async () => {
    const f = await fixture('#specs');
    try {
      f.dom.window.dispatchEvent(new f.dom.window.Event(event));
      f.insert('specs'); await f.flush(); assert.deepEqual(f.scrolls, []);
    } finally { await f.dispose(); }
  });
  for (const options of [{ scrollY: 400 }, { navigationType: 'back_forward' }]) await t.test(JSON.stringify(options), async () => {
    const f = await fixture('#specs', options);
    try { f.insert('specs'); await f.flush(); assert.deepEqual(f.scrolls, []); }
    finally { await f.dispose(); }
  });
});

test('missing, malformed, changed and external anchors do not cause a model-page scroll', async t => {
  for (const hash of ['', '#external', '#%ZZ']) await t.test(hash || 'no hash', async () => {
    const f = await fixture(hash);
    try { f.insert('specs'); f.insert('external'); await f.flush(); assert.deepEqual(f.scrolls, []); }
    finally { await f.dispose(); }
  });
  await t.test('an allowed id outside the current page', async () => {
    const f = await fixture('#specs');
    try { f.insert('specs', true); await f.flush(); assert.deepEqual(f.scrolls, []); }
    finally { await f.dispose(); }
  });
  await t.test('hash changed before reveal without an event', async () => {
    const f = await fixture('#specs');
    try {
      f.dom.window.history.replaceState(null, '', '#decision-pricing');
      f.insert('specs'); await f.flush(); assert.deepEqual(f.scrolls, []);
    } finally { await f.dispose(); }
  });
  await t.test('interaction between insertion and animation frame', async () => {
    const f = await fixture('#specs');
    try {
      f.insert('specs'); await Promise.resolve();
      f.dom.window.dispatchEvent(new f.dom.window.Event('wheel'));
      await f.flush(); assert.deepEqual(f.scrolls, []);
    } finally { await f.dispose(); }
  });
});


test('a hero Link click creates a new late-anchor intent from its current scroll position', async t => {
  for (const hash of ['', '#specs']) await t.test(hash || 'arrival without hash', async () => {
    const f = await fixture(hash, { scrollY: 640 });
    try {
      f.click(); await f.flush();
      assert.equal(f.dom.window.location.hash, '#prompting');
      assert.deepEqual(f.scrolls, []);
      f.insert('specs'); await f.flush(); assert.deepEqual(f.scrolls, []);
      f.insert('prompting'); await f.flush();
      assert.deepEqual(f.scrolls, [{ id: 'prompting', options: { block: 'start', behavior: 'instant' } }]);
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
      f.insert('prompting'); await f.flush(); assert.deepEqual(f.scrolls, []);
    } finally { await f.dispose(); }
  });
});

test('present targets and modified, external or new-tab links retain their existing navigation behavior', async t => {
  await t.test('target already exists', async () => {
    const f = await fixture('');
    try { f.insert('prompting'); f.click(); await f.flush(); assert.deepEqual(f.scrolls, []); }
    finally { await f.dispose(); }
  });
  for (const options of [{ event: { ctrlKey: true } }, { event: { metaKey: true } }, { event: { shiftKey: true } }, { event: { altKey: true } }, { event: { button: 1 } }, { target: '_blank' }, { download: '' }]) await t.test(JSON.stringify(options), async () => {
    const f = await fixture('');
    try { f.click('#prompting', options); f.insert('prompting'); await f.flush(); assert.deepEqual(f.scrolls, []); }
    finally { await f.dispose(); }
  });
  for (const href of ['#foreign', '/pricing#prompting', 'https://example.com/#prompting']) await t.test(href, async () => {
    const f = await fixture('');
    try { f.click(href); f.insert('prompting'); f.insert('foreign'); await f.flush(); assert.deepEqual(f.scrolls, []); }
    finally { await f.dispose(); }
  });
});


test('a same-URL router fallback scroll preserves an explicit missing-anchor click', async () => {
  const f = await fixture('', { scrollY: 640 });
  try {
    f.click();
    assert.equal(f.dom.window.location.hash, '#prompting');
    Object.defineProperty(f.dom.window, 'scrollY', { configurable: true, value: 140 });
    f.dom.window.dispatchEvent(new f.dom.window.Event('scroll'));
    f.insert('prompting'); await f.flush();
    assert.deepEqual(f.scrolls, [{ id: 'prompting', options: { block: 'start', behavior: 'instant' } }]);
    assert.equal(f.dom.window.history.length, 2);
    assert.deepEqual(f.dom.window.history.state, { next: true });
  } finally { await f.dispose(); }
});

test('router scroll tolerance never revives user-cancelled or navigated anchor intentions', async t => {
  for (const cause of ['wheel', 'touchstart', 'pointerdown', 'keydown', 'popstate', 'pagehide', 'other-url']) await t.test(cause, async () => {
    const f = await fixture('', { scrollY: 640 });
    try {
      f.click();
      if (cause === 'other-url') f.dom.window.history.replaceState(null, '', '/pricing#prompting');
      else f.dom.window.dispatchEvent(new f.dom.window.Event(cause));
      Object.defineProperty(f.dom.window, 'scrollY', { configurable: true, value: 140 });
      f.dom.window.dispatchEvent(new f.dom.window.Event('scroll'));
      f.dom.window.history.replaceState(null, '', '/models/veo-3-1#prompting');
      f.insert('prompting'); await f.flush(); assert.deepEqual(f.scrolls, []);
    } finally { await f.dispose(); }
  });
});

test('a reveal before the delayed router scroll event keeps the explicit anchor intent', async () => {
  const f = await fixture('', { scrollY: 640 });
  try {
    f.click();
    Object.defineProperty(f.dom.window, 'scrollY', { configurable: true, value: 140 });
    f.insert('prompting');
    // MutationObserver runs before the browser delivers the queued scroll event.
    await Promise.resolve();
    await Promise.resolve();
    f.dom.window.dispatchEvent(new f.dom.window.Event('scroll'));
    await f.flush();
    assert.deepEqual(f.scrolls, [{ id: 'prompting', options: { block: 'start', behavior: 'instant' } }]);
  } finally { await f.dispose(); }
});
