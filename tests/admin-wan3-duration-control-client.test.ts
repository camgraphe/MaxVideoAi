import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { SWRConfig } from 'swr';
import type { CustomerTariffScenarioDetail } from '../frontend/server/pricing-admin/customer-tariff-contract';

test('decimal input duration stays editable after invalid input and cancels prior approval', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/admin/pricing' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const requests: Array<{ url: string; init?: RequestInit; resolve: (response: Response) => void }> = [];
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, React, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: (url: string, init?: RequestInit) => new Promise<Response>(resolve => requests.push({ url, init, resolve })),
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  const selector = { engineId: 'wan-3', mode: 'v2v', resolution: '720p', durationSec: '5', aspectRatio: '16:9', inputVideoDurationSec: '3' };
  const id = (seconds: string) => Object.entries({ ...selector, inputVideoDurationSec: seconds })
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('|');
  const detail = (seconds: string): CustomerTariffScenarioDetail => ({ modelId: 'wan-3', scenarioId: id(seconds),
    tariffCellId: 'cell-' + seconds, selector: { ...selector, inputVideoDurationSec: seconds },
    choices: [{ key: 'inputVideoDurationSec', value: seconds, options: [], range: { minExclusive: 0, max: 15 } }],
    currentCents: 108, stagedCents: null, currency: 'USD', supplierComparison: { customerQuote: {},
      mode: 'v2v', mediaType: 'video', durationSec: 5, resolution: '720p', aspectRatio: '16:9' } as never });
  const button = (label: string) => [...dom.window.document.querySelectorAll('button')].find(el => el.textContent === label)!;
  const respond = async (path: string, body: unknown, status = 200) => {
    const index = requests.findIndex(r => r.url.includes(path));
    assert.ok(index >= 0, `Missing ${path}`);
    const request = requests.splice(index, 1)[0];
    await act(async () => request.resolve(Response.json(body, { status })));
  };
  try {
    const { useCustomerTariffEditor } = await import('../frontend/app/(core)/admin/pricing/_hooks/useCustomerTariffEditor');
    const { TariffVariantControls } = await import('../frontend/app/(core)/admin/pricing/_components/TariffVariantControls');
    function Harness() {
      const editor = useCustomerTariffEditor({ modelId: 'wan-3', scenarioId: id('3'), selector }, true);
      return React.createElement(React.Fragment, null,
        React.createElement(TariffVariantControls, { editor, disabled: false }),
        ...['3.25', '', '4.5'].map(value => React.createElement('button', { key: value,
          onClick: () => editor.changeOption('inputVideoDurationSec', value) }, value || 'Clear')),
        React.createElement('button', { disabled: !editor.editable, onClick: () => void editor.requestPreview(129) }, 'Preview'),
        editor.preview && React.createElement('button', { onClick: () => void editor.confirm() }, 'Confirm'));
    }
    await act(async () => root.render(React.createElement(SWRConfig, { value: { provider: () => new Map(),
      dedupingInterval: 0, shouldRetryOnError: false, revalidateOnFocus: false } }, React.createElement(Harness))));
    await respond('/inventory', { ok: true, inventory: { active: false, revision: 3, databaseStatus: 'loaded', rows: [] } });
    await respond('/scenarios?', { ok: true, scenario: detail('3') });
    await respond('/history?', { ok: true, events: [] });
    const source = () => dom.window.document.querySelector('[aria-label="Input video (seconds)"]') as HTMLInputElement;
    assert.equal(source().tagName, 'INPUT');
    assert.equal(source().step, 'any');
    assert.equal(source().max, '15');
    await act(async () => button('3.25').click());
    assert.equal(source().value, '3.25', 'draft digits do not reset to the previous quote during loading');
    assert.equal(button('Preview').disabled, true);
    await respond('/scenarios?', { ok: true, scenario: detail('3.25') });
    await respond('/history?', { ok: true, events: [] });
    await act(async () => button('Preview').click());
    assert.equal(JSON.parse(requests.find(r => r.url.endsWith('/preview'))!.init!.body as string).scenarioId, id('3.25'));
    assert.equal(source().disabled, true, 'duration is locked while preview is in flight');
    await respond('/preview', { ok: true, preview: { scenarioId: id('3.25'), fingerprint: 'old' } });
    assert.ok(button('Confirm'));
    await act(async () => button('Clear').click());
    await respond('/scenarios?', { ok: false, message: 'Input-video duration is required' }, 400);
    assert.equal(button('Confirm'), undefined, 'approval cannot survive a changed duration');
    assert.equal(button('Preview').disabled, true);
    assert.equal(source().disabled, false, 'invalid input must remain correctable');
    await act(async () => button('4.5').click());
    await respond('/scenarios?', { ok: true, scenario: detail('4.5') });
    await respond('/history?', { ok: true, events: [] });
    assert.equal(source().value, '4.5');
    assert.equal(button('Preview').disabled, false);
    assert.ok(!requests.some(r => r.url.endsWith('/confirm')));
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
