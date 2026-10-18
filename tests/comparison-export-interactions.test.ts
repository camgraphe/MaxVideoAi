import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { buildComparisonExport, publicComparisonUrl } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-export';
import { CompareScoreActions } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareScoreActions.client';
import { CompareInteractionTracking } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareInteractionTracking.client';

const input: Parameters<typeof buildComparisonExport>[0] = {
  locale: 'en', path: 'http://localhost:8770/fr/comparatif/model-a-vs-model-b?order=model-b&utm_source=private#pricing',
  leftName: 'Model A', rightName: 'Model B', metrics: [], leftUpdated: '2026-09-01', rightUpdated: null,
  specRows: [{ label: 'References', left: 'Supported (up to 10 reference images)', right: 'Not supported', sublines: ['Only in reference mode'] }],
  leftPricing: { headline: '$0.135/s', subline: null, prices: [13.5], scenario: { modelId: 'gemini-omni-flash', mode: 't2v', durationSec: 8, resolution: '720p', aspectRatio: '16:9', audio: true, amountCents: 108 }, priceRows: [{ resolution: '720p', unitPrice: '$0.135/s', totalPrice: '$1.08' }] },
  rightPricing: { headline: '$999', subline: null, prices: [], quoteUnavailable: true },
  priceSnapshotAt: '2026-10-18T12:00:00.000Z', sources: [{ name: 'Model A', urls: ['https://fal.ai/models/example'] }],
  labels: { pending: 'Data pending', supported: 'Supported', notSupported: 'Not supported', na: 'N/A' },
};

test('copy is self-contained and never leaks the preview origin or visit parameters', () => {
  const output = buildComparisonExport(input);
  assert.equal(publicComparisonUrl(input.path), 'https://maxvideoai.com/fr/comparatif/model-a-vs-model-b#scores');
  assert.doesNotMatch(output, /localhost|utm_source|order=|\$999/);
  for (const fact of ['up to 10 reference images', 'Only in reference mode', 'Not supported', '720p', '8 s', '16:9', 'audio on', '$1.08', '$0.135/s', 'USD', '2026-09-01', '2026-10-18T12:00:00.000Z', 'https://fal.ai/models/example', 'date unavailable']) assert.ok(output.includes(fact), fact);
  assert.match(output, /Current quote unavailable/);
});

test('actual clipboard writes, success/failure events and consent/admin exclusions', async () => {
  const dom = new JSDOM('<main id="comparison-detail" data-model-left="gemini-omni-flash" data-model-right="veo-3-1"><div id="root"></div></main>', { url: 'http://localhost:8770/?secret=visitor' });
  let clipboard = '';
  let reject = false;
  const browserNavigator = { clipboard: { writeText: async (value: string) => { if (reject) throw new Error('denied'); clipboard = value; } } };
  const globals = { React, window: dom.window, document: dom.window.document, navigator: browserNavigator, CustomEvent: dom.window.CustomEvent, IS_REACT_ACT_ENVIRONMENT: true };
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const root = createRoot(dom.window.document.getElementById('root')!);
  const events: Array<{ event: string; payload: Record<string, unknown> }> = [];
  dom.window.addEventListener('mvai:analytics', event => events.push((event as CustomEvent).detail));
  const click = async (index: number) => act(async () => { (dom.window.document.querySelectorAll('button')[index] as HTMLButtonElement).click(); });
  const markdown = buildComparisonExport(input);
  try {
    await act(async () => root.render(React.createElement(CompareScoreActions, { locale: 'en', markdown, canonicalUrl: publicComparisonUrl(input.path) })));
    await click(0);
    assert.equal(clipboard, markdown);
    assert.equal(events.length, 0, 'no analytics without consent, but copy still works');
    dom.window.localStorage.setItem('mv-consent-analytics', 'granted');
    await click(1);
    assert.equal(clipboard, publicComparisonUrl(input.path));
    assert.equal(events.length, 1);
    assert.equal(events[0].payload.action, 'copy_link');
    assert.equal(events[0].payload.model_left, 'gemini-omni-flash');
    assert.equal(events[0].payload.model_right, 'veo-3-1');
    reject = true;
    await click(0);
    assert.match(dom.window.document.querySelector('[role=status]')!.textContent!, /Could not copy/);
    assert.equal(events.length, 1, 'clipboard rejection is not a copy success');
    reject = false;
    dom.window.sessionStorage.setItem('mvai.analytics-excluded-admin.v1', '1');
    await click(0);
    assert.equal(clipboard, markdown);
    assert.equal(events.length, 1, 'admin activity is excluded');
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});

test('only opening a scoped disclosure is measured and listener is cleaned up', async () => {
  const dom = new JSDOM('<main id="comparison-detail"><details data-comparison-section="specifications"><summary>Specs</summary></details><div id="root"></div></main>');
  // Storage and location need an explicit origin.
  dom.reconfigure({ url: 'https://maxvideoai.com/ai-video-engines/a-vs-b' });
  const globals = { React, window: dom.window, document: dom.window.document, HTMLDetailsElement: dom.window.HTMLDetailsElement, CustomEvent: dom.window.CustomEvent, IS_REACT_ACT_ENVIRONMENT: true };
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const root = createRoot(dom.window.document.getElementById('root')!);
  let count = 0;
  dom.window.localStorage.setItem('mv-consent-analytics', 'granted');
  dom.window.addEventListener('mvai:analytics', () => count++);
  const detail = dom.window.document.querySelector('details')!;
  try {
    await act(async () => root.render(React.createElement(CompareInteractionTracking, { locale: 'en' })));
    detail.open = true;
    await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(count, 1);
    detail.open = false;
    await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(count, 1);
    await act(async () => root.unmount());
    detail.open = true;
    await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(count, 1);
  } finally {
    dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
