import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { PathnameContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { GA4EventBridge } from '../frontend/components/analytics/GA4EventBridge';
import { GA4RouteTracker } from '../frontend/components/analytics/GA4RouteTracker';
import { PublicVideoAnalytics } from '../frontend/components/analytics/PublicVideoAnalytics.client';
import { clearBrowserAnalyticsAuthContext, resolveBrowserCommercialAnalyticsAuthContext } from '../frontend/lib/analytics/commercial-client';
import { persistPendingAnalyticsEvent } from '../frontend/lib/analytics-client';

async function fixture({ href = '/app/studio', analyticsConsent = true } = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: new URL(href, 'https://maxvideoai.com').href });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ React, window: dom.window, document: dom.window.document, navigator: dom.window.navigator, Element: dom.window.Element, CustomEvent: dom.window.CustomEvent, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  const fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  if (analyticsConsent) dom.window.localStorage.setItem('mv-consent-analytics', 'granted');
  clearBrowserAnalyticsAuthContext();
  const sent: Array<{ name: string; params: Record<string, unknown> }> = [];
  window.gtag = (_command, name, params) => { sent.push({ name: String(name), params: params as Record<string, unknown> }); };
  const root = createRoot(document.getElementById('root')!);
  async function render(href: string, watchReaderReady = false) {
    window.history.replaceState(null, '', href);
    const pathname = window.location.pathname;
    const watchReader = watchReaderReady
      ? React.createElement(PublicVideoAnalytics, { key: pathname, watchPath: pathname })
      : null;
    await React.act(async () => root.render(React.createElement(PathnameContext.Provider, { value: pathname },
      React.createElement(React.Fragment, null, React.createElement(GA4EventBridge), React.createElement(GA4RouteTracker), watchReader))));
  }
  await render(href);
  return {
    sent,
    render,
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

test('in-flight and unrecognized job statuses never emit failure before a successful generation', async () => {
  const view = await fixture();
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, commercialAnalyticsEligible: true }));
    await React.act(async () => { await resolveBrowserCommercialAnalyticsAuthContext('ordinary', 'local-fixture', {}); });
    const jobId = 'job_7df6d42a-4b70-4eca-82fe-3a320c4a6eb9';
    const localKey = 'local_batch_abcd_efgh_1';
    view.emit('mvai:analytics', { event: 'generation_started', payload: { route_family: 'workspace', local_key: localKey } });
    for (const status of ['queued', 'running', 'processing', 'pending', 'finalizing', 'unexpected']) {
      view.emit('jobs:status', { status, jobId, localKey });
    }
    assert.deepEqual(view.sent.filter(event => ['generation_completed', 'generation_failed'].includes(event.name)), []);
    view.emit('jobs:status', { status: 'completed', jobId });
    view.emit('jobs:status', { status: 'completed', jobId });
    const completed = view.sent.filter(event => event.name === 'generation_completed');
    assert.equal(completed.length, 1);
    assert.equal(completed[0].params.generation_sequence, 1, 'nonterminal updates still correlate local starts to jobs');
    assert.equal(view.sent.filter(event => event.name === 'generation_failed').length, 0);
    const failedJob = 'job_8df6d42a-4b70-4eca-82fe-3a320c4a6eb9';
    view.emit('jobs:status', { status: 'failed', jobId: failedJob });
    view.emit('jobs:status', { status: 'failed', jobId: failedJob });
    assert.equal(view.sent.filter(event => event.name === 'generation_failed').length, 1, 'explicit failures remain tracked once');
  } finally { await view.close(); }
});


test('anonymous public watch views require Analytics consent and keep video URLs masked', async () => {
  const first = '/video/first-example?token=private-fixture';
  const view = await fixture({ href: first, analyticsConsent: false });
  const pageViews = () => view.sent.filter(event => event.name === 'page_view');
  try {
    await view.render(first, true);
    assert.equal(pageViews().length, 0);
    await React.act(async () => {
      window.localStorage.setItem('mv-consent-analytics', 'granted');
      view.emit('consent:updated', { categories: { analytics: true } });
    });
    assert.equal(pageViews().length, 1, 'the consented watch view must send without resolving a user');
    assert.equal(pageViews()[0].params.page_location, 'https://maxvideoai.com/video/:video');
    assert.equal(pageViews()[0].params.page_path, '/video/:video');

    await React.act(async () => view.emit('consent:updated', { categories: { analytics: true } }));
    await view.render('/video/another-example', true);
    assert.equal(pageViews().length, 2, 'a different reader gets a new view with the same sanitized path');
    assert.equal(pageViews()[1].params.page_location, 'https://maxvideoai.com/video/:video');
    await view.render(first, true);
    assert.equal(pageViews().length, 3, 'reopening a reader records another view');
    assert.equal(view.sent.some(event => event.name === 'app_open'), false);
  } finally {
    await view.close();
  }
});

test('public watch measures the resolved reader and excludes known administrators', async () => {
  const href = '/video/late-reader';
  const view = await fixture({ href });
  const pageViews = () => view.sent.filter(event => event.name === 'page_view');
  try {
    assert.equal(pageViews().length, 0, 'a watch route without a reader has no video view');
    await view.render(href, true);
    assert.equal(pageViews().length, 1, 'a reader that appears after the route is tracked');

    await React.act(async () => {
      await resolveBrowserCommercialAnalyticsAuthContext('admin-fixture', null, { role: 'admin' });
    });
    await view.render('/video/admin-watch', true);
    assert.equal(pageViews().length, 1, 'admin traffic remains excluded on public video pages');
  } finally {
    await view.close();
  }
});
