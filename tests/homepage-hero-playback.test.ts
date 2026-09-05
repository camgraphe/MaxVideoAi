import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import {
  HeroVideoShowcase,
  type HeroVideoShowcaseItem,
} from '../frontend/components/marketing/home/HeroVideoShowcase.tsx';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const items: HeroVideoShowcaseItem[] = ['one', 'two'].map((id, index) => ({
  id,
  name: `Model ${index + 1}`,
  provider: 'Provider',
  bestFor: 'Testing',
  price: '$1',
  estimateLabel: 'Estimate',
  estimateValue: '$1',
  estimateMeta: '5s',
  posterSrc: `/hero/${id}.jpg`,
  videoSrc: `/hero/${id}.mp4`,
  duration: '0:05',
  resolution: '1080p',
  imageAlt: `${id} poster`,
}));

type MatchPolicy = { desktop?: boolean; reducedMotion?: boolean; saveData?: boolean };

async function mountHero(policy: MatchPolicy = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', pretendToBeVisual: true });
  const idle = new Map<number, IdleRequestCallback>();
  const cancelledIdle: number[] = [];
  let nextIdle = 1;
  const observers: MockIntersectionObserver[] = [];

  class MockIntersectionObserver {
    private callback: IntersectionObserverCallback;
    targets = new Set<Element>();
    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
      observers.push(this);
    }
    observe(target: Element) { this.targets.add(target); }
    unobserve(target: Element) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); }
    takeRecords() { return []; }
    get root() { return null; }
    get rootMargin() { return '0px'; }
    get thresholds() { return [0]; }
    emit(target: Element, isIntersecting: boolean) {
      this.callback([{ target, isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
    }
  }

  Object.defineProperty(dom.window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: query.includes('min-width') ? (policy.desktop ?? false) : (policy.reducedMotion ?? false),
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() { return true; },
    }),
  });
  Object.defineProperty(dom.window.navigator, 'connection', {
    configurable: true,
    value: { saveData: policy.saveData ?? false },
  });
  dom.window.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  dom.window.HTMLMediaElement.prototype.pause = function () {};
  Object.defineProperty(dom.window, 'requestIdleCallback', {
    configurable: true,
    value: (callback: IdleRequestCallback) => {
      const id = nextIdle++;
      idle.set(id, callback);
      return id;
    },
  });
  Object.defineProperty(dom.window, 'cancelIdleCallback', {
    configurable: true,
    value: (id: number) => {
      cancelledIdle.push(id);
      idle.delete(id);
    },
  });

  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    IntersectionObserver: MockIntersectionObserver,
    IS_REACT_ACT_ENVIRONMENT: true,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  };
  const previous = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }

  const container = dom.window.document.querySelector<HTMLElement>('#root')!;
  const root: Root = createRoot(container);
  await act(async () => root.render(React.createElement(HeroVideoShowcase, {
    items,
    playLabel: 'Play',
    pauseLabel: 'Pause',
    loadingLabel: 'Loading preview',
    errorLabel: 'Preview unavailable',
    retryLabel: 'Retry preview',
  })));

  const player = () => container.querySelector<HTMLElement>('[data-hero-player="main"]')!;
  const video = () => container.querySelector<HTMLVideoElement>('video');
  const intersectPlayer = async (visible: boolean) => {
    const observer = observers.find((candidate) => candidate.targets.has(player()));
    assert.ok(observer, 'The hero player must be observed for visibility');
    await act(async () => observer.emit(player(), visible));
  };
  const flushIdle = async () => {
    const callbacks = [...idle.entries()];
    idle.clear();
    await act(async () => callbacks.forEach(([, callback]) => callback({ didTimeout: false, timeRemaining: () => 50 })));
  };
  const cleanup = async () => {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  };

  return { dom, container, player, video, idle, cancelledIdle, intersectPlayer, flushIdle, cleanup };
}

test('automatic hero loading waits for visible desktop idle and honors data-saving policies', async () => {
  for (const policy of [
    { desktop: false },
    { desktop: true, reducedMotion: true },
    { desktop: true, saveData: true },
  ]) {
    const fixture = await mountHero(policy);
    try {
      await fixture.intersectPlayer(true);
      assert.equal(fixture.idle.size, 0);
      assert.equal(fixture.video(), null);
    } finally {
      await fixture.cleanup();
    }
  }

  const desktop = await mountHero({ desktop: true });
  try {
    assert.equal(desktop.idle.size, 0, 'Offscreen markup must not schedule media loading');
    await desktop.intersectPlayer(true);
    assert.equal(desktop.idle.size, 1);
    assert.equal(desktop.video(), null);
    await desktop.flushIdle();
    assert.equal(desktop.video()?.querySelector('source')?.getAttribute('src'), '/hero/one.mp4');
  } finally {
    await desktop.cleanup();
  }
});

