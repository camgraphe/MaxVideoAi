import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { PathnameContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { GA4EventBridge } from '../frontend/components/analytics/GA4EventBridge';
import { GA4RouteTracker } from '../frontend/components/analytics/GA4RouteTracker';
import { clearBrowserAnalyticsAuthContext, resolveBrowserCommercialAnalyticsAuthContext } from '../frontend/lib/analytics/commercial-client';
import { persistPendingAnalyticsEvent } from '../frontend/lib/analytics-client';

async function fixture() {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://maxvideoai.com/app/studio' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ React, window: dom.window, document: dom.window.document, navigator: dom.window.navigator, Element: dom.window.Element, CustomEvent: dom.window.CustomEvent, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  const fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  dom.window.localStorage.setItem('mv-consent-analytics', 'granted');
  clearBrowserAnalyticsAuthContext();
  const sent: Array<{ name: string; params: Record<string, unknown> }> = [];
  window.gtag = (_command, name, params) => { sent.push({ name: String(name), params: params as Record<string, unknown> }); };
  const root = createRoot(document.getElementById('root')!);
  await React.act(async () => root.render(React.createElement(PathnameContext.Provider, { value: '/app/studio' },
    React.createElement(React.Fragment, null, React.createElement(GA4EventBridge), React.createElement(GA4RouteTracker)))));
  return {
    sent,
    emit(type: string, detail: unknown) { window.dispatchEvent(new window.CustomEvent(type, { detail })); },
    async close() {
      await React.act(async () => root.unmount());
      clearBrowserAnalyticsAuthContext();
      dom.window.close();
      for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
      if (fetchDescriptor) Object.defineProperty(globalThis, 'fetch', fetchDescriptor);
    },
  };
}

test('role resolution defers private entry and preserves generation start/job correlation received while pending', async () => {
  const view = await fixture();
  try {
    let release!: (response: Response) => void;
    persistPendingAnalyticsEvent('login_completed', { route_family: 'auth', method: 'google' });
    globalThis.fetch = async () => new Promise((done) => { release = done; });
    const role = resolveBrowserCommercialAnalyticsAuthContext('ordinary', 'local-fixture', {});
    await Promise.resolve();
    await React.act(async () => {
      view.emit('mvai:analytics', { event: 'generation_started', payload: { route_family: 'workspace', local_key: 'local_batch_abcd_efgh_1' } });
      view.emit('jobs:status', { status: 'pending', jobId: 'job_7df6d42a-4b70-4eca-82fe-3a320c4a6eb9', localKey: 'local_batch_abcd_efgh_1' });
      view.emit('jobs:status', { status: 'completed', jobId: 'job_7df6d42a-4b70-4eca-82fe-3a320c4a6eb9', localKey: 'local_batch_abcd_efgh_1' });
    });
    assert.deepEqual(view.sent, []);
    await React.act(async () => { release(new Response(JSON.stringify({ ok: false, commercialAnalyticsEligible: true }))); await role; });
    assert.equal(view.sent.filter((event) => event.name === 'studio_entered').length, 1);
    assert.equal(view.sent.filter((event) => event.name === 'login_completed').length, 1, 'initial verified destination preserves its stored auth continuation');
    const success = view.sent.find((event) => event.name === 'first_media_completed_in_journey');
    assert.equal(success?.params.generation_sequence, 1);
    assert.equal(success?.params.job_id, 'job_7df6d42a-4b70-4eca-82fe-3a320c4a6eb9');
    view.emit('mvai:analytics', { event: 'generation_started', payload: { route_family: 'workspace', local_key: 'local_batch_abcd_efgh_2' } });
    view.emit('jobs:status', { status: 'pending', jobId: 'job_8df6d42a-4b70-4eca-82fe-3a320c4a6eb9', localKey: 'local_batch_abcd_efgh_2' });
    const savedNow = Date.now;
    const future = savedNow() + 31_000;
    try {
      Date.now = () => future;
      globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, commercialAnalyticsEligible: true }));
      await React.act(async () => { await resolveBrowserCommercialAnalyticsAuthContext('ordinary', 'local-fixture', {}); });
    } finally { Date.now = savedNow; }
    view.emit('jobs:status', { status: 'completed', jobId: 'job_8df6d42a-4b70-4eca-82fe-3a320c4a6eb9', localKey: 'local_batch_abcd_efgh_2' });
    assert.equal(view.sent.find((event) => event.name === 'generation_completed' && event.params.job_id === 'job_8df6d42a-4b70-4eca-82fe-3a320c4a6eb9')?.params.generation_sequence, 2, 'same-user role refresh keeps ongoing generation correlation');
  } finally { await view.close(); }
});

test('a switched account cannot replay another account deferred actions and failed role reads emit no private entry', async () => {
  const view = await fixture();
  try {
    let releaseOld!: (response: Response) => void;
    globalThis.fetch = async () => new Promise((done) => { releaseOld = done; });
    const old = resolveBrowserCommercialAnalyticsAuthContext('old-admin', 'local-fixture', {});
    await Promise.resolve();
    view.emit('mvai:analytics', { event: 'generation_started', payload: { route_family: 'workspace', local_key: 'old-account' } });
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, commercialAnalyticsEligible: true }));
    await React.act(async () => { await resolveBrowserCommercialAnalyticsAuthContext('ordinary', 'local-fixture', {}); });
    releaseOld(new Response(JSON.stringify({ ok: true, commercialAnalyticsEligible: false })));
    await old;
    assert.equal(view.sent.filter((event) => event.name === 'generation_started').length, 0);
    await React.act(async () => { clearBrowserAnalyticsAuthContext(); });
    view.sent.splice(0);
    globalThis.fetch = async () => new Response('', { status: 500 });
    await React.act(async () => { await resolveBrowserCommercialAnalyticsAuthContext('offline', 'local-fixture', {}); });
    assert.deepEqual(view.sent, []);
  } finally { await view.close(); }
});
