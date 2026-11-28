import assert from 'node:assert/strict';
import test from 'node:test';
import { quoteComparisonRequest, type ComparisonRequest } from '../frontend/app/(core)/admin/routing/_lib/comparison-offers';
import type { CatalogueCard } from '../frontend/app/(core)/admin/routing/_lib/catalogue/types';
import { offerAccessLabel } from '../frontend/app/(core)/admin/routing/_lib/route-playback';
import { routingScenarios } from '../frontend/app/(core)/admin/routing/_lib/routing-scenarios';
import { rankQuotedOffers } from '../frontend/src/lib/video-purchase-decision';
import { planVideoPurchase, planWanPrimePurchase } from '../frontend/src/server/video-providers/purchase-router';

const textClip: ComparisonRequest = {
  engineId: 'wan-3-prime', mode: 't2v', durationSec: 15, resolution: '480p', aspectRatio: '16:9',
  audioEnabled: true, images: 0, hasVideo: false, hasEndFrame: false, inputVideoSeconds: 0,
  hasAudioReference: false, hasDocument: false,
};
function candidate(provider: string, request: ComparisonRequest) {
  const row = quoteComparisonRequest(request)?.candidates.find(item => item.provider === provider);
  assert.ok(row);
  return row;
}

test('new suppliers are simulated separately from the canary and historical purchase policies', () => {
  for (const [id, provider, micros] of [
    ['text', 'wavespeed', 1_012_500], ['reference', 'wavespeed', 540_000],
    ['standard-reference', 'wavespeed', 1_350_000], ['standard-image', 'wavespeed', 450_000],
    ['standard-source', 'wavespeed', 900_000], ['video', 'wavespeed', 1_350_000],
    ['h3-2k', 'apimart', 457_200], ['h3-six-images', 'apimart', 594_080],
    ['h3-max-text', 'apimart', 285_600], ['h3-max-frame', 'apimart', 1_280_000],
  ] as const) {
    const scenario = routingScenarios().find(item => item.id === id);
    assert.ok(scenario);
    const row = scenario.candidates.find(item => item.provider === provider);
    assert.equal(row?.simulationOnly, true);
    assert.equal(row?.costMicros, micros);
    assert.equal(row?.excluded, null);
    assert.match(row?.sourceUrl ?? '', /^https:\/\/(apimart\.ai|wavespeed\.ai)\/model/);
  }
  const planner = planWanPrimePurchase(textClip);
  assert.deepEqual(planner.candidates.map(r => r.provider).sort(), ['alibaba_model_studio', 'apimart', 'fal']);
  const simulated = quoteComparisonRequest(textClip)!;
  const primeOffer = candidate('apimart', textClip);
  assert.equal(primeOffer.sourceUrl, 'https://apimart.ai/model/wan-3-0-prime');
  assert.equal(primeOffer.simulationOnly, undefined);
  assert.equal(candidate('apimart', { ...textClip, engineId: 'wan-3' }).simulationOnly, true);
  assert.deepEqual(rankQuotedOffers(simulated.candidates, { ceilingMicros: simulated.baselineMicros, unavailable: { apimart: 'not configured' } }).order,
    ['wavespeed', 'alibaba_model_studio', 'fal']);
  assert.deepEqual(planWanPrimePurchase(textClip, {unavailable: {apimart: 'not configured'}}).order, ['alibaba_model_studio', 'fal']);
  assert.deepEqual(planVideoPurchase({...textClip, engineId: 'minimax-h3', resolution: '2K'})?.order, ['fal']);
  assert.equal(planVideoPurchase({...textClip, engineId: 'minimax-h3-max'}), null);
});

