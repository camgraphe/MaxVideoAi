import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { ModelHeroMedia } from '../frontend/components/marketing/ModelHeroMedia.client';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const PUBLIC_ORIGINAL = 'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/6e299d72-22dd-46f4-8260-4d6887777558.mp4';

async function mountModelPreview({
  automatic = false,
  readyState = 2,
}: { automatic?: boolean; readyState?: number } = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', pretendToBeVisual: true });
  const observers: MockIntersectionObserver[] = [];
  class MockIntersectionObserver {
    private callback: IntersectionObserverCallback;
    targets = new Set<Element>();
    constructor(callback: IntersectionObserverCallback) { this.callback = callback; observers.push(this); }
    observe(target: Element) { this.targets.add(target); }
    unobserve(target: Element) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); }
    takeRecords() { return []; }
    get root() { return null; }
    get rootMargin() { return '0px'; }
    get thresholds() { return [0.01]; }
    emit(target: Element, visible: boolean) {
      this.callback([{ target, isIntersecting: visible } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
    }
  }
  Object.defineProperty(dom.window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  });
  Object.defineProperty(dom.window.navigator, 'connection', { configurable: true, value: { saveData: false } });
  Object.defineProperty(dom.window.HTMLMediaElement.prototype, 'readyState', { configurable: true, get: () => readyState });
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    IntersectionObserver: MockIntersectionObserver,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const previous = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  let playCalls = 0;
  dom.window.HTMLMediaElement.prototype.play = function () { playCalls += 1; return Promise.resolve(); };
  dom.window.HTMLMediaElement.prototype.pause = function () {};
  const container = dom.window.document.querySelector<HTMLElement>('#root')!;
  const root = createRoot(container);
  await act(async () => root.render(React.createElement(ModelHeroMedia, {
    posterSrc: '/renders/model.jpg',
    videoSrc: PUBLIC_ORIGINAL,
    alt: 'Model example',
    sizes: '100vw',
    autoPlayDelayMs: automatic ? 1 : undefined,
  })));
  if (automatic) await act(async () => new Promise((resolve) => dom.window.setTimeout(resolve, 10)));
  const video = () => container.querySelector<HTMLVideoElement>('video');
  const emitVisibility = async (visible: boolean) => {
    const target = container.firstElementChild!;
    const observer = observers.find((candidate) => candidate.targets.has(target));
    assert.ok(observer);
    await act(async () => observer.emit(target, visible));
  };
  const cleanup = async () => {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  };
  return {
    dom, container, video, emitVisibility, cleanup,
    playCalls: () => playCalls,
  };
}

test('the active workspace preview keeps its optimized cover until ready without a native poster', async () => {
  const require = createRequire(import.meta.url);
  const previousCssLoader = require.extensions['.css'];
  require.extensions['.css'] = () => {};
  let CompositePreviewDockTile;
  try {
    ({ CompositePreviewDockTile } = await import('../frontend/components/groups/CompositePreviewDockTile'));
  } finally {
    if (previousCssLoader) require.extensions['.css'] = previousCssLoader;
    else delete require.extensions['.css'];
  }
  for (const ready of [false, true]) {
    const markup = renderToStaticMarkup(React.createElement(CompositePreviewDockTile, {
      item: { id: 'take', url: '/renders/take.mp4', thumb: '/renders/take.jpg', aspect: '16:9' },
      itemKey: 'take', activeVideoKey: 'take', index: 0, tileCount: 1,
      isPlaying: true, isVideoReady: ready, isSingleLayout: true, isMuted: true, isLooping: true,
      showGroupError: false, markReady() {}, onVideoCanPlay() {}, onVideoLoadedData() {},
      registerVideo: () => () => {},
    }));
    const dom = new JSDOM(markup);
    try {
      const image = dom.window.document.querySelector('img')!;
      const video = dom.window.document.querySelector('video')!;
      assert.ok(image);
      assert.ok(video);
      assert.match(image.src, /^\/_next\/image\?/);
      assert.equal(image.classList.contains('opacity-0'), ready);
      assert.equal(video.getAttribute('poster'), null);
      assert.equal(video.getAttribute('src'), '/renders/take.mp4');
    } finally {
      dom.window.close();
    }
  }
});

