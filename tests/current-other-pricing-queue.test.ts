import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCurrentOtherPricing } from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/current-other-pricing';
import { buildPricingHubData } from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData';
import type { AudioPricingInput } from '../frontend/src/lib/audio-generation';

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
const expectedAudio = [
  { pack: 'music_only' }, { pack: 'voice_only' }, { pack: 'voice_only', voiceMode: 'clone' },
].flatMap((preset) => [30, 60, 120].map((durationSec) => ({ ...preset, durationSec, script: null, musicEnabled: true })));
const expectedProducts = [
  { productKey: 'character-draft', quantity: 1 }, { productKey: 'character-draft', quantity: 3 },
  { productKey: 'character-final', quantity: 1 }, { productKey: 'character-final', quantity: 2 },
  { productKey: 'angle-flux-single', quantity: 1 }, { productKey: 'angle-qwen-single', quantity: 1 },
  { productKey: 'angle-flux-multi', quantity: 1 }, { productKey: 'angle-qwen-multi', quantity: 1 },
  { productKey: 'upscale-image-seedvr', quantity: 1 }, { productKey: 'upscale-image-topaz', quantity: 1 },
  { productKey: 'upscale-video-seedvr', quantity: 1 }, { productKey: 'upscale-video-topaz', quantity: 1 },
];

test('audio and products share twelve workers and products can finish while an audio quote is still pending', async () => {
  const audio: AudioPricingInput[] = [];
  const product: Array<{ productKey: string; quantity: number }> = [];
  const gates: Array<() => void> = [];
  let active = 0;
  let maximum = 0;
  const hold = async () => {
    maximum = Math.max(maximum, ++active);
    await new Promise<void>((resolve) => gates.push(resolve));
    active--;
    return { totalCents: 432, currency: 'USD' };
  };
  const pending = buildCurrentOtherPricing(buildPricingHubData('en').otherSurfaces, 'en', {
    audio: async (input) => { audio.push(input); return hold(); },
    product: async (input) => { product.push(input); return hold(); },
  });
  await flush();
  const initiallyStarted = { audio: audio.length, product: product.length, active };
  const slowAudio = gates.shift()!;
  while (gates.length) { gates.shift()!(); await flush(); }
  const productsBeforeLastAudio = product.length;
  slowAudio();
  await flush();
  while (gates.length) { gates.shift()!(); await flush(); }
  const data = await pending;
  assert.deepEqual(initiallyStarted, { audio: 9, product: 3, active: 12 });
  assert.equal(productsBeforeLastAudio, 12, 'products are not held behind the final audio response');
  assert.equal(maximum, 12, 'combined active work retains the previous maximum');
  assert.deepEqual(audio, expectedAudio);
  assert.deepEqual(product, expectedProducts, 'Character Builder quantities and every fixed tool input are preserved');
  assert.equal(active, 0);
  assert.equal(data.audioRows.find((row) => row.id === 'audio-music-only')?.thirtySeconds, '$4.32');
  assert.equal(data.toolRows.find((row) => row.id === 'character-builder-draft')?.proOutput, '4K: $4.32');
  assert.match(data.toolRows.find((row) => row.id === 'video-upscale')!.standardOutput, /\$4\.32.*minimum.*Live quote/i);
});

test('failed and invalid current sources keep truthful localized prices and the next construction retries all inputs', async () => {
  for (const locale of ['en', 'fr', 'es'] as const) for (const mode of ['rejected', 'invalid'] as const) {
    let calls = 0;
    const failed = await buildCurrentOtherPricing(buildPricingHubData(locale).otherSurfaces, locale, {
      audio: async (input) => {
        calls++;
        if (mode === 'rejected') throw new Error('Unavailable audio source');
        return { totalCents: input.durationSec === 30 ? Number.NaN : input.durationSec === 60 ? -1 : 1.5, currency: 'USD' };
      },
      product: async (input) => {
        calls++;
        if (mode === 'rejected') throw new Error('Unavailable product source');
        return { totalCents: input.quantity === 1 ? Number.MAX_SAFE_INTEGER + 1 : 432, currency: input.quantity === 1 ? 'USD' : '' };
      },
    });
    assert.equal(calls, 21);
    for (const row of failed.audioRows) {
      assert.doesNotMatch(`${row.thirtySeconds} ${row.sixtySeconds} ${row.oneTwentySeconds}`, /\d+[.,]\d{2}/);
    }
    for (const row of failed.toolRows) assert.doesNotMatch(`${row.standardOutput} ${row.proOutput}`, /\d+[.,]\d{2}/);
    const recovered = await buildCurrentOtherPricing(buildPricingHubData(locale).otherSurfaces, locale, {
      audio: async () => { calls++; return { totalCents: 432, currency: 'USD' }; },
      product: async () => { calls++; return { totalCents: 543, currency: 'USD' }; },
    });
    assert.equal(calls, 42);
    assert.match(recovered.audioRows.find((row) => row.id === 'audio-music-only')!.thirtySeconds, /4[.,]32/);
    assert.match(recovered.toolRows.find((row) => row.id === 'character-builder-draft')!.proOutput, /5[.,]43/);
  }
});
