import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { PayAsYouGoAnchorRestore } from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoAnchorRestore.client';

async function fixture(hash: string, options: { scrollY?: number; navigationType?: string } = {}) {
  const dom = new JSDOM('<main id="page"><div id="client"></div></main><aside id="external"></aside>', {
    url: `https://maxvideoai.com/pay-as-you-go-ai-video-generator${hash}`, pretendToBeVisual: true,
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
  await act(async () => root.render(React.createElement(PayAsYouGoAnchorRestore, { anchorIds: ['compare-price-per-model'] })));
  const flush = async () => { await act(async () => { await new Promise(done => dom.window.setTimeout(done, 40)); }); };
  return {
    dom, scrolls, insert, flush,
    click(href = '#compare-price-per-model', options: { event?: MouseEventInit; target?: string; download?: string } = {}) {
      const link = dom.window.document.createElement('a');
      link.href = href;
      if (options.target) link.target = options.target;
      if (options.download !== undefined) link.download = options.download;
      const label = dom.window.document.createElement('span');
      label.textContent = 'Compare model prices'; link.append(label);
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

test('PAYG restores a late owned price anchor once while preserving history', async t => {
  for (const hash of ['#compare-price-per-model', '#%63ompare-price-per-model']) await t.test(hash, async () => {
    const f = await fixture(hash);
    try {
      const before = { href: f.dom.window.location.href, length: f.dom.window.history.length, state: f.dom.window.history.state };
      f.insert('unrelated'); await f.flush(); assert.deepEqual(f.scrolls, []);
      f.insert('compare-price-per-model'); await f.flush();
      assert.deepEqual(f.scrolls, [{ id: 'compare-price-per-model', options: { block: 'start', behavior: 'instant' } }]);
      f.insert('more'); await f.flush(); assert.equal(f.scrolls.length, 1);
      assert.deepEqual({ href: f.dom.window.location.href, length: f.dom.window.history.length, state: f.dom.window.history.state }, before);
    } finally { await f.dispose(); }
  });
});

test('PAYG anchor restoration yields to user input, history, and links outside its own page', async t => {
  for (const explicit of [false, true]) for (const cause of ['wheel', 'touchstart', 'pointerdown', 'keydown', 'popstate', 'pagehide', 'other-url']) await t.test(`${explicit ? 'click' : 'arrival'}/${cause}`, async () => {
    const f = await fixture(explicit ? '' : '#compare-price-per-model');
    try {
      if (explicit) f.click();
      if (cause === 'other-url') f.dom.window.history.replaceState(null, '', '/pricing#compare-price-per-model');
      else f.dom.window.dispatchEvent(new f.dom.window.Event(cause));
      f.insert('compare-price-per-model'); await f.flush(); assert.deepEqual(f.scrolls, []);
    } finally { await f.dispose(); }
  });
  for (const options of [{ scrollY: 400 }, { navigationType: 'back_forward' }]) await t.test(JSON.stringify(options), async () => {
    const f = await fixture('#compare-price-per-model', options);
    try { f.insert('compare-price-per-model'); await f.flush(); assert.deepEqual(f.scrolls, []); }
    finally { await f.dispose(); }
  });
  for (const hash of ['', '#foreign', '#%ZZ']) await t.test(hash || 'no hash', async () => {
    const f = await fixture(hash);
    try { f.insert('compare-price-per-model'); await f.flush(); assert.deepEqual(f.scrolls, []); }
    finally { await f.dispose(); }
  });
  const f = await fixture('#compare-price-per-model');
  try { f.insert('compare-price-per-model', true); await f.flush(); assert.deepEqual(f.scrolls, []); }
  finally { await f.dispose(); }
});

test('PAYG preserves an early price-link intent through the router fallback scroll', async () => {
  const f = await fixture('', { scrollY: 640 });
  try {
    f.click();
    assert.equal(f.dom.window.location.hash, '#compare-price-per-model');
    Object.defineProperty(f.dom.window, 'scrollY', { configurable: true, value: 140 });
    f.insert('compare-price-per-model'); await Promise.resolve(); await Promise.resolve();
    f.dom.window.dispatchEvent(new f.dom.window.Event('scroll'));
    await f.flush();
    assert.deepEqual(f.scrolls, [{ id: 'compare-price-per-model', options: { block: 'start', behavior: 'instant' } }]);
    assert.equal(f.dom.window.history.length, 2);
    assert.deepEqual(f.dom.window.history.state, { next: true });
  } finally { await f.dispose(); }
});

test('PAYG leaves present anchors, modified clicks, new tabs, downloads and other routes alone', async t => {
  for (const options of [{ event: { ctrlKey: true } }, { event: { metaKey: true } }, { event: { shiftKey: true } }, { event: { altKey: true } }, { event: { button: 1 } }, { target: '_blank' }, { download: '' }]) await t.test(JSON.stringify(options), async () => {
    const f = await fixture('');
    try { f.click('#compare-price-per-model', options); f.insert('compare-price-per-model'); await f.flush(); assert.deepEqual(f.scrolls, []); }
    finally { await f.dispose(); }
  });
  for (const href of ['/pricing#compare-price-per-model', 'https://example.com/#compare-price-per-model']) await t.test(href, async () => {
    const f = await fixture('');
    try { f.click(href); f.insert('compare-price-per-model'); await f.flush(); assert.deepEqual(f.scrolls, []); }
    finally { await f.dispose(); }
  });
  const f = await fixture('');
  try { f.insert('compare-price-per-model'); f.click(); await f.flush(); assert.deepEqual(f.scrolls, []); }
  finally { await f.dispose(); }
});
