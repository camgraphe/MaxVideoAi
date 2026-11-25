import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { notifyCustomerPricingRefresh } from '../frontend/lib/customer-tariff-revision';
import { useStoryboardPricing } from '../frontend/src/components/tools/storyboard/_hooks/useStoryboardPricing';

test('storyboard generation and edit retain their displayed revision and refresh without submitting', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://local.test/app/tools/storyboard' });
  const globals = {
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    localStorage: dom.window.localStorage, Event: dom.window.Event, IS_REACT_ACT_ENVIRONMENT: true,
  };
  const saved = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const previousFetch = globalThis.fetch;
  let revision = 7;
  let estimates = 0;
  const bodies: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), '/api/images/estimate', 'refresh may only request an estimate, never generation');
    estimates += 1;
    bodies.push(JSON.parse(String(init?.body)));
    return Response.json({ ok: true, pricing: {
      totalCents: revision === 7 ? 123 : 145, currency: 'USD',
      meta: { pricingMode: 'manual_tariff', customerTariffRevision: revision },
    } });
  };
  let latest: ReturnType<typeof useStoryboardPricing> | undefined;
  const selectedImage = { url: 'https://media.example/frame.png', width: 1920, height: 1080 };
  function Fixture() {
    latest = useStoryboardPricing({ locale: 'en', storyboardOrientation: 'landscape', storyboardTier: 'hd',
      targetModel: 'kling', referenceImageCount: 3, selectedImage });
    return null;
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  try {
    await act(async () => root.render(React.createElement(Fixture)));
    assert.equal(estimates, 4, 'three generation tiers and one edit quote must be fetched');
    assert.ok(bodies.every(body => body.engineId === 'gpt-image-2-6-sunburst'));
    for (const body of bodies.filter(body => body.source === 'storyboard')) {
      assert.equal(body.referenceImageCount, 3);
      assert.deepEqual(body.metadata, { storyboard: { role: 'board', targetModel: 'kling' } });
    }
    assert.equal(latest?.generationPricingSnapshot?.meta?.customerTariffRevision, 7);
    assert.equal(latest?.editPricingSnapshot?.meta?.customerTariffRevision, 7);
    assert.equal(latest?.activePrice, '$1.23');
    assert.equal(latest?.editPriceLabel, '$1.23');

    revision = 8;
    await act(async () => notifyCustomerPricingRefresh('PRICING_REFRESH_REQUIRED'));
    assert.equal(estimates, 8);
    assert.equal(latest?.generationPricingSnapshot?.meta?.customerTariffRevision, 8);
    assert.equal(latest?.editPricingSnapshot?.meta?.customerTariffRevision, 8);
    assert.equal(latest?.activePrice, '$1.45');
    assert.equal(latest?.editPriceLabel, '$1.45');
  } finally {
    globalThis.fetch = previousFetch;
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
