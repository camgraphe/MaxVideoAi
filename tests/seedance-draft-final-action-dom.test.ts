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
  const navigation: string[] = [];
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
    React.createElement(SeedanceDraftFinalAction, { jobId: 'draft', locale: 'fr', account: { userId: 'owner', token: 'confirmed' }, onNavigate: (href: string) => navigation.push(href) }))));
  const click = async (prefix: string) => act(async () => { const button = [...dom.window.document.querySelectorAll('button')].find(node => node.textContent?.startsWith(prefix)); assert.ok(button); button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  try {
    await mount(); assert.match(dom.window.document.body.textContent!, /Draft 480p prêt/);
    const navigationEvent = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
    await act(async () => dom.window.document.querySelector('a[href="/app?job=draft"]')!.dispatchEvent(navigationEvent));
    assert.equal(navigationEvent.defaultPrevented, true, 'Studio must await its save/ACK owner before navigation');
    assert.deepEqual(navigation, ['/app?job=draft']);
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

test('failed Drafts explain the refusal and a new attempt, confirming only recorded refunds in each locale', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  let view: SeedanceWorkflowView = { draft: { jobId: 'failed-draft', status: 'failed', amountCents: 258, currency: 'USD',
    paymentStatus: 'refunded_wallet', videoUrl: null, thumbUrl: null,
    message: 'Seedance stopped this render because its output checks detected possible copyright-restricted content.' },
    final: null, eligibility: 'failed', expiresAt: null,
    settings: { durationSec: 10, aspectRatio: '16:9', audio: true, resolution: '480p' } };
  let submissions = 0;
  for (const [key, value] of Object.entries({ React, window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true, fetch: async (url: string) => {
      if (url === '/api/generate') submissions++;
      return new Response(JSON.stringify(view));
    },
  })) { previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); }
  let root: ReturnType<typeof createRoot> | null = null;
  const mount = async (locale: string) => {
    root = createRoot(dom.window.document.getElementById('root')!);
    await act(async () => root!.render(React.createElement(SWRConfig, { value: { provider: () => new Map(),
      fallback: { [unstable_serialize(['seedance-workflow', 'owner', 'failed-draft'])]: view }, revalidateOnMount: false } },
    React.createElement(SeedanceDraftFinalAction, { jobId: 'failed-draft', locale, account: { userId: 'owner', token: 'confirmed' } }))));
    return dom.window.document.querySelector('section')!.textContent!;
  };
  const unmount = async () => { await act(async () => root!.unmount()); root = null; };
  try {
    for (const [locale, reason, retry, refund, amount] of [
      ['en', /copyright/i, /prompt.*new Draft/i, /returned to your wallet/i, /2\.58/],
      ['fr', /droits d’auteur/i, /prompt.*nouveau Draft/i, /recrédit/i, /2,58/],
      ['es', /derechos de autor/i, /prompt.*nuevo Draft/i, /devuelto.*monedero/i, /2,58/],
    ] as const) {
      for (const paymentStatus of ['refunded_wallet', 'paid_wallet', 'refunded', 'included_mcp_trial']) {
        view = { ...view, draft: { ...view.draft, paymentStatus } };
        const text = await mount(locale);
        assert.match(text, reason);
        assert.match(text, retry);
        if (paymentStatus === 'refunded_wallet') { assert.match(text, refund); assert.match(text, amount); }
        else assert.doesNotMatch(text, refund);
        assert.equal(dom.window.document.querySelectorAll('button').length, 0, 'a refused Draft cannot be finalized');
        await unmount();
      }
    }
    view = { ...view, draft: { ...view.draft, paymentStatus: 'paid_wallet',
      message: 'The generated audio was blocked by Seedance safety checks. Change the prompt or turn off generated audio before trying again.' } };
    assert.match(await mount('fr'), /audio.*désactivez/i);
    await unmount();
    view = { ...view, draft: { ...view.draft, message: 'Private unknown provider error: req_private https://private.example/token' } };
    const unknown = await mount('fr');
    assert.match(unknown, /raison.*précise/i);
    assert.match(unknown, /prompt.*nouveau Draft/i);
    assert.doesNotMatch(unknown, /copyright|droits d’auteur|req_private|private\.example/i);
    assert.equal(submissions, 0, 'reading a refusal never submits a new paid render');
    await unmount();
  } finally {
    if (root) await unmount();
    dom.window.close();
    for (const [name, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name); }
  }
});
