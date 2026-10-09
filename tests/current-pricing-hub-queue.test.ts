import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines';
import type { PublicModelQuote, PublicModelQuoteInput } from '../frontend/lib/pricing-public-model-contract';
import { buildCurrentPricingHubData } from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/currentPricingHubData';
import {
  buildPricingHubData, getExactVideoPresetInput, getImagePricePresetInput, VIDEO_PRICE_PRESETS,
} from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData';

const key = (input: PublicModelQuoteInput) => JSON.stringify(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)));
const exact = (amountCents: number): PublicModelQuote => ({
  status: 'exact', amountCents, currency: 'USD', revision: 'controlled-current', scenarioLabel: 'Current scenario',
});
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
const other = {
  audio: async () => ({ totalCents: 432, currency: 'USD' }),
  product: async () => ({ totalCents: 543, currency: 'USD' }),
};

test('a hub quotes each authored exact input once through at most eight distinct workers', async () => {
  const entries = new Map(listFalEngines().map((entry) => [entry.id, entry]));
  for (const locale of ['en', 'fr', 'es'] as const) {
    const base = buildPricingHubData(locale);
    const authored = [
      ...base.video.rows.flatMap((row) => VIDEO_PRICE_PRESETS.flatMap((preset) => {
        const entry = entries.get(row.id);
        const input = entry && row.quotes[preset.id].status === 'exact'
          ? getExactVideoPresetInput(entry, preset, locale) : null;
        return input ? [input] : [];
      })),
      ...base.otherSurfaces.imageRows.flatMap((row) => [false, true].map((highQuality) =>
        getImagePricePresetInput(entries.get(row.id)!, highQuality))),
    ];
    const requests: PublicModelQuoteInput[] = [];
    const gates: Array<() => void> = [];
    let active = 0;
    let maximum = 0;
    let audioCalls = 0;
    let productCalls = 0;
    const pending = buildCurrentPricingHubData(locale, async (input) => {
      requests.push(input);
      maximum = Math.max(maximum, ++active);
      await new Promise<void>((resolve) => gates.push(resolve));
      active--;
      return exact(321);
    }, {
      audio: async () => { audioCalls++; return other.audio(); },
      product: async () => { productCalls++; return other.product(); },
    });
    await flush();
    assert.equal(requests.length, 8, 'the initial batch must remain bounded');
    assert.equal(audioCalls + productCalls, 21, 'independent other reads progress while model quotes remain held');
    while (gates.length) {
      gates.shift()!();
      await flush();
    }
    const data = await pending;
    assert.deepEqual(new Set(requests.map(key)), new Set(authored.map(key)), 'every exact authored input remains quoted');
    assert.equal(requests.length, new Set(requests.map(key)).size, 'identical matrix inputs share one quote');
    assert.equal(requests.filter((input) => input.mode !== 't2i').length, 114);
    assert.equal(requests.filter((input) => input.mode === 't2i').length, 18);
    assert.equal(requests.length + audioCalls + productCalls, 153);
    assert.equal(maximum, 8);
    assert.equal(audioCalls, 9);
    assert.equal(productCalls, 12);
    for (const row of data.video.rows) for (const preset of VIDEO_PRICE_PRESETS) {
      if (base.video.rows.find((candidate) => candidate.id === row.id)!.quotes[preset.id].status === 'exact') {
        assert.equal(row.quotes[preset.id].amountCents, 321, 'all duplicate slots receive the current result');
      }
    }
  }
});

test('unavailable quotes are shared only within one hub and the next hub retries every distinct input', async () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const calls: PublicModelQuoteInput[][] = [[], []];
    const failed = await buildCurrentPricingHubData(locale, async (input) => {
      calls[0].push(input);
      return { status: 'unavailable' };
    }, other);
    const recovered = await buildCurrentPricingHubData(locale, async (input) => {
      calls[1].push(input);
      return exact(321);
    }, other);
    assert.equal(calls[0].length, 132);
    assert.deepEqual(calls[1].map(key), calls[0].map(key), 'a later invocation makes fresh canonical calls');
    for (const row of failed.video.rows) for (const quote of Object.values(row.quotes)) {
      assert.notEqual(quote.status, 'exact', 'unavailability must not retain a catalogue exact amount');
    }
    for (const row of failed.otherSurfaces.imageRows) {
      assert.doesNotMatch(`${row.standardImage} ${row.highQualityImage}`, /\d+[.,]\d{2}/);
    }
    assert.equal(recovered.video.highlights.filter((highlight) => highlight.featured).length, 3);
    assert.ok(recovered.video.rows.some((row) => Object.values(row.quotes).some((quote) => quote.amountCents === 321)));
  }
});

