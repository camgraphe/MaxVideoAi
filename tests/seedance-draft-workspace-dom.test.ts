import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { SWRConfig } from 'swr';
import { useSeedanceDraftWorkflow } from '../frontend/app/(core)/(workspace)/app/_hooks/useSeedanceDraftWorkflow';
import { SeedanceDraftLocalPreviewMode } from '../frontend/app/(core)/(workspace)/app/_components/SeedanceDraftLocalPreviewMode.client';
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
  let root = createRoot(dom.window.document.getElementById('root')!);
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
    await act(async () => result!.toggle());
    assert.equal(result!.selected, false, 'an uncertain acknowledgement cannot trap the creator in Draft mode');
    assert.equal(result!.canResume, false);
    await act(async () => result!.resume());
    assert.equal(submissions.length, 1, 'standard generation cannot resend an uncertain Draft');
    assert.ok(dom.window.localStorage.getItem(`seedance-draft-request:owner:${id}`), 'the original recovery facts survive leaving Draft');
    await act(async () => result!.toggle());
    assert.equal(result!.draftId, id);
    await act(async () => root.unmount());
    root = createRoot(dom.window.document.getElementById('root')!);
    await act(async () => root.render(React.createElement(Fixture)));
    assert.equal(result!.draftId, id, 'refresh restores the accepted/uncertain MaxVideoAI job');
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    assert.equal(result!.canResume, true, 'an authoritative absent job offers explicit same-attempt recovery');
    await act(async () => result!.resume());
    assert.equal(submissions.length, 2);
    assert.deepEqual(submissions[1].body, submissions[0].body, 'same ID and original facts, even after reload');
    assert.equal(submissions[1].headers.get('x-maxvideoai-customer-tariff'), '328');
    assert.equal(JSON.stringify([...Array.from({length: dom.window.localStorage.length}, (_, index) => dom.window.localStorage.getItem(dom.window.localStorage.key(index)!))]).includes('fixture-token'), false);
  } finally {
    await act(async () => root.unmount());
    dom.window.close(); for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});

test('the real Draft checkbox returns to standard generation before submission and with a restored job, without losing recovery', async () => {
  for (const eligibility of [null, 'failed', 'ready', 'pending', 'finalizing', 'unavailable'] as const) {
    const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app' });
    const previous = new Map<string, PropertyDescriptor | undefined>();
    let submissions = 0;
    const view = eligibility ? { draft: { jobId: 'saved-draft', status: eligibility === 'failed' ? 'failed' : 'completed',
      amountCents: 129, currency: 'USD', paymentStatus: 'paid_wallet', videoUrl: null, thumbUrl: null },
      final: null, eligibility, expiresAt: null, settings: { durationSec: 5, aspectRatio: '16:9', audio: false, resolution: '480p' } } : null;
    if (view) dom.window.localStorage.setItem('seedance-active-draft:owner', 'saved-draft');
    for (const [key, value] of Object.entries({ React, window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
      IS_REACT_ACT_ENVIRONMENT: true, fetch: async (url: string) => {
        if (url === '/api/generate') submissions++;
        return new Response(JSON.stringify(view), { status: view ? 200 : 404 });
      },
    })) { previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); }
    let controls: ReturnType<typeof useSeedanceDraftWorkflow>;
    function Fixture() {
      const [form, setForm] = React.useState<FormState>({ engineId: 'seedance-2-5', mode: 't2v', durationSec: 5, resolution: '720p',
        aspectRatio: '16:9', audio: false, fps: 24, iterations: 1, extraInputValues: {} });
      controls = useSeedanceDraftWorkflow({ enabled: true, form, engineId: form.engineId, mode: 't2v', prompt: 'A valley',
        account: { userId: 'owner', token: 'fixture-token' }, showNotice: () => {},
        onResolutionChange: resolution => setForm(current => ({ ...current, resolution })) });
      return React.createElement('div', null, React.createElement(SeedanceDraftLocalPreviewMode, { preview: controls, locale: 'fr' }),
        React.createElement('output', null, form.resolution));
    }
    let root = createRoot(dom.window.document.getElementById('root')!);
    const mount = () => act(async () => root.render(React.createElement(SWRConfig, { value: { provider: () => new Map() } }, React.createElement(Fixture))));
    const checkbox = () => dom.window.document.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    const click = () => act(async () => { checkbox().click(); });
    try {
      await mount();
      if (!view) await click();
      assert.equal(checkbox().checked, true);
      await click();
      assert.equal(checkbox().checked, false, `must leave Draft with ${eligibility ?? 'no submitted job'}`);
      assert.equal(controls!.selected, false);
      assert.equal(dom.window.document.querySelector('output')!.textContent, '720p');
      if (view) {
        assert.equal(controls!.draftId, 'saved-draft');
        assert.equal(dom.window.localStorage.getItem('seedance-active-draft:owner'), 'saved-draft', 'leaving Draft retains the accepted task');
        await act(async () => root.unmount());
        root = createRoot(dom.window.document.getElementById('root')!);
        await mount();
        assert.equal(checkbox().checked, false, 'refresh preserves the choice to use standard generation');
      }
      await click();
      assert.equal(checkbox().checked, true);
      assert.equal(dom.window.document.querySelector('output')!.textContent, '480p');
      if (view) assert.equal(controls!.draftId, 'saved-draft', 're-entering Draft resumes its existing task');
      assert.equal(submissions, 0, 'changing the checkbox never submits a paid task');
    } finally {
      await act(async () => root.unmount()); dom.window.close();
      for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
    }
  }
});
