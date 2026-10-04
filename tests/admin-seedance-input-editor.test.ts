import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { CustomerTariffEditor } from '../frontend/app/(core)/admin/pricing/_hooks/useCustomerTariffEditor';

test('Seedance editor explains the minimum and previews one proportional rate without saving', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/admin/pricing' });
  const previous = new Map<string,PropertyDescriptor | undefined>();
  for (const [key,value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, React, IS_REACT_ACT_ENVIRONMENT: true })) {
    previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{ configurable: true, writable: true, value });
  }
  let proposal: unknown; let saves = 0;
  const editor = { busy: false, loading: false, editable: true, cancelPreview() {},
    async requestPreview(_: unknown,next: unknown) { proposal=next; }, async confirm() { saves++; },
    exact: { scenarioId: 'verified-scenario', continuousInputTariff: { prepared: true,
      inputCentsPerSecond: 68/7, seedanceMinimum: { minimumBillableSeconds: 7, includedInputSeconds: 3 } } },
  } as unknown as CustomerTariffEditor;
  const root = createRoot(dom.window.document.getElementById('root')!);
  try {
    const { SeedanceInputTariffEditor } = await import('../frontend/app/(core)/admin/pricing/_components/SeedanceInputTariffEditor.client');
    await act(async () => root.render(React.createElement(SeedanceInputTariffEditor,
      { editor, disabled: false, inputSeconds: 15, outputSeconds: 4 })));
    assert.match(dom.window.document.body.textContent!, /19.*billable seconds/);
    assert.match(dom.window.document.body.textContent!, /\$1\.85/);
    assert.match(dom.window.document.body.textContent!, /Minimum.*7/);
    const rate = dom.window.document.querySelector<HTMLInputElement>('input[aria-label="Customer price per billable second (USD)"]')!;
    await act(async () => { rate.value='0.10'; rate.dispatchEvent(new dom.window.Event('input',{ bubbles: true })); });
    assert.match(dom.window.document.body.textContent!, /\$1\.90/);
    const preview = [...dom.window.document.querySelectorAll('button')].find(el => el.textContent==='Preview proportional price')!;
    await act(async () => preview.click());
    assert.deepEqual(proposal,{ operation: 'update', scenarioId: 'verified-scenario', scope: 'continuous_input',
      price: { kind: 'seedance_billable', customerCentsPerBillableSecond: 10 } });
    assert.equal(saves,0);
  } finally {
    await act(async () => root.unmount());dom.window.close();
    for (const [key,descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis,key,descriptor); else Reflect.deleteProperty(globalThis,key); }
  }
});
