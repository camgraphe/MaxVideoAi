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
    assert.equal(audioCalls + productCalls, 0, 'deduplication preserves the existing other-surface phases');
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
