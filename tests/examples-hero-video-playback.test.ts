import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';

import { ExamplesHeroVideo } from '../frontend/components/examples/ExamplesHeroVideo.client';
import { resolvePublicVideoRendition } from '../frontend/lib/public-video-renditions';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const ORIGINAL = 'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/6e299d72-22dd-46f4-8260-4d6887777558.mp4';

async function mountExample({ desktop, ready = 0 }: { desktop: boolean; ready?: number }) {
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
    get thresholds() { return [0.55]; }
    emit(target: Element, visible: boolean) {
      this.callback([{ target, isIntersecting: visible } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
    }
  }
  Object.defineProperty(dom.window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: query.includes('max-width') ? !desktop : false,
      addEventListener() {}, removeEventListener() {},
    }),
  });
  Object.defineProperty(dom.window.navigator, 'connection', { configurable: true, value: { saveData: false } });
  Object.defineProperty(dom.window.HTMLMediaElement.prototype, 'readyState', { configurable: true, get: () => ready });
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
  let loadCalls = 0;
  let playCalls = 0;
  let pauseCalls = 0;
  dom.window.HTMLMediaElement.prototype.load = function () { loadCalls += 1; };
  dom.window.HTMLMediaElement.prototype.play = function () { playCalls += 1; return Promise.resolve(); };
  dom.window.HTMLMediaElement.prototype.pause = function () { pauseCalls += 1; };
  const container = dom.window.document.querySelector<HTMLElement>('#root')!;
  const root = createRoot(container);
  await act(async () => root.render(React.createElement(ExamplesHeroVideo, {
    src: ORIGINAL, type: 'video/mp4', poster: '/poster.jpg', ariaLabel: 'Example', controls: true,
  })));
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
    loadCalls: () => loadCalls, playCalls: () => playCalls, pauseCalls: () => pauseCalls,
  };
}

test('mobile examples prepare one derivative with preload none without requesting media', async () => {
  const fixture = await mountExample({ desktop: false });
  try {
    assert.equal(fixture.video()?.getAttribute('preload'), 'none');
    assert.equal(
      fixture.video()?.querySelector('source')?.getAttribute('src'),
      resolvePublicVideoRendition(ORIGINAL, 'mobile').src,
    );
    assert.equal(fixture.loadCalls(), 0);
    assert.equal(fixture.playCalls(), 0);
  } finally {
    await fixture.cleanup();
  }
});

test('a native mobile Play intent is not cancelled by the autoplay policy', async () => {
  const fixture = await mountExample({ desktop: false, ready: 2 });
  try {
    const video = fixture.video()!;
    await act(async () => video.dispatchEvent(new fixture.dom.window.Event('play')));
    await act(async () => video.dispatchEvent(new fixture.dom.window.Event('loadeddata')));
    assert.ok(fixture.playCalls() >= 1, 'manual playback may continue after media becomes ready');
    assert.equal(fixture.pauseCalls(), 0, 'mobile autoplay blocking must not cancel an explicit native Play');
  } finally {
    await fixture.cleanup();
  }
});

test('examples retain a user pause across visibility changes', async () => {
  const fixture = await mountExample({ desktop: true, ready: 2 });
  try {
    const video = fixture.video()!;
    assert.ok(fixture.playCalls() >= 1);
    await act(async () => video.dispatchEvent(new fixture.dom.window.Event('playing')));
    await act(async () => video.dispatchEvent(new fixture.dom.window.Event('pause')));
    const callsAfterPause = fixture.playCalls();
    await fixture.emitVisibility(false);
    await fixture.emitVisibility(true);
    assert.equal(fixture.playCalls(), callsAfterPause);
  } finally {
    await fixture.cleanup();
  }
});

test('examples fallback once and expose a retry after the original also fails', async () => {
  const fixture = await mountExample({ desktop: false });
  try {
    const derivativeVideo = fixture.video()!;
    await act(async () => derivativeVideo.querySelector('source')!.dispatchEvent(new fixture.dom.window.Event('error')));
    const originalVideo = fixture.video()!;
    assert.notEqual(originalVideo, derivativeVideo);
    assert.equal(originalVideo.querySelector('source')?.getAttribute('src'), ORIGINAL);
    await act(async () => originalVideo.querySelector('source')!.dispatchEvent(new fixture.dom.window.Event('error')));
    const retry = fixture.container.querySelector<HTMLButtonElement>('button[aria-label="Retry preview"]')!;
    assert.ok(retry);
    await act(async () => retry.click());
    assert.equal(
      fixture.video()?.querySelector('source')?.getAttribute('src'),
      resolvePublicVideoRendition(ORIGINAL, 'mobile').src,
    );
  } finally {
    await fixture.cleanup();
  }
});

test('examples preserve native mute and volume through derivative fallback', async () => {
  const fixture = await mountExample({ desktop: true, ready: 2 });
  try {
    const derivativeVideo = fixture.video()!;
    derivativeVideo.muted = false;
    derivativeVideo.volume = 0.35;
    await act(async () => derivativeVideo.dispatchEvent(new fixture.dom.window.Event('volumechange')));
    await act(async () => derivativeVideo.querySelector('source')!.dispatchEvent(new fixture.dom.window.Event('error')));

    const originalVideo = fixture.video()!;
    assert.notEqual(originalVideo, derivativeVideo);
    assert.equal(originalVideo.querySelector('source')?.getAttribute('src'), ORIGINAL);
    assert.equal(originalVideo.muted, false, 'fallback must retain the user-selected native mute state');
    assert.equal(originalVideo.volume, 0.35, 'fallback must retain the user-selected native volume');
  } finally {
    await fixture.cleanup();
  }
});
