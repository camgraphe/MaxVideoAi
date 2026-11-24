import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { ModelCinematicHeroMotion } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelCinematicHeroMotion.client';
import type { CinematicPresentation } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-cinematic-data';

(globalThis as typeof globalThis & { React: typeof React }).React = React;
const ui = { play: 'Play', pause: 'Pause', retry: 'Retry' } as CinematicPresentation['ui'];
async function fixture({ mobile = false, reduced = false, saveData = false, autoplay = true } = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/models/example', pretendToBeVisual: true });
  let intersect: (entries: unknown[]) => void = () => {};
  let hidden = false;
  let plays = 0;
  let paused = true;
  Object.defineProperty(dom.window.document, 'readyState', { get: () => 'complete' });
  Object.defineProperty(dom.window.document, 'visibilityState', { get: () => hidden ? 'hidden' : 'visible' });
  Object.defineProperty(dom.window, 'matchMedia', { value: (query: string) => ({
    matches: query.includes('min-width') ? !mobile : query.includes('max-width') ? mobile : reduced,
    addEventListener() {}, removeEventListener() {},
  }) });
  Object.defineProperty(dom.window.navigator, 'connection', { value: Object.assign(new dom.window.EventTarget(), { saveData }) });
  dom.window.HTMLMediaElement.prototype.play = function () { plays++; paused = false; this.dispatchEvent(new dom.window.Event('playing')); return Promise.resolve(); };
  dom.window.HTMLMediaElement.prototype.pause = function () { if (paused) return; paused = true; this.dispatchEvent(new dom.window.Event('pause')); };
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    IntersectionObserver: class { constructor(callback: typeof intersect) { intersect = callback; } observe() {} disconnect() {} }, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  const container = dom.window.document.querySelector('#root')!;
  const root = createRoot(container);
  await act(async () => root.render(React.createElement(ModelCinematicHeroMotion, { src: 'https://media.maxvideoai.com/example.mp4', title: 'Opening', ui, autoplay })));
  return {
    container, plays: () => plays, paused: () => paused,
    visible: (value: boolean) => act(async () => intersect([{ isIntersecting: value }])),
    hidden: (value: boolean) => act(async () => { hidden = value; dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange')); }),
    wait: () => act(async () => { await new Promise(resolve => setTimeout(resolve, 1250)); }),
    click: () => act(async () => container.querySelector('button')!.click()),
    error: () => act(async () => container.querySelector('video')!.dispatchEvent(new dom.window.Event('error'))),
    cleanup: async () => {
      await act(async () => root.unmount()); dom.window.close();
      for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
    },
  };
}

test('hero motion defers transfer, loops silently and preserves explicit pause across visibility changes', async () => {
  const f = await fixture();
  try {
    assert.equal(f.container.querySelector('video'), null, 'The critical poster loads without a competing video source');
    await f.visible(true);
    assert.equal(f.container.querySelector('video'), null, 'Autoplay remains deferred after visibility is established');
    await f.wait();
    const video = f.container.querySelector('video')!;
    assert.ok(video.loop && video.muted && video.playsInline);
    assert.equal(video.preload, 'none');
    assert.equal(f.plays(), 1);
    await f.hidden(true); assert.equal(f.paused(), true);
    await f.hidden(false); assert.equal(f.plays(), 2);
    await f.click(); assert.equal(f.paused(), true);
    await f.visible(false); await f.visible(true); await f.hidden(true); await f.hidden(false);
    assert.equal(f.plays(), 2, 'Scrolling or returning to the tab does not undo a deliberate pause');
    await f.click(); assert.equal(f.plays(), 3);
    await f.error();
    assert.match(f.container.querySelector('button')!.getAttribute('aria-label')!, /Retry/);
    await f.click(); assert.equal(f.plays(), 4, 'Failed media can be retried explicitly');
  } finally { await f.cleanup(); }
});

test('mobile, reduced motion, Save-Data and manual openings keep the poster until explicit Play', async () => {
  for (const [policy, options] of [
    ['mobile', { mobile: true }],
    ['reduced motion', { reduced: true }],
    ['Save-Data', { saveData: true }],
    ['manual opening', { autoplay: false }],
  ] as const) {
    const f = await fixture(options);
    try {
      await f.visible(true); await f.wait();
      assert.equal(f.container.querySelector('video'), null, policy);
      await f.click();
      assert.equal(f.plays(), 1, `${policy}: manual Play remains available`);
      assert.equal(f.container.querySelector('video')!.muted, true);
    } finally { await f.cleanup(); }
  }
});
