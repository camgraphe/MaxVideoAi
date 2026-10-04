import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { SWRConfig } from 'swr';
import { MediaActionPanel } from '../frontend/components/library/MediaActionPanel.client';
import type { SeedanceWorkflowView } from '../frontend/lib/seedance-workflow-contract';

test('production media exposes an owned Draft finalization without narrowing ordinary videos', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://app.example/app', pretendToBeVisual: true });
  const requests: string[] = [];
  const view: SeedanceWorkflowView = {
    draft: { jobId: 'draft', status: 'completed', amountCents: 103, currency: 'USD', paymentStatus: 'paid_wallet', videoUrl: '/draft.mp4', thumbUrl: null },
    final: null, eligibility: 'ready', expiresAt: '2026-10-08T00:00:00Z',
    settings: { durationSec: 4, aspectRatio: '16:9', audio: false, resolution: '480p' },
  };
  const globals = { React, window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (url: string, options?: RequestInit) => {
      requests.push(url);
      if (url === '/api/preflight') return new Response(JSON.stringify({ ok: true, total: 521, currency: 'USD', pricing: { totalCents: 521, currency: 'USD', meta: { workflowStep: 'final', pricingMode: 'manual_tariff', customerTariffRevision: 1 } } }));
      assert.match(url, /^\/api\/jobs\/(draft|ordinary)(\/seedance-workflow)?$/);
      assert.equal(new Headers(options?.headers).get('authorization'), 'Bearer confirmed-session');
      if (!url.endsWith('/seedance-workflow')) return new Response(JSON.stringify({ ok: true, status: 'completed' }));
      return url.includes('/ordinary/') ? new Response('{}', { status: 404 }) : new Response(JSON.stringify(view));
    },
  };
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const env = new Map(['NODE_ENV', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'].map(key => [key, process.env[key]]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  process.env.NODE_ENV = 'production';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://auth.example';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fixture-public-key';
  dom.window.HTMLElement.prototype.getClientRects = function () { return [{ width: 44, height: 44 }] as unknown as DOMRectList; };
  const { supabase } = await import('../frontend/src/lib/supabaseClient');
  await supabase.auth.stopAutoRefresh();
  const oldGetSession = supabase.auth.getSession, oldOnAuth = supabase.auth.onAuthStateChange;
  // Only the external Auth SDK is stubbed; the account, reader, action and modal are real.
  supabase.auth.getSession = async () => ({ data: { session: { user: { id: 'owner' }, access_token: 'confirmed-session' } }, error: null }) as any;
  supabase.auth.onAuthStateChange = () => ({ data: { subscription: { unsubscribe() {} } } }) as any;
  const root = createRoot(dom.window.document.getElementById('root')!);
  const render = (jobId: string) => act(async () => {
    root.render(React.createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } },
      React.createElement(MediaActionPanel, { asset: { id: jobId, jobId, url: `/${jobId}.mp4`, kind: 'video' }, locale: 'fr', onClose() {} })));
    await new Promise(resolve => setTimeout(resolve, 50));
  });
  try {
    await render('draft');
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    assert.match(dom.window.document.body.textContent ?? '', /Draft 480p prêt/);
    assert.equal(dom.window.document.querySelectorAll('.app-media-detail-layout > aside').length, 1);
    await act(async () => [...dom.window.document.querySelectorAll('button')].find(button => button.textContent?.startsWith('Finaliser en 1080p'))!.click());
    assert.match(dom.window.document.body.textContent ?? '', /5,21/);
    assert.match(dom.window.document.body.textContent ?? '', /6,24/);
    assert.equal(requests.includes('/api/generate'), false, 'viewing the final price must not submit or charge');
    await render('ordinary');
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    assert.equal(dom.window.document.querySelector('.app-media-detail-layout > aside'), null, 'ordinary videos retain their full-width reader');
    assert.doesNotMatch(dom.window.document.body.textContent ?? '', /Draft/);
  } finally {
    await act(async () => root.unmount());
    supabase.auth.getSession = oldGetSession; supabase.auth.onAuthStateChange = oldOnAuth;
    await supabase.auth.stopAutoRefresh();
    (supabase.auth as any).broadcastChannel?.close();
    dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
    for (const [key, value] of env) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
