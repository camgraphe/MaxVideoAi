import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);

test('marketing motion uses observer geometry, protects initial content and cancels on navigation or preference change', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'marketing-motion-'));
  const output = join(directory, 'motion.cjs');
  const dom = new JSDOM('<div class="marketing-site"><main><section id="hero"></section><section id="below"></section><section id="above"></section></main></div><div id="root"></div>');
  const listeners = new Set<() => void>();
  let reduced = false;
  const media = { get matches() { return reduced; }, addEventListener: (_: string, fn: () => void) => listeners.add(fn), removeEventListener: (_: string, fn: () => void) => listeners.delete(fn) };
  const observers: Observer[] = [];
  class Observer {
    targets = new Set<Element>();
    disconnected = false;
    constructor(public callback: IntersectionObserverCallback) { observers.push(this); }
    observe = (target: Element) => this.targets.add(target);
    unobserve = (target: Element) => this.targets.delete(target);
    disconnect = () => { this.disconnected = true; this.targets.clear(); };
    emit(target: Element, top: number, intersecting: boolean, ratio: number, size = 600) {
      this.callback([{ target, isIntersecting: intersecting, intersectionRatio: ratio, boundingClientRect: { top, height: size, width: size }, rootBounds: { top: 0, bottom: 800 } } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
    }
  }
  Object.assign(dom.window, { matchMedia: () => media, IntersectionObserver: Observer, __motionPath: '/', innerHeight: 800 });
  let geometryReads = 0;
  dom.window.Element.prototype.getBoundingClientRect = function () { geometryReads++; return { top: this.id === 'below' ? 1200 : 0 } as DOMRect; };
  const animations: { target: Element; canceled: boolean }[] = [];
  dom.window.Element.prototype.animate = function () {
    const animation = { target: this, canceled: false };
    animations.push(animation);
    return { cancel: () => { animation.canceled = true; } } as Animation;
  };
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IntersectionObserver: Observer, React, IS_REACT_ACT_ENVIRONMENT: true };
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let root: ReturnType<typeof createRoot> | undefined;
  try {
    await build({
      entryPoints: ['frontend/components/marketing/MarketingMotion.client.tsx'], outfile: output,
      bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', tsconfig: 'frontend/tsconfig.json',
      plugins: [{ name: 'route-context', setup(builder) {
        builder.onResolve({ filter: /^@\/i18n\/navigation$/ }, () => ({ path: 'route', namespace: 'fixture' }));
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const usePathname=()=>window.__motionPath;', loader: 'js' }));
        builder.onResolve({ filter: /^react(?:\/.*)?$/ }, args => ({ path: require.resolve(args.path), external: true }));
      } }],
    });
    for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    const { MarketingMotion } = require(output);
    root = createRoot(dom.window.document.getElementById('root')!);
    await act(async () => root!.render(React.createElement(MarketingMotion)));
    assert.equal(geometryReads, 0, 'offscreen sections must not be synchronously laid out by the animation enhancement');
    const [hero, below, above] = [...dom.window.document.querySelectorAll('section')];
    const first = observers[0];
    first.emit(hero, 100, true, 1);
    first.emit(above, -500, false, 0);
    first.emit(below, 1200, false, 0);
    assert.equal(animations.length, 0, 'initial and previously passed content stays still');
    assert.equal(first.targets.has(hero), false);
    assert.equal(first.targets.has(above), false);
    first.emit(below, 799, true, 0.01);
    assert.equal(animations.length, 0, 'retain the original 8% entry threshold');
    first.emit(below, 650, true, 0.1);
    assert.equal(animations.length, 1);
    assert.equal(animations[0].target, below);
    assert.equal(first.targets.has(below), false);
    Object.assign(dom.window, { __motionPath: '/pricing' });
    await act(async () => root!.render(React.createElement(MarketingMotion)));
    assert.equal(first.disconnected, true);
    assert.equal(animations[0].canceled, true);
    const second = observers[1];
    second.emit(below, 1200, false, 0);
    second.emit(below, 600, true, 0.2);
    // A skipped content-visibility subtree initially reports a zero-size rectangle.
    Object.assign(dom.window, { __motionPath: '/deferred', scrollY: 0 });
    await act(async () => root!.render(React.createElement(MarketingMotion)));
    const deferred = observers[2];
    deferred.emit(below, 0, false, 0, 0);
    assert.equal(deferred.targets.has(below), true, 'unknown geometry must stay observed');
    Object.assign(dom.window, { scrollY: 1000 });
    deferred.emit(below, 300, true, 0.5);
    assert.equal(animations.length, 3, 'revealed below-fold section still animates after scrolling');
    assert.equal(deferred.targets.has(below), false);
    // An anchor arrival must also keep deferred content above that arrival still.
    Object.assign(dom.window, { __motionPath: '/anchor', scrollY: 3000 });
    await act(async () => root!.render(React.createElement(MarketingMotion)));
    const anchor = observers[3];
    anchor.emit(above, 0, false, 0, 0);
    Object.assign(dom.window, { scrollY: 500 });
    anchor.emit(above, 500, true, 0.5);
    assert.equal(animations.length, 3, 'scrolling back above the initial anchor never animates passed content');
    assert.equal(anchor.targets.has(above), false);
    anchor.emit(below, 4000, false, 0);
    Object.assign(dom.window, { scrollY: 3900 });
    anchor.emit(below, 600, true, 0.2);
    assert.equal(animations.length, 4);
    assert.equal(animations[3].canceled, false);
    assert.equal(anchor.disconnected, false);
    reduced = true;
    listeners.forEach(fn => fn());
    assert.equal(anchor.disconnected, true);
    assert.equal(animations[3].canceled, true);
    Object.assign(dom.window, { __motionPath: '/models' });
    await act(async () => root!.render(React.createElement(MarketingMotion)));
    assert.equal(observers.length, 4, 'reduced motion never starts an observer');
    assert.equal(geometryReads, 0);
  } finally {
    if (root) await act(async () => root!.unmount());
    dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
    await rm(directory, { recursive: true, force: true });
  }
});
