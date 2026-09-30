import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createPricingPolicyDraft, type PricingPolicyInventoryRow } from '../frontend/app/(core)/admin/pricing/_lib/pricing-cockpit-view-model';

test('inline product policy editor preserves inherited scope and locks all actions during preview', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/admin/pricing' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, React, IS_REACT_ACT_ENVIRONMENT: true })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const row: PricingPolicyInventoryRow = {
    selector: { engineId: 'audio-generation', mode: 'voice_only', resolution: 'audio' },
    databaseOverride: { id: 'default', marginPercent: 0.3, marginFlatCents: 0, surchargeAudioPercent: 0.2,
      surchargeUpscalePercent: 0.5, currency: 'USD' },
    versionedRule: null, effectiveProvenance: null, representativeQuotes: [], routingContext: null, lastEvent: null,
  };
  const draft = createPricingPolicyDraft(row, true);
  const root = createRoot(dom.window.document.getElementById('root')!);
  let previews = 0;
  let changes = 0;
  let closes = 0;
  try {
    const { ProductPolicyEditor } = await import('../frontend/app/(core)/admin/pricing/_components/ProductPolicyEditor.client');
    const render = (locked: boolean) => root.render(React.createElement(ProductPolicyEditor, { row, draft, locked, busy: locked,
      onChange: () => { changes++; }, onPreview: () => { previews++; }, onClose: () => { closes++; } }));
    await act(async () => render(false));
    assert.match(dom.window.document.body.textContent!, /voice_only/);
    assert.equal(dom.window.document.querySelectorAll('input').length, 4, 'only commercial fields are editable');
    const preview = [...dom.window.document.querySelectorAll('button')].find((button) => button.textContent === 'Preview policy change')!;
    await act(async () => preview.click());
    assert.equal(previews, 1);
    assert.equal(changes, 0);
    assert.equal(draft.engineId, 'audio-generation');
    assert.equal(draft.mode, 'voice_only');
    assert.equal(draft.resolution, 'audio');
    assert.notEqual(draft.id, 'default');
    await act(async () => render(true));
    assert.ok([...dom.window.document.querySelectorAll('input,button')].every((element) => (element as HTMLInputElement).disabled));
    await act(async () => [...dom.window.document.querySelectorAll('button')].forEach((button) => button.click()));
    assert.equal(previews, 1);
    assert.equal(closes, 0);
    assert.doesNotMatch(dom.window.document.body.textContent!, /Confirm and apply now/, 'confirmation belongs to the server preview dialog');
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
  }
});
