import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { SWRConfig } from 'swr';
import { useEngines } from '../frontend/lib/api-engines';

test('optional engine timing cannot block or replace the fast catalog, and arrives as observed metadata', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  let resolveTiming!: (response: Response) => void;
  const requests: string[] = [];
  const nativeSetTimeout = globalThis.setTimeout;
  for (const [key, value] of Object.entries({ setTimeout: (callback: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => {
    const timer = nativeSetTimeout(callback, delay, ...args);
    if ((delay ?? 0) >= 60_000) timer.unref();
    return timer;
  }, window: dom.window, document: dom.window.document, navigator: dom.window.navigator, React, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (input: string) => {
      requests.push(input);
      if (input.includes('/averages')) return new Promise<Response>((resolve) => { resolveTiming = resolve; });
      return new Response(JSON.stringify({ engines: [{ id: 'veo-3-1', label: 'Veo 3.1' }], engineScores: {} }));
    },
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  let latest!: ReturnType<typeof useEngines>;
  function Fixture() { latest = useEngines('video', { includeAverages: true }); return null; }
  const root = createRoot(dom.window.document.getElementById('root')!);
  try {
    await act(async () => root.render(React.createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, React.createElement(Fixture))));
    assert.equal(latest.data?.engines[0]?.id, 'veo-3-1');
    assert.equal(latest.isLoading, false, 'timing is still pending but catalog is usable');
    assert.deepEqual(requests.sort(), ['/api/engines', '/api/engines/averages?category=video']);
    await act(async () => resolveTiming(new Response(JSON.stringify({ source: 'completion_event', averages: { 'veo-3-1': 98000 }, samples: { 'veo-3-1': 6 } }))));
    assert.equal(latest.data?.engines[0]?.avgDurationMs, 98000);
    assert.equal(latest.data?.engines[0]?.durationSampleCount, 6);
    assert.equal(latest.data?.engines[0]?.durationSource, 'completion_event');
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
  }
});
