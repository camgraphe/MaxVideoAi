import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { CustomerTariffEditor } from '../frontend/app/(core)/admin/pricing/_hooks/useCustomerTariffEditor';

test('Kling billable rate input preserves the exact approved decimal rate in its preview proposal', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/admin/pricing' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, React, IS_REACT_ACT_ENVIRONMENT: true })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  const scenarioId = 'engineId=kling-v4|mode=ref2v|resolution=720p|durationSec=3|inputVideoDurationSec=3|billingInputType=video_input';
  const proposals: unknown[] = [];
  const editor = {
    exact: { modelId: 'kling-v4', scenarioId, selector: { durationSec: '3' },
      continuousInputTariff: { klingV4Billable: true, prepared: false, price: null,
        inputCentsPerSecond: 0, maxInputSeconds: 30 } },
    busy: false, loading: false, editable: true, cancelPreview() {},
    async requestPreview(_cents: number | undefined, proposal: unknown) { proposals.push(proposal); },
  } as unknown as CustomerTariffEditor;
  try {
    const { ContinuousInputTariffEditor } = await import('../frontend/app/(core)/admin/pricing/_components/ContinuousInputTariffEditor.client');
    await act(async () => root.render(React.createElement(ContinuousInputTariffEditor,
      { editor, disabled: false, inputSeconds: 3, outputSeconds: 3 })));
    const input = dom.window.document.querySelector('input')!;
    const preview = [...dom.window.document.querySelectorAll('button')]
      .find(button => button.textContent === 'Preview billable-second price')!;
    for (const [usd, cents] of [['0.141', 14.1], ['0.2115', 21.15], ['1.41e-1', 14.1], ['0.000000001', 0.0000001]] as const) {
      await act(async () => {
        input.value = usd;
        input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      });
      assert.equal(preview.disabled, false);
      const before = proposals.length;
      await act(async () => preview.click());
      assert.equal(proposals.length, before + 1);
      assert.deepEqual(proposals.at(-1), { operation: 'create', scenarioId, scope: 'continuous_input',
        price: { kind: 'kling_v4_billable', customerCentsPerBillableSecond: cents } });
    }
    for (const value of ['', '0', '-0.1']) {
      await act(async () => {
        input.value = value;
        input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      });
      assert.equal(preview.disabled, true, `invalid/nonpositive rate ${JSON.stringify(value)} cannot be proposed`);
      const before = proposals.length;
      await act(async () => preview.click());
      assert.equal(proposals.length, before);
    }
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
