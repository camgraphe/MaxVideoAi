import assert from 'node:assert/strict';
import test from 'node:test';

import type { PricingSnapshot } from '@maxvideoai/pricing';
import type { PricingContext } from '../frontend/src/lib/pricing-context';
import type { GalleryVideo } from '../frontend/server/videos-normalization';
import {
  quoteCurrentExamplePrice,
  quoteCurrentExamplePrices,
} from '../frontend/server/current-example-price';

function video(overrides: Partial<GalleryVideo> = {}): GalleryVideo {
  return {
    id: 'old-kling-render',
    userId: null,
    engineId: 'kling-3-pro',
    engineLabel: 'Kling 3 Pro',
    durationSec: 5,
    prompt: 'A street at dusk',
    promptExcerpt: 'A street at dusk',
    createdAt: '2025-01-15T12:00:00Z',
    visibility: 'public',
    indexable: true,
    hasAudio: true,
    canUpscale: false,
    aspectRatio: '16:9',
    finalPriceCents: 288,
    currency: 'USD',
    settingsSnapshot: {
      inputMode: 't2v',
      core: { durationSec: 5, resolution: '1080p', audio: true, aspectRatio: '16:9' },
      refs: {},
    },
    ...overrides,
  };
}

function currentQuote(calls: PricingContext[], cents = 141) {
  return async (context: PricingContext): Promise<PricingSnapshot> => {
    calls.push(context);
    return {
      currency: 'USD',
      totalCents: cents,
      subtotalBeforeDiscountCents: cents,
      base: { seconds: context.durationSec, rate: cents / 100 / context.durationSec, unit: 'sec', amountCents: cents },
      addons: [],
      margin: { percent: 0, flatCents: 0, amountCents: 0 },
    } as PricingSnapshot;
  };
}

test('a complete old Kling render shows its current exact quote, not the old paid amount', async () => {
  const calls: PricingContext[] = [];
  const result = await quoteCurrentExamplePrice(video(), { quote: currentQuote(calls) });

  assert.deepEqual(result, {
    kind: 'exact', modelId: 'kling-3-pro', amountCents: 141,
    currency: 'USD', scenarioLabel: 'Text to video · 5s · 1080p',
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.engine.id, 'kling-3-pro');
  assert.equal(calls[0]?.mode, 't2v');
  assert.equal(calls[0]?.resolution, '1080p');
  assert.equal(calls[0]?.durationSec, 5);
});

test('missing saved resolution gives a named current reference, not a claimed exact recreation', async () => {
  const calls: PricingContext[] = [];
  const result = await quoteCurrentExamplePrice(video({
    settingsSnapshot: { inputMode: 't2v', core: { durationSec: 5, audio: true }, refs: {} },
  }), { quote: currentQuote(calls) });

  assert.equal(result.kind, 'reference');
  if (result.kind === 'reference') {
    assert.equal(result.amountCents, 141);
    assert.match(result.scenarioLabel, /Text to video.*5s.*1080p/);
  }
  assert.equal(calls.length, 1);
});

test('private image references prevent an exact price claim', async () => {
  const calls: PricingContext[] = [];
  const result = await quoteCurrentExamplePrice(video({
    settingsSnapshot: {
      inputMode: 'i2v',
      core: { durationSec: 5, resolution: '1080p', audio: true, aspectRatio: '16:9' },
      refs: { imageUrl: 'https://private.example/source.png' },
    },
  }), { quote: currentQuote(calls) });

  assert.equal(result.kind, 'reference');
  assert.equal(calls[0]?.mode, 't2v');
});

test('an unpublished original model is not silently priced as its successor', async () => {
  const calls: PricingContext[] = [];
  const result = await quoteCurrentExamplePrice(video({ engineId: 'seedance-1-5-pro' }), { quote: currentQuote(calls) });
  assert.deepEqual(result, { kind: 'unavailable', modelId: 'seedance-1-5-pro' });
  assert.equal(calls.length, 0);
});

test('a failed current quote never falls back to the historical charge', async () => {
  const result = await quoteCurrentExamplePrice(video(), {
    quote: async () => { throw new Error('pricing unavailable'); },
  });
  assert.deepEqual(result, { kind: 'unavailable', modelId: 'kling-3-pro' });
});

test('repeated model settings share one current quote across gallery cards', async () => {
  const calls: PricingContext[] = [];
  const first = video();
  const second = video({ id: 'second-kling-render', finalPriceCents: 90 });
  const prices = await quoteCurrentExamplePrices([first, second], { quote: currentQuote(calls) });

  assert.equal(prices.get(first.id)?.kind, 'exact');
  assert.equal(prices.get(second.id)?.kind, 'exact');
  assert.equal(calls.length, 1);
});
