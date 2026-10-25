import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useImageWorkspaceDisplayState } from '../frontend/app/(core)/(workspace)/app/image/_hooks/useImageWorkspaceDisplayState';

test('an image model switch waits for its exact quote instead of flashing the catalogue price', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app/image' });
  const globals = { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  type Args = Parameters<typeof useImageWorkspaceDisplayState>[0];
  const args = { error: null, historyEntries: [], numImages: 1, pendingGroups: [], pricingErrorMessage: null,
    pricingSnapshot: { totalCents: 6, currency: 'USD' }, selectedEngine: { id: 'first', pricePerImage: 0.04, currency: 'USD' }, selectedPreviewEntryId: null } as unknown as Args;
  let observed: ReturnType<typeof useImageWorkspaceDisplayState>;
  function Fixture() { observed = useImageWorkspaceDisplayState(args); return null; }
  const root = createRoot(dom.window.document.getElementById('root')!);
  try {
    await React.act(async () => root.render(React.createElement(Fixture)));
    assert.equal(observed!.estimatedCostAmount, 0.06);
    args.selectedEngine = { ...args.selectedEngine!, id: 'next' };
    args.pricingSnapshot = null;
    await React.act(async () => root.render(React.createElement(Fixture)));
    assert.equal(observed!.estimatedCostAmount, null, 'neither the old quote nor the generic $0.04 catalogue price is valid for the new settings');
    args.pricingSnapshot = { totalCents: 9, currency: 'USD' } as Args['pricingSnapshot'];
    await React.act(async () => root.render(React.createElement(Fixture)));
    assert.equal(observed!.estimatedCostAmount, 0.09);
  } finally {
    await React.act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of previous) descriptor ? Object.defineProperty(globalThis, key, descriptor) : Reflect.deleteProperty(globalThis, key);
  }
});
