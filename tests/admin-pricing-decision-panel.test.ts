import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { buildProviderCostComparisonRows } from '../frontend/server/pricing-admin/provider-cost-comparison';

test('a closed decision panel simulates exact cents without reads or writes and cannot confirm', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/admin/pricing' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  let writes = 0;
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, React, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: () => { writes++; throw new Error('A decision simulation must not write or quote remotely'); },
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  const [row] = buildProviderCostComparisonRows([{ scenarioId: 'engineId=seedance-2-0-mini|mode=t2v|resolution=720p|durationSec=5|aspectRatio=16%3A9',
    brandId: 'bytedance', engineId: 'seedance-2-0-mini', executionProvider: 'byteplus_modelark', mode: 't2v',
    resolution: '720p', durationSec: 5, step: 'normal', billingInputType: 'no_video_input', videoTokens: 67_500,
    tokenEvidence: 'scenario_estimate', customerQuote: { totalCents: 95, currency: 'USD', source: 'database',
      ruleId: 'live', pricingMode: 'legacy_margin_rule' } }], '2026-09-30T12:00:00Z');
  row.supplierList.amountUsd = 0.378;
  try {
    const { PricingDecisionPanel } = await import('../frontend/app/(core)/admin/pricing/_components/PricingDecisionPanel.client');
    await act(async () => root.render(React.createElement(PricingDecisionPanel, { row, disabled: false,
      onInspect: () => {}, enabled: false })));
    assert.match(dom.window.document.body.textContent!, /60\.2%/);
    const target = [...dom.window.document.querySelectorAll('button')].find((el) => el.textContent === '50%')!;
    await act(async () => target.click());
    assert.match(dom.window.document.body.textContent!, /\$0\.76/);
    const preview = [...dom.window.document.querySelectorAll('button')].find((el) => el.textContent === 'Preview price change')!;
    assert.equal(preview.disabled, true, 'a server-authoritative exact scenario is required before preview');
    assert.equal([...dom.window.document.querySelectorAll('button')].some((el) => el.textContent === 'Confirm'), false);
    assert.equal(writes, 0);
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
  }
});