test('WaveSpeed ref2v verifies each video, rounds their combined duration once and preserves media roles', () => {
  const ref: ComparisonRequest = { ...textClip, mode: 'ref2v', durationSec: 5, resolution: '720p',
    hasVideo: true, inputVideoSeconds: 2.5, referenceVideoSeconds: [1.1, 1.4] };
  // Two input clips together bill as 3 source seconds and 5 output seconds.
  assert.equal(candidate('wavespeed', ref).costMicros, 1_080_000);
  for (const input of [
    { referenceVideoSeconds: undefined }, {referenceVideoSeconds: [0.5, 2]}, {referenceVideoSeconds: [2.4]},
    {referenceVideoSeconds: [16], inputVideoSeconds: 16}, {referenceVideoSeconds: [5, 5, 6], inputVideoSeconds: 16},
    {referenceVideoSeconds: [1, 1, 1, 1, 1, 1], inputVideoSeconds: 6}, { durationSec: 29 },
    { referenceVideoSeconds: [NaN] }, { mode: 'extend' }, {mode: 'v2v'}, {mode: 'i2v'}, { hasStartFrame: true },
    { hasAudioReference: true }, { hasUnpricedOptions: true }, { hasDocument: true }, { aspectRatio: '21:9' }, { images: 11 },
  ]) {
    const row = candidate('wavespeed', { ...ref, ...input });
    assert.equal(row.costMicros, null);
    assert.ok(row.excluded);
  }
  assert.ok(candidate('wavespeed', {...textClip, aspectRatio: 'auto'}).excluded);
  assert.equal(candidate('wavespeed', {...textClip, mode: 'i2v', hasStartFrame: true, hasEndFrame: true, images: 1, aspectRatio: 'auto'}).excluded, null);
  assert.ok(candidate('wavespeed', {...textClip, mode: 'ref2v', images: 1, hasStartFrame: true}).excluded);
});

test('MiniMax comparisons keep editions, billable references, native frame ratios and supported options distinct', () => {
  const h3 = { ...textClip, engineId: 'minimax-h3', resolution: '768P', promptCharacters: 200, h3PromptExpansion: 'disabled' };
  const max = { ...h3, engineId: 'minimax-h3-max' };
  for (const request of [
    {...h3, resolution: '480p'}, {...h3, resolution: '4K'}, {...max, resolution: '2K'}, {...max, mode: 'i2v', hasStartFrame: true, images: 1},
    {...h3, audioEnabled: false}, {...h3, h3PromptExpansion: 'balanced'}, {...h3, h3PromptExpansion: undefined},
    {...h3, promptCharacters: 7001}, {...h3, promptCharacters: undefined}, {...h3, mode: 'ref2v', images: 10},
  ]) assert.ok(candidate('apimart', request).excluded);
  assert.equal(candidate('apimart', {...max, mode: 'i2v', hasStartFrame: true, images: 1, aspectRatio: null}).excluded, null);
  assert.equal(candidate('fal', {...max, durationSec: 5, resolution: '480p'}).costMicros, 250_000);
  assert.ok(candidate('fal', {...max, mode: 'ref2v', images: 3}).excluded);
});

test('registering a supplier card qualifies only its declared engines in the admin', () => {
  // Reuse a known supplier identity to model a new negotiated H3 Max offer.
  const card: CatalogueCard = {
    provider: 'wavespeed', engines: ['minimax-h3-max'],
    quote: r => ({
      tariff: 'Contract fixture', sourceUrl: 'https://example.test/contract',
      costMicros: r.mode === 't2v' ? r.durationSec * 1000 : null,
      excluded: r.mode === 't2v' ? null : 'Text only',
    }),
  };
  const request = { ...textClip, engineId: 'minimax-h3-max', durationSec: 5, resolution: '480p' };
  const simulate = (r: ComparisonRequest, cards = [card]) => {
    const quote = quoteComparisonRequest(r, cards)!;
    return rankQuotedOffers(quote.candidates, {ceilingMicros: quote.baselineMicros});
  };
  const winner = simulate(request);
  assert.deepEqual(winner.order, ['wavespeed', 'fal']);
  const offer = winner.candidates.find(r => r.provider === 'wavespeed')!;
  assert.equal(offer.costMicros, 5000);
  assert.match(offerAccessLabel(offer, true), /simulation only/);
  assert.equal(simulate(request, [card, card]).order.includes('wavespeed'), false);
  assert.equal(simulate({ ...request, mode: 'i2v', hasStartFrame: true, aspectRatio: null, images: 1 }).order.includes('wavespeed'), false);
  assert.equal(simulate(textClip).candidates.some(r => r.provider === 'wavespeed'), false);
  assert.equal(planVideoPurchase(request), null);
  assert.match(offerAccessLabel(candidate('apimart', textClip), false), /admin pilot/);
});
