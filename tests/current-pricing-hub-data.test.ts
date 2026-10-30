import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCurrentPricingHubData, buildCurrentVideoPricingData } from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/currentPricingHubData';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import type { PublicModelQuoteInput } from '../frontend/lib/pricing-public-model-contract';

test('new models receive current quotes without requiring an old catalogue price', async () => {
  const calls: PublicModelQuoteInput[] = [];
  const data = await buildCurrentVideoPricingData('en', async (input) => {
    calls.push(input);
    return { status: 'exact', amountCents: input.modelId === 'kling-v4' ? 12 : 999,
      currency: 'USD', revision: 'current', scenarioLabel: 'test' };
  });
  for (const id of ['kling-v4', 'flux-3-max', 'minimax-h3', 'seedance-2-5']) {
    assert.ok(calls.some(input => input.modelId === id), `Missing current quote: ${id}`);
    assert.equal(data.video.rows.find(row => row.id === id)?.quotes['entry-route'].status, 'exact');
  }
  assert.ok(data.video.highlights.some(item => item.featured?.engineName === 'Kling 4.0' && item.featured.price === '$0.12'));
  assert.ok(!calls.some(input => input.modelId === 'minimax-h3' && input.resolution === '1080p'), 'Do not invent an unsupported H3 resolution');
});

test('disabled models never enter current pricing rows, requests or cheapest highlights', async () => {
  const calls: string[] = [];
  const data = await buildCurrentVideoPricingData('en', async (input) => {
    calls.push(input.modelId);
    return { status: 'exact', amountCents: input.modelId === 'pika-text-to-video' ? 1 : 123,
      currency: 'USD', revision: 'current', scenarioLabel: 'test' };
  }, async () => [getFalEngineById('kling-v4')!.engine]);
  assert.deepEqual(data.video.rows.map(row => row.id), ['kling-v4']);
  assert.deepEqual([...new Set(calls)], ['kling-v4']);
  assert.doesNotMatch(JSON.stringify(data.video.highlights), /pika/i);
});

test('missing current quotes and failed catalog reads cannot invent a cheapest model', async () => {
  const data = await buildCurrentVideoPricingData('en', async () => ({ status: 'unavailable' }));
  assert.ok(data.video.highlights.every(item => !item.featured));
  await assert.rejects(buildCurrentVideoPricingData('en', async () => ({ status: 'unavailable' }),
    async () => { throw new Error('catalog unavailable'); }), /catalog unavailable/);
});

test('Pricing image rows and popular image check use current customer quotes', async () => {
  const data = await buildCurrentPricingHubData('en', async (input) => ({
    status: 'exact', amountCents: input.mode === 't2i' ? 321 : 654,
    currency: 'USD', revision: 'current', scenarioLabel: 'test',
  }));
  assert.ok(data.otherSurfaces.imageRows.length > 0);
  for (const row of data.otherSurfaces.imageRows) {
    assert.equal(row.standardImage, '$3.21');
    assert.equal(row.highQualityImage, '$3.21');
  }
  assert.equal(data.popularChecks.find((row) => row.id === 'one-image-generation')?.price, '$3.21');
});

test('Pricing suppresses old image amounts when a current quote is unavailable', async () => {
  const data = await buildCurrentPricingHubData('fr', async () => ({ status: 'unavailable' }));
  for (const row of data.otherSurfaces.imageRows) {
    assert.doesNotMatch(row.standardImage, /\d+[.,]\d{2}/);
    assert.doesNotMatch(row.highQualityImage, /\d+[.,]\d{2}/);
  }
});

test('Pricing audio and tools project current server totals, including Character Builder quantities', async () => {
  const requests: Array<{ productKey: string; quantity: number }> = [];
  const data = await buildCurrentPricingHubData('en', async () => ({ status: 'unavailable' }), {
    audio: async () => ({ totalCents: 432, currency: 'USD' }),
    product: async (input) => { requests.push(input); return { totalCents: 543, currency: 'USD' }; },
  });
  for (const row of data.otherSurfaces.audioRows) {
    if (row.id === 'audio-cinematic' || row.id === 'audio-cinematic-voice') {
      assert.doesNotMatch(row.thirtySeconds, /\$4\.32/, 'source-backed packs do not support 30-second jobs');
      assert.match(row.mode, /10 s/);
      continue;
    }
    assert.equal(row.thirtySeconds, '$4.32');
    assert.equal(row.sixtySeconds, '$4.32');
    assert.equal(row.oneTwentySeconds, '$4.32');
  }
  assert.match(data.otherSurfaces.toolRows.find((row) => row.id === 'character-builder-draft')!.standardOutput, /\$5\.43/);
  assert.ok(requests.some((input) => input.productKey === 'character-draft' && input.quantity === 3));
  assert.ok(requests.some((input) => input.productKey === 'character-final' && input.quantity === 2));
  assert.match(data.otherSurfaces.toolRows.find((row) => row.id === 'video-upscale')!.standardOutput, /minimum/i);
});

