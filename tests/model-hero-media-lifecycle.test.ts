import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { ModelHeroMedia } from '../frontend/components/marketing/ModelHeroMedia.client';

(globalThis as typeof globalThis & { React: typeof React }).React = React;
const ORIGINAL = 'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/6e299d72-22dd-46f4-8260-4d6887777558.mp4';

async function mount({ mobile = false, reduced = false, saveData = false, rejectPlay = false, deferPlay = false } = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/models/fixture', pretendToBeVisual: true });
  let now = 0;
  let nextId = 1;
  let visibility = 'visible';
  let playRejected = rejectPlay;
  const pendingPlays: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];
  const sequence: Record<string, unknown>[] = [];
  const timers = new Map<number, { at: number; callback: () => void }>();
  const idles = new Map<number, () => void>();
  const intersections: MockIntersectionObserver[] = [];
  const lcpObservers: MockPerformanceObserver[] = [];
  const nodes = new Set<HTMLVideoElement>();
  const paused = new WeakMap<HTMLMediaElement, boolean>();
  let playCalls = 0;
  let pauseCalls = 0;
  const log = (event: string, extra = {}) => sequence.push({ t: now, event, ...extra });
  class MockIntersectionObserver {
    active = true;
    constructor(public callback: (entries: unknown[]) => void) { intersections.push(this); }
    observe() {}
    disconnect() { this.active = false; log('intersection.disconnect'); }
  }
  class MockPerformanceObserver {
    static supportedEntryTypes = ['largest-contentful-paint'];
    active = true;
    constructor(public callback: () => void) { lcpObservers.push(this); log('lcp.create'); }
    observe() {}
    disconnect() { this.active = false; log('lcp.disconnect'); }
  }
  Object.defineProperty(dom.window.document, 'visibilityState', { configurable: true, get: () => visibility });
  Object.defineProperty(dom.window, 'matchMedia', { value: (query: string) => ({
    matches: query.includes('max-width') ? mobile : query.includes('reduced-motion') ? reduced : false,
    addEventListener() {}, removeEventListener() {},
  }) });
  Object.defineProperty(dom.window.navigator, 'connection', { configurable: true, value: { saveData } });
  Object.defineProperty(dom.window.HTMLMediaElement.prototype, 'readyState', { configurable: true, get: () => 0 });
  Object.defineProperty(dom.window.HTMLMediaElement.prototype, 'paused', { configurable: true, get() { return paused.get(this) ?? true; } });
  dom.window.HTMLMediaElement.prototype.play = function () {
    playCalls += 1;
    log('play', { source: this.querySelector('source')?.getAttribute('src'), rejected: playRejected });
    if (deferPlay) return new Promise<void>((resolve, reject) => pendingPlays.push({ resolve, reject }));
    if (playRejected) return Promise.reject(new dom.window.DOMException('Autoplay blocked', 'NotAllowedError'));
    paused.set(this, false);
    return Promise.resolve();
  };
  dom.window.HTMLMediaElement.prototype.pause = function () {
    pauseCalls += 1;
    log('pause');
    paused.set(this, true);
    this.dispatchEvent(new dom.window.Event('pause'));
  };
  dom.window.setTimeout = ((callback: () => void, delay: number) => {
    const id = nextId++;
    timers.set(id, { at: now + delay, callback });
    log('timer.schedule', { id, delay });
    return id;
  }) as typeof dom.window.setTimeout;
  dom.window.clearTimeout = ((id: number) => {
    if (timers.delete(id)) log('timer.cancel', { id });
  }) as typeof dom.window.clearTimeout;
  Object.assign(dom.window, {
    PerformanceObserver: MockPerformanceObserver,
    requestIdleCallback: (callback: () => void) => {
      const id = nextId++;
      idles.set(id, callback);
      log('idle.schedule', { id });
      return id;
    },
    cancelIdleCallback: (id: number) => { if (idles.delete(id)) log('idle.cancel', { id }); },
  });
  const globals = {
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    IntersectionObserver: MockIntersectionObserver, PerformanceObserver: MockPerformanceObserver,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const container = dom.window.document.querySelector<HTMLElement>('#root')!;
  const root = createRoot(container);
  const observeNodes = () => {
    for (const node of container.querySelectorAll<HTMLVideoElement>('video')) if (!nodes.has(node)) {
      nodes.add(node);
      log('video.mount', { preload: node.preload, source: node.querySelector('source')?.getAttribute('src'), visibility });
    }
  };
  const invoke = async (fn: () => void) => { await act(async () => fn()); observeNodes(); };
  const render = (src: string) => root.render(React.createElement(ModelHeroMedia, {
    posterSrc: '/renders/model.jpg', videoSrc: src, alt: 'Model example', sizes: '100vw',
    autoPlayDelayMs: 250, waitForLcp: true, showPlayButton: 'when-autoplay-disabled', quality: 75,
  }));
  await invoke(() => render(ORIGINAL));
  let unmounted = false;
  return {
    dom, container, sequence,
    video: () => container.querySelector<HTMLVideoElement>('video'),
    button: () => container.querySelector<HTMLButtonElement>('button'),
    counts: () => ({ mounts: nodes.size, playCalls, pauseCalls, timerCancels: sequence.filter(e => e.event === 'timer.cancel').length,
      idleCancels: sequence.filter(e => e.event === 'idle.cancel').length, pendingTimers: timers.size, pendingIdles: idles.size }),
    async advance(target: number) {
      while (true) {
        const task = [...timers.entries()].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!task) break;
        const [id, timer] = task;
        now = timer.at;
        timers.delete(id);
        log('timer.fire', { id });
        await invoke(timer.callback);
      }
      now = target;
    },
    async runIdle() {
      for (const [id, callback] of [...idles]) {
        idles.delete(id);
        log('idle.fire', { id });
        await invoke(callback);
      }
    },
    async visible(visible: boolean) {
      log('intersection', { visible });
      await invoke(() => intersections.filter(o => o.active).forEach(o => o.callback([{ isIntersecting: visible }])));
    },
    async hidden(hidden: boolean) {
      visibility = hidden ? 'hidden' : 'visible';
      log('document.visibility', { visibility });
      await invoke(() => dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange')));
    },
    async lcp() { log('lcp.entry'); await invoke(() => lcpObservers.filter(o => o.active).forEach(o => o.callback())); },
    async click() { const button = container.querySelector<HTMLButtonElement>('button'); assert.ok(button); await invoke(() => button.click()); },
    allowPlay() { playRejected = false; },
    async rejectPending(name: string) {
      const pending = pendingPlays.shift(); assert.ok(pending);
      await invoke(() => pending.reject(new dom.window.DOMException(name, name)));
    },
    async source(src: string) { await invoke(() => render(src)); },
    saveData(value: boolean) {
      Object.assign((dom.window.navigator as Navigator & { connection: { saveData: boolean } }).connection, { saveData: value });
    },
    async userPause() { const node = container.querySelector('video'); assert.ok(node); await invoke(() => node.pause()); },
    async playing() { const node = container.querySelector('video'); assert.ok(node); await invoke(() => node.dispatchEvent(new dom.window.Event('playing'))); },
    async unmount() { await invoke(() => root.unmount()); unmounted = true; },
    async cleanup() {
      if (!unmounted) await act(async () => root.unmount());
      dom.window.close();
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

test('model hero pending loads and blocked playback follow visibility and user intent', async t => {
  for (const scenario of [
    { name: 'offscreen during LCP quiet', at: 100, hidden: false },
    { name: 'hidden during LCP quiet', at: 100, hidden: true },
    { name: 'offscreen during autoplay delay', at: 1000, hidden: false },
    { name: 'hidden during pending idle', at: 1150, hidden: true },
  ]) await t.test(scenario.name, async () => {
    const f = await mount();
    try {
      await f.advance(scenario.at);
      if (scenario.hidden) await f.hidden(true); else await f.visible(false);
      const afterVisibility = f.counts();
      assert.equal(afterVisibility.pendingTimers + afterVisibility.pendingIdles, 0, 'visibility loss cancels pending work immediately');
      await f.advance(5000);
      await f.runIdle();
      const whileHidden = f.counts();
      if (scenario.hidden) await f.hidden(false); else await f.visible(true);
      await f.advance(10000);
      await f.runIdle();
      const afterResume = f.counts();
      assert.equal(whileHidden.mounts, 0, 'pending automatic load must not mount metadata media while offscreen/hidden');
      assert.equal(whileHidden.playCalls, 0, 'play guard already works independently of mounting');
      assert.equal(afterResume.mounts, 1, 'resume must create exactly one video');
      assert.equal(afterResume.playCalls, 1, 'resume must request playback exactly once');
    } finally { await f.cleanup(); }
  });

  await t.test('LCP quiet entries reset 900ms wait and hard limit remains 3500ms', async () => {
    for (const times of [[800], [800, 1600, 2400, 3200]]) {
      const f = await mount();
      try {
        for (const time of times) { await f.advance(time); await f.lcp(); }
        const expectedAt = times.length === 1 ? 1950 : 3750;
        await f.advance(expectedAt - 1);
        assert.equal(f.counts().pendingIdles, 0);
        assert.equal(f.counts().mounts, 0);
        await f.advance(expectedAt);
        assert.equal(f.counts().pendingIdles, 1);
        await f.runIdle();
        assert.equal(f.counts().mounts, 1);
        assert.equal(f.counts().playCalls, 1);
      } finally { await f.cleanup(); }
    }
  });

  await t.test('autoplay rejection exposes a user retry without requiring a media error', async () => {
    const f = await mount({ rejectPlay: true });
    try {
      await f.advance(1150);
      await f.runIdle();
      const observation = { counts: f.counts(), button: f.button()?.getAttribute('aria-label') ?? null,
        nativeControls: f.video()?.controls, mediaError: f.video()?.error ?? null,
        mountedSource: f.video()?.querySelector('source')?.getAttribute('src') };
      assert.equal(observation.counts.mounts, 1);
      assert.equal(observation.counts.playCalls, 1);
      assert.equal(observation.nativeControls, false);
      assert.equal(observation.mediaError, null);
      assert.ok(f.button(), 'rejected play must expose a manual action even with shouldLoadVideo=true');
      f.allowPlay();
      await f.click();
      assert.equal(f.counts().playCalls, 2);
      assert.equal(f.counts().mounts, 1, 'blocked autoplay reuses its source and mounted reader');
      assert.equal(f.video()?.querySelector('source')?.getAttribute('src'), observation.mountedSource,
        'autoplay policy rejection must not trigger original fallback');
      await f.playing();
      assert.ok(f.video()?.classList.contains('opacity-100'), 'successful manual recovery reveals the video without requiring another loadeddata event');
    } finally { await f.cleanup(); }
  });

  await t.test('automatic idle rechecks Save-Data changed after scheduling', async () => {
    const f = await mount();
    try {
      await f.advance(1150);
      f.saveData(true);
      await f.runIdle();
      assert.equal(f.counts().mounts, 0);
      assert.ok(f.button(), 'newly disabled autoplay leaves a reachable manual action');
    } finally { await f.cleanup(); }
  });

  await t.test('pending play aborts and stale rejections cannot expose a retry for a newer attempt', async () => {
    const f = await mount({ deferPlay: true });
    try {
      await f.advance(1150); await f.runIdle();
      await f.rejectPending('AbortError');
      assert.equal(f.button(), null, 'an interrupted play is not an autoplay policy failure');
      await f.hidden(true); await f.hidden(false);
      await f.hidden(true); await f.hidden(false);
      await f.rejectPending('NotAllowedError');
      assert.equal(f.button(), null, 'the old visibility generation must not alter the current reader');
      await f.rejectPending('NotAllowedError');
      assert.ok(f.button(), 'the current rejected play still exposes recovery');
      const calls = f.counts().playCalls;
      await f.hidden(true); await f.hidden(false);
      assert.equal(f.counts().playCalls, calls, 'blocked autoplay waits for user input, avoiding retry loops');
    } finally { await f.cleanup(); }
  });

  await t.test('source replacement invalidates queued automatic load and old play rejection', async () => {
    const f = await mount({ deferPlay: true });
    try {
      await f.advance(1150);
      await f.source('/new-video.mp4');
      await f.runIdle();
      assert.equal(f.counts().mounts, 0, 'old queued source must not mount');
      await f.advance(2300); await f.runIdle();
      assert.equal(f.video()?.querySelector('source')?.getAttribute('src'), '/new-video.mp4');
      await f.source('/third-video.mp4');
      await f.rejectPending('NotAllowedError');
      assert.equal(f.button(), null, 'replaced node rejection cannot block the new source');
      await f.advance(3450); await f.runIdle();
      assert.equal(f.video()?.querySelector('source')?.getAttribute('src'), '/third-video.mp4');
    } finally { await f.cleanup(); }
  });

  await t.test('visibility restoration never resumes already loaded user-paused media', async () => {
    const f = await mount();
    try {
      await f.advance(1150); await f.runIdle();
      await f.userPause();
      await f.hidden(true); await f.hidden(false);
      await f.visible(false); await f.visible(true);
      await f.advance(5000); await f.runIdle();
      assert.equal(f.counts().mounts, 1);
      assert.equal(f.counts().playCalls, 1);
    } finally { await f.cleanup(); }
  });

  for (const preference of ['mobile', 'reduced', 'saveData']) await t.test(`${preference} keeps manual cold playback`, async () => {
    const f = await mount({ [preference]: true });
    try {
      await f.advance(5000);
      await f.runIdle();
      assert.equal(f.counts().mounts, 0);
      assert.equal(f.button()?.getAttribute('aria-label'), 'Play preview');
      await f.click();
      assert.equal(f.counts().mounts, 1);
      assert.equal(f.counts().playCalls, 1);
    } finally { await f.cleanup(); }
  });

  for (const at of [100, 1000, 1150]) await t.test(`unmount cancels scheduled work at ${at}ms`, async () => {
    const f = await mount();
    try {
      await f.advance(at);
      await f.unmount();
      await f.advance(5000);
      await f.runIdle();
      assert.equal(f.counts().mounts, 0);
      assert.equal(f.counts().playCalls, 0);
      assert.equal(f.counts().pendingTimers + f.counts().pendingIdles, 0);
    } finally { await f.cleanup(); }
  });
});
