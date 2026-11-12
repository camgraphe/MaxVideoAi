import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { syncOpenAIAttribution } from '../frontend/lib/analytics/openai-browser';
import {
  resolveBrowserCommercialAnalyticsAuthContext,
  setBrowserAnalyticsAuthContext,
} from '../frontend/lib/analytics/commercial-client';

test('the browser preserves the opaque click only after both consents and removes it on withdrawal or admin resolution', () => {
  const dom = new JSDOM('', { url: 'https://maxvideoai.com/?oppref=opaque-click' });
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document });
  const consent = (analytics: boolean, ads: boolean, version = 'policy') => {
    dom.window.document.cookie = `mv-consent=${encodeURIComponent(JSON.stringify({ version, timestamp: Date.now() - 1000, categories: { analytics, ads }, source: 'banner' }))}; Path=/`;
  };
  try {
    consent(true, false);
    assert.equal(syncOpenAIAttribution('policy'), null);
    assert.doesNotMatch(dom.window.document.cookie, /mvai-openai-click/);
    consent(true, true, 'old');
    assert.equal(syncOpenAIAttribution('policy'), null);
    consent(true, true);
    const first = syncOpenAIAttribution('policy');
    assert.equal(first?.oppref, 'opaque-click');
    dom.window.history.pushState(null, '', '/login');
    assert.deepEqual(syncOpenAIAttribution('policy'), first);
    consent(false, false);
    assert.equal(syncOpenAIAttribution('policy'), null);
    assert.doesNotMatch(dom.window.document.cookie, /mvai-openai-click/);
    dom.window.history.pushState(null, '', '/?oppref=opaque-click');
    consent(true, true);
    setBrowserAnalyticsAuthContext({ role: 'admin' });
    assert.equal(syncOpenAIAttribution('policy'), null);
    assert.doesNotMatch(dom.window.document.cookie, /mvai-openai-click/);
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument);
    else Reflect.deleteProperty(globalThis, 'document');
    dom.window.close();
  }
});

test('email confirmation and unavailable roles preserve a consented click until authenticated eligibility resolves', async () => {
  const landing = new JSDOM('', { url: 'https://maxvideoai.com/?oppref=email-click' });
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const oldFetch = globalThis.fetch;
  let confirmed: JSDOM | undefined;
  const activate = (dom: JSDOM) => {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document });
  };
  try {
    activate(landing);
    landing.window.document.cookie = `mv-consent=${encodeURIComponent(JSON.stringify({ version: 'policy', timestamp: Date.now() - 1000, categories: { analytics: true, ads: true }, source: 'banner' }))}; Path=/`;
    const click = syncOpenAIAttribution('policy');
    assert.equal(click?.oppref, 'email-click');
    landing.window.history.pushState(null, '', '/login');
    // Supabase returns a new user but no session before the confirmation email.
    globalThis.fetch = async () => Response.json({ ok: false, commercialAnalyticsEligible: false });
    assert.equal(await resolveBrowserCommercialAnalyticsAuthContext('new-user'), false);
    assert.equal(syncOpenAIAttribution('policy'), null);
    assert.match(landing.window.document.cookie, /mvai-openai-click=/);

    // Following the email link loads a new document with the same first-party cookies.
    confirmed = new JSDOM('', { url: 'https://maxvideoai.com/app', cookieJar: landing.cookieJar });
    activate(confirmed);
    globalThis.fetch = async () => {
      throw new Error('temporary role lookup failure');
    };
    assert.equal(await resolveBrowserCommercialAnalyticsAuthContext('new-user', 'fixture-token'), false);
    assert.equal(syncOpenAIAttribution('policy'), null);
    assert.match(confirmed.window.document.cookie, /mvai-openai-click=/);
    confirmed.window.close();
    confirmed = new JSDOM('', { url: 'https://maxvideoai.com/app', cookieJar: landing.cookieJar });
    activate(confirmed);
    globalThis.fetch = async () => Response.json({ ok: false, commercialAnalyticsEligible: true });
    assert.equal(await resolveBrowserCommercialAnalyticsAuthContext('new-user', 'fixture-token'), true);
    assert.deepEqual(syncOpenAIAttribution('policy'), click);
    // A real DB admin response still erases the attribution.
    globalThis.fetch = async () => Response.json({ ok: true, commercialAnalyticsEligible: false });
    assert.equal(await resolveBrowserCommercialAnalyticsAuthContext('admin-user', 'fixture-token'), false);
    assert.equal(syncOpenAIAttribution('policy'), null);
    assert.doesNotMatch(confirmed.window.document.cookie, /mvai-openai-click=/);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument);
    else Reflect.deleteProperty(globalThis, 'document');
    landing.window.close();
    confirmed?.window.close();
  }
});