test('an unexpected quote rejection still rejects the hub and cannot poison the next invocation', async () => {
  const failure = new Error('canonical quote rejected');
  await assert.rejects(buildCurrentPricingHubData('en', async () => { throw failure; }, other), (error) => error === failure);
  let calls = 0;
  const recovered = await buildCurrentPricingHubData('en', async () => { calls++; return exact(654); }, other);
  assert.equal(calls, 132);
  assert.ok(recovered.video.rows.some((row) => Object.values(row.quotes).some((quote) => quote.amountCents === 654)));
});

function heldQuotes() {
  const model: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];
  const others: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];
  const active = { model: 0, other: 0 };
  const maximum = { model: 0, other: 0, total: 0 };
  const calls = { model: 0, other: 0 };
  const hold = async (family: 'model' | 'other') => {
    calls[family]++;
    active[family]++;
    maximum.model = Math.max(maximum.model, active.model);
    maximum.other = Math.max(maximum.other, active.other);
    maximum.total = Math.max(maximum.total, active.model + active.other);
    try {
      await new Promise<void>((resolve, reject) => (family === 'model' ? model : others).push({ resolve, reject }));
    } finally { active[family]--; }
  };
  return { model, others, active, maximum, calls,
    quote: async (input: PublicModelQuoteInput) => { await hold('model'); return exact(input.mode === 't2i' ? 777 : 321); },
    dependencies: {
      audio: async () => { await hold('other'); return { totalCents: 432, currency: 'USD' }; },
      product: async () => { await hold('other'); return { totalCents: 543, currency: 'USD' }; },
    },
  };
}

test('eight model and four other quotes overlap until all model workers stop, then twelve other quotes can progress', async () => {
  const held = heldQuotes();
  const pending = buildCurrentPricingHubData('en', held.quote, held.dependencies);
  await flush();
  assert.deepEqual(held.active, { model: 8, other: 4 }, 'both independent queues start immediately within twelve active quotes');
  // One fast other quote refills only its existing worker while models remain active.
  held.others.shift()!.resolve();
  await flush();
  assert.deepEqual(held.active, { model: 8, other: 4 });
  const slowModel = held.model.shift()!;
  while (held.model.length) { held.model.shift()!.resolve(); await flush(); }
  assert.deepEqual(held.active, { model: 1, other: 4 }, 'staggered model completion cannot admit extra other workers');
  slowModel.resolve();
  await flush();
  assert.deepEqual(held.active, { model: 0, other: 12 }, 'slow other work gets the complete budget after the last model worker');
  while (held.others.length) { held.others.shift()!.resolve(); await flush(); }
  const data = await pending;
  assert.deepEqual(held.calls, { model: 132, other: 21 });
  assert.deepEqual(held.maximum, { model: 8, other: 12, total: 12 });
  assert.deepEqual(held.active, { model: 0, other: 0 });
  assert.ok(data.otherSurfaces.imageRows.every(row => row.standardImage === '$7.77' && row.highQualityImage === '$7.77'),
    'the shared image rows contain finalized current prices when the hub returns');
});

test('early model rejection retains its original error and holds extra other workers until surviving workers settle', async () => {
  const held = heldQuotes();
  const original = new Error('first model failure');
  const pending = buildCurrentPricingHubData('fr', held.quote, held.dependencies);
  const rejected = assert.rejects(pending, error => error === original);
  await flush();
  assert.deepEqual(held.active, { model: 8, other: 4 });
  held.model.shift()!.reject(original);
  await rejected;
  await flush();
  assert.deepEqual(held.active, { model: 7, other: 4 }, 'fail-fast Promise.all rejection must not release the extra budget');
  held.model.shift()!.reject(new Error('late model failure'));
  await flush();
  assert.deepEqual(held.active, { model: 6, other: 4 }, 'a later rejection is observed without releasing held siblings');
  while (held.model.length) { held.model.shift()!.resolve(); await flush(); }
  assert.deepEqual(held.active, { model: 0, other: 12 });
  // Late other errors retain their localized fallback and must remain observed after hub rejection.
  while (held.others.length) { held.others.shift()!.reject(new Error('late other failure')); await flush(); }
  assert.deepEqual(held.maximum, { model: 8, other: 12, total: 12 });
  assert.deepEqual(held.calls, { model: 132, other: 21 });
  let models = 0, others = 0;
  const recovered = await buildCurrentPricingHubData('fr', async () => { models++; return exact(321); }, {
    audio: async () => { others++; return { totalCents: 432, currency: 'USD' }; },
    product: async () => { others++; return { totalCents: 543, currency: 'USD' }; },
  });
  assert.equal(models, 132, 'the next request retries all distinct model inputs');
  assert.equal(others, 21, 'the next request retries all other inputs');
  assert.ok(recovered.otherSurfaces.imageRows.every(row => /3,21/.test(row.standardImage)));
});