test('a Play-labelled thumbnail loads and starts the selected video in one click without idle delay', async () => {
  const fixture = await mountHero({ desktop: false, reducedMotion: true, saveData: true });
  const played: string[] = [];
  const originalPlay = fixture.dom.window.HTMLMediaElement.prototype.play;
  fixture.dom.window.HTMLMediaElement.prototype.play = function () {
    played.push(this.querySelector('source')?.getAttribute('src') ?? '');
    return Promise.resolve();
  };
  try {
    const thumbnail = fixture.container.querySelector<HTMLButtonElement>('button[aria-label="Play: Model 2"]')!;
    await act(async () => thumbnail.click());
    assert.equal(fixture.idle.size, 0);
    assert.equal(fixture.video()?.querySelector('source')?.getAttribute('src'), '/hero/two.mp4');
    assert.deepEqual(played, ['/hero/two.mp4']);
  } finally {
    fixture.dom.window.HTMLMediaElement.prototype.play = originalPlay;
    await fixture.cleanup();
  }
});

test('a manual request waits when the document becomes hidden before the play effect', async () => {
  const fixture = await mountHero({ desktop: false, reducedMotion: true, saveData: true });
  let playCalls = 0;
  fixture.dom.window.HTMLMediaElement.prototype.play = function () { playCalls += 1; return Promise.resolve(); };
  try {
    Object.defineProperty(fixture.dom.window.document, 'visibilityState', { configurable: true, value: 'visible' });
    await act(async () => {
      fixture.container.querySelector<HTMLButtonElement>('button[aria-label="Play: Model 2"]')!.click();
      Object.defineProperty(fixture.dom.window.document, 'visibilityState', { configurable: true, value: 'hidden' });
      fixture.dom.window.document.dispatchEvent(new fixture.dom.window.Event('visibilitychange'));
    });
    assert.equal(playCalls, 0, 'A pending manual request must not start while the document is hidden');
    Object.defineProperty(fixture.dom.window.document, 'visibilityState', { configurable: true, value: 'visible' });
    await act(async () => fixture.dom.window.document.dispatchEvent(new fixture.dom.window.Event('visibilitychange')));
    assert.equal(playCalls, 1, 'The retained manual request should start when the document becomes visible');
  } finally {
    await fixture.cleanup();
  }
});

test('playing state follows media readiness and waiting returns the control to loading', async () => {
  const fixture = await mountHero();
  try {
    await act(async () => fixture.container.querySelector<HTMLButtonElement>('button[aria-label="Play: Model 1"]')!.click());
    const video = fixture.video()!;
    assert.ok(fixture.container.querySelector('button[aria-label="Play"]'));
    await act(async () => video.dispatchEvent(new fixture.dom.window.Event('play')));
    assert.ok(fixture.container.querySelector('button[aria-label="Play"]'), 'The play event alone does not prove frames are advancing');
    await act(async () => video.dispatchEvent(new fixture.dom.window.Event('playing')));
    assert.ok(fixture.container.querySelector('button[aria-label="Pause"]'));
    await act(async () => video.dispatchEvent(new fixture.dom.window.Event('waiting')));
    assert.ok(fixture.container.querySelector('button[aria-label="Play"]'));
  } finally {
    await fixture.cleanup();
  }
});

test('stalled fetching keeps the Pause control while buffered playback continues', async () => {
  const fixture = await mountHero();
  let pauseCalls = 0;
  fixture.dom.window.HTMLMediaElement.prototype.pause = function () { pauseCalls += 1; };
  try {
    await act(async () => fixture.container.querySelector<HTMLButtonElement>('button[aria-label="Play: Model 1"]')!.click());
    const video = fixture.video()!;
    Object.defineProperties(video, {
      paused: { configurable: true, value: false },
      readyState: { configurable: true, value: video.HAVE_FUTURE_DATA },
    });

    await act(async () => video.dispatchEvent(new fixture.dom.window.Event('playing')));
    await act(async () => video.dispatchEvent(new fixture.dom.window.Event('stalled')));

    const pause = fixture.container.querySelector<HTMLButtonElement>('button[aria-label="Pause"]');
    assert.ok(pause, 'A stalled fetch must not replace Pause while buffered media is still playing');
    await act(async () => pause.click());
    assert.equal(pauseCalls, 1);
    assert.equal(fixture.player().dataset.playbackState, 'paused');
  } finally {
    await fixture.cleanup();
  }
});

