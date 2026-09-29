import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { SWRConfig } from 'swr';
import { buildProviderCostComparisonRows } from '../frontend/server/pricing-admin/provider-cost-comparison';
import type { CustomerTariffInventory, CustomerTariffScenarioDetail, CustomerTariffChangePreview }
  from '../frontend/server/pricing-admin/customer-tariff-contract';

test('a pending price preview locks its scenario, and selecting another scenario discards confirmation', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/admin/pricing' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const requests: Array<{ url: string; init?: RequestInit; resolve: (response: Response) => void }> = [];
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, React, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: (url: string, init?: RequestInit) => new Promise<Response>((resolve) => requests.push({ url, init, resolve })),
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  const [supplierComparison] = buildProviderCostComparisonRows([{ scenarioId: 'scenario-a', brandId: 'bytedance',
    engineId: 'seedance-2-0-mini', executionProvider: 'byteplus_modelark', mode: 't2v', resolution: '720p',
    durationSec: 5, step: 'normal', billingInputType: 'no_video_input', videoTokens: 100_000,
    tokenEvidence: 'scenario_estimate', customerQuote: null }], '2026-09-30T12:00:00Z');
  const scenario: CustomerTariffScenarioDetail = { modelId: 'seedance-2-0-mini', scenarioId: 'scenario-a',
    tariffCellId: 'cell-a', selector: { mode: 't2v', durationSec: '5', resolution: '720p' },
    choices: [{ key: 'durationSec', value: '5', options: ['5', '10'] }], currentCents: 95,
    stagedCents: null, currency: 'USD', supplierComparison };
  const inventory: CustomerTariffInventory = { active: false, revision: 3, databaseStatus: 'loaded',
    coverageGapCount: 122, rows: [{ modelId: scenario.modelId, familyId: 'bytedance', mediaType: 'video',
      scenarioId: scenario.scenarioId, selector: scenario.selector, currentCents: 95, currency: 'USD',
      stagedCents: null, supplierListUsd: 0.7, supplierEffectiveUsd: null, supplierObservedUsd: null, supplierComparison }] };
  const preview: CustomerTariffChangePreview = { fingerprint: 'fixture-preview', operation: 'create',
    scenarioId: scenario.scenarioId, modelId: scenario.modelId, selector: scenario.selector, currentCents: 95,
    proposedCents: 95, currency: 'USD', revision: 3, active: false, previousCell: null,
    proposedCell: null, warnings: [] };
  const button = (name: string) => [...dom.window.document.querySelectorAll('button')]
    .find((el) => el.textContent?.trim() === name)!;
  const respond = async (path: string, body: unknown) => {
    const request = requests.find((item) => item.url.includes(path));
    assert.ok(request, `Missing ${path} request`);
    requests.splice(requests.indexOf(request), 1);
    await act(async () => request.resolve(Response.json(body)));
  };
  try {
    const { CustomerTariffPanel } = await import('../frontend/app/(core)/admin/pricing/_components/CustomerTariffPanel.client');
    await act(async () => root.render(React.createElement(SWRConfig, { value: {
      provider: () => new Map(), dedupingInterval: 0, revalidateOnFocus: false, revalidateOnReconnect: false,
    } }, React.createElement(CustomerTariffPanel))));
    await respond('/inventory', { ok: true, inventory });
    await act(async () => (dom.window.document.querySelector('[aria-pressed="false"]') as HTMLButtonElement).click());
    await respond('/scenarios?', { ok: true, scenario });
    await respond('/history?', { ok: true, events: [] });
    await act(async () => button('Preview price change').click());
    const duration = dom.window.document.querySelector('[aria-label="Duration (seconds)"]') as HTMLSelectElement;
    assert.equal(duration.disabled, true, 'the visible scenario cannot change while its preview is pending');
    assert.equal(JSON.parse(requests.find((item) => item.url.endsWith('/preview'))!.init!.body as string).scenarioId,
      'scenario-a');
    await respond('/preview', { ok: true, preview });
    assert.ok(button('Confirm'));
    assert.equal(duration.disabled, false);
    await act(async () => { duration.value = '10'; duration.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    assert.equal(button('Confirm'), undefined, 'switching options discards the prior approval');
    await respond('/scenarios?', { ok: true, scenario: { ...scenario, scenarioId: 'scenario-b', tariffCellId: 'cell-b',
      selector: { ...scenario.selector, durationSec: '10' }, choices: [{ ...scenario.choices[0], value: '10' }], currentCents: 190 } });
    assert.equal(button('Confirm'), undefined);
    assert.ok(!requests.some((item) => item.url.endsWith('/confirm')), 'no price write occurs without a fresh approval');
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
