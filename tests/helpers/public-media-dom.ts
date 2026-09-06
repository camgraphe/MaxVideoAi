import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';

// JSDOM has no media decoder, layout observer or browser playback permission model.
// Keep React and the production readers real; emulate only those browser boundaries.
export async function mountPublicMedia(element: React.ReactElement, options: { width?: number; saveData?: boolean; reducedMotion?: boolean } = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', pretendToBeVisual: true });
  const observers: Observer[] = [];
  class Observer {
    targets = new Set<Element>();
    constructor(private callback: IntersectionObserverCallback) { observers.push(this); }
    observe(target: Element) { this.targets.add(target); }
    unobserve(target: Element) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); }
    emit(visible: boolean) {
      this.callback([...this.targets].map((target) => ({ target, isIntersecting: visible }) as IntersectionObserverEntry), this as unknown as IntersectionObserver);
    }
  }
  const width = options.width ?? 390;
  Object.defineProperty(dom.window, 'innerWidth', { value: width });
  Object.defineProperty(dom.window, 'matchMedia', { value: (query: string) => ({
    matches: query.includes('max-width: 767') ? width < 768 : query.includes('prefers-reduced-motion') ? Boolean(options.reducedMotion) : false,
    addEventListener() {}, removeEventListener() {},
  }) });
  Object.defineProperty(dom.window.navigator, 'connection', { value: { saveData: options.saveData ?? false } });
  let documentVisible = true;
  Object.defineProperty(dom.window.document, 'visibilityState', { get: () => documentVisible ? 'visible' : 'hidden' });
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    IntersectionObserver: Observer, React, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const state = new WeakMap<HTMLMediaElement, { paused: boolean; ready: number; error: MediaError | null }>();
  const mediaState = (node: HTMLMediaElement) => {
    let value = state.get(node);
    if (!value) { value = { paused: true, ready: 0, error: null }; state.set(node, value); }
    return value;
  };
  const proto = dom.window.HTMLMediaElement.prototype;
  Object.defineProperty(proto, 'paused', { get(this: HTMLMediaElement) { return mediaState(this).paused; } });
  Object.defineProperty(proto, 'readyState', { get(this: HTMLMediaElement) { return mediaState(this).ready; } });
  Object.defineProperty(proto, 'error', { get(this: HTMLMediaElement) { return mediaState(this).error; } });
  Object.defineProperty(proto, 'duration', { get() { return 15; } });
  Object.defineProperty(proto, 'currentSrc', { get(this: HTMLMediaElement) { return this.src; } });
  const plays: string[] = [];
  let loads = 0;
  let nextPlay: (() => Promise<void>) | undefined;
  proto.play = function () {
    const src = this.getAttribute('src') ?? this.querySelector('source')?.getAttribute('src') ?? '';
    plays.push(src); mediaState(this).paused = false;
    this.dispatchEvent(new dom.window.Event('play'));
    const result = nextPlay?.() ?? Promise.resolve(); nextPlay = undefined;
    return result;
  };
  proto.pause = function () {
    if (mediaState(this).paused) return;
    mediaState(this).paused = true; this.dispatchEvent(new dom.window.Event('pause'));
  };
  proto.load = function () { loads += 1; };
  const container = dom.window.document.querySelector<HTMLElement>('#root')!;
  const root = createRoot(container);
  const render = async (next: React.ReactElement) => { await act(async () => root.render(next)); };
  await render(element);
  const video = () => container.querySelector<HTMLVideoElement>('video')!;
  const emit = async (name: string, node = video()) => {
    if (name === 'playing') mediaState(node).ready = 4;
    if (name === 'loadedmetadata') { mediaState(node).ready = 1; mediaState(node).error = null; }
    await act(async () => node.dispatchEvent(new dom.window.Event(name)));
  };
  return {
    dom, container, video, render, emit, plays, loads: () => loads,
    source: () => video().getAttribute('src') ?? video().querySelector('source')?.getAttribute('src'),
    nextPlay(result: () => Promise<void>) { nextPlay = result; },
    async fail(code = 2) {
      mediaState(video()).error = { code, message: 'Media failed' } as MediaError;
      await emit('error');
    },
    async click(label: string) {
      const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
      if (!button) throw new Error(`Missing button: ${label}`);
      await act(async () => button.click());
    },
    async selectQuality(value: string) {
      const select = container.querySelector<HTMLSelectElement>('select');
      if (!select) throw new Error('Missing quality choice');
      await act(async () => { select.value = value; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    },
    async visible(visible: boolean) { await act(async () => { for (const observer of observers) observer.emit(visible); }); },
    async documentVisible(visible: boolean) {
      documentVisible = visible;
      await act(async () => dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange')));
    },
    async cleanup() {
      await act(async () => root.unmount()); dom.window.close();
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}
