import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { PricingAnchorRestore } from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingAnchorRestore.client';

async function fixture(hash: string, options: { scrollY?: number; navigationType?: string; documentUrl?: string } = {}) {
  const dom = new JSDOM('<main id="page"><div id="client"></div></main><aside id="external"></aside>', {
    url: `https://maxvideoai.com/fr/tarifs${hash}`, pretendToBeVisual: true,
  });
  const globals = { React, window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  Object.defineProperty(dom.window, 'scrollY', { configurable: true, writable: true, value: options.scrollY ?? 0 });
  Object.defineProperty(dom.window.performance, 'getEntriesByType', { value: () => [{ type: options.navigationType ?? 'navigate', name: options.documentUrl ?? 'https://maxvideoai.com/fr/tarifs' }] });
  let expire: (() => void) | undefined;
  const setTimeout = dom.window.setTimeout.bind(dom.window);
  dom.window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    if (timeout === 30_000 && typeof handler === 'function') {
      expire = () => handler(...args);
      return 999_999;
    }
    return setTimeout(handler, timeout, ...args);
  }) as typeof dom.window.setTimeout;
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
  await act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(PricingAnchorRestore, {}))));
  const flush = async () => { await act(async () => { await new Promise(done => dom.window.setTimeout(done, 40)); }); };
  return {
    dom, scrolls, insert, flush,
    async leave() { await act(async () => root.render(null)); },
    async remount() { await act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(PricingAnchorRestore, {})))); },
    expire() { assert.ok(expire, 'Missing anchors need a bounded wait'); expire(); },
    ready(parent = dom.window.document.getElementById('client')!) {
      const marker = dom.window.document.createElement('span');
      marker.hidden = true;
      marker.setAttribute('data-pricing-content-ready', '');
      marker.setAttribute('data-pricing-quick-start-ready', '');
      parent.append(marker);
      return marker;
    },
    click(href = '#video-pricing', options: { event?: MouseEventInit; target?: string; download?: string } = {}) {
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



test('late localized Pricing destinations restore once without rewriting navigation', async t => {
  for (const id of ['video-pricing', 'image-pricing', 'audio-pricing', 'tool-pricing', 'kling-3-pro-pricing', 'nano-banana-pro-pricing', 'audio-music-only-pricing', 'upscale-pricing', 'full-video-pricing-table', 'pricing-faq']) await t.test(id, async () => {
    const f = await fixture(`#${id}`);
    try {
      const before = [f.dom.window.location.href, f.dom.window.history.length, f.dom.window.history.state];
      f.insert(id); await f.flush(); assert.deepEqual(f.scrolls, [], 'Wait until all price sections are revealed');
      f.ready(); await f.flush();
      assert.deepEqual(f.scrolls, [{ id, options: { block: 'start', behavior: 'instant' } }]);
      f.insert('unrelated'); await f.flush(); assert.equal(f.scrolls.length, 1);
      assert.deepEqual([f.dom.window.location.href, f.dom.window.history.length, f.dom.window.history.state], before);
    } finally { await f.dispose(); }
  });
});

test('Pricing ignores pending duplicate IDs and hidden React transport segments until reveal', async t => {
  for (const intent of ['arrival', 'click']) await t.test(intent, async () => {
    const f = await fixture(intent === 'arrival' ? '#video-pricing' : '', { scrollY: intent === 'click' ? 640 : 0 });
    try {
      const pending = f.insert('video-pricing'); pending.setAttribute('aria-busy', 'true');
      const transport = f.insert('transport'); transport.hidden = true;
      const target = f.dom.window.document.createElement('section'); target.id = 'video-pricing'; transport.append(target);
      const marker = f.ready(transport);
      if (intent === 'click') f.click();
      await f.flush(); assert.deepEqual(f.scrolls, [], 'A hidden final ID and pending placeholder are not usable anchors');
      pending.remove();
      f.dom.window.document.getElementById('client')!.append(target, marker);
      await f.flush();
      assert.deepEqual(f.scrolls, [{ id: 'video-pricing', options: { block: 'start', behavior: 'instant' } }]);
    } finally { await f.dispose(); }
  });
});

test('an early quick-start link restores from a nonzero scroll position', async () => {
  const f = await fixture('', { scrollY: 640, documentUrl: 'https://maxvideoai.com/models/kling-3-pro' });
  try {
    f.click('#kling-3-pro-pricing');
    Object.defineProperty(f.dom.window, 'scrollY', { configurable: true, value: 120 });
    f.insert('kling-3-pro-pricing'); f.ready();
    await Promise.resolve();
    f.dom.window.dispatchEvent(new f.dom.window.Event('scroll'));
    await f.flush();
    assert.deepEqual(f.scrolls, [{ id: 'kling-3-pro-pricing', options: { block: 'start', behavior: 'instant' } }]);
  } finally { await f.dispose(); }
});

test('remounting after SPA Back preserves restored scroll despite original-document navigation timing', async () => {
  const f = await fixture('#kling-3-pro-pricing', { documentUrl: 'https://maxvideoai.com/models/kling-3-pro', navigationType: 'navigate' });
  try {
    await f.leave();
    f.dom.window.history.pushState({ next: true }, '', '/fr/modeles/wan-3');
    const returned = new Promise<void>(resolve => f.dom.window.addEventListener('popstate', () => resolve(), { once: true }));
    f.dom.window.history.back();
    await returned;
    // Browsers restore this position before the returning route mounts; JSDOM has no layout.
    Object.defineProperty(f.dom.window, 'scrollY', { configurable: true, value: 1900 });
    const before = [f.dom.window.location.href, f.dom.window.history.length, f.dom.window.history.state];
    await f.remount();
    f.insert('kling-3-pro-pricing'); f.ready(); await f.flush();
    assert.deepEqual(f.scrolls, []);
    assert.equal(f.dom.window.scrollY, 1900);
    assert.deepEqual([f.dom.window.location.href, f.dom.window.history.length, f.dom.window.history.state], before);
  } finally { await f.dispose(); }
});

test('Pricing yields pending restoration to gestures, history, changed URLs and restored document positions', async t => {
  for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown', 'popstate', 'pagehide', 'click', 'hashchange']) await t.test(event, async () => {
    const f = await fixture('#image-pricing');
    try {
      f.dom.window.dispatchEvent(new f.dom.window.Event(event));
      f.insert('image-pricing'); f.ready(); await f.flush(); assert.deepEqual(f.scrolls, []);
    } finally { await f.dispose(); }
  });
  for (const options of [{ scrollY: 640 }, { navigationType: 'back_forward', documentUrl: 'https://maxvideoai.com/models/kling-3-pro' }]) await t.test(JSON.stringify(options), async () => {
    const f = await fixture('#image-pricing', options);
    try { f.insert('image-pricing'); f.ready(); await f.flush(); assert.deepEqual(f.scrolls, []); }
    finally { await f.dispose(); }
  });
  await t.test('changed route without event', async () => {
    const f = await fixture('#image-pricing');
    try {
      f.dom.window.history.replaceState(null, '', '/fr/modeles/kling-3-pro#image-pricing');
      f.insert('image-pricing'); f.ready(); await f.flush(); assert.deepEqual(f.scrolls, []);
    } finally { await f.dispose(); }
  });
});

