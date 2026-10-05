import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
import path from 'node:path';
import { persistPendingAnalyticsEvent, readPendingAnalyticsEvent } from '../frontend/lib/analytics-client';
import { prepareBrowserAnalyticsEvents, readWalletAnalyticsJourney } from '../frontend/lib/analytics/journey-browser';
import { sendPreparedAnalyticsEvents } from '../frontend/lib/analytics/ordered-events';

test('compiled public GA target still sets the admin disable flag without a browser process shim', async () => {
  const frontend = path.join(process.cwd(), 'frontend');
  const bundle = await build({
    absWorkingDir: frontend, bundle: true, platform: 'browser', format: 'iife', write: false,
    tsconfig: path.join(frontend, 'tsconfig.json'),
    define: { 'process.env.NEXT_PUBLIC_GA_ID': '"G-LOCAL-FIXTURE"' },
    stdin: { resolveDir: frontend, loader: 'ts', contents: `import { setBrowserAnalyticsAuthContext } from './lib/analytics/commercial-client'; window.setFixtureContext = setBrowserAnalyticsAuthContext;` },
  });
  const dom = new JSDOM('', { url: 'https://maxvideoai.test', runScripts: 'outside-only' });
  try {
    assert.equal('process' in dom.window, false);
    dom.window.eval(bundle.outputFiles[0].text);
    dom.window.eval('window.setFixtureContext({ role: "admin" })');
    assert.equal((dom.window as unknown as Record<string, unknown>)['ga-disable-G-LOCAL-FIXTURE'], true);
  } finally { dom.window.close(); }
});

test('trusted app admin roles suppress browser milestones, pending auth, wallet attribution and queued transport', async (t) => {
  const dom = new JSDOM('', { url: 'https://maxvideoai.com/app/studio' });
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window });
  t.after(() => { dom.window.close(); if (saved) Object.defineProperty(globalThis, 'window', saved); else Reflect.deleteProperty(globalThis, 'window'); });
  dom.window.localStorage.setItem('mv-consent-analytics', 'granted');
  const mod = await import('../frontend/lib/analytics/commercial-client') as Record<string, unknown>;
  const setContext = mod.setBrowserAnalyticsAuthContext as (appMetadata: unknown) => void;
  assert.equal(typeof setContext, 'function');
  persistPendingAnalyticsEvent('login_completed', { method: 'password' });
  assert.ok(readPendingAnalyticsEvent());
  setContext({ role: 'customer', roles: ['member', 'ADMIN'] });
  assert.equal(readPendingAnalyticsEvent(), null);
  assert.deepEqual(prepareBrowserAnalyticsEvents('studio_entered', { route_family: 'workspace' }), []);
  assert.equal(readWalletAnalyticsJourney(), null);
  let calls = 0;
  assert.equal(sendPreparedAnalyticsEvents(() => { calls += 1; }, [{ event: 'purchase', payload: {} }]), 1);
  assert.equal(calls, 0);
  // User-owned profile fields or an email address never confer admin authority.
  setContext({ role: 'member' });
  persistPendingAnalyticsEvent('login_completed', { method: 'password' });
  assert.ok(readPendingAnalyticsEvent());
});

test('private entry waits for a deduped authenticated role read and excludes DB-only admin or lookup failure', async (t) => {
  const dom = new JSDOM('', { url: 'https://maxvideoai.com/app/studio' });
  const saved = new Map(['window', 'document', 'fetch'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document });
  t.after(() => { dom.window.close(); for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } });
  dom.window.localStorage.setItem('mv-consent-analytics', 'granted');
  const { resolveBrowserCommercialAnalyticsAuthContext: resolve, clearBrowserAnalyticsAuthContext } = await import('../frontend/lib/analytics/commercial-client');
  clearBrowserAnalyticsAuthContext();
  const page = { route_family: 'workspace', workspace_section: 'studio' };
  assert.deepEqual(prepareBrowserAnalyticsEvents('page_view', page), [], 'unknown role cannot emit first app entry');
  let release!: (response: Response) => void;
  let requests = 0;
  globalThis.fetch = async (_url, options) => {
    requests += 1;
    assert.equal((options?.headers as Record<string, string>).Authorization, 'Bearer local-fixture');
    return new Promise((done) => { release = done; });
  };
  const first = resolve('db-admin', 'local-fixture', { role: 'member' });
  assert.equal(resolve('db-admin', 'local-fixture', { role: 'member' }), first);
  await Promise.resolve();
  assert.equal(requests, 1);
  assert.deepEqual(prepareBrowserAnalyticsEvents('page_view', page), []);
  release(new Response(JSON.stringify({ ok: true, commercialAnalyticsEligible: false })));
  assert.equal(await first, false);
  assert.deepEqual(prepareBrowserAnalyticsEvents('page_view', page), [], 'DB-only admin stays excluded');
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, commercialAnalyticsEligible: true }));
  assert.equal(await resolve('ordinary', 'local-fixture', {}), true);
  assert.ok(prepareBrowserAnalyticsEvents('page_view', page).some((event) => event.event === 'studio_entered'));
  assert.equal(await resolve('metadata-admin', 'local-fixture', { role: 'admin' }), false);
  assert.deepEqual(prepareBrowserAnalyticsEvents('page_view', page), []);
  assert.equal(await resolve('ordinary', 'local-fixture', {}), true, 'return from a metadata admin invalidates the earlier ordinary cache');
  globalThis.fetch = async () => { throw new Error('offline'); };
  assert.equal(await resolve('unknown', 'local-fixture', {}), false);
  assert.deepEqual(prepareBrowserAnalyticsEvents('generation_completed', { route_family: 'workspace', job_id: 'owned' }), []);
  clearBrowserAnalyticsAuthContext();
});
