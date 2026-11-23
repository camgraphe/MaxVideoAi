import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { usePricingVideoPreset } from '../frontend/app/(core)/(workspace)/app/_hooks/usePricingVideoPreset';
import type { FormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-form-state';

test('a pricing click applies the four supported combinations after hydration, once, without touching creative inputs', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.test/app' });
  const globals = { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const root = createRoot(dom.window.document.getElementById('root')!);
  const changes: FormState[] = [];
  const cleared: unknown[] = [];
  function Fixture({ search, ready, engine }: { search: string; ready: boolean; engine: string }) {
    const initial: FormState = { engineId: engine, mode: 't2v', durationSec: 5, resolution: '720p', aspectRatio: '9:16',
      fps: 24, iterations: 3, audio: false, extraInputValues: {} };
    usePricingVideoPreset({ searchString: search, ready, form: initial,
      setForm(next) { const form = typeof next === 'function' ? next(initial) : next; if (form) changes.push(form); },
      setVoiceIdsInput: ids => cleared.push(ids), setMultiPromptEnabled: enabled => cleared.push(enabled) });
    return null;
  }
  try {
    for (const engine of ['kling-3-standard', 'kling-3-pro']) for (const sound of [false, true]) {
      const search = `engine=${engine}&mode=t2v&pricingPreset=10s-1080p${sound ? '-audio' : ''}&lang=fr`;
      const start = changes.length;
      const show = async (query: string, ready: boolean, activeEngine = engine) => {
        dom.window.history.replaceState({}, '', '/app?' + query);
        await React.act(async () => root.render(React.createElement(Fixture, { search: query, ready, engine: activeEngine })));
      };
      await show(search, false);
      await show(search, true, 'other');
      await show(search + '&from=film', true);
      assert.equal(changes.length, start);
      await show(search, true);
      assert.equal(changes.length, start + 1);
      const applied = changes.at(-1)!;
      assert.deepEqual([applied.durationSec, applied.durationOption, applied.resolution, applied.audio, applied.iterations],
        [10, 10, '1080p', sound, 1]);
      assert.equal(applied.aspectRatio, '9:16');
      assert.deepEqual(cleared.slice(-2), [false, '']);
      assert.ok(!dom.window.location.search.includes('pricingPreset'));
      assert.ok(dom.window.location.search.includes('lang=fr'));
      await React.act(async () => root.render(React.createElement(Fixture, { search, ready: true, engine })));
      assert.equal(changes.length, start + 1);
    }
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