test('Pricing leaves present targets, malformed or foreign fragments and modified links alone', async t => {
  for (const hash of ['#%ZZ', '#pricing-service-jsonld', '#foreign']) await t.test(hash, async () => {
    const f = await fixture(hash);
    try { f.insert(hash.slice(1)); f.ready(); await f.flush(); assert.deepEqual(f.scrolls, []); }
    finally { await f.dispose(); }
  });
  await t.test('target outside Pricing scope', async () => {
    const f = await fixture('#image-pricing');
    try { f.insert('image-pricing', true); f.ready(); await f.flush(); assert.deepEqual(f.scrolls, []); }
    finally { await f.dispose(); }
  });
  await t.test('already revealed link', async () => {
    const f = await fixture('');
    try { f.insert('video-pricing'); f.ready(); f.click(); await f.flush(); assert.deepEqual(f.scrolls, []); }
    finally { await f.dispose(); }
  });
  for (const options of [{ event: { ctrlKey: true } }, { target: '_blank' }, { download: '' }]) await t.test(JSON.stringify(options), async () => {
    const f = await fixture('');
    try { f.click('#image-pricing', options); f.insert('image-pricing'); f.ready(); await f.flush(); assert.deepEqual(f.scrolls, []); }
    finally { await f.dispose(); }
  });
  for (const href of ['/pricing#image-pricing', '/fr/tarifs?other=1#image-pricing', 'https://example.com/#image-pricing']) await t.test(href, async () => {
    const f = await fixture('');
    try { f.click(href); f.insert('image-pricing'); f.ready(); await f.flush(); assert.deepEqual(f.scrolls, []); }
    finally { await f.dispose(); }
  });
});


