import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { syncOpenAIAttribution } from '../frontend/lib/analytics/openai-browser';

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
    (dom.window as any).__mvaiCommercialAnalyticsExcluded = true;
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
