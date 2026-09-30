import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { SWRConfig, useSWRConfig } from 'swr';
import { buildProviderCostComparisonRows } from '../frontend/server/pricing-admin/provider-cost-comparison';
import type { CustomerTariffInventory, CustomerTariffScenarioDetail, CustomerTariffChangePreview }
  from '../frontend/server/pricing-admin/customer-tariff-contract';

for (const target of [undefined, 50]) test(`inline tariff preview locks options and rejects stale approval (${target == null ? 'duration' : 'audio extra'})`, async () => {
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
  const id = 'engineId=seedance-2-0-mini|mode=t2v|resolution=720p|durationSec=5|aspectRatio=16%3A9|audio=false';
  const [supplierComparison] = buildProviderCostComparisonRows([{ scenarioId: id, brandId: 'bytedance',
    engineId: 'seedance-2-0-mini', executionProvider: 'byteplus_modelark', mode: 't2v', resolution: '720p',
    durationSec: 5, step: 'normal', billingInputType: 'no_video_input', videoTokens: 108_000,
    tokenEvidence: 'scenario_estimate', customerQuote: { totalCents: 95, currency: 'USD', source: 'database',
      ruleId: 'current', pricingMode: 'legacy_margin_rule' } }], '2026-09-30T12:00:00Z');
  const scenario: CustomerTariffScenarioDetail = { modelId: 'seedance-2-0-mini', scenarioId: id,
    tariffCellId: 'cell-a', selector: { mode: 't2v', durationSec: '5', resolution: '720p', aspectRatio: '16:9', audio: 'false' },
    choices: [{ key: 'durationSec', value: '5', options: ['5', '10'] }, { key: 'audio', value: 'false', options: ['false', 'true'] }],
    currentCents: 95, stagedCents: null, currency: 'USD', supplierComparison };
  const inventory: CustomerTariffInventory = { active: false, revision: 3, databaseStatus: 'loaded',
    coverageGapCount: 122, rows: [] };
  const proposedCents = target == null ? 95 : 76;
  const preview: CustomerTariffChangePreview = { fingerprint: 'fixture-preview', operation: 'create',
    scenarioId: id, modelId: scenario.modelId, selector: scenario.selector, currentCents: 95,
    proposedCents, currency: 'USD', revision: 3, active: false, previousCell: null,
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
    const { PricingDecisionPanel } = await import('../frontend/app/(core)/admin/pricing/_components/PricingDecisionPanel.client');
    const cache = new Map();
    const config = {
      provider: () => cache, dedupingInterval: 0, revalidateOnFocus: false, revalidateOnReconnect: false,
    };
    let refresh: ReturnType<typeof useSWRConfig>['mutate'];
    let displayedCents: number | undefined;
    function CaptureCache({ children }: { children: React.ReactNode }) {
      refresh = useSWRConfig().mutate;
      return children;
    }
    const staleRow = { ...supplierComparison, customerQuote: { ...supplierComparison.customerQuote!, totalCents: 50 } };
    const render = (enabled: boolean) => root.render(React.createElement(SWRConfig, { value: config },
      React.createElement(CaptureCache, {}, React.createElement(PricingDecisionPanel, { row: staleRow, enabled,
        onScenarioRow: row => { displayedCents = row.customerQuote?.totalCents; }, disabled: false, onInspect: () => {} }))));
    await act(async () => render(true));
    await respond('/inventory', { ok: true, inventory });
    await respond('/scenarios?', { ok: true, scenario });
    await respond('/history?', { ok: true, events: [] });
    assert.equal((dom.window.document.querySelector('input[type="number"]') as HTMLInputElement).value, '0.19',
      'the first authoritative response replaces a pristine draft even at the same scenario ID');
    assert.equal(dom.window.document.querySelectorAll('input[type="number"]').length, 2,
      'one unit-price field and optional extra costs, without a second total-price form');
    if (target != null) await act(async () => button(`${target}%`).click());
    await act(async () => button('Preview price change').click());
    const duration = dom.window.document.querySelector('[aria-label="Duration (seconds)"]') as HTMLSelectElement;
    const audio = dom.window.document.querySelector('[aria-label="Audio"]') as HTMLSelectElement;
    assert.equal(duration.disabled, true);
    assert.equal(audio.disabled, true, 'priced extras cannot switch under a pending preview');
    assert.deepEqual(JSON.parse(requests.find((item) => item.url.endsWith('/preview'))!.init!.body as string),
      { operation: 'create', scenarioId: id, customerCents: proposedCents });
    await respond('/preview', { ok: true, preview });
    assert.ok(button('Confirm'));
    assert.equal(duration.disabled, false);
    if (target != null) {
      await act(async () => { void refresh!((key) => typeof key === 'string' && key.includes('/scenarios?'), undefined, { revalidate: true }); });
      await respond('/scenarios?', { ok: true, scenario: { ...scenario, currentCents: 96,
        supplierComparison: { ...supplierComparison, customerQuote: { ...supplierComparison.customerQuote!, totalCents: 96 } } } });
      assert.equal(button('Confirm'), undefined, 'a refreshed quote invalidates approval even for the same scenario ID');
    }
    const control = target == null ? duration : audio;
    await act(async () => { control.value = target == null ? '10' : 'true'; control.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    assert.equal(button('Confirm'), undefined, 'changing an option discards the previous approval');
    const nextId = target == null ? id.replace('durationSec=5', 'durationSec=10') : id.replace('audio=false', 'audio=true');
    const nextRow = { ...supplierComparison, scenarioId: nextId, durationSec: target == null ? 10 : 5,
      audio: target != null, customerQuote: { ...supplierComparison.customerQuote!, totalCents: 190 } };
    await respond('/scenarios?', { ok: true, scenario: { ...scenario, scenarioId: nextId, tariffCellId: 'cell-b',
      selector: { ...scenario.selector, ...(target == null ? { durationSec: '10' } : { audio: 'true' }) },
      choices: scenario.choices.map(choice => ({ ...choice, value: choice.key === (target == null ? 'durationSec' : 'audio') ? (target == null ? '10' : 'true') : choice.value })),
      currentCents: 190, supplierComparison: nextRow } });
    assert.equal(button('Confirm'), undefined);
    assert.ok(!requests.some((item) => item.url.endsWith('/confirm')), 'no price write without a fresh approval');
    assert.equal((dom.window.document.querySelector('input[type="number"]') as HTMLInputElement).value,
      target == null ? '0.19' : '0.38', 'the new variant uses its own exact current quote');
    await act(async () => button('Preview price change').click());
    assert.equal(JSON.parse(requests.find((item) => item.url.endsWith('/preview'))!.init!.body as string).scenarioId, nextId);
    await respond('/preview', { ok: true, preview: { ...preview, scenarioId: nextId, currentCents: 190, proposedCents: 190, fingerprint: 'new-preview' } });
    if (target == null) {
      await act(async () => button('Cancel').click());
      await act(async () => button('Preview price change').click());
      await act(async () => render(false));
      await act(async () => render(true));
      // Reopen the same cached selector before the earlier preview response finishes.
      await respond('/inventory', { ok: true, inventory });
      await respond('/preview', { ok: true, preview: { ...preview, scenarioId: nextId, fingerprint: 'cancelled-preview' } });
      assert.equal(button('Confirm'), undefined, 'closing invalidates a late preview even after reopening the same exact row');
      await act(async () => render(false));
      await act(async () => { void refresh!((key) => typeof key === 'string' && key.includes('/scenarios?'), undefined, { revalidate: true }); });
      const freshRow = { ...nextRow, customerQuote: { ...nextRow.customerQuote!, totalCents: 200 } };
      await respond('/scenarios?', { ok: true, scenario: { ...scenario, scenarioId: nextId, tariffCellId: 'cell-b',
        selector: { ...scenario.selector, durationSec: '10' }, currentCents: 200, supplierComparison: freshRow } });
      assert.equal(displayedCents, 200, 'Refresh revalidates the exact selected quote while its row is closed');
      assert.equal((dom.window.document.querySelector('input[type="number"]') as HTMLInputElement).value, '0.2');
      await act(async () => render(true));
      await respond('/inventory', { ok: true, inventory });
      await act(async () => button('Preview price change').click());
      await respond('/preview', { ok: true, preview: { ...preview, scenarioId: nextId, currentCents: 200, proposedCents: 200, fingerprint: 'new-preview' } });
    }
    await act(async () => button('Confirm').click());
    const confirm = requests.find((item) => item.url.endsWith('/confirm'))!;
    assert.equal(JSON.parse(confirm.init!.body as string).previewFingerprint, 'new-preview');
    assert.equal(JSON.parse(confirm.init!.body as string).proposal.scenarioId, nextId);
    await respond('/confirm', { ok: true, confirmation: { operationalWarnings: [] } });
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