test('offscreen and hidden playback pauses without overriding the user pause', async () => {
  const fixture = await mountHero({ desktop: true });
  let playCalls = 0;
  let pauseCalls = 0;
  fixture.dom.window.HTMLMediaElement.prototype.play = function () { playCalls += 1; return Promise.resolve(); };
  fixture.dom.window.HTMLMediaElement.prototype.pause = function () { pauseCalls += 1; };
  try {
    await fixture.intersectPlayer(true);
    await fixture.flushIdle();
    const video = fixture.video()!;
    await act(async () => video.dispatchEvent(new fixture.dom.window.Event('playing')));
    await fixture.intersectPlayer(false);
    assert.ok(pauseCalls > 0);
    await fixture.intersectPlayer(true);
    assert.ok(playCalls >= 2, 'Visibility may resume automatic playback before a user pause');

    await act(async () => video.dispatchEvent(new fixture.dom.window.Event('playing')));
    await act(async () => fixture.container.querySelector<HTMLButtonElement>('button[aria-label="Pause"]')!.click());
    const callsAfterUserPause = playCalls;
    await fixture.intersectPlayer(false);
    await fixture.intersectPlayer(true);
    assert.equal(playCalls, callsAfterUserPause, 'Returning onscreen must retain an explicit user pause');

    Object.defineProperty(fixture.dom.window.document, 'visibilityState', { configurable: true, value: 'hidden' });
    await act(async () => fixture.dom.window.document.dispatchEvent(new fixture.dom.window.Event('visibilitychange')));
    assert.ok(pauseCalls >= 2);
  } finally {
    await fixture.cleanup();
  }
});

test('manual intent is consumed once and subsequent offscreen state suspends playback', async () => {
  const fixture = await mountHero({ desktop: false, reducedMotion: true });
  let playCalls = 0;
  fixture.dom.window.HTMLMediaElement.prototype.play = function () { playCalls += 1; return Promise.resolve(); };
  try {
    await fixture.intersectPlayer(true);
    await act(async () => fixture.container.querySelector<HTMLButtonElement>('button[aria-label="Play: Model 2"]')!.click());
    assert.equal(playCalls, 1, 'The explicit click starts immediately');
    await fixture.intersectPlayer(false);
    assert.equal(playCalls, 1, 'The consumed manual intent must not bypass later visibility suspension');
    await fixture.intersectPlayer(true);
    assert.equal(playCalls, 2, 'The mounted preview may resume when it becomes visible');
  } finally {
    await fixture.cleanup();
  }
});

test('reselecting the current Play-labelled thumbnail starts it again', async () => {
  const fixture = await mountHero();
  let playCalls = 0;
  fixture.dom.window.HTMLMediaElement.prototype.play = function () { playCalls += 1; return Promise.resolve(); };
  try {
    const selectedThumbnail = fixture.container.querySelector<HTMLButtonElement>('button[aria-label="Play: Model 1"]')!;
    await act(async () => selectedThumbnail.click());
    await act(async () => fixture.video()!.dispatchEvent(new fixture.dom.window.Event('playing')));
    await act(async () => selectedThumbnail.click());
    assert.equal(playCalls, 2);
    assert.equal(fixture.player().dataset.playbackState, 'loading');
  } finally {
    await fixture.cleanup();
  }
});

test('a mounted preview never schedules another initial idle load on visibility changes', async () => {
  const fixture = await mountHero({ desktop: true });
  try {
    await fixture.intersectPlayer(true);
    await fixture.flushIdle();
    await act(async () => fixture.video()!.dispatchEvent(new fixture.dom.window.Event('playing')));
    await fixture.intersectPlayer(false);
    await fixture.intersectPlayer(true);
    assert.equal(fixture.idle.size, 0);
    await act(async () => fixture.video()!.dispatchEvent(new fixture.dom.window.Event('playing')));
    await act(async () => fixture.container.querySelector<HTMLButtonElement>('button[aria-label="Pause"]')!.click());
    await fixture.intersectPlayer(false);
    await fixture.intersectPlayer(true);
    assert.equal(fixture.idle.size, 0, 'User-paused mounted media must not receive a late initial-load callback');
    assert.equal(fixture.player().dataset.playbackState, 'paused');
  } finally {
    await fixture.cleanup();
  }
});

