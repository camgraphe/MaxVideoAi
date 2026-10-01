import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useSeedanceDraftWorkflow } from '../frontend/app/(core)/(workspace)/app/_hooks/useSeedanceDraftWorkflow';
import type { FormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-form-state';

test('creator Draft uses its own quote, locks 480p, and recovers one persisted job after an ambiguous response', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const quotes: any[] = [], submissions: any[] = [];
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (url: string, options?: RequestInit) => {
      if (url === '/api/preflight') { quotes.push(JSON.parse(String(options?.body))); return new Response(JSON.stringify({ ok: true, total: 129, currency: 'USD', pricing: { totalCents: 129, currency: 'USD', meta: { workflowStep: 'draft', pricingMode: 'manual_tariff', customerTariffRevision: 328 } } })); }
      if (url === '/api/generate') { submissions.push({ body: JSON.parse(String(options?.body)), headers: new Headers(options?.headers) }); return new Response(JSON.stringify({ error: 'SEEDANCE_WORKFLOW_SUBMISSION_UNCERTAIN', message: 'Response lost', jobId: submissions.at(-1).body.jobId }), { status: 503 }); }
      return new Response('{}', { status: 404 });
    },
  })) { previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); }
  let result: ReturnType<typeof useSeedanceDraftWorkflow>;
  const form = { engineId: 'seedance-2-5', mode: 't2v', durationSec: 5, resolution: '720p', aspectRatio: '16:9', audio: false, fps: 24, iterations: 1, extraInputValues: {} } as FormState;
  function Fixture() {
    const [value, setValue] = React.useState(form);
    result = useSeedanceDraftWorkflow({ enabled: true, form: value, engineId: value.engineId, mode: 't2v', prompt: 'A valley',
      account: { userId: 'owner', token: 'fixture-token' }, showNotice: () => {}, onResolutionChange: (resolution: string) => setValue(current => ({ ...current, resolution })) });
    return null;
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  try {
    await act(async () => root.render(React.createElement(Fixture)));
    await act(async () => result!.toggle());
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 700)); });
    assert.equal(result!.selected, true);
    assert.equal(result!.price, 1.29);
    assert.equal(quotes.at(-1)?.seedanceWorkflow.step, 'draft');
    assert.equal(quotes.at(-1)?.resolution, '480p');
    await act(async () => { const first = result!.generate(); void result!.generate(); await first; });
    assert.equal(submissions.length, 1);
    assert.equal(submissions[0].headers.get('x-maxvideoai-customer-tariff'), '328');
    const id = submissions[0].body.jobId;
    assert.equal(dom.window.localStorage.getItem('seedance-active-draft:owner'), id);
    assert.equal(result!.draftId, id);
    assert.deepEqual(submissions[0].body.seedanceWorkflow, { step: 'draft' });
    await act(async () => result!.generate());
    assert.equal(submissions.length, 1, 'uncertain jobs must be recovered, never charged again');
    await act(async () => root.unmount());
    const otherRoot = createRoot(dom.window.document.getElementById('root')!);
    await act(async () => otherRoot.render(React.createElement(Fixture)));
    assert.equal(result!.draftId, id, 'refresh restores the accepted/uncertain MaxVideoAI job');
    await act(async () => otherRoot.unmount());
  } finally {
    dom.window.close(); for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