test('Pricing stops observing an expired or resolved-but-missing target', async t => {
  for (const completion of ['timeout', 'missing']) await t.test(completion, async () => {
    const f = await fixture('#missing-model-pricing');
    try {
      if (completion === 'timeout') f.expire();
      else f.ready();
      await f.flush();
      f.insert('missing-model-pricing'); f.ready(); await f.flush();
      assert.deepEqual(f.scrolls, []);
    } finally { await f.dispose(); }
  });
});

test('revealing a transport ancestor also makes its real Pricing target available', async () => {
  const f = await fixture('#image-pricing');
  try {
    const transport = f.insert('transport'); transport.hidden = true;
    const target = f.insert('image-pricing'); transport.append(target); f.ready(transport);
    await f.flush(); assert.deepEqual(f.scrolls, []);
    transport.hidden = false; await f.flush();
    assert.deepEqual(f.scrolls, [{ id: 'image-pricing', options: { block: 'start', behavior: 'instant' } }]);
  } finally { await f.dispose(); }
});


test('Pricing waits for quick-start geometry even if the lower matrix reveals first', async () => {
  const f = await fixture('#video-pricing');
  try {
    f.insert('video-pricing');
    const lowerReady = f.ready(); lowerReady.removeAttribute('data-pricing-quick-start-ready');
    await f.flush(); assert.deepEqual(f.scrolls, []);
    const quickReady = f.ready(); quickReady.removeAttribute('data-pricing-content-ready');
    await f.flush();
    assert.deepEqual(f.scrolls, [{ id: 'video-pricing', options: { block: 'start', behavior: 'instant' } }]);
  } finally { await f.dispose(); }
});


test('PricingAnchorRestore preserves SPA Back restored at zero or nonzero before remount', async t => {
  for (const scrollY of [0, 1900]) await t.test(String(scrollY), async () => {
    const f = await fixture('#kling-3-pro-pricing');
    try {
      await f.leave();
      f.dom.window.history.pushState({ next: true }, '', '/other-page');
      const returned = new Promise<void>(resolve => f.dom.window.addEventListener('popstate', () => resolve(), { once: true }));
      f.dom.window.history.back(); await returned;
      Object.defineProperty(f.dom.window, 'scrollY', { configurable: true, value: scrollY });
      await f.remount();
      f.insert('kling-3-pro-pricing'); f.ready(); await f.flush();
      assert.deepEqual(f.scrolls, []);
      assert.equal(f.dom.window.scrollY, scrollY);
    } finally { await f.dispose(); }
  });
});

test('PricingAnchorRestore consumes mounted local history so a later fresh arrival still restores', async () => {
  const f = await fixture('#kling-3-pro-pricing');
  try {
    const arrival = f.dom.window.location.href;
    f.dom.window.history.pushState({ next: true }, '', '#another-section');
    const returned = new Promise<void>(resolve => f.dom.window.addEventListener('popstate', () => resolve(), { once: true }));
    f.dom.window.history.back(); await returned; await f.flush();
    assert.deepEqual(f.scrolls, []);
    await f.leave();
    f.dom.window.history.pushState({ next: true }, '', '/other-page');
    f.dom.window.history.pushState({ next: true }, '', arrival);
    await f.remount();
    f.insert('kling-3-pro-pricing'); f.ready(); await f.flush();
    assert.deepEqual(f.scrolls, [{ id: 'kling-3-pro-pricing', options: { block: 'start', behavior: 'instant' } }]);
  } finally { await f.dispose(); }
});
