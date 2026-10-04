import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

test('continuous editor submits absolute base/source prices only through preview and cancels approval on input changes', async () => {
  const dom = new JSDOM('<div id="root"></div>');
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    React, IS_REACT_ACT_ENVIRONMENT: true })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  const proposals: unknown[] = [];
  let cancelled = 0;
  const root = createRoot(dom.window.document.getElementById('root')!);
  const editor = { editable: true, busy: false, loading: false, inventory: { active: false },
    exact: { scenarioId: 'exact-source', continuousInputTariff: { prepared: false, outputCents: 65, inputCentsPerSecond: 13, maxInputSeconds: 15 } },
    requestPreview: async (_: unknown, proposal: unknown) => { proposals.push(proposal); }, cancelPreview: () => { cancelled++; } };
  const button = (label: string) => [...dom.window.document.querySelectorAll('button')].find(el => el.textContent === label)!;
  try {
    const { ContinuousInputTariffEditor } = await import('../frontend/app/(core)/admin/pricing/_components/ContinuousInputTariffEditor.client');
    await act(async () => root.render(React.createElement(ContinuousInputTariffEditor, { editor: editor as never, disabled: false, inputSeconds: 3.25, outputSeconds: 5 })));
    assert.equal(proposals.length, 0, 'opening an editor cannot save or preview automatically');
    assert.match(dom.window.document.body.textContent!, /\$1\.07/);
    await act(async () => button('Preserve current prices').click());
    assert.deepEqual(proposals.pop(), { operation: 'create', scenarioId: 'exact-source', scope: 'continuous_input', price: { kind: 'preserve_current' } });
    const input = dom.window.document.querySelector('[aria-label="Output video price per second (USD)"]') as HTMLInputElement;
    assert.equal(input.value, '0.13');
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, '0.16');
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    assert.equal(cancelled, 1);
    await act(async () => button('Preview unit prices').click());
    assert.deepEqual(proposals.pop(), { operation: 'create', scenarioId: 'exact-source', scope: 'continuous_input', price: { kind: 'linear_input', outputCents: 80, inputCentsPerSecond: 13 } });
    assert.equal(dom.window.document.querySelectorAll('button').length, 2, 'confirmation belongs to the shared server review');
    Object.assign(editor.exact.continuousInputTariff, { kind: 'audio', outputCents: 0, inputCentsPerSecond: 22.1,
      minInputSeconds: 2, maxInputSeconds: 10 });
    await act(async () => root.render(React.createElement(ContinuousInputTariffEditor, { key: 'audio',
      editor: editor as never, disabled: false, inputSeconds: 3.25, outputSeconds: 3.25 })));
    assert.ok(!dom.window.document.querySelector('[aria-label="Output video price per second (USD)"]'));
    assert.ok(dom.window.document.querySelector('[aria-label="Source audio price per second (USD)"]'));
    assert.match(dom.window.document.body.textContent!, /\$0\.72/);
    await act(async () => button('Preview unit prices').click());
    assert.deepEqual(proposals.pop(), { operation: 'create', scenarioId: 'exact-source', scope: 'continuous_input',
      price: { kind: 'linear_input', outputCents: 0, inputCentsPerSecond: 22.1 } });
    Object.assign(editor.exact, { modelId: 'gemini-omni-flash' });
    Object.assign(editor.exact.continuousInputTariff, { kind: 'video', outputVaries: true, outputCents: 49,
      inputCentsPerSecond: 2, maxInputSeconds: 10 });
    await act(async () => root.render(React.createElement(ContinuousInputTariffEditor, { key: 'omni',
      editor: editor as never, disabled: false, inputSeconds: 3.25, outputSeconds: 3.25 })));
    await act(async () => button('Preview unit prices').click());
    const omni = proposals.pop() as { price: { kind: string; outputCentsPerSecond: number; inputCentsPerSecond: number } };
    assert.equal(omni.price.kind, 'linear_video');
    assert.ok(Math.abs(omni.price.outputCentsPerSecond - 49 / 3.25) < 1e-7);
    assert.equal(omni.price.inputCentsPerSecond, 2);
    Object.assign(editor.exact.continuousInputTariff, { maxInputSeconds: 0, inputCentsPerSecond: 0 });
    await act(async () => root.render(React.createElement(ContinuousInputTariffEditor, { key: 'omni-retake',
      editor: editor as never, disabled: false, inputSeconds: 0, outputSeconds: 3.25 })));
    assert.ok(!dom.window.document.querySelector('[aria-label="Source video price per second (USD)"]'));
    await act(async () => button('Preview unit prices').click());
    assert.equal((proposals.pop() as { price: { inputCentsPerSecond: number } }).price.inputCentsPerSecond, 0);
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of previous) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  }
});
