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
    stdin: { resolveDir: frontend, loader: 'ts', contents: `import { setBrowserAnalyticsAuthContext, clearBrowserAnalyticsAuthContext, resolveBrowserCommercialAnalyticsAuthContext } from './lib/analytics/commercial-client'; window.setFixtureContext = setBrowserAnalyticsAuthContext; window.clearFixtureContext = clearBrowserAnalyticsAuthContext; window.resolveFixtureContext = resolveBrowserCommercialAnalyticsAuthContext;` },
  });
  const dom = new JSDOM('', { url: 'https://maxvideoai.test', runScripts: 'outside-only' });
  try {
    assert.equal('process' in dom.window, false);
    dom.window.eval(bundle.outputFiles[0].text);
    dom.window.eval('window.setFixtureContext({ role: "admin" })');
    assert.equal((dom.window as unknown as Record<string, unknown>)['ga-disable-G-LOCAL-FIXTURE'], true);
    dom.window.eval('window.setFixtureContext({ role: "member" })');
    assert.equal((dom.window as unknown as Record<string, unknown>)['ga-disable-G-LOCAL-FIXTURE'], true, 'member metadata cannot clear known disable state');
    dom.window.eval('window.clearFixtureContext()');
    dom.window.localStorage.setItem('mv-consent-analytics', 'granted');
    dom.window.fetch = async () => new Response(JSON.stringify({ ok: true, commercialAnalyticsEligible: false }));
    assert.equal(await dom.window.eval('window.resolveFixtureContext("db-admin", "fixture-token", {})'), false);
    assert.equal((dom.window as unknown as Record<string, unknown>)['ga-disable-G-LOCAL-FIXTURE'], true);
    const now = dom.window.Date.now;
    dom.window.Date.now = () => now() + 31_000;
    let release!: (response: Response) => void;
    dom.window.fetch = async () => new Promise((done) => { release = done; });
    const recheck = dom.window.eval('window.resolveFixtureContext("db-admin", "fixture-token", {})') as Promise<boolean>;
    await Promise.resolve();
    assert.equal((dom.window as unknown as Record<string, unknown>)['ga-disable-G-LOCAL-FIXTURE'], true, 'disable flag persists during DB revalidation');
    release(new Response(JSON.stringify({ ok: false, commercialAnalyticsEligible: true })));
    assert.equal(await recheck, true);
    assert.equal((dom.window as unknown as Record<string, unknown>)['ga-disable-G-LOCAL-FIXTURE'], false, 'confirmed ordinary eligibility can restore tracking');
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
  assert.equal(readPendingAnalyticsEvent(), null, 'non-admin metadata cannot retire known admin exclusion');
  (mod.clearBrowserAnalyticsAuthContext as () => void)();
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

test('DB admin exclusion survives a public reload and remains active through same-account role revalidation', async (t) => {
  const dom = new JSDOM('', { url: 'https://maxvideoai.com/app/studio' });
  const publicDom = new JSDOM('', { url: 'https://maxvideoai.com/integrations/claude' });
  const saved = new Map(['window', 'document', 'fetch'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const savedNow = Date.now;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document });
  t.after(() => {
    Date.now = savedNow;
    dom.window.close(); publicDom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  });
  dom.window.localStorage.setItem('mv-consent-analytics', 'granted');
  const { resolveBrowserCommercialAnalyticsAuthContext: resolve, clearBrowserAnalyticsAuthContext, isBrowserCommercialAnalyticsExcluded } = await import('../frontend/lib/analytics/commercial-client');
  clearBrowserAnalyticsAuthContext();
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, commercialAnalyticsEligible: false }));
  assert.equal(await resolve('db-admin', 'local-fixture', {}), false);
  const exclusionKey = 'mvai.analytics-excluded-admin.v1';
  assert.equal(dom.window.sessionStorage.getItem(exclusionKey), '1', 'authoritative DB admin evidence is retained without identity data');
  let release!: (response: Response) => void;
  const afterCacheExpiry = savedNow() + 31_000;
  Date.now = () => afterCacheExpiry;
  globalThis.fetch = async () => new Promise((done) => { release = done; });
  const recheck = resolve('db-admin', 'local-fixture', {});
  await Promise.resolve();
  assert.equal(isBrowserCommercialAnalyticsExcluded(), true, 'same-account refresh cannot temporarily unexclude a known admin');
  assert.equal(dom.window.sessionStorage.getItem(exclusionKey), '1');
  assert.deepEqual(prepareBrowserAnalyticsEvents('cta_click', { cta_name: 'mcp_setup_guide', route_family: 'integrations' }), []);
  release(new Response(JSON.stringify({ ok: true, commercialAnalyticsEligible: false })));
  await recheck;
  Object.defineProperty(publicDom.window, 'sessionStorage', { configurable: true, value: dom.window.sessionStorage });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: publicDom.window });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: publicDom.window.document });
  publicDom.window.localStorage.setItem('mv-consent-analytics', 'granted');
  assert.equal(isBrowserCommercialAnalyticsExcluded(), true, 'a new public document inherits the exclusion');
  assert.deepEqual(prepareBrowserAnalyticsEvents('page_view', { route_family: 'integrations' }), []);
  assert.deepEqual(prepareBrowserAnalyticsEvents('cta_click', { cta_name: 'mcp_setup_guide', route_family: 'integrations' }), []);
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, commercialAnalyticsEligible: true }));
  assert.equal(await resolve('other-customer', 'local-fixture', {}), true);
  assert.equal(isBrowserCommercialAnalyticsExcluded(), false);
  assert.equal(publicDom.window.sessionStorage.getItem(exclusionKey), null, 'confirmed ordinary account restores its commercial eligibility');
  assert.ok(prepareBrowserAnalyticsEvents('page_view', { route_family: 'integrations' }).length > 0);
  clearBrowserAnalyticsAuthContext();
});
