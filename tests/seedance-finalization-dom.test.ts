import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useSeedanceFinalization } from '../frontend/hooks/useSeedanceFinalization';
import type { SeedanceWorkflowView } from '../frontend/lib/seedance-workflow-contract';

async function mount() {
  const dom = new JSDOM('<div id="root"></div>');
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  let view: SeedanceWorkflowView = { draft: { jobId: 'owned-draft', status: 'completed', amountCents: 129, currency: 'USD', paymentStatus: 'paid_wallet', videoUrl: '/draft.mp4', thumbUrl: null },
    final: null, eligibility: 'ready', expiresAt: '2026-10-08T00:00:00Z', settings: { durationSec: 5, aspectRatio: '16:9', audio: false, resolution: '480p' } };
  let account: { userId: string; token: string } | null = { userId: 'owner', token: 'session-fixture' };
  let result: ReturnType<typeof useSeedanceFinalization>;
  const quotes: { body: unknown; resolve: (value: any) => void }[] = [], submissions: { body: any; options: any; resolve: (value: any) => void; reject: (value: Error) => void }[] = [];
  const accepted: string[] = [];
  function Fixture() {
    result = useSeedanceFinalization({ view, account, onAccepted: (id: string) => accepted.push(id) }, {
      runPreflight: (body: unknown) => new Promise<any>(resolve => quotes.push({ body, resolve })),
      runGenerate: (body: unknown, options: unknown) => new Promise<any>((resolve, reject) => submissions.push({ body, options, resolve, reject })),
    }); return null;
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  await act(async () => root.render(React.createElement(Fixture)));
  return { quotes, submissions, accepted, get action() { return result!; },
    async update(eligibility: SeedanceWorkflowView['eligibility'], loggedOut = false) { view = { ...view, eligibility }; if (loggedOut) account = null; await act(async () => root.render(React.createElement(Fixture))); },
    async quote(index = 0) { await act(async () => quotes[index].resolve({ ok: true, total: 651, pricing: { totalCents: 651, currency: 'USD', meta: { workflowStep: 'final', pricingMode: 'manual_tariff', customerTariffRevision: 328 } } })); },
    async dispose() { await act(async () => root.unmount()); dom.window.close(); for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } },
  };
}

test('final confirmation quotes the owned Draft, charges only the final once, and preserves both output identities', async () => {
  const f = await mount();
  try {
    await act(async () => { void f.action.requestFinal(); });
    assert.deepEqual(f.quotes[0]?.body, { engine: 'seedance-2-5', mode: 't2v', durationSec: 5, resolution: '1080p', fps: 24, aspectRatio: '16:9', audio: false, seedanceWorkflow: { step: 'final', draftJobId: 'owned-draft' } });
    assert.equal(f.action.pending, true);
    assert.equal(f.submissions.length, 0);
    await f.quote();
    assert.equal(f.action.quote?.pricing?.totalCents, 651);
    await act(async () => { void f.action.confirm(); void f.action.confirm(); });
    assert.equal(f.submissions.length, 1);
    assert.deepEqual(f.submissions[0].body.seedanceWorkflow, { step: 'final', draftJobId: 'owned-draft' });
    assert.equal(f.submissions[0].body.durationSec, undefined, 'the server inherits the original Draft facts');
    assert.equal(f.submissions[0].options.pricingSnapshot.totalCents, 651);
    await act(async () => f.submissions[0].resolve({ ok: true, jobId: 'new-final' }));
    assert.deepEqual(f.accepted, ['new-final']);
    assert.equal(f.action.confirming, false);
  } finally { await f.dispose(); }
});

test('expiry and account changes invalidate final quotes; an uncertain submission never retries automatically', async () => {
  const f = await mount();
  try {
    await f.update('expired');
    await act(async () => { void f.action.requestFinal(); });
    assert.equal(f.quotes.length, 0);
    await f.update('ready');
    await act(async () => { void f.action.requestFinal(); });
    await f.quote();
    await act(async () => { void f.action.confirm(); });
    await act(async () => f.submissions[0].reject(new Error('response lost')));
    assert.equal(f.action.uncertain, true);
    await act(async () => { void f.action.requestFinal(); void f.action.confirm(); });
    assert.equal(f.quotes.length, 1); assert.equal(f.submissions.length, 1);
    await f.update('expired'); await f.update('ready');
    await act(async () => { void f.action.requestFinal(); });
    await f.update('ready', true); await f.quote(1);
    assert.equal(f.action.quote, null, 'late prices must never survive logout');
    await act(async () => { void f.action.confirm(); });
    assert.equal(f.submissions.length, 1);
  } finally { await f.dispose(); }
});

test('a definitive provider rejection with its exact confirmed refund allows a fresh quote without remounting', async () => {
  const f = await mount();
  try {
    await act(async () => { void f.action.requestFinal(); }); await f.quote();
    await act(async () => { void f.action.confirm(); });
    await act(async () => f.submissions[0].reject(Object.assign(new Error('provider rejected'), { status: 502, jobId: 'rejected-final', paymentStatus: 'refunded_wallet', refundedAmountCents: 651, currency: 'USD' })));
    assert.equal(f.action.uncertain, false);
    await act(async () => { void f.action.requestFinal(); });
    assert.equal(f.quotes.length, 2, 'retry always obtains a new price and requires another confirmation');
    assert.equal(f.submissions.length, 1);
  } finally { await f.dispose(); }
});