test('Pricing never retains literal audio or tool prices when their effective sources are unavailable', async () => {
  const unavailable = async () => { throw new Error('database unavailable'); };
  const data = await buildCurrentPricingHubData('fr', async () => ({ status: 'unavailable' }), {
    audio: unavailable, product: unavailable,
  });
  for (const row of data.otherSurfaces.audioRows) assert.doesNotMatch(row.thirtySeconds, /\d+[.,]\d{2}/);
  for (const row of data.otherSurfaces.toolRows) {
    assert.doesNotMatch(row.standardOutput, /\d+[.,]\d{2}/);
    assert.doesNotMatch(row.proOutput, /\d+[.,]\d{2}/);
  }
});

test('current video quote notes describe the submitted audio setting, including toggles without a price discount', async () => {
  for (const [locale, audioOff] of [['en', 'Audio off'], ['fr', 'Audio désactivé'], ['es', 'Audio desactivado']] as const) {
    const inputs: Array<{ modelId: string; audio?: boolean }> = [];
    const data = await buildCurrentPricingHubData(locale, async (input) => {
      inputs.push(input);
      return { status: 'exact', amountCents: 156, currency: 'USD', revision: 'current', scenarioLabel: 'test' };
    });
    const ltx = data.video.rows.find(row => row.id === 'ltx-2-5-pro')!;
    assert.ok(inputs.some(input => input.modelId === ltx.id && input.audio === false));
    assert.equal(ltx.quotes['10s-720p'].note, audioOff);
    assert.equal(ltx.quotes['5s-720p'].status, 'unsupported');
    const fixedAudio = data.video.rows.find(row => row.id === 'kling-3-turbo-pro')!;
    assert.ok(inputs.filter(input => input.modelId === fixedAudio.id).every(input => input.audio === undefined));
    assert.match(fixedAudio.quotes['8s-1080p'].note ?? '', /audio incl/);
  }
});

test('configured duration limits constrain quote requests and ranking even with older static mode options', async () => {
  const {projectConfiguredEngine}=await import('../frontend/src/server/engine-configuration-projection');
  const base=getFalEngineById('veo-3-1')!.engine;
  const configured=projectConfiguredEngine(base,new Map([[base.id,{engine_id:base.id,options:{maxDurationSec:4},pricing:base.pricingDetails??null,updated_by:'admin',updated_at:''}]]),new Map()).engine;
  const calls:PublicModelQuoteInput[]=[];
  const data=await buildCurrentVideoPricingData('en',async input=>{calls.push(input);return {status:'exact',amountCents:1,currency:'USD',revision:'configured',scenarioLabel:'test'};},async()=>[configured]);
  assert.ok(calls.length>0);
  assert.ok(calls.every(input=>input.durationSec<=4),JSON.stringify(calls));
  const row=data.video.rows[0];
  assert.equal(row.quotes['8s-1080p'].status,'unsupported');
  assert.notEqual(row.quotes['8s-1080p'].isCheapest,true);
  assert.ok(data.video.highlights.filter(item=>item.featured).every(item=>!JSON.stringify(item.featured).includes('8s')));
});

test('pricing uses the selected mode duration choices, without borrowing from another mode',async()=>{
  const base=getFalEngineById('veo-3-1')!.engine;
  const configured={...base,modes:['t2v' as const],modeCaps:{...base.modeCaps,t2v:{modes:['t2v' as const],duration:{options:[4],default:4}}}};
  const calls:PublicModelQuoteInput[]=[];
  await buildCurrentVideoPricingData('en',async input=>{calls.push(input);return {status:'unavailable'};},async()=>[configured]);
  assert.ok(calls.length>0);assert.ok(calls.every(input=>input.durationSec===4),JSON.stringify(calls));
});
