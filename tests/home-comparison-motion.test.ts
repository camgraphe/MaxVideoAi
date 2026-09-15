import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { HomeComparisonScores } from '../frontend/components/marketing/home/HomeComparisonScores.client';

test('comparison animates once on entry, ends at exact scores and respects reduced motion', async () => {
  for (const reduced of [false, true]) {
    const dom = new JSDOM('<div id="root"></div>', {url:'http://localhost'});
    let enter: IntersectionObserverCallback | undefined;
    let frame: FrameRequestCallback | undefined;
    let change: (() => void) | undefined;
    const query = { matches: reduced, addEventListener: (_: string, fn: () => void) => { change = fn; }, removeEventListener() {} };
    Object.defineProperty(dom.window, 'matchMedia', { value: () => query });
    const values = { window: dom.window, document: dom.window.document, React, IS_REACT_ACT_ENVIRONMENT: true,
      IntersectionObserver: class { constructor(fn: IntersectionObserverCallback) { enter = fn; } observe() {} disconnect() {} },
      requestAnimationFrame: (fn: FrameRequestCallback) => { frame = fn; return 1; }, cancelAnimationFrame: () => { frame = undefined; } };
    const previous = new Map(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { configurable: true, value });
    const container = dom.window.document.getElementById('root')!;
    const root = createRoot(container);
    const scores = () => [...container.querySelectorAll<HTMLElement>('.paired-dot')].map(n => n.style.left);
    try {
      await act(async () => root.render(React.createElement(HomeComparisonScores, {label:'Editorial /10', metrics:[{id:'a',label:'Quality',leftValue:8.4,rightValue:9.2},{id:'b',label:'Missing',leftValue:0,rightValue:null}]})));
      assert.deepEqual(scores(), ['84%','92%','0%']);
      if (reduced) { assert.equal(enter, undefined); assert.equal(frame, undefined); continue; }
      const emit = () => enter!([{isIntersecting:true} as IntersectionObserverEntry], {} as IntersectionObserver);
      await act(async () => emit());
      assert.deepEqual(scores(), ['0%','0%','0%']);
      await act(async () => frame!(performance.now() + 1200));
      assert.deepEqual(scores(), ['84%','92%','0%']);
      await act(async () => emit());
      assert.deepEqual(scores(), ['84%','92%','0%'], 'Re-entry must not restart the count');
      query.matches = true;
      await act(async () => change!());
      assert.equal(frame, undefined);
    } finally {
      await act(async () => root.unmount());
      dom.window.close();
      for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
    }
  }
});
