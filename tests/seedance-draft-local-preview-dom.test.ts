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
  let prompt = 'A valley';
  let result: ReturnType<typeof useSeedanceDraftLocalPreview>;
  function Fixture() {
    result = useSeedanceDraftLocalPreview({ enabled, form, engineId, mode: 't2v', prompt,
      onResolutionChange: (value) => resolutions.push(value), showNotice: (value) => notices.push(value) });
    return null;
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  await act(async () => root.render(React.createElement(Fixture)));
  return { requests, resolutions, notices, get preview() { return result!; },
    async updatePrompt(value: string) { prompt = value; await act(async () => root.render(React.createElement(Fixture))); },
    async respond(body: unknown, index = 0) { await act(async () => requests[index].resolve(new Response(JSON.stringify(body), { status: 200 }))); },
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
    assert.equal(f.requests.length, 2, 'trial and optional final are separately quoted by the same public owner');
    assert.deepEqual(f.requests.map(({ url }) => url), ['/api/pricing/quote', '/api/pricing/quote']);
    assert.deepEqual(f.requests[0].body, { modelId: 'seedance-2-5', mode: 't2v', durationSec: 5,
      aspectRatio: '16:9', audio: false, resolution: '480p' });
    assert.deepEqual(f.requests[1].body, { modelId: 'seedance-2-5', mode: 't2v', durationSec: 5,
      aspectRatio: '16:9', audio: false, resolution: '1080p' });
    await f.respond({ status: 'exact', amountCents: 129, currency: 'USD', revision: 'current', scenarioLabel: '5s 480p' });
    await f.respond({ status: 'exact', amountCents: 651, currency: 'USD', revision: 'current', scenarioLabel: '5s 1080p' }, 1);
    await pending!;
    assert.equal(f.preview.finalQuote?.status, 'exact');
    assert.equal(f.preview.trialQuote?.status, 'exact');
    assert.equal(f.preview.combinedReferenceCents, 780);
    await act(async () => f.preview.confirmSimulation());
    assert.equal(f.preview.phase, 'final');
    assert.equal(f.requests.length, 2, 'confirmation is still a UI simulation, with no generation or payment request');
  } finally { await f.dispose(); }
});

test('editing the idea keeps the trial mode selected while discarding the previous result and late prices', async () => {
  const f = await mount();
  try {
    await act(async () => f.preview.toggle());
    await act(async () => f.preview.generate());
    let pending: Promise<void>;
    await act(async () => { pending = f.preview.requestFinal(); });
    await f.updatePrompt('A different idea');
    assert.equal(f.preview.selected, true, 'editing the prompt must not silently switch back to direct generation');
    assert.equal(f.preview.phase, 'setup');
    assert.equal(f.preview.snapshot, null);
    await f.respond({ status: 'exact', amountCents: 129, currency: 'USD' });
    await f.respond({ status: 'exact', amountCents: 651, currency: 'USD' }, 1);
    await pending!;
    assert.equal(f.preview.trialQuote, null);
    assert.equal(f.preview.finalQuote, null);
    await act(async () => f.preview.confirmSimulation());
    assert.equal(f.preview.phase, 'setup');
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
    assert.equal(f.requests.length, 2, 'both references must have been requested before cancellation');
    await f.respond({ status: 'exact', amountCents: 651, currency: 'USD', revision: 'old', scenarioLabel: 'old' });
    await f.respond({ status: 'exact', amountCents: 651, currency: 'USD', revision: 'old', scenarioLabel: 'old' }, 1);
    await pending!;
    assert.equal(f.preview.phase, 'draft'); assert.equal(f.preview.finalQuote, null); assert.equal(f.preview.trialQuote, null);
    await act(async () => f.preview.confirmSimulation());
    assert.equal(f.preview.phase, 'draft');
  } finally { await f.dispose(); }
});

test('the preview does not confirm an incomplete or incompatible pair of price references', async () => {
  for (const final of [
    { status: 'unavailable' },
    { status: 'exact', amountCents: 651, currency: 'EUR' },
    { status: 'exact', amountCents: Number.MAX_SAFE_INTEGER, currency: 'USD' },
  ]) {
    const f = await mount();
    try {
      await act(async () => f.preview.toggle());
      await act(async () => f.preview.generate());
      let pending: Promise<void>;
      await act(async () => { pending = f.preview.requestFinal(); });
      assert.equal(f.requests.length, 2);
      await f.respond({ status: 'exact', amountCents: 129, currency: 'USD' });
      await f.respond(final, 1);
      await pending!;
      assert.equal(f.preview.finalQuote, null);
      assert.equal(f.preview.trialQuote, null);
      assert.equal(f.preview.combinedReferenceCents, null);
      assert.ok(f.preview.error);
      await act(async () => f.preview.confirmSimulation());
      assert.equal(f.preview.phase, 'confirm');
    } finally { await f.dispose(); }
  }
});