test('new play and visibility actions invalidate same-element pending play promises', async () => {
  const fixture = await mountHero();
  const rejections: Array<(reason?: unknown) => void> = [];
  fixture.dom.window.HTMLMediaElement.prototype.play = function () {
    return new Promise((_, reject) => rejections.push(reject));
  };
  try {
    await act(async () => fixture.container.querySelector<HTMLButtonElement>('button[aria-label="Play: Model 1"]')!.click());
    await act(async () => fixture.container.querySelector<HTMLButtonElement>('button[aria-label="Play"]')!.click());
    await act(async () => {
      rejections[0]?.(new fixture.dom.window.DOMException('interrupted', 'AbortError'));
      await Promise.resolve();
    });
    assert.equal(fixture.player().dataset.playbackState, 'loading');
    await fixture.intersectPlayer(false);
    await act(async () => {
      rejections[1]?.(new fixture.dom.window.DOMException('interrupted', 'AbortError'));
      await Promise.resolve();
    });
    assert.notEqual(fixture.player().dataset.playbackState, 'error');
    await fixture.intersectPlayer(true);
    await act(async () => fixture.video()!.dispatchEvent(new fixture.dom.window.Event('playing')));
    await act(async () => fixture.container.querySelector<HTMLButtonElement>('button[aria-label="Pause"]')!.click());
    await act(async () => {
      rejections[2]?.(new fixture.dom.window.DOMException('interrupted', 'AbortError'));
      await Promise.resolve();
    });
    assert.equal(fixture.player().dataset.playbackState, 'paused');
  } finally {
    await fixture.cleanup();
  }
});

test('selection cancels stale idle work and stale media events cannot change the current state', async () => {
  const fixture = await mountHero({ desktop: true });
  let rejectStalePlay: ((reason?: unknown) => void) | undefined;
  fixture.dom.window.HTMLMediaElement.prototype.play = function () {
    const source = this.querySelector('source')?.getAttribute('src');
    if (source === '/hero/two.mp4') {
      return new Promise((_, reject) => { rejectStalePlay = reject; });
    }
    return Promise.resolve();
  };
  try {
    await fixture.intersectPlayer(true);
    assert.equal(fixture.idle.size, 1);
    const staleIdleId = [...fixture.idle.keys()][0];
    await act(async () => fixture.container.querySelector<HTMLButtonElement>('button[aria-label="Play: Model 2"]')!.click());
    assert.deepEqual(fixture.cancelledIdle, [staleIdleId]);
    const staleVideo = fixture.video()!;
    await act(async () => fixture.container.querySelector<HTMLButtonElement>('button[aria-label="Play: Model 1"]')!.click());
    assert.equal(fixture.video()?.querySelector('source')?.getAttribute('src'), '/hero/one.mp4');
    await act(async () => {
      rejectStalePlay?.(new Error('late failure'));
      await Promise.resolve();
      staleVideo.dispatchEvent(new fixture.dom.window.Event('playing'));
      staleVideo.dispatchEvent(new fixture.dom.window.Event('error'));
    });
    assert.equal(fixture.player().dataset.playbackState, 'loading');
    assert.ok(fixture.container.querySelector('button[aria-label="Play"]'));
  } finally {
    await fixture.cleanup();
  }
});

test('a native playback error announces a localized retry and remounts media before playing again', async () => {
  const fixture = await mountHero();
  let playCalls = 0;
  fixture.dom.window.HTMLMediaElement.prototype.play = function () {
    playCalls += 1;
    return playCalls === 1 ? Promise.reject(new Error('blocked')) : Promise.resolve();
  };
  try {
    await act(async () => fixture.container.querySelector<HTMLButtonElement>('button[aria-label="Play: Model 1"]')!.click());
    const video = fixture.video()!;
    await act(async () => video.dispatchEvent(new fixture.dom.window.Event('error')));
    assert.equal(video.getAttribute('poster'), null);
    assert.ok(video.classList.contains('opacity-0'));
    const status = fixture.container.querySelector<HTMLElement>('[role="status"]')!;
    assert.equal(status.textContent, 'Preview unavailable');
    const retry = fixture.container.querySelector<HTMLButtonElement>('button[aria-label="Retry preview"]')!;
    assert.ok(retry);
    await act(async () => retry.click());
    assert.equal(playCalls, 2);
    assert.notEqual(fixture.video(), video, 'Retry must reload the failed native media resource');
    assert.equal(status.textContent, 'Loading preview');
  } finally {
    await fixture.cleanup();
  }
});