test('model preview retains its cover during loading and on failure without fetching a native poster', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  const globals = { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  dom.window.HTMLMediaElement.prototype.play = async () => {};
  const container = dom.window.document.querySelector<HTMLElement>('#root')!;
  const root = createRoot(container);
  try {
    await act(async () => root.render(React.createElement(ModelHeroMedia, {
      posterSrc: '/renders/model.jpg', videoSrc: '/renders/model.mp4', alt: 'Model example', sizes: '100vw',
    })));
    assert.equal(container.querySelector('video'), null, 'Manual previews must not mount video before interaction');
    const image = container.querySelector('img')!;
    assert.match(image.src, /\/_next\/image\?/);
    await act(async () => container.querySelector<HTMLButtonElement>('button')!.click());
    const video = container.querySelector('video')!;
    assert.ok(video);
    assert.equal(video.getAttribute('poster'), null);
    assert.ok(video.classList.contains('opacity-0'), 'The optimized cover stays visible until a frame is available');
    await act(async () => video.dispatchEvent(new dom.window.Event('loadeddata')));
    assert.ok(video.classList.contains('opacity-100'), 'A loaded video must become visible');
    await act(async () => video.dispatchEvent(new dom.window.Event('error')));
    assert.ok(video.classList.contains('opacity-0'), 'A failed video must reveal its cover');
    assert.ok(container.contains(image), 'Keep the optimized image as the fallback throughout playback');
    const retry = container.querySelector<HTMLButtonElement>('button[aria-label="Retry preview"]')!;
    assert.ok(retry, 'A terminal model preview error must expose a retry');
    await act(async () => retry.click());
    assert.notEqual(container.querySelector('video'), video, 'Retry must remount the failed media resource');
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test('model fallback cannot autoplay after a user pause', async () => {
  const fixture = await mountModelPreview();
  try {
    await act(async () => fixture.container.querySelector<HTMLButtonElement>('button[aria-label="Play preview"]')!.click());
    const derivativeVideo = fixture.video()!;
    assert.ok(fixture.playCalls() >= 1);
    assert.equal(derivativeVideo.autoplay, false, 'model playback must use the guarded play path');

    await act(async () => derivativeVideo.dispatchEvent(new fixture.dom.window.Event('pause')));
    const callsAfterPause = fixture.playCalls();
    await act(async () => derivativeVideo.querySelector('source')!.dispatchEvent(new fixture.dom.window.Event('error')));

    const originalVideo = fixture.video()!;
    assert.notEqual(originalVideo, derivativeVideo);
    assert.equal(originalVideo.querySelector('source')?.getAttribute('src'), PUBLIC_ORIGINAL);
    assert.equal(originalVideo.autoplay, false);
    assert.equal(fixture.playCalls(), callsAfterPause, 'fallback must not bypass the retained user pause');
    await fixture.emitVisibility(false);
    await fixture.emitVisibility(true);
    assert.equal(fixture.playCalls(), callsAfterPause, 'visibility changes must not resume a user-paused fallback');
  } finally {
    await fixture.cleanup();
  }
});

test('model explicit Play requests cold playback before loadeddata', async () => {
  const fixture = await mountModelPreview({ readyState: 0 });
  try {
    await act(async () => fixture.container.querySelector<HTMLButtonElement>('button[aria-label="Play preview"]')!.click());
    const video = fixture.video()!;
    assert.ok(video, 'explicit Play must mount the selected source');
    assert.notEqual(video.querySelector('source')?.getAttribute('src'), PUBLIC_ORIGINAL);
    assert.equal(video.classList.contains('opacity-0'), true, 'the cover remains until media is actually ready');
    assert.equal(fixture.playCalls(), 1, 'explicit Play must request playback without waiting for loadeddata');
  } finally {
    await fixture.cleanup();
  }
});

test('model delayed automatic playback requests metadata-only media before loadeddata', async () => {
  const fixture = await mountModelPreview({ automatic: true, readyState: 1 });
  try {
    const video = fixture.video()!;
    assert.ok(video, 'eligible automatic playback must mount the selected source');
    assert.equal(video.classList.contains('opacity-0'), true, 'metadata alone must not hide the cover');
    assert.equal(fixture.playCalls(), 1, 'automatic playback must request data beyond metadata without a loadeddata event');
  } finally {
    await fixture.cleanup();
  }
});

test('model automatic fallback waits offscreen and resumes through the visibility guard', async () => {
  const fixture = await mountModelPreview({ automatic: true });
  try {
    const derivativeVideo = fixture.video()!;
    assert.ok(derivativeVideo, 'eligible automatic playback must still mount the selected source');
    assert.ok(fixture.playCalls() >= 1, 'eligible automatic playback must still use the guarded play path');
    assert.equal(derivativeVideo.autoplay, false);

    await fixture.emitVisibility(false);
    const callsWhileHidden = fixture.playCalls();
    await act(async () => derivativeVideo.querySelector('source')!.dispatchEvent(new fixture.dom.window.Event('error')));
    const originalVideo = fixture.video()!;
    assert.notEqual(originalVideo, derivativeVideo);
    assert.equal(originalVideo.querySelector('source')?.getAttribute('src'), PUBLIC_ORIGINAL);
    assert.equal(fixture.playCalls(), callsWhileHidden, 'offscreen fallback must not start autonomously');

    await fixture.emitVisibility(true);
    assert.equal(fixture.playCalls(), callsWhileHidden + 1, 'eligible fallback should resume through the guarded visibility transition');
  } finally {
    await fixture.cleanup();
  }
});
