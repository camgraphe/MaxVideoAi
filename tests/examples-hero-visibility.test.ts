import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import test from 'node:test';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { ExamplesHeroVideo } from '../frontend/components/examples/ExamplesHeroVideo.client';

(globalThis as typeof globalThis & { React: typeof React }).React = React;
const ORIGINAL = 'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/6e299d72-22dd-46f4-8260-4d6887777558.mp4';

async function mount({ mobile = false, reduced = false, saveData = false, crawler = false, hidden = false } = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/examples#gallery', pretendToBeVisual: true });
  const observers: MockIntersectionObserver[] = [];
  class MockIntersectionObserver {
    active = true;
    constructor(public callback: (entries: unknown[]) => void, public options: IntersectionObserverInit) { observers.push(this); }
    observe() {}
    disconnect() { this.active = false; }
  }
  Object.defineProperty(dom.window.document, 'visibilityState', { configurable: true, get: () => hidden ? 'hidden' : 'visible' });
  Object.defineProperty(dom.window, 'matchMedia', { value: (query: string) => ({
    matches: query.includes('max-width') ? mobile : query.includes('reduced-motion') ? reduced : false,
    addEventListener() {}, removeEventListener() {},
  }) });
  Object.defineProperty(dom.window.navigator, 'connection', { value: { saveData } });
  if (crawler) Object.defineProperty(dom.window.navigator, 'userAgent', { value: 'Googlebot' });
  const paused = new WeakMap<HTMLMediaElement, boolean>();
  const plays: string[] = [];
  let pauses = 0;
  Object.defineProperty(dom.window.HTMLMediaElement.prototype, 'paused', { configurable: true, get() { return paused.get(this) ?? true; } });
  dom.window.HTMLMediaElement.prototype.play = function () {
    plays.push(this.querySelector('source')?.getAttribute('src') ?? '');
    paused.set(this, false);
    this.dispatchEvent(new dom.window.Event('play'));
    this.dispatchEvent(new dom.window.Event('playing'));
    return Promise.resolve();
  };
  dom.window.HTMLMediaElement.prototype.pause = function () {
    if (this.paused) return;
    pauses += 1;
    paused.set(this, true);
    this.dispatchEvent(new dom.window.Event('pause'));
  };
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IntersectionObserver: MockIntersectionObserver, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const container = dom.window.document.querySelector<HTMLElement>('#root')!;
  const root = createRoot(container);
  const render = async (src = ORIGINAL) => act(async () => root.render(React.createElement(ExamplesHeroVideo, { src, type: 'video/mp4', poster: '/renders/fixture.webp', ariaLabel: 'Example' })));
  await render();
  const video = () => container.querySelector<HTMLVideoElement>('video')!;
  return {
    dom, container, observers, plays, video, render,
    pauses: () => pauses,
    visible: async (visible: boolean) => act(async () => {
      const observer = observers.findLast(item => item.active)!;
      assert.ok(observer);
      assert.equal(observer.options.threshold, 0.55);
      observer.callback([{ isIntersecting: visible }]);
    }),
    hidden: async (value: boolean) => act(async () => { hidden = value; dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange')); }),
    manualPlay: async () => act(async () => { await video().play(); }),
    manualPause: async () => act(async () => video().pause()),
    loaded: async () => act(async () => video().dispatchEvent(new dom.window.Event('loadeddata'))),
    error: async () => act(async () => video().dispatchEvent(new dom.window.Event('error'))),
    retry: async () => act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Retry preview"]')!.click()),
    cleanup: async () => {
      await act(async () => root.unmount());
      assert.ok(observers.every(observer => !observer.active));
      dom.window.close();
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

test('examples hero waits for its first visibility observation before automatic play', async () => {
  const f = await mount();
  try {
    const initial = { playCalls: f.plays.length, preload: f.video().preload, source: f.video().querySelector('source')?.getAttribute('src') };
    await f.visible(false);
    const offscreen = { playCalls: f.plays.length, pauses: f.pauses() };
    await f.visible(true);
    const visible = { playCalls: f.plays.length, paused: f.video().paused };
    if (process.env.CWV_EXAMPLES_EVIDENCE_PATH) await writeFile(process.env.CWV_EXAMPLES_EVIDENCE_PATH, JSON.stringify({ initial, offscreen, visible }, null, 2)+'\n');
    assert.equal(initial.playCalls, 0, 'initial optimistic visibility must not start a transfer before IO answers');
    assert.equal(initial.preload, 'none');
    assert.equal(offscreen.playCalls, 0);
    assert.equal(visible.playCalls, 1);
    assert.equal(visible.paused, false);
    await f.visible(false);
    assert.equal(f.video().paused, true);
    await f.visible(true);
    assert.equal(f.plays.length, 2, 'automatic playback resumes after an environment pause');
  } finally { await f.cleanup(); }
});

test('examples hero preserves manual playback before IO, environment pauses and user pauses', async () => {
  for (const preference of ['desktop', 'mobile', 'reduced', 'saveData', 'crawler']) {
    const f = await mount({ [preference]: true });
    try {
      assert.equal(f.plays.length, 0);
      await f.manualPlay();
      await f.loaded();
      assert.equal(f.video().paused, false, `${preference}: native manual play works before first IO`);
      await f.visible(true);
      assert.equal(f.plays.length, 1);
      await f.hidden(true);
      assert.equal(f.video().paused, true);
      await f.hidden(false);
      assert.equal(f.plays.length, 2);
      await f.manualPause();
      await f.visible(false); await f.visible(true);
      await f.hidden(true); await f.hidden(false);
      assert.equal(f.plays.length, 2, 'environment changes must retain explicit user pause');
    } finally { await f.cleanup(); }
  }
});

test('examples hero keeps hidden documents quiet and observes replacement automatic readers', async () => {
  const f = await mount({ hidden: true });
  try {
    await f.visible(true);
    assert.equal(f.plays.length, 0);
    await f.hidden(false);
    assert.equal(f.plays.length, 1);
    await f.render('/renders/replacement.mp4');
    assert.equal(f.plays.length, 1, 'new automatic reader waits for its new observer');
    await f.visible(false);
    assert.equal(f.plays.length, 1);
    await f.visible(true);
    assert.equal(f.plays.length, 2);
    assert.equal(f.plays.at(-1), '/renders/replacement.mp4');
  } finally { await f.cleanup(); }
});

test('examples manual fallback and terminal retry do not wait for an automatic visibility gate', async () => {
  const f = await mount({ mobile: true });
  try {
    await f.manualPlay();
    await f.error();
    assert.equal(f.video().querySelector('source')?.getAttribute('src'), ORIGINAL);
    assert.equal(f.video().paused, false, 'manual fallback retains playback before first observer result');
    await f.error();
    assert.ok(f.container.querySelector('button[aria-label="Retry preview"]'));
    const previous = f.plays.length;
    await f.retry();
    assert.equal(f.plays.length, previous + 1, 'manual retry must work before first observer result');
    assert.equal(f.video().paused, false);
  } finally { await f.cleanup(); }
});


test('examples autoplay remains disabled by mobile, motion, data-saving and crawler policy after observation', async () => {
  for (const preference of ['mobile', 'reduced', 'saveData', 'crawler']) {
    const f = await mount({ [preference]: true });
    try {
      await f.visible(true);
      await f.loaded();
      await f.hidden(true); await f.hidden(false);
      assert.equal(f.plays.length, 0, preference);
      await f.manualPlay();
      assert.equal(f.plays.length, 1);
    } finally { await f.cleanup(); }
  }
});
