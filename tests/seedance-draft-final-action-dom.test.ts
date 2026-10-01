import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { SWRConfig, unstable_serialize } from 'swr';
import { SeedanceDraftFinalAction } from '../frontend/components/library/SeedanceDraftFinalAction.client';
import type { SeedanceWorkflowView } from '../frontend/lib/seedance-workflow-contract';

test('shared library/Studio action shows a fresh separate charge, retains the Draft and disables expired finalization', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  let view: SeedanceWorkflowView = { draft: { jobId: 'draft', status: 'completed', amountCents: 129, currency: 'USD', paymentStatus: 'paid_wallet', videoUrl: '/draft.mp4', thumbUrl: null },
    final: null, eligibility: 'ready', expiresAt: '2026-10-08T00:00:00Z', settings: { durationSec: 5, aspectRatio: '16:9', audio: false, resolution: '480p' } };
  let submissions = 0;
  for (const [key, value] of Object.entries({ React, window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (url: string) => {
      if (url === '/api/preflight') return new Response(JSON.stringify({ ok: true, total: 651, currency: 'USD', pricing: { totalCents: 651, currency: 'USD', meta: { workflowStep: 'final', pricingMode: 'manual_tariff', customerTariffRevision: 328 } } }));
      if (url === '/api/generate') { submissions++; view = { ...view, eligibility: 'finalized', final: { jobId: 'final', status: 'completed', amountCents: 651, currency: 'USD', paymentStatus: 'paid_wallet', videoUrl: '/final.mp4', thumbUrl: null } }; return new Response(JSON.stringify({ ok: true, jobId: 'final' })); }
      return new Response(JSON.stringify(url.endsWith('/seedance-workflow') ? view : { ok: true, status: 'completed' }));
    },
  })) { previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); }
  const key = unstable_serialize(['seedance-workflow', 'owner', 'draft']);
  let root = createRoot(dom.window.document.getElementById('root')!);
  const mount = async () => act(async () => root.render(React.createElement(SWRConfig, { value: { provider: () => new Map(), fallback: { [key]: view }, revalidateOnMount: false } },
    React.createElement(SeedanceDraftFinalAction, { jobId: 'draft', locale: 'fr', account: { userId: 'owner', token: 'confirmed' } }))));
  const click = async (prefix: string) => act(async () => { const button = [...dom.window.document.querySelectorAll('button')].find(node => node.textContent?.startsWith(prefix)); assert.ok(button); button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  try {
    await mount(); assert.match(dom.window.document.body.textContent!, /Draft 480p prêt/);
    await click('Finaliser en 1080p');
    assert.match(dom.window.document.body.textContent!, /Draft déjà payé/);
    assert.match(dom.window.document.body.textContent!, /1,29/);
    assert.match(dom.window.document.body.textContent!, /6,51/);
    assert.match(dom.window.document.body.textContent!, /7,80/);
    assert.equal(submissions, 0, 'reading a price does not submit or charge');
    await click('Lancer le final');
    assert.equal(submissions, 1);
    assert.equal(dom.window.document.querySelector('a[href="/app?job=draft"]')?.textContent, 'Revoir le Draft 480p');
    assert.equal(dom.window.document.querySelector('a[href="/app?job=final"]')?.textContent, 'Voir le final 1080p');
    await act(async () => root.unmount());
    view = { ...view, final: null, eligibility: 'expired' };
    root = createRoot(dom.window.document.getElementById('root')!); await mount();
    assert.match(dom.window.document.body.textContent!, /Délai de finalisation expiré/);
    assert.equal(dom.window.document.querySelectorAll('button').length, 0);
    assert.ok(dom.window.document.querySelector('a[href="/app?job=draft"]'));
  } finally { await act(async () => root.unmount()); dom.window.close(); for (const [name, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name); } }
});
