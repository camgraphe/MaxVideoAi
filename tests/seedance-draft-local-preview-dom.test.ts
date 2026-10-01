import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useSeedanceDraftLocalPreview } from '../frontend/app/(core)/(workspace)/app/_hooks/useSeedanceDraftLocalPreview';

async function mount(enabled = true, engineId = 'seedance-2-5') {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app?draftPreview=1' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const requests: { url: string; body: unknown; resolve: (value: Response) => void }[] = [];
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: (url: string, options: RequestInit) => new Promise<Response>((resolve) => {
      requests.push({ url, body: JSON.parse(String(options.body)), resolve });
    }),
  })) { previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); }
  const resolutions: string[] = [], notices: string[] = [];
  const form = { engineId, mode: 't2v' as const, durationSec: 5, resolution: '720p', aspectRatio: '16:9',
    audio: false, fps: 24, iterations: 1, extraInputValues: {} };
  let result: ReturnType<typeof useSeedanceDraftLocalPreview>;
  function Fixture() {
    result = useSeedanceDraftLocalPreview({ enabled, form, engineId, mode: 't2v', prompt: 'A valley',
      onResolutionChange: (value) => resolutions.push(value), showNotice: (value) => notices.push(value) });
    return null;
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  await act(async () => root.render(React.createElement(Fixture)));
  return { requests, resolutions, notices, get preview() { return result!; },
    async respond(body: unknown) { await act(async () => requests[0].resolve(new Response(JSON.stringify(body), { status: 200 }))); },
    async dispose() { await act(async () => root.unmount()); dom.window.close(); for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    } },
  };
}

test('the local Draft demonstration changes only preview state and quotes the inherited final through the public owner', async () => {
  const f = await mount();
  try {
    assert.equal(f.preview.selected, false);
    await act(async () => f.preview.toggle());
    assert.equal(f.preview.selected, true);
    assert.deepEqual(f.resolutions, ['480p']);
    await act(async () => f.preview.generate());
    assert.equal(f.preview.phase, 'draft');
    assert.deepEqual(f.requests, [], 'creating the visual Draft cannot submit a provider or generation request');
    let pending: Promise<void>;
    await act(async () => { pending = f.preview.requestFinal(); });
    assert.equal(f.requests[0].url, '/api/pricing/quote');
    assert.deepEqual(f.requests[0].body, { modelId: 'seedance-2-5', mode: 't2v', durationSec: 5,
      aspectRatio: '16:9', audio: false, resolution: '1080p' });
    await f.respond({ status: 'exact', amountCents: 651, currency: 'USD', revision: 'current', scenarioLabel: '5s 1080p' });
    await pending!;
    assert.equal(f.preview.finalQuote?.status, 'exact');
    await act(async () => f.preview.confirmSimulation());
    assert.equal(f.preview.phase, 'final');
    assert.equal(f.requests.length, 1, 'confirmation is still a UI simulation, with no generation or payment request');
  } finally { await f.dispose(); }
});

test('the preview does not expose Draft for another model or a disabled page', async () => {
  for (const [enabled, engine] of [[false, 'seedance-2-5'], [true, 'seedance-2-0-mini']] as const) {
    const f = await mount(enabled, engine);
    try { assert.equal(f.preview.available, false); await act(async () => f.preview.toggle());
      assert.equal(f.preview.selected, false); assert.deepEqual(f.resolutions, []); assert.deepEqual(f.requests, []);
    } finally { await f.dispose(); }
  }
});

test('a cancelled final preview cannot reopen or complete the final when a late quote arrives', async () => {
  const f = await mount();
  try {
    await act(async () => f.preview.toggle()); await act(async () => f.preview.generate());
    let pending: Promise<void>;
    await act(async () => { pending = f.preview.requestFinal(); });
    await act(async () => f.preview.cancel());
    assert.equal(f.requests.length, 1, 'a final quote must have been requested before cancellation');
    await f.respond({ status: 'exact', amountCents: 651, currency: 'USD', revision: 'old', scenarioLabel: 'old' });
    await pending!;
    assert.equal(f.preview.phase, 'draft'); assert.equal(f.preview.finalQuote, null);
    await act(async () => f.preview.confirmSimulation());
    assert.equal(f.preview.phase, 'draft');
  } finally { await f.dispose(); }
});
